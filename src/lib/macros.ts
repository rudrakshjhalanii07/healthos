import type { DateKey } from './dates';
import type { WeekPlan } from './planner';

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };
export type MacroKey = keyof Macros;

export const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
const KEYS: MacroKey[] = ['kcal', 'protein', 'carbs', 'fat'];

const map = (f: (k: MacroKey) => number): Macros =>
  Object.fromEntries(KEYS.map((k) => [k, f(k)])) as Macros;
export const addM = (a: Macros, b: Macros) => map((k) => a[k] + b[k]);
export const subM = (a: Macros, b: Macros) => map((k) => a[k] - b[k]);
export const scaleM = (a: Macros, s: number) => map((k) => a[k] * s);
export const clampM = (a: Macros) => map((k) => Math.max(0, a[k]));
export const sumM = (list: Macros[]) => list.reduce(addM, ZERO);

export type MacroConfig = {
  /** Fixed daily protein target in grams. */
  proteinG: number;
  /** Share of calories from fat. */
  fatPct: number;
  fatMinG: number;
  /** Paybacks never push carbs below this. */
  carbMinG: number;
};

/** Protein stays fixed, fat follows its share of calories, carbs fill the rest. */
export function splitKcal(kcal: number, cfg: MacroConfig): Macros {
  const protein = Math.min(cfg.proteinG, (kcal * 0.4) / 4);
  const fat = Math.max(cfg.fatMinG, (kcal * cfg.fatPct) / 9);
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  return { kcal, protein, carbs, fat };
}

export type DayMacros = {
  date: DateKey;
  /** Whole-day target, including any planned treats. */
  target: Macros;
  /** Target before the previous day's payback was taken out. */
  base: Macros;
  /** Planned treats reserved on this day. */
  allowance: Macros;
  eaten: Macros;
  /** How far the previous day ran over on carbs and fat. */
  prevExcess: { carbs: number; fat: number };
  /** Grams removed from this day because of the previous day's overage. */
  cut: { carbs: number; fat: number };
};

/**
 * Derives macro targets for every day of the plan. A day's payback (kcal repaid for the previous
 * day's overage) is taken out of whichever macro actually overflowed: 150 g extra carbs yesterday
 * becomes ~150 g fewer carbs today, not a blanket cut.
 */
export function buildMacroPlan(
  plan: WeekPlan,
  eatenByDate: Record<DateKey, Macros>,
  allowanceByDate: Record<DateKey, Macros>,
  cfg: MacroConfig,
): Record<DateKey, DayMacros> {
  const out: Record<DateKey, DayMacros> = {};
  let prev: DayMacros | null = null;

  for (const day of plan.days) {
    const allowance = allowanceByDate[day.date] ?? { ...ZERO, kcal: day.reserved };
    const foodKcal = day.target - day.reserved;
    const baseFood = splitKcal(foodKcal + day.payback, cfg);

    const prevExcess = prev
      ? {
          carbs: Math.max(0, prev.eaten.carbs - prev.target.carbs),
          fat: Math.max(0, prev.eaten.fat - prev.target.fat),
        }
      : { carbs: 0, fat: 0 };

    let cutC = 0;
    let cutF = 0;
    if (day.payback > 0) {
      let wc = prevExcess.carbs * 4;
      let wf = prevExcess.fat * 9;
      if (wc + wf === 0) wc = 1; // Overage came from protein or drinks: trim carbs by default.
      cutC = (day.payback * wc) / (wc + wf) / 4;
      cutF = (day.payback * wf) / (wc + wf) / 9;
      // Respect the floors and shift whatever doesn't fit onto the other macro.
      const roomC = Math.max(0, baseFood.carbs - cfg.carbMinG);
      const roomF = Math.max(0, baseFood.fat - cfg.fatMinG);
      if (cutC > roomC) {
        cutF += ((cutC - roomC) * 4) / 9;
        cutC = roomC;
      }
      if (cutF > roomF) {
        cutC = Math.min(roomC, cutC + ((cutF - roomF) * 9) / 4);
        cutF = roomF;
      }
    }

    const food: Macros = { kcal: foodKcal, protein: baseFood.protein, carbs: baseFood.carbs - cutC, fat: baseFood.fat - cutF };
    const dm: DayMacros = {
      date: day.date,
      target: { ...addM(food, allowance), kcal: day.target },
      base: { ...addM(baseFood, allowance), kcal: day.target + day.payback },
      allowance,
      eaten: eatenByDate[day.date] ?? ZERO,
      prevExcess,
      cut: { carbs: cutC, fat: cutF },
    };
    out[day.date] = dm;
    prev = dm;
  }
  return out;
}

// ---- Today ------------------------------------------------------------------------------------

export type DayBudget = {
  /** Everything logged for the day, treats included. */
  eaten: Macros;
  /** What's still available once reserved treats are set aside; negative once a macro is overspent. */
  remaining: Macros;
  /** `remaining` floored at zero and kept within the calories left, for display. */
  left: Macros;
  /** Positive parts of eaten − target. */
  over: Macros;
  /** Planned treats not yet logged. */
  allowanceLeft: Macros;
};

/**
 * Macro budgets are rebalanced independently, so after a heavy entry they can add up to more than
 * the calories actually left. Calories win (the weekly total is the goal): scale macros down to fit.
 */
function fitToKcal(m: Macros): Macros {
  const fromMacros = m.protein * 4 + m.carbs * 4 + m.fat * 9;
  if (fromMacros <= m.kcal || fromMacros === 0) return m;
  const s = m.kcal / fromMacros;
  return { kcal: m.kcal, protein: m.protein * s, carbs: m.carbs * s, fat: m.fat * s };
}

export type DayEntry = { macros: Macros; isAllowance: boolean };

/** Everything eaten in a day counts against one daily budget; there is no per-meal split. */
export function buildDayBudget(dm: DayMacros, entries: DayEntry[]): DayBudget {
  const allowanceEaten = sumM(entries.filter((e) => e.isAllowance).map((e) => e.macros));
  const allowanceLeft = clampM(subM(dm.allowance, allowanceEaten));
  const eaten = sumM(entries.map((e) => e.macros));
  const remaining = subM(subM(dm.target, eaten), allowanceLeft);
  return {
    eaten,
    remaining,
    left: fitToKcal(clampM(remaining)),
    over: clampM(subM(eaten, dm.target)),
    allowanceLeft,
  };
}
