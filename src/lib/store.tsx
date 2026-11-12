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
  DEFAULT_PROFILE,
  energyPlan,
  type Prefs,
  type Profile,
} from './profile';

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

export type UserMeta = { email: string; createdAt: number; lastActiveAt: number };

// Accounts live in Neon Auth (proxied at /api/auth/*). This device keeps a cache of the signed-in user's data so
// the app opens instantly and keeps working offline; changes sync back in the background.
const SESSION_KEY = 'healthos:session';
const USERS_KEY = 'healthos:users';
const cacheKey = (email: string) => `healthos:cache:${email}`;

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

type Account = { email: string; data: Data };

/** Whether this device's changes have reached the server. */
export type SyncStatus = 'saved' | 'pending' | 'saving' | 'offline' | 'error';

type Store = {
  ready: boolean;
  email: string | null;
  syncStatus: SyncStatus;
  users: UserMeta[];
  data: Data;
  /** Throws an `ApiError` with a user-facing message on failure. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Resolves to 'verify' when the account must confirm its email (with a code) before signing in. */
  signUp: (email: string, password: string) => Promise<'signedIn' | 'verify'>;
  /** Emails a fresh 6-digit verification code. */
  sendVerificationCode: (email: string) => Promise<void>;
  /** Confirms the emailed code, then signs in (with the password if the server didn't already). */
  verifyEmail: (email: string, code: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Ends every session for this account, on all devices, then signs out here. */
  signOutEverywhere: () => Promise<void>;
  forgetUser: (email: string) => Promise<void>;
  /** Permanently deletes the account and all its data. Throws an `ApiError` (e.g. wrong password). */
  deleteAccount: (password: string) => Promise<void>;
  /** The server's copy of the signed-in user's data, for download. */
  exportData: () => Promise<{ exportedAt: string; email: string; data: Partial<Data> | null }>;
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
  // Email and data change together so a write can never land under the wrong user's key.
  const [account, setAccount] = useState<Account | null>(null);
  const [users, setUsers] = useState<UserMeta[]>([]);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');

  // Sync bookkeeping lives in refs: it changes on every save and nothing renders from it.
  const accountRef = useRef<Account | null>(null);
  const sync = useRef<Sync>(FRESH);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushing = useRef(false);

  const persist = (a: Account) =>
    AsyncStorage.setItem(cacheKey(a.email), JSON.stringify({ data: a.data, sync: sync.current } satisfies Cache)).catch(
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
    setSyncStatus('saved');
  };

  /** Saves local changes; on a version conflict merges with the server copy and tries again. */
  const push = async (): Promise<void> => {
    const a = accountRef.current;
    if (!a || !sync.current.dirty || pushing.current) return;
    pushing.current = true;
    setSyncStatus('saving');
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
      setSyncStatus(sync.current.dirty ? 'pending' : 'saved');
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1;
      if (status === 401) clearSession();
      else if (status !== 409) {
        setSyncStatus(status === 0 ? 'offline' : 'error');
        console.error('HealthOS sync failed', e);
      }
      // Offline or a server error: stay dirty and retry on the next change, focus or reconnect.
      if (status !== 409) return;
      // Another device saved first: fold its copy in, then save the result on top of its version.
      const server = (e as ApiError).body as { data: Partial<Data> | null; version: number };
      const current = accountRef.current;
      if (current?.email !== a.email) return;
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
  const pull = async (email: string) => {
    const server = await api<{ data: Partial<Data> | null; version: number }>('/api/data');
    const current = accountRef.current;
    if (current?.email !== email) return;
    const serverData = hydrate(server.data);
    const data = sync.current.dirty ? merge(current.data, serverData, new Set(sync.current.removed)) : serverData;
    sync.current = { ...sync.current, version: server.version };
    show({ email, data });
    if (sync.current.dirty) await push();
  };

  /**
   * Opens a signed-in user from this device's cache, then refreshes from the server. With
   * `wait: false` a cached copy is shown at once and the refresh finishes in the background,
   * so a slow or sleeping server never holds up opening the app.
   */
  const open = async (email: string, { wait = true } = {}) => {
    const cached = await readJSON<Cache | null>(cacheKey(email), null);
    sync.current = cached?.sync ?? FRESH;
    setSyncStatus(sync.current.dirty ? 'pending' : 'saved');
    show({ email, data: hydrate(cached?.data ?? null) });
    await AsyncStorage.setItem(SESSION_KEY, email).catch(() => {});

    const now = Date.now();
    setUsers((list) => {
      const meta = list.find((u) => u.email === email);
      const next = [
        meta ? { ...meta, lastActiveAt: now } : { email, createdAt: now, lastActiveAt: now },
        ...list.filter((u) => u.email !== email),
      ];
      AsyncStorage.setItem(USERS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

    const refreshed = pull(email).catch((e) => {
      if (e instanceof ApiError && e.status === 401) clearSession();
      else if (e instanceof ApiError && e.status === 0) setSyncStatus('offline');
    });
    if (wait || !cached) await refreshed;
  };

  type AuthResponse = { user: { email: string } };

  const signIn = async (raw: string, password: string) => {
    const { user } = await api<AuthResponse>('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email: raw, password },
    });
    await open(user.email);
  };

  const hasSession = async () => !!(await api<{ session?: unknown } | null>('/api/auth/get-session'))?.session;

  const signUp = async (raw: string, password: string): Promise<'signedIn' | 'verify'> => {
    const { user } = await api<AuthResponse>('/api/auth/sign-up/email', {
      method: 'POST',
      body: { email: raw, password, name: raw.split('@')[0] },
    });
    // A fresh account: don't carry over anything a previous account with this email left on the device.
    await AsyncStorage.removeItem(cacheKey(user.email)).catch(() => {});
    // With email verification on, sign-up creates the account but no session until the code is entered.
    if (!(await hasSession())) return 'verify';
    await open(user.email);
    return 'signedIn';
  };

  const sendVerificationCode = async (email: string) => {
    await api('/api/auth/email-otp/send-verification-otp', { method: 'POST', body: { email, type: 'email-verification' } });
  };

  const verifyEmail = async (email: string, code: string, password: string) => {
    await api('/api/auth/email-otp/verify-email', { method: 'POST', body: { email, otp: code.trim() } });
    if (await hasSession()) await open(email);
    else await signIn(email, password);
  };

  useEffect(() => {
    (async () => {
      // Entries saved before accounts moved to email have no `email`; drop them.
      setUsers((await readJSON<UserMeta[]>(USERS_KEY, [])).filter((u) => u.email));
      const session = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);
      // An expired session is detected by the first server call, which then signs out.
      if (session) await open(session, { wait: false });
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
    setSyncStatus('pending');
    schedulePush();
  };

  const store: Store = {
    ready,
    email: account?.email ?? null,
    syncStatus,
    users,
    data: account?.data ?? EMPTY,
    signIn,
    signUp,
    sendVerificationCode,
    verifyEmail,
    signOut: async () => {
      const a = accountRef.current;
      await push().catch(() => {});
      await api('/api/auth/sign-out', { method: 'POST', body: {} }).catch(() => {});
      if (a) await AsyncStorage.removeItem(cacheKey(a.email)).catch(() => {});
      clearSession();
    },
    signOutEverywhere: async () => {
      const a = accountRef.current;
      await push().catch(() => {});
      // Unlike sign-out, a failure here must surface: the user is relying on other devices losing access.
      await api('/api/auth/revoke-sessions', { method: 'POST', body: {} });
      if (a) await AsyncStorage.removeItem(cacheKey(a.email)).catch(() => {});
      clearSession();
    },
    deleteAccount: async (password) => {
      const a = accountRef.current;
      await api('/api/account', { method: 'DELETE', body: { password } });
      if (a) await store.forgetUser(a.email);
      clearSession();
    },
    exportData: async () => {
      const a = accountRef.current;
      if (!a) throw new ApiError('Not signed in', 401);
      // Save anything pending first so the download matches what's on screen.
      await push().catch(() => {});
      const { data } = await api<{ data: Partial<Data> | null }>('/api/data');
      return { exportedAt: new Date().toISOString(), email: a.email, data };
    },
    forgetUser: async (email) => {
      await AsyncStorage.removeItem(cacheKey(email)).catch(() => {});
      setUsers((list) => {
        const next = list.filter((u) => u.email !== email);
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
