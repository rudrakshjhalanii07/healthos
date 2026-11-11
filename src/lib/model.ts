import type { DateKey } from './dates';
import { allowancesOn, matchesAllowance } from './diet';
import { buildDayBudget, buildMacroPlan, type DayEntry, type MacroConfig, type Macros } from './macros';
import { buildWeekPlan } from './planner';
import { DEFAULT_PREFS, macroConfig } from './profile';
import type { Data, Entry } from './store';

/** Typical mixed-meal split used when a manual entry has no macros. */
export const assumedMacros = (kcal: number): Macros => ({
  kcal,
  protein: (kcal * 0.2) / 4,
  carbs: (kcal * 0.5) / 4,
  fat: (kcal * 0.3) / 9,
});

export function entryMacros(e: Entry): Macros {
  if (e.protein != null && e.carbs != null && e.fat != null) {
    return { kcal: e.kcal, protein: e.protein, carbs: e.carbs, fat: e.fat };
  }
  return assumedMacros(e.kcal);
}

const FALLBACK_CFG: MacroConfig = { proteinG: 120, fatPct: 0.28, fatMinG: 45, carbMinG: 60 };

/** Everything the dashboard needs for one week, derived from stored data. */
export function buildModel(data: Data, dates: DateKey[], today: DateKey) {
  const prefs = data.prefs ?? DEFAULT_PREFS;
  const cfg = data.profile ? macroConfig(data.profile, data.learned?.fatPct) : FALLBACK_CFG;
  // While still learning, don't front-load paybacks — just observe and spread overages gently.
  const settings = data.learned ? data.settings : { ...data.settings, correction: 'gentle' as const };

  const consumedByDate: Record<DateKey, number> = {};
  const eatenByDate: Record<DateKey, Macros> = {};
  const byDate: Record<DateKey, Entry[]> = {};
  for (const e of data.entries) {
    consumedByDate[e.date] = (consumedByDate[e.date] ?? 0) + e.kcal;
    const m = entryMacros(e);
    const prev = eatenByDate[e.date];
    eatenByDate[e.date] = prev
      ? { kcal: prev.kcal + m.kcal, protein: prev.protein + m.protein, carbs: prev.carbs + m.carbs, fat: prev.fat + m.fat }
      : m;
    (byDate[e.date] ??= []).push(e);
  }

  const treats = Object.fromEntries(dates.map((d) => [d, allowancesOn(d, data.prefs)]));
  const plan = buildWeekPlan({
    dates,
    today,
    settings,
    consumedByDate,
    closedDays: data.closedDays,
    dayOverrides: data.dayOverrides,
    reservedByDate: Object.fromEntries(dates.map((d) => [d, Math.round(treats[d].macros.kcal / 10) * 10])),
  });
  const macroPlan = buildMacroPlan(
    plan,
    eatenByDate,
    Object.fromEntries(dates.map((d) => [d, treats[d].macros])),
    cfg,
  );

  const isTreat = (e: Entry) => treats[e.date]?.items.some((i) => matchesAllowance(e, i.allowance)) ?? false;

  const dayBudgetFor = (date: DateKey) => {
    const entries: DayEntry[] = (byDate[date] ?? []).map((e) => ({ macros: entryMacros(e), isAllowance: isTreat(e) }));
    return buildDayBudget(macroPlan[date], entries);
  };

  return { plan, macroPlan, cfg, prefs, treats, dayBudgetFor, isTreat, learning: !data.learned };
}

export type WeekModel = ReturnType<typeof buildModel>;
