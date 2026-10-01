/**
 * Learns the user's own pattern from what they log — which days they eat more, how they split
 * meals, their carb/fat balance, recurring treats and (with weigh-ins) their real maintenance —
 * and turns it into a plan proposal instead of asking them to configure any of it up front.
 */
import { addDays, type DateKey, fromKey, weekday } from './dates';
import { getFood, servingMacros } from './foods';
import { MEAL_ORDER, type Meal } from './macros';
import { entryMacros } from './model';
import { type Allowance, energyPlan, formulaMaintenance, KCAL_PER_KG, type Profile } from './profile';
import type { Data, Entry, WeighIn } from './store';

export const CALIBRATION_DAYS = 14;
/** Complete days needed before a plan is proposed (sooner if the user asks for an early read). */
export const DAYS_FOR_PLAN = 10;
export const DAYS_FOR_EARLY_READ = 5;
const UPDATE_WINDOW = 28;

export type LearnedPlan = {
  appliedAt: DateKey;
  maintenance: number;
  maintenanceSource: 'weight-trend' | 'stated' | 'formula';
  dailyTarget: number;
  dayWeights: number[];
  mealWeights: Record<Meal, number>;
  fatPct: number;
  basedOnDays: number;
};

const TREAT_KEYS = new Set([
  'pizza', 'burger', 'french fries', 'ice cream', 'cake', 'milk chocolate', 'dark chocolate', 'cookie', 'donut',
  'gulab jamun', 'jalebi', 'rasgulla', 'ladoo', 'kheer', 'halwa', 'potato chips', 'nachos', 'fried chicken',
  'cola', 'muffin', 'samosa', 'kachori',
]);

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round10 = (n: number) => Math.round(n / 10) * 10;
const daysBetween = (a: DateKey, b: DateKey) => Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);

export type WeightTrend = { kgPerWeek: number; spanDays: number; points: number; latest: number };

export type Habits = {
  from: DateKey;
  to: DateKey;
  completeDays: number;
  avgIntake: number;
  /** Coefficient of variation of daily intake — how steady the user is. */
  variability: number;
  weekdayAvg: (number | null)[];
  dayWeights: number[];
  mealShare: Record<Meal, number>;
  mealWeights: Record<Meal, number>;
  snackRate: number;
  macroShare: { protein: number; carbs: number; fat: number };
  proteinPerKg: number;
  treats: { allowance: Allowance; occurrences: number }[];
  trend: WeightTrend | null;
  /** Maintenance implied by intake and weight trend, when there's enough weigh-in data. */
  observedMaintenance: number | null;
};

/**
 * A day counts only if it looks fully logged — partial days would drag every average down.
 */
function completeDays(totals: Map<DateKey, number>) {
  const med = median([...totals.values()]);
  const bar = Math.max(800, med * 0.5);
  return [...totals.entries()].filter(([, kcal]) => kcal >= bar);
}

export function weightTrend(weighIns: WeighIn[], to: DateKey, windowDays = UPDATE_WINDOW): WeightTrend | null {
  const from = addDays(to, -windowDays);
  const pts = weighIns.filter((w) => w.date >= from && w.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length < 3) return null;
  const spanDays = daysBetween(pts[0].date, pts[pts.length - 1].date);
  if (spanDays < 7) return null;
  // Least-squares slope in kg/day; daily scale noise averages out over the window.
  const xs = pts.map((p) => daysBetween(pts[0].date, p.date));
  const ys = pts.map((p) => p.kg);
  const mx = mean(xs);
  const my = mean(ys);
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  return { kgPerWeek: slope * 7, spanDays, points: pts.length, latest: pts[pts.length - 1].kg };
}

export function analyzeHabits(entries: Entry[], weighIns: WeighIn[], from: DateKey, to: DateKey, profile: Profile): Habits {
  const inWindow = entries.filter((e) => e.date >= from && e.date <= to);
  const totals = new Map<DateKey, number>();
  for (const e of inWindow) totals.set(e.date, (totals.get(e.date) ?? 0) + e.kcal);
  const complete = completeDays(totals);
  const completeSet = new Set(complete.map(([d]) => d));
  const intakes = complete.map(([, k]) => k);
  const avgIntake = mean(intakes);
  const sd = Math.sqrt(mean(intakes.map((k) => (k - avgIntake) ** 2)));

  // Recurring treats: the same indulgence showing up on more than one day.
  const weeks = Math.max(1, (daysBetween(from, to) + 1) / 7);
  const groups = new Map<string, Entry[]>();
  for (const e of inWindow) {
    if (!e.foodKey) continue;
    const food = getFood(e.foodKey);
    if (!food || !((food.t ?? []).includes('alcohol') || TREAT_KEYS.has(e.foodKey))) continue;
    groups.set(e.foodKey, [...(groups.get(e.foodKey) ?? []), e]);
  }
  const treats = [...groups.entries()]
    .filter(([, es]) => new Set(es.map((e) => e.date)).size >= 2)
    .map(([key, es]) => {
      const unit = servingMacros(key, 1)!;
      const food = getFood(key)!;
      const servings = es.reduce((s, e) => s + e.kcal / Math.max(unit.kcal, 1), 0);
      const wdCount = new Map<number, number>();
      for (const e of es) wdCount.set(weekday(e.date), (wdCount.get(weekday(e.date)) ?? 0) + 1);
      const top = Math.max(...wdCount.values());
      const days = [...wdCount.entries()].filter(([, n]) => n >= Math.max(1, top * 0.5)).map(([wd]) => wd);
      const allowance: Allowance = {
        id: `learned-${key}`,
        foodKey: key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        unit: food.serving[0],
        ...unit,
        perWeek: Math.max(1, Math.round(servings / weeks)),
        days,
      };
      return { allowance, occurrences: es.length };
    })
    .sort((a, b) => b.occurrences - a.occurrences);

  // Weekday pattern from food only — recurring treats get their own reservation, so counting them
  // here too would make their days double-heavy. Shrunk toward "normal" with few samples per weekday.
  const treatKeys = new Set(treats.map((t) => t.allowance.foodKey));
  const foodTotals = new Map<DateKey, number>();
  for (const e of inWindow) {
    if (completeSet.has(e.date) && !(e.foodKey && treatKeys.has(e.foodKey))) foodTotals.set(e.date, (foodTotals.get(e.date) ?? 0) + e.kcal);
  }
  const avgFood = mean([...foodTotals.values()]);
  const byWd: number[][] = Array.from({ length: 7 }, () => []);
  for (const [d, k] of foodTotals) byWd[weekday(d)].push(k);
  const weekdayAvg = byWd.map((xs) => (xs.length ? mean(xs) : null));
  let dayWeights = byWd.map((xs) => {
    if (!xs.length || !avgFood) return 1;
    const raw = mean(xs) / avgFood;
    return clamp(1 + (raw - 1) * (xs.length / (xs.length + 1)), 0.75, 1.5);
  });
  const avgW = mean(dayWeights);
  dayWeights = dayWeights.map((w) => Math.round((w / avgW) * 20) / 20);

  // Meal split and macro balance, over complete days only.
  const completeEntries = inWindow.filter((e) => completeSet.has(e.date));
  const mealKcal = Object.fromEntries(MEAL_ORDER.map((m) => [m, 0])) as Record<Meal, number>;
  let p = 0;
  let c = 0;
  let f = 0;
  for (const e of completeEntries) {
    mealKcal[e.meal] += e.kcal;
    const m = entryMacros(e);
    p += m.protein;
    c += m.carbs;
    f += m.fat;
  }
  const total = Object.values(mealKcal).reduce((s, x) => s + x, 0) || 1;
  const mealShare = Object.fromEntries(MEAL_ORDER.map((m) => [m, mealKcal[m] / total])) as Record<Meal, number>;
  const snackDays = new Set(completeEntries.filter((e) => e.meal === 'snack').map((e) => e.date)).size;
  const snackRate = complete.length ? snackDays / complete.length : 0;
  const rawMeal = { ...mealShare, snack: snackRate >= 0.3 ? mealShare.snack : 0 };
  const rawTotal = Object.values(rawMeal).reduce((s, x) => s + x, 0) || 1;
  const mealWeights = Object.fromEntries(
    MEAL_ORDER.map((m) => [m, Math.round((rawMeal[m] / rawTotal) * 100) / 100]),
  ) as Record<Meal, number>;

  const macroKcal = p * 4 + c * 4 + f * 9 || 1;
  const macroShare = { protein: (p * 4) / macroKcal, carbs: (c * 4) / macroKcal, fat: (f * 9) / macroKcal };

  const trend = weightTrend(weighIns, to);
  const observedMaintenance =
    trend && avgIntake > 0 ? round10(avgIntake - (trend.kgPerWeek / 7) * KCAL_PER_KG) : null;

  return {
    from,
    to,
    completeDays: complete.length,
    avgIntake: round10(avgIntake),
    variability: avgIntake ? sd / avgIntake : 0,
    weekdayAvg,
    dayWeights,
    mealShare,
    mealWeights,
    snackRate,
    macroShare,
    proteinPerKg: complete.length ? p / complete.length / profile.weightKg : 0,
    treats,
    trend,
    observedMaintenance,
  };
}

export type Proposal = {
  kind: 'initial' | 'update';
  habits: Habits;
  maintenance: number;
  maintenanceSource: LearnedPlan['maintenanceSource'];
  /** Where the goal eventually lands, from maintenance and pace. */
  goalTarget: number;
  /** What to aim for now — stepped toward the goal when current intake is far from it. */
  dailyTarget: number;
  stepped: boolean;
  dayWeights: number[];
  mealWeights: Record<Meal, number>;
  fatPct: number;
  /** Treats seen in the log that aren't planned yet. */
  treats: Allowance[];
  changes: string[];
};

/** How far a single step may move from what the user currently eats, per day. */
const MAX_STEP = { lose: 500, gain: 300 };

export function buildProposal(data: Data, today: DateKey): Proposal | null {
  const profile = data.profile;
  if (!profile) return null;
  const learned = data.learned;
  const to = addDays(today, -1);
  const start = data.calibrationStart ?? to;
  const from = learned ? addDays(today, -UPDATE_WINDOW) : addDays(today, -Math.max(CALIBRATION_DAYS, daysBetween(start, today)));
  const habits = analyzeHabits(data.entries, data.weighIns, from, to, profile);
  if (habits.completeDays < DAYS_FOR_EARLY_READ) return null;

  // Maintenance: trust the weight trend in proportion to how much data backs it.
  const base = profile.knownMaintenance ?? formulaMaintenance(profile);
  let maintenance = base;
  let maintenanceSource: LearnedPlan['maintenanceSource'] = profile.knownMaintenance ? 'stated' : 'formula';
  if (habits.observedMaintenance && habits.trend) {
    const observed = clamp(habits.observedMaintenance, base * 0.65, base * 1.35);
    const confidence = Math.min(1, habits.trend.spanDays / 21) * Math.min(1, habits.completeDays / DAYS_FOR_PLAN);
    maintenance = round10(base + (observed - base) * (0.3 + 0.6 * confidence));
    maintenanceSource = 'weight-trend';
  }

  const goalTarget = energyPlan(profile, maintenance).target;
  // A veteran eating 2,800 won't sustain 1,800 tomorrow — step there instead; weekly re-checks close the gap.
  let dailyTarget = goalTarget;
  if (habits.avgIntake > 0) {
    if (profile.goal === 'lose' && habits.avgIntake - goalTarget > MAX_STEP.lose) dailyTarget = round10(habits.avgIntake - MAX_STEP.lose);
    if (profile.goal === 'gain' && goalTarget - habits.avgIntake > MAX_STEP.gain) dailyTarget = round10(habits.avgIntake + MAX_STEP.gain);
    if (profile.goal === 'maintain') dailyTarget = goalTarget;
  }

  const planned = new Set((data.prefs?.allowances ?? []).map((a) => a.foodKey));
  const proposal: Proposal = {
    kind: learned ? 'update' : 'initial',
    habits,
    maintenance,
    maintenanceSource,
    goalTarget,
    dailyTarget,
    stepped: dailyTarget !== goalTarget,
    dayWeights: habits.dayWeights,
    mealWeights: habits.mealWeights,
    fatPct: clamp(habits.macroShare.fat, 0.2, 0.4),
    treats: habits.treats.map((t) => t.allowance).filter((a) => !planned.has(a.foodKey)),
    changes: [],
  };

  if (learned) {
    const changes: string[] = [];
    const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
    if (Math.abs(maintenance - learned.maintenance) >= 100) {
      changes.push(`Maintenance looks like ~${fmt(maintenance)} kcal, not ${fmt(learned.maintenance)}.`);
    }
    if (Math.abs(dailyTarget - learned.dailyTarget) >= 80) {
      changes.push(`Daily target ${fmt(learned.dailyTarget)} → ${fmt(dailyTarget)} kcal.`);
    }
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const shifted = proposal.dayWeights.flatMap((w, i) => (Math.abs(w - learned.dayWeights[i]) >= 0.1 ? [names[i]] : []));
    if (shifted.length) changes.push(`Your day-to-day pattern shifted (${shifted.join(', ')}).`);
    if (proposal.treats.length) changes.push(`New recurring treat: ${proposal.treats.map((t) => t.label.toLowerCase()).join(', ')}.`);
    proposal.changes = changes;
  }
  return proposal;
}

export type Calibration =
  | { phase: 'learning'; day: number; completeDays: number; canReadEarly: boolean }
  | { phase: 'ready'; proposal: Proposal }
  | { phase: 'active'; update: Proposal | null };

export function calibrationStatus(data: Data, today: DateKey): Calibration {
  const snoozed = !!data.proposalSnoozedUntil && data.proposalSnoozedUntil > today;
  if (data.learned) {
    const due = daysBetween(data.learned.appliedAt, today) >= 7 && !snoozed;
    const update = due ? buildProposal(data, today) : null;
    return { phase: 'active', update: update && update.changes.length ? update : null };
  }
  const start = data.calibrationStart ?? today;
  const day = Math.min(CALIBRATION_DAYS, daysBetween(start, today) + 1);
  const proposal = buildProposal(data, today);
  const completeDays = proposal?.habits.completeDays ?? countComplete(data, today);
  const ready = proposal && !snoozed && (completeDays >= DAYS_FOR_PLAN || (day >= CALIBRATION_DAYS && completeDays >= 7));
  if (ready) return { phase: 'ready', proposal };
  return { phase: 'learning', day, completeDays, canReadEarly: completeDays >= DAYS_FOR_EARLY_READ };
}

function countComplete(data: Data, today: DateKey) {
  const totals = new Map<DateKey, number>();
  const from = addDays(today, -CALIBRATION_DAYS);
  for (const e of data.entries) if (e.date >= from && e.date < today) totals.set(e.date, (totals.get(e.date) ?? 0) + e.kcal);
  return completeDays(totals).length;
}

export function planFromProposal(p: Proposal, today: DateKey): LearnedPlan {
  return {
    appliedAt: today,
    maintenance: p.maintenance,
    maintenanceSource: p.maintenanceSource,
    dailyTarget: p.dailyTarget,
    dayWeights: p.dayWeights,
    mealWeights: p.mealWeights,
    fatPct: p.fatPct,
    basedOnDays: p.habits.completeDays,
  };
}
