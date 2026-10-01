import type { DateKey } from './dates';
import type { DayPlan, WeekPlan } from './planner';

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

// ---- Meals -----------------------------------------------------------------------------------

export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner'];
export const MEAL_LABEL: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
/** Starting split until the user's own meal pattern has been learned. */
export const DEFAULT_MEAL_WEIGHTS: Record<Meal, number> = { breakfast: 0.25, lunch: 0.35, snack: 0.1, dinner: 0.3 };
const MAIN_MEALS: Meal[] = ['breakfast', 'lunch', 'dinner'];

export type MealStatus = 'done' | 'skipped' | 'next' | 'upcoming';

export type MealBudget = {
  meal: Meal;
  status: MealStatus;
  eaten: Macros;
  /** A normal day's share for this meal, before any rebalancing. */
  usual: Macros;
  /** Live budget for meals still to come (rebalanced after every entry); equals `eaten` once done. */
  budget: Macros;
};

export type MealPlan = {
  meals: MealBudget[];
  next: MealBudget | null;
  /** What's still available today once reserved treats are set aside. */
  remaining: Macros;
  /** Positive parts of eaten − target. */
  over: Macros;
  /** Planned treats not yet logged today. */
  allowanceLeft: Macros;
};

/**
 * Macro budgets are rebalanced independently, so after a heavy meal they can add up to more than
 * the calories actually left. Calories win (the weekly total is the goal): scale macros down to fit.
 */
function fitToKcal(m: Macros): Macros {
  const fromMacros = m.protein * 4 + m.carbs * 4 + m.fat * 9;
  if (fromMacros <= m.kcal || fromMacros === 0) return m;
  const s = m.kcal / fromMacros;
  return { kcal: m.kcal, protein: m.protein * s, carbs: m.carbs * s, fat: m.fat * s };
}

export type MealEntry = { meal: Meal; macros: Macros; isAllowance: boolean };

/**
 * Splits a day into per-meal budgets. The previous day's payback is shared equally across the
 * main meals; after that, any meal that runs over (or under) immediately shifts the budgets of the
 * meals still to come, weighted by their usual size.
 */
export function buildMealPlan(
  day: DayPlan,
  dm: DayMacros,
  entries: MealEntry[],
  mealWeights: Record<Meal, number> = DEFAULT_MEAL_WEIGHTS,
): MealPlan {
  // A meal the user habitually skips (e.g. no breakfast) gets no budget unless they log it.
  const logged = (m: Meal) => entries.some((e) => e.meal === m && !e.isAllowance);
  const meals = MEAL_ORDER.filter((m) => mealWeights[m] >= 0.03 || logged(m));
  const weightOf = (m: Meal) => Math.max(mealWeights[m], 0.05);
  const totalW = meals.reduce((s, m) => s + weightOf(m), 0);
  const mains = meals.filter((m) => MAIN_MEALS.includes(m));

  const baseFood = subM(dm.base, dm.allowance);
  const n = Math.max(1, mains.length);
  const cutPerMain: Macros = {
    kcal: (dm.cut.carbs * 4 + dm.cut.fat * 9) / n,
    protein: 0,
    carbs: dm.cut.carbs / n,
    fat: dm.cut.fat / n,
  };

  const food = entries.filter((e) => !e.isAllowance);
  const eatenBy = (m: Meal) => sumM(food.filter((e) => e.meal === m).map((e) => e.macros));
  const lastDone = Math.max(-1, ...meals.map((m, i) => (food.some((e) => e.meal === m) ? i : -1)));
  const open = day.status === 'future' || (day.status === 'today' && !day.locked);

  const allowanceEaten = sumM(entries.filter((e) => e.isAllowance).map((e) => e.macros));
  const allowanceLeft = clampM(subM(dm.allowance, allowanceEaten));
  const eatenAll = sumM(entries.map((e) => e.macros));
  const pool = subM(subM(dm.target, eatenAll), allowanceLeft);

  const rows = meals.map((meal, i) => {
    const w = weightOf(meal) / totalW;
    const usual = scaleM(baseFood, w);
    const planned = mains.includes(meal) ? clampM(subM(usual, cutPerMain)) : usual;
    const eaten = eatenBy(meal);
    const status: MealStatus = !open || i <= lastDone ? (eaten.kcal > 0 ? 'done' : 'skipped') : 'upcoming';
    return { meal, status, eaten, usual, planned, w };
  });

  const upcoming = rows.filter((r) => r.status === 'upcoming');
  const plannedSum = sumM(upcoming.map((r) => r.planned));
  const upcomingW = upcoming.reduce((s, r) => s + r.w, 0);
  const diff = subM(pool, plannedSum);

  const out: MealBudget[] = rows.map((r) => ({
    meal: r.meal,
    status: r.status,
    eaten: r.eaten,
    usual: r.usual,
    budget: r.status === 'upcoming' ? fitToKcal(clampM(addM(r.planned, scaleM(diff, r.w / upcomingW)))) : r.eaten,
  }));
  const next = out.find((m) => m.status === 'upcoming') ?? null;
  if (next && day.status === 'today') next.status = 'next';

  return {
    meals: out,
    next,
    remaining: pool,
    over: clampM(subM(eatenAll, dm.target)),
    allowanceLeft,
  };
}
