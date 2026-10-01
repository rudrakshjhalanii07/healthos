import '@/global.css';

import { Platform } from 'react-native';

import { istSun } from '@/lib/sun';

export type ThemeName = 'light' | 'dark';

/** True-black canvas, near-black surfaces, a single lime accent. */
const DARK = {
  bg: '#000000',
  surface: '#0A0A0B',
  surfaceRaised: '#111113',
  surfaceHover: '#18181B',
  border: '#1C1C20',
  borderStrong: '#2A2A30',
  text: '#EDEDEF',
  textDim: '#A1A1AA',
  textMuted: '#62626B',
  accent: '#B5F23D',
  accentHover: '#C6F76A',
  accentDim: '#8FC72E',
  accentGlow: '#E4FF8A',
  accentSoft: 'rgba(181, 242, 61, 0.12)',
  accentBorder: 'rgba(181, 242, 61, 0.35)',
  accentTint: 'rgba(181, 242, 61, 0.04)',
  onAccent: '#0B1100',
  info: '#7DB4FF',
  infoSoft: 'rgba(125, 180, 255, 0.12)',
  warn: '#FFB547',
  warnSoft: 'rgba(255, 181, 71, 0.12)',
  warnBorder: 'rgba(255, 181, 71, 0.35)',
  danger: '#FF6B6B',
  dangerSoft: 'rgba(255, 107, 107, 0.12)',
  dangerHover: 'rgba(255, 107, 107, 0.2)',
  dangerBorder: 'rgba(255, 107, 107, 0.3)',
  ghostFill: 'rgba(255, 255, 255, 0.02)',
  overlay: 'rgba(0, 0, 0, 0.72)',
};

/** Warm off-white canvas with white cards; the lime deepens so it stays readable on light surfaces. */
const LIGHT: typeof DARK = {
  bg: '#F5F5F1',
  surface: '#FFFFFF',
  surfaceRaised: '#FAFAF7',
  surfaceHover: '#EEEEE8',
  border: '#E4E4DD',
  borderStrong: '#D2D2C9',
  text: '#131315',
  textDim: '#4F4F57',
  textMuted: '#85858E',
  accent: '#4D7C0F',
  accentHover: '#436C0D',
  accentDim: '#6B9A2A',
  accentGlow: '#84CC16',
  accentSoft: 'rgba(77, 124, 15, 0.10)',
  accentBorder: 'rgba(77, 124, 15, 0.35)',
  accentTint: 'rgba(77, 124, 15, 0.04)',
  onAccent: '#FFFFFF',
  info: '#1D5FD6',
  infoSoft: 'rgba(29, 95, 214, 0.09)',
  warn: '#B45309',
  warnSoft: 'rgba(180, 83, 9, 0.09)',
  warnBorder: 'rgba(180, 83, 9, 0.35)',
  danger: '#D12B2B',
  dangerSoft: 'rgba(209, 43, 43, 0.08)',
  dangerHover: 'rgba(209, 43, 43, 0.14)',
  dangerBorder: 'rgba(209, 43, 43, 0.3)',
  ghostFill: 'rgba(0, 0, 0, 0.02)',
  overlay: 'rgba(20, 20, 18, 0.45)',
};

export const PALETTES: Record<ThemeName, typeof DARK> = { dark: DARK, light: LIGHT };
type Token = keyof typeof DARK;

const cssVar = (k: string) => `--c-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

/**
 * On web every color is a CSS variable, so switching themes is just flipping `data-theme` on
 * <html> — instant, no re-render. Native has no CSS variables, so it takes the palette that matches
 * IST daylight at launch.
 */
export const Colors: Record<Token, string> =
  Platform.OS === 'web'
    ? (Object.fromEntries(Object.keys(DARK).map((k) => [k, `var(${cssVar(k)})`])) as Record<Token, string>)
    : PALETTES[istSun(Date.now()).isDay ? 'light' : 'dark'];

/** CSS custom properties for both palettes, injected into the static HTML. */
export function themeCss() {
  const block = (name: ThemeName) =>
    Object.entries(PALETTES[name])
      .map(([k, v]) => `${cssVar(k)}:${v};`)
      .join('');
  return `:root,:root[data-theme="dark"]{${block('dark')}color-scheme:dark}:root[data-theme="light"]{${block('light')}color-scheme:light}`;
}

export const Fonts = Platform.select({
  web: {
    sans: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
    mono: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  ios: { sans: 'System', mono: 'Menlo' },
  default: { sans: 'sans-serif', mono: 'monospace' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const MaxContentWidth = 1180;
