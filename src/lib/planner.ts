import { type DateKey, weekday } from './dates';

export type DayType = 'light' | 'normal' | 'flex';

/** Weight applied when the user manually marks a single date light / normal / burst. */
export const DAY_WEIGHT: Record<DayType, number> = { light: 0.85, normal: 1, flex: 1.3 };

/** Labels a learned weekday weight so the UI can show it as a light / normal / burst day. */
export function classifyWeight(w: number): DayType {
  if (w >= 1.1) return 'flex';
  if (w <= 0.92) return 'light';
  return 'normal';
}

export type Correction = 'fast' | 'balanced' | 'gentle';

/** Share of the next day's allocation that can go to repaying an overage (the rest spreads over the week). */
export const CORRECTION_CAP: Record<Correction, number> = { fast: 0.4, balanced: 0.3, gentle: 0 };

export type PlannerSettings = {
  weeklyGoal: number;
  minDaily: number;
  maxDaily: number;
  /** Relative share of the week per JS weekday (0 = Sunday); learned from the user's own pattern. */
  dayWeights: number[];
  /** How aggressively an over-budget day is repaid. */
  correction: Correction;
};

export type PlannerInput = {
  dates: DateKey[];
  today: DateKey;
  settings: PlannerSettings;
  consumedByDate: Record<DateKey, number>;
  closedDays: DateKey[];
  dayOverrides: Record<DateKey, DayType>;
  /** Calories set aside on specific days for planned treats (beer on Saturday, etc.). */
  reservedByDate?: Record<DateKey, number>;
};

export type DayStatus = 'past' | 'today' | 'future';

export type DayPlan = {
  date: DateKey;
  status: DayStatus;
  type: DayType;
  /** Calories actually logged. */
  consumed: number;
  logged: boolean;
  /** Past days and closed-out days no longer change. */
  locked: boolean;
  /** Target the optimizer assigned to this day, given everything before it. */
  target: number;
  /** Target if the week were split evenly (by day type) with no history. */
  baseline: number;
  /** Amount counted against the weekly budget (unlogged past days assume target). */
  counted: number;
  assumed: boolean;
  /** Calories reserved for planned treats, included in `target`. */
  reserved: number;
  /** How far the previous day ran over its target. */
  carriedOver: number;
  /** Part of `carriedOver` repaid on this day (the rest is spread over the remaining days). */
  payback: number;
};

export type WeekPlan = {
  days: DayPlan[];
  goal: number;
  /** Actual calories logged this week. */
  logged: number;
  /** Logged plus assumed values for unlogged past days. */
  accounted: number;
  remaining: number;
  /** Sum of counted (locked + today) + future targets. */
  projected: number;
  openDays: number;
  /** Positive = ahead of pace (ate less than baseline on finished days). */
  paceDelta: number;
  floorHit: boolean;
  ceilingHit: boolean;
};

const ROUND = 10;
const round = (n: number) => Math.round(n / ROUND) * ROUND;

/**
 * Split `budget` across days proportional to `weights`, keeping each day within [min, max].
 * Water-filling: days that would fall outside the band are pinned to it and the rest is
 * redistributed among the remaining days.
 */
export function allocate(budget: number, weights: number[], min: number, max: number) {
  const n = weights.length;
  if (n === 0) return { values: [] as number[], floorHit: false, ceilingHit: false };
  if (budget <= min * n) return { values: weights.map(() => min), floorHit: true, ceilingHit: false };
  if (budget >= max * n) return { values: weights.map(() => max), floorHit: false, ceilingHit: true };

  const pinned: (number | null)[] = weights.map(() => null);
  for (let iter = 0; iter < n; iter++) {
    const free = pinned.flatMap((p, i) => (p === null ? [i] : []));
    const rest = budget - pinned.reduce<number>((s, p) => s + (p ?? 0), 0);
    const scale = rest / free.reduce((s, i) => s + weights[i], 0);

    // Pin only the worst-violating direction per pass so the loop converges correctly.
    const low = free.filter((i) => weights[i] * scale < min);
    const high = free.filter((i) => weights[i] * scale > max);
    if (low.length === 0 && high.length === 0) {
      free.forEach((i) => (pinned[i] = weights[i] * scale));
      break;
    }
    if (low.length) low.forEach((i) => (pinned[i] = min));
    else high.forEach((i) => (pinned[i] = max));
  }

  const values = pinned.map((v) => round(v ?? min));
  return {
    values,
    floorHit: values.some((v) => v <= min),
    ceilingHit: values.some((v) => v >= max),
  };
}

export function dayWeightFor(date: DateKey, input: Pick<PlannerInput, 'settings' | 'dayOverrides'>) {
  const override = input.dayOverrides[date];
  if (override) return { type: override, weight: DAY_WEIGHT[override] };
  const weight = input.settings.dayWeights[weekday(date)] ?? 1;
  return { type: classifyWeight(weight), weight };
}

/**
 * Allocates the food budget for the remaining days, front-loading repayment of the previous
 * day's overage onto the first day (capped), so an over-budget day is corrected immediately
 * instead of being diluted across the whole week.
 */
function planRemaining(food: number, weights: number[], over: number, min: number, max: number, cap: number) {
  const front = cap > 0 ? over : 0;
  let plan = allocate(food + front, weights, min, max);
  let payback = 0;
  if (front > 0) {
    const first = plan.values[0];
    payback = Math.max(0, round(Math.min(over, first * cap, first - min)));
    if (payback < over) plan = allocate(food + payback, weights, min, max);
  }
  const values = [...plan.values];
  values[0] -= payback;
  return { values, payback, floorHit: plan.floorHit, ceilingHit: plan.ceilingHit };
}

/**
 * Walks the week chronologically. Each finished day gets the target the optimizer would have
 * given it that morning; whatever was actually eaten is then subtracted, and the leftover budget
 * is re-spread across the days that remain — overage is repaid first on the very next day.
 */
export function buildWeekPlan(input: PlannerInput): WeekPlan {
  const { dates, today, settings, consumedByDate, closedDays } = input;
  const { weeklyGoal: goal, minDaily: min, maxDaily: max } = settings;

  const perDay = dates.map((d) => dayWeightFor(d, input));
  const types = perDay.map((d) => d.type);
  const weights = perDay.map((d) => d.weight);
  const cap = CORRECTION_CAP[settings.correction] ?? CORRECTION_CAP.balanced;
  const reserved = dates.map((d) => input.reservedByDate?.[d] ?? 0);
  const totalReserved = reserved.reduce((s, r) => s + r, 0);
  const baseline = allocate(goal - totalReserved, weights, min, max).values.map((v, i) => v + reserved[i]);

  const days: DayPlan[] = dates.map((date, i) => {
    const consumed = consumedByDate[date] ?? 0;
    const status: DayStatus = date < today ? 'past' : date === today ? 'today' : 'future';
    return {
      date,
      status,
      type: types[i],
      consumed,
      logged: consumed > 0,
      locked: status === 'past' || (status === 'today' && closedDays.includes(date)),
      target: baseline[i],
      baseline: baseline[i],
      counted: 0,
      assumed: false,
      reserved: reserved[i],
      carriedOver: 0,
      payback: 0,
    };
  });

  let running = goal;
  let floorHit = false;
  let ceilingHit = false;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const prev = days[i - 1];
    const over = prev ? Math.max(0, prev.counted - prev.target) : 0;
    const food = running - reserved.slice(i).reduce((s, r) => s + r, 0);
    const plan = planRemaining(food, weights.slice(i), over, min, max, cap);
    day.carriedOver = over;
    day.payback = plan.payback;

    if (day.status === 'future') {
      plan.values.forEach((v, j) => {
        days[i + j].target = v + reserved[i + j];
        days[i + j].counted = days[i + j].target;
      });
      floorHit ||= plan.floorHit;
      ceilingHit ||= plan.ceilingHit;
      break;
    }

    day.target = plan.values[0] + reserved[i];
    if (day.locked) {
      day.assumed = !day.logged;
      day.counted = day.logged ? day.consumed : day.target;
    } else {
      // Today is still in progress: assume at least the target will be eaten.
      day.counted = Math.max(day.consumed, day.target);
      floorHit ||= plan.floorHit;
      ceilingHit ||= plan.ceilingHit;
    }
    running -= day.counted;
  }
  const logged = days.reduce((s, d) => s + d.consumed, 0);
  const accounted = days.reduce((s, d) => s + (d.assumed ? d.counted : d.consumed), 0);
  const finished = days.filter((d) => d.locked);

  return {
    days,
    goal,
    logged,
    accounted,
    remaining: goal - accounted,
    projected: days.reduce((s, d) => s + d.counted, 0),
    openDays: days.filter((d) => !d.locked).length,
    paceDelta: finished.reduce((s, d) => s + d.baseline - d.counted, 0),
    floorHit,
    ceilingHit,
  };
}
