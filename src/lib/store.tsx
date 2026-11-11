import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, use, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { api, ApiError } from './api';
import { addDays, type DateKey, todayKey } from './dates';
import type { Tag } from './foods';
import { type LearnedPlan, planFromProposal, type Proposal } from './learn';
import { type DayType, DAY_WEIGHT, type PlannerSettings } from './planner';
import {
  type Allowance,
  dailyBounds,
  DEFAULT_PREFS,
  DEFAULT_PROFILE,
  energyPlan,
  type Prefs,
  type Profile,
} from './profile';
import { DEV_PASSWORD, DEV_USER, normalizeUsername } from './username';

export { normalizeUsername };

export type Entry = {
  id: string;
  date: DateKey;
  name: string;
  detail?: string;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  /** Macros were not given for a manual entry and are assumed from a typical mixed split. */
  macrosEstimated?: boolean;
  foodKey?: string;
  tags?: Tag[];
  source: 'estimate' | 'manual';
  createdAt: number;
};

export type Settings = PlannerSettings & { weekStartsOn: 0 | 1 };

export type WeighIn = { date: DateKey; kg: number };

export type Data = {
  version: 3;
  profile: Profile | null;
  prefs: Prefs | null;
  settings: Settings;
  entries: Entry[];
  closedDays: DateKey[];
  dayOverrides: Record<DateKey, DayType>;
  weighIns: WeighIn[];
  /** When the learning period began (first profile save). */
  calibrationStart: DateKey | null;
  /** The plan derived from the user's own logs, once they've accepted a proposal. */
  learned: LearnedPlan | null;
  proposalSnoozedUntil: DateKey | null;
};

export type UserMeta = { username: string; createdAt: number; lastActiveAt: number };

// Accounts live in Neon (see src/app/api). This device keeps a cache of the signed-in user's data so
// the app opens instantly and keeps working offline; changes sync back in the background.
const SESSION_KEY = 'healthos:session';
const USERS_KEY = 'healthos:users';
const cacheKey = (username: string) => `healthos:cache:${username}`;

/** Wait this long after the last change before saving to the server. */
const SYNC_DELAY_MS = 1000;

export const DEFAULT_SETTINGS: Settings = {
  weeklyGoal: 14000,
  minDaily: 1200,
  maxDaily: 3500,
  weekStartsOn: 1,
  // Flat until the user's own weekday pattern has been learned.
  dayWeights: [1, 1, 1, 1, 1, 1, 1],
  correction: 'balanced',
};

const EMPTY: Data = {
  version: 3,
  profile: null,
  prefs: null,
  settings: DEFAULT_SETTINGS,
  entries: [],
  closedDays: [],
  dayOverrides: {},
  weighIns: [],
  calibrationStart: null,
  learned: null,
  proposalSnoozedUntil: null,
};

/** Weekly goal and daily bounds for a profile, honouring a learned plan's current step if there is one. */
function targetSettings(profile: Profile, learned: LearnedPlan | null) {
  const target = learned?.dailyTarget ?? energyPlan(profile).target;
  return { weeklyGoal: target * 7, ...dailyBounds(profile, target) };
}

/** Saves a profile and re-aims the targets at it. Goal changes keep a learned maintenance. */
function withProfile(d: Data, profile: Profile, prefs: Prefs): Data {
  const learned = d.learned ? { ...d.learned, dailyTarget: energyPlan(profile, d.learned.maintenance).target } : null;
  return {
    ...d,
    profile,
    prefs,
    learned,
    calibrationStart: d.calibrationStart ?? todayKey(),
    settings: { ...d.settings, ...targetSettings(profile, learned) },
  };
}

type LegacySettings = Partial<Settings> & { dayTypes?: DayType[]; flexWeight?: number };

function hydrate(saved: Partial<Data> | null): Data {
  if (!saved) return EMPTY;
  const old = (saved.settings ?? {}) as LegacySettings;
  // Earlier versions stored fixed day types instead of weights.
  const dayWeights =
    old.dayWeights ?? old.dayTypes?.map((t) => (t === 'flex' ? (old.flexWeight ?? DAY_WEIGHT.flex) : DAY_WEIGHT[t]));
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ...old,
    dayWeights: dayWeights ?? DEFAULT_SETTINGS.dayWeights,
    correction: old.correction ?? 'balanced',
  };
  const profile = saved.profile ? { ...DEFAULT_PROFILE, ...saved.profile } : null;
  return { ...EMPTY, ...saved, version: 3, profile, settings };
}

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** What this device knows about the signed-in user's data, relative to the server copy. */
type Sync = {
  /** Server version the local data was last based on. */
  version: number;
  /** Local changes not yet saved to the server. */
  dirty: boolean;
  /** `entry:<id>` / `weigh:<date>` removed locally since the last save, so a merge doesn't bring them back. */
  removed: string[];
};

type Cache = { data: Partial<Data>; sync: Sync };

const FRESH: Sync = { version: 0, dirty: false, removed: [] };

/**
 * Combines a local copy that has unsaved changes with a newer server copy. Entries and weigh-ins
 * from both survive (unless removed here); for everything else this device's version wins.
 */
function merge(local: Data, server: Data, removed: Set<string>): Data {
  const ids = new Set(local.entries.map((e) => e.id));
  const dates = new Set(local.weighIns.map((w) => w.date));
  return {
    ...local,
    entries: [...local.entries, ...server.entries.filter((e) => !ids.has(e.id) && !removed.has(`entry:${e.id}`))],
    weighIns: [...local.weighIns, ...server.weighIns.filter((w) => !dates.has(w.date) && !removed.has(`weigh:${w.date}`))].sort(
      (a, b) => a.date.localeCompare(b.date),
    ),
  };
}

type Account = { username: string; data: Data };

type Store = {
  ready: boolean;
  username: string | null;
  users: UserMeta[];
  data: Data;
  /** Throws an `ApiError` with a user-facing message on failure. */
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgetUser: (username: string) => Promise<void>;
  saveProfile: (profile: Profile, prefs: Prefs) => void;
  updatePrefs: (patch: Partial<Prefs>) => void;
  addWeighIn: (date: DateKey, kg: number) => void;
  removeWeighIn: (date: DateKey) => void;
  applyProposal: (proposal: Proposal, treats: Allowance[]) => void;
  snoozeProposal: (days: number) => void;
  addEntry: (entry: Omit<Entry, 'id' | 'createdAt'>) => void;
  removeEntry: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setDayClosed: (date: DateKey, closed: boolean) => void;
  setDayType: (date: DateKey, type: DayType | null) => void;
  resetAll: () => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // Username and data change together so a write can never land under the wrong user's key.
  const [account, setAccount] = useState<Account | null>(null);
  const [users, setUsers] = useState<UserMeta[]>([]);
  const [ready, setReady] = useState(false);

  // Sync bookkeeping lives in refs: it changes on every save and nothing renders from it.
  const accountRef = useRef<Account | null>(null);
  const sync = useRef<Sync>(FRESH);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushing = useRef(false);

  const persist = (a: Account) =>
    AsyncStorage.setItem(cacheKey(a.username), JSON.stringify({ data: a.data, sync: sync.current } satisfies Cache)).catch(
      () => {},
    );

  const show = (a: Account | null) => {
    accountRef.current = a;
    setAccount(a);
    if (a) persist(a);
  };

  const clearSession = () => {
    if (timer.current) clearTimeout(timer.current);
    accountRef.current = null;
    sync.current = FRESH;
    AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    setAccount(null);
  };

  /** Saves local changes; on a version conflict merges with the server copy and tries again. */
  const push = async (): Promise<void> => {
    const a = accountRef.current;
    if (!a || !sync.current.dirty || pushing.current) return;
    pushing.current = true;
    const sent = a.data;
    try {
      const { version } = await api<{ version: number }>('/api/data', {
        method: 'PUT',
        body: { data: sent, baseVersion: sync.current.version },
      });
      // Anything changed while the request was in flight still needs saving.
      const unchanged = accountRef.current?.data === sent;
      sync.current = unchanged ? { ...FRESH, version } : { ...sync.current, version };
      if (accountRef.current) persist(accountRef.current);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1;
      if (status === 401) clearSession();
      // Offline or a server error: stay dirty and retry on the next change, focus or reconnect.
      if (status !== 409) return;
      // Another device saved first: fold its copy in, then save the result on top of its version.
      const server = (e as ApiError).body as { data: Partial<Data> | null; version: number };
      const current = accountRef.current;
      if (current?.username !== a.username) return;
      sync.current = { ...sync.current, version: server.version };
      show({ ...current, data: merge(current.data, hydrate(server.data), new Set(sync.current.removed)) });
    } finally {
      pushing.current = false;
    }
    if (sync.current.dirty) await push();
  };

  const schedulePush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void push(), SYNC_DELAY_MS);
  };

  /** Brings in the server copy. Unsaved local changes are merged rather than overwritten. */
  const pull = async (username: string) => {
    const server = await api<{ data: Partial<Data> | null; version: number }>('/api/data');
    const current = accountRef.current;
    if (current?.username !== username) return;
    const serverData = hydrate(server.data);
    const data = sync.current.dirty ? merge(current.data, serverData, new Set(sync.current.removed)) : serverData;
    sync.current = { ...sync.current, version: server.version };
    show({ username, data });
    if (sync.current.dirty) await push();
  };

  /** Opens a signed-in user from this device's cache, then refreshes from the server. */
  const open = async (username: string, seed?: (d: Data) => Data) => {
    const cached = await readJSON<Cache | null>(cacheKey(username), null);
    sync.current = cached?.sync ?? FRESH;
    show({ username, data: hydrate(cached?.data ?? null) });
    await AsyncStorage.setItem(SESSION_KEY, username).catch(() => {});

    const now = Date.now();
    setUsers((list) => {
      const meta = list.find((u) => u.username === username);
      const next = [
        meta ? { ...meta, lastActiveAt: now } : { username, createdAt: now, lastActiveAt: now },
        ...list.filter((u) => u.username !== username),
      ];
      AsyncStorage.setItem(USERS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

    await pull(username).catch((e) => {
      if (e instanceof ApiError && e.status === 401) clearSession();
    });
    if (seed && accountRef.current?.username === username) {
      const seeded = seed(accountRef.current.data);
      if (seeded !== accountRef.current.data) {
        sync.current = { ...sync.current, dirty: true };
        show({ username, data: seeded });
        schedulePush();
      }
    }
  };

  const signIn = async (raw: string, password: string) => {
    const { username } = await api<{ username: string }>('/api/auth/login', {
      method: 'POST',
      body: { username: raw, password },
    });
    await open(username);
  };

  const signUp = async (raw: string, password: string) => {
    const { username } = await api<{ username: string }>('/api/auth/signup', {
      method: 'POST',
      body: { username: raw, password },
    });
    // A fresh account: don't carry over anything an old local-only profile left under this name.
    await AsyncStorage.removeItem(cacheKey(username)).catch(() => {});
    await open(username);
  };

  useEffect(() => {
    (async () => {
      setUsers(await readJSON<UserMeta[]>(USERS_KEY, []));
      const session = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);
      if (session) {
        await open(session);
      } else if (__DEV__) {
        // Skip login and onboarding while developing.
        const seed = (d: Data) => (d.profile ? d : withProfile(d, DEFAULT_PROFILE, DEFAULT_PREFS));
        const login = { method: 'POST', body: { username: DEV_USER, password: DEV_PASSWORD } };
        await api('/api/auth/login', login).catch(async (e) => {
          if (e instanceof ApiError && e.status === 401) await api('/api/auth/signup', login);
          else throw e;
        });
        await open(DEV_USER, seed);
      }
    })()
      .catch(() => {})
      .finally(() => setReady(true));

    // Save anything pending when the app comes back to the foreground or the network returns.
    const appState = AppState.addEventListener('change', (s) => s === 'active' && void push());
    const online = () => void push();
    if (typeof window !== 'undefined' && 'addEventListener' in window) window.addEventListener('online', online);
    return () => {
      appState.remove();
      if (typeof window !== 'undefined' && 'removeEventListener' in window) window.removeEventListener('online', online);
    };
    // Runs once on mount; the handlers read live state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (f: (d: Data) => Data, removed?: string) => {
    const a = accountRef.current;
    if (!a) return;
    sync.current = {
      ...sync.current,
      dirty: true,
      removed: removed ? [...sync.current.removed, removed] : sync.current.removed,
    };
    show({ ...a, data: f(a.data) });
    schedulePush();
  };

  const store: Store = {
    ready,
    username: account?.username ?? null,
    users,
    data: account?.data ?? EMPTY,
    signIn,
    signUp,
    signOut: async () => {
      const a = accountRef.current;
      await push().catch(() => {});
      await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
      if (a) await AsyncStorage.removeItem(cacheKey(a.username)).catch(() => {});
      clearSession();
    },
    forgetUser: async (username) => {
      await AsyncStorage.removeItem(cacheKey(username)).catch(() => {});
      setUsers((list) => {
        const next = list.filter((u) => u.username !== username);
        AsyncStorage.setItem(USERS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    saveProfile: (profile, prefs) => update((d) => withProfile(d, profile, prefs)),
    updatePrefs: (patch) => update((d) => (d.prefs ? { ...d, prefs: { ...d.prefs, ...patch } } : d)),
    addWeighIn: (date, kg) =>
      update((d) => {
        const weighIns = [...d.weighIns.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date));
        const latest = weighIns[weighIns.length - 1];
        return { ...d, weighIns, profile: d.profile ? { ...d.profile, weightKg: latest.kg } : d.profile };
      }),
    removeWeighIn: (date) =>
      update((d) => ({ ...d, weighIns: d.weighIns.filter((w) => w.date !== date) }), `weigh:${date}`),
    applyProposal: (proposal, treats) =>
      update((d) => {
        if (!d.profile) return d;
        const learned = planFromProposal(proposal, todayKey());
        const prefs = d.prefs ? { ...d.prefs, allowances: [...d.prefs.allowances, ...treats] } : d.prefs;
        return {
          ...d,
          learned,
          prefs,
          proposalSnoozedUntil: null,
          settings: { ...d.settings, ...targetSettings(d.profile, learned), dayWeights: learned.dayWeights },
        };
      }),
    snoozeProposal: (days) => update((d) => ({ ...d, proposalSnoozedUntil: addDays(todayKey(), days) })),
    addEntry: (entry) =>
      update((d) => ({
        ...d,
        entries: [
          ...d.entries,
          { ...entry, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, createdAt: Date.now() },
        ],
      })),
    removeEntry: (id) => update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }), `entry:${id}`),
    updateSettings: (patch) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
    setDayClosed: (date, closed) =>
      update((d) => ({
        ...d,
        closedDays: closed ? [...new Set([...d.closedDays, date])] : d.closedDays.filter((x) => x !== date),
      })),
    setDayType: (date, type) =>
      update((d) => {
        const dayOverrides = { ...d.dayOverrides };
        if (type) dayOverrides[date] = type;
        else delete dayOverrides[date];
        return { ...d, dayOverrides };
      }),
    // Clears the log and everything learned but keeps the profile, so learning starts over from today.
    resetAll: () =>
      update((d) => ({
        ...EMPTY,
        profile: d.profile,
        prefs: d.prefs,
        calibrationStart: todayKey(),
        settings: d.profile ? { ...DEFAULT_SETTINGS, ...targetSettings(d.profile, null) } : DEFAULT_SETTINGS,
      })),
  };

  return <StoreContext value={store}>{children}</StoreContext>;
}

export function useStore(): Store {
  const store = use(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
