import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';

import { addDays, type DateKey, todayKey } from './dates';
import type { Tag } from './foods';
import { type LearnedPlan, planFromProposal, type Proposal } from './learn';
import type { Meal } from './macros';
import { type DayType, DAY_WEIGHT, type PlannerSettings } from './planner';
import { type Allowance, dailyBounds, DEFAULT_PROFILE, energyPlan, type Prefs, type Profile } from './profile';

export type { Meal };

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
  meal: Meal;
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

// Everything lives in this device's storage (localStorage on web): one key per user.
const SESSION_KEY = 'healthos:session';
const USERS_KEY = 'healthos:users';
const LEGACY_KEY = 'healthos:v1';
const userKey = (username: string) => `healthos:user:${username}`;

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

/** Lowercase, 2–24 chars of letters, digits, dot, dash or underscore. */
export function normalizeUsername(raw: string): string | null {
  const name = raw.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._-]{2,24}$/.test(name) ? name : null;
}

type LegacySettings = Partial<Settings> & { dayTypes?: DayType[]; flexWeight?: number };

function hydrate(raw: string | null): Data {
  if (!raw) return EMPTY;
  const saved = JSON.parse(raw) as Partial<Data>;
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

type Account = { username: string; data: Data };

type Store = {
  ready: boolean;
  username: string | null;
  users: UserMeta[];
  data: Data;
  signIn: (username: string) => Promise<void>;
  signOut: () => void;
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

  useEffect(() => {
    (async () => {
      const list = await readJSON<UserMeta[]>(USERS_KEY, []);
      setUsers(list);
      const session = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);
      if (session && list.some((u) => u.username === session)) {
        const raw = await AsyncStorage.getItem(userKey(session)).catch(() => null);
        setAccount({ username: session, data: hydrate(raw) });
      }
    })()
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (account) AsyncStorage.setItem(userKey(account.username), JSON.stringify(account.data)).catch(() => {});
  }, [account]);

  const saveUsers = (next: UserMeta[]) => {
    setUsers(next);
    AsyncStorage.setItem(USERS_KEY, JSON.stringify(next)).catch(() => {});
  };

  const update = (f: (d: Data) => Data) => setAccount((a) => (a ? { ...a, data: f(a.data) } : a));

  const signIn = async (raw: string) => {
    const username = normalizeUsername(raw);
    if (!username) throw new Error('Invalid username');
    const existing = await AsyncStorage.getItem(userKey(username)).catch(() => null);
    let data = hydrate(existing);
    if (!existing) {
      // Carry over entries from the single-user version of the app into the first profile.
      const legacy = await AsyncStorage.getItem(LEGACY_KEY).catch(() => null);
      if (legacy && users.length === 0) {
        const old = hydrate(legacy);
        data = { ...data, entries: old.entries, closedDays: old.closedDays, dayOverrides: old.dayOverrides };
        AsyncStorage.removeItem(LEGACY_KEY).catch(() => {});
      }
    }
    const now = Date.now();
    const meta = users.find((u) => u.username === username);
    saveUsers([
      meta ? { ...meta, lastActiveAt: now } : { username, createdAt: now, lastActiveAt: now },
      ...users.filter((u) => u.username !== username),
    ]);
    await AsyncStorage.setItem(SESSION_KEY, username).catch(() => {});
    setAccount({ username, data });
  };

  const store: Store = {
    ready,
    username: account?.username ?? null,
    users,
    data: account?.data ?? EMPTY,
    signIn,
    signOut: () => {
      AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
      setAccount(null);
    },
    forgetUser: async (username) => {
      await AsyncStorage.removeItem(userKey(username)).catch(() => {});
      saveUsers(users.filter((u) => u.username !== username));
    },
    saveProfile: (profile, prefs) =>
      update((d) => {
        // Goal changes re-aim the learned plan at the new target but keep the learned maintenance.
        const learned = d.learned ? { ...d.learned, dailyTarget: energyPlan(profile, d.learned.maintenance).target } : null;
        return {
          ...d,
          profile,
          prefs,
          learned,
          calibrationStart: d.calibrationStart ?? todayKey(),
          settings: { ...d.settings, ...targetSettings(profile, learned) },
        };
      }),
    updatePrefs: (patch) => update((d) => (d.prefs ? { ...d, prefs: { ...d.prefs, ...patch } } : d)),
    addWeighIn: (date, kg) =>
      update((d) => {
        const weighIns = [...d.weighIns.filter((w) => w.date !== date), { date, kg }].sort((a, b) => a.date.localeCompare(b.date));
        const latest = weighIns[weighIns.length - 1];
        return { ...d, weighIns, profile: d.profile ? { ...d.profile, weightKg: latest.kg } : d.profile };
      }),
    removeWeighIn: (date) => update((d) => ({ ...d, weighIns: d.weighIns.filter((w) => w.date !== date) })),
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
    removeEntry: (id) => update((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) })),
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
