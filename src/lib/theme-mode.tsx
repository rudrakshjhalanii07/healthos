import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, use, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { istSun } from './sun';

import { PALETTES, type ThemeName } from '@/constants/theme';

export type ThemeMode = 'auto' | 'light' | 'dark';

/** Device-wide (not per user): the whole device shares one look. Read by the pre-paint script too. */
export const THEME_KEY = 'healthos:theme';

type ThemeState = {
  mode: ThemeMode;
  resolved: ThemeName;
  setMode: (mode: ThemeMode) => void;
  /** Today's sunrise/sunset in minutes after IST midnight. */
  sun: { sunrise: number; sunset: number };
};

const ThemeContext = createContext<ThemeState | null>(null);

function readSun() {
  const s = istSun(Date.now());
  return { theme: (s.isDay ? 'light' : 'dark') as ThemeName, sunrise: s.sunrise, sunset: s.sunset, msUntilSwitch: s.msUntilSwitch };
}

/** Only web can re-theme live (CSS variables); native keeps the palette it launched with. */
export const CAN_SWITCH_LIVE = Platform.OS === 'web';
const LAUNCH_THEME = readSun().theme;

function storedMode(): ThemeMode {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null;
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function applyToDocument(theme: ThemeName) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PALETTES[theme].bg);
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  // Read synchronously on web so the first render agrees with the pre-paint script.
  const [mode, setModeState] = useState<ThemeMode>(() => (CAN_SWITCH_LIVE ? storedMode() : 'auto'));
  const [sunNow, setSunNow] = useState(readSun);

  // Re-read the sun exactly at the next sunrise/sunset, and again whenever the app returns to the
  // foreground (timers don't run while a PWA or native app is suspended).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const next = readSun();
      setSunNow(next);
      clearTimeout(timer);
      timer = setTimeout(schedule, next.msUntilSwitch + 1000);
    };
    schedule();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && schedule());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  const resolved = !CAN_SWITCH_LIVE ? LAUNCH_THEME : mode === 'auto' ? sunNow.theme : mode;
  useEffect(() => applyToDocument(resolved), [resolved]);

  const value: ThemeState = {
    mode,
    resolved,
    sun: { sunrise: sunNow.sunrise, sunset: sunNow.sunset },
    setMode: (m) => {
      setModeState(m);
      AsyncStorage.setItem(THEME_KEY, m).catch(() => {});
    },
  };
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useThemeMode() {
  const t = use(ThemeContext);
  if (!t) throw new Error('useThemeMode must be used inside <ThemeModeProvider>');
  return t;
}

export const NEXT_MODE: Record<ThemeMode, ThemeMode> = { auto: 'light', light: 'dark', dark: 'auto' };
