import type { MacroConfig } from './macros';

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete';
export type Goal = 'lose' | 'maintain' | 'gain';

export type Profile = {
  sex: Sex;
  age: number;
  heightCm: number;
  /** Latest known weight; updated by weigh-ins. */
  weightKg: number;
  targetWeightKg: number | null;
  units: 'metric' | 'imperial';
  activity: ActivityLevel;
  /** Maintenance the user already knows from experience; beats the formula until data says otherwise. */
  knownMaintenance: number | null;
  goal: Goal;
  /** Always positive; direction comes from `goal`. */
  ratePerWeekKg: number;
};

export type Diet = 'omnivore' | 'pescatarian' | 'eggetarian' | 'vegetarian' | 'vegan';
export type Allergy = 'gluten' | 'lactose' | 'nuts' | 'peanut' | 'soy' | 'egg' | 'fish' | 'shellfish';
export type MilkAlt = 'lactose-free' | 'soy' | 'oat' | 'almond' | 'coconut';
export type GlutenAlt = 'millet' | 'gf-products' | 'rice';
export type Supplement = 'whey' | 'isolate' | 'plant' | 'none';

/** A treat the user doesn't want to give up, reserved in the plan ahead of time. */
export type Allowance = {
  id: string;
  /** Food database key, or `custom:<label>` for user-defined items. */
  foodKey: string;
  label: string;
  unit: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  perWeek: number;
  /** JS weekdays (0 = Sunday) the quantity is split across. */
  days: number[];
};

export type Prefs = {
  diet: Diet;
  avoidMeats: ('beef' | 'pork')[];
  dairy: boolean;
  allergies: Allergy[];
  milkAlts: MilkAlt[];
  glutenAlts: GlutenAlt[];
  supplement: Supplement;
  allowances: Allowance[];
};

export const DEFAULT_PROFILE: Profile = {
  sex: 'male',
  age: 28,
  heightCm: 175,
  weightKg: 75,
  targetWeightKg: null,
  units: 'metric',
  activity: 'moderate',
  knownMaintenance: null,
  goal: 'lose',
  ratePerWeekKg: 0.5,
};

export const DEFAULT_PREFS: Prefs = {
  diet: 'omnivore',
  avoidMeats: [],
  dairy: true,
  allergies: [],
  milkAlts: [],
  glutenAlts: [],
  supplement: 'none',
  allowances: [],
};

/** Standard activity multipliers on BMR (include the thermic effect of food). */
export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  athlete: 1.9,
};

/** 1 kg of body mass ≈ 7700 kcal. */
export const KCAL_PER_KG = 7700;
const round10 = (n: number) => Math.round(n / 10) * 10;

/** Lowest average daily target the app will plan for (common clinical guidance for unsupervised dieting). */
export const safeFloor = (sex: Sex) => (sex === 'female' ? 1200 : 1500);
/** Lowest any single day may go, e.g. while repaying an overage. */
export const dayFloor = (sex: Sex) => (sex === 'female' ? 1000 : 1200);

/** Below this BMI the app won't plan weight loss or accept a lower goal weight. */
export const MIN_BMI = 18.5;
export const bmiOf = (kg: number, heightCm: number) => kg / (heightCm / 100) ** 2;
/** Lowest goal weight the app accepts for a height, in kg (rounded up to 0.1). */
export const minHealthyKg = (heightCm: number) => Math.ceil(MIN_BMI * (heightCm / 100) ** 2 * 10) / 10;
export const MIN_AGE = 18;

export const bmr = (p: Profile) => 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
export const formulaMaintenance = (p: Profile) => round10(bmr(p) * ACTIVITY_FACTOR[p.activity]);

export type MaintenanceSource = 'formula' | 'stated' | 'learned';

export type EnergyPlan = {
  maintenance: number;
  source: MaintenanceSource;
  target: number;
  weekly: number;
  /** Signed kcal/day vs maintenance (negative = deficit). */
  delta: number;
  effectiveRate: number;
  limitedBy: 'floor' | 'cap' | null;
  weeksToTarget: number | null;
};

/**
 * Target intake from maintenance and goal. Maintenance comes from (best first) what the app has
 * learned from the user's own intake and weight trend, what the user said, or the formula.
 */
export function energyPlan(p: Profile, learnedMaintenance?: number | null): EnergyPlan {
  const [maintenance, source]: [number, MaintenanceSource] = learnedMaintenance
    ? [round10(learnedMaintenance), 'learned']
    : p.knownMaintenance
      ? [round10(p.knownMaintenance), 'stated']
      : [formulaMaintenance(p), 'formula'];

  const wanted = (p.ratePerWeekKg * KCAL_PER_KG) / 7;
  let target = maintenance;
  let limitedBy: EnergyPlan['limitedBy'] = null;
  if (p.goal === 'lose') {
    const cap = maintenance * 0.25;
    const floor = safeFloor(p.sex);
    target = maintenance - Math.min(wanted, cap);
    if (wanted > cap) limitedBy = 'cap';
    if (target < floor) {
      target = Math.min(floor, maintenance);
      limitedBy = 'floor';
    }
  } else if (p.goal === 'gain') {
    const cap = maintenance * 0.2;
    target = maintenance + Math.min(wanted, cap);
    if (wanted > cap) limitedBy = 'cap';
  }
  target = round10(target);
  const delta = target - maintenance;
  const effectiveRate = Math.abs((delta * 7) / KCAL_PER_KG);

  let weeksToTarget: number | null = null;
  if (p.targetWeightKg && p.goal !== 'maintain' && effectiveRate > 0) {
    const gap = p.goal === 'lose' ? p.weightKg - p.targetWeightKg : p.targetWeightKg - p.weightKg;
    if (gap > 0) weeksToTarget = Math.ceil(gap / effectiveRate);
  }

  return { maintenance, source, target, weekly: target * 7, delta, effectiveRate, limitedBy, weeksToTarget };
}

/** Protein is set from bodyweight; the carb/fat balance follows the user's own habits once learned. */
export function macroConfig(p: Profile, learnedFatPct?: number | null): MacroConfig {
  // Above a BMI of 25, base protein on the weight at BMI 25 rather than total mass.
  const h = p.heightCm / 100;
  const basis = Math.min(p.weightKg, 25 * h * h);
  const perKg = { lose: 1.8, maintain: 1.6, gain: 1.8 }[p.goal];
  return {
    proteinG: Math.round((basis * perKg) / 5) * 5,
    fatPct: learnedFatPct ?? 0.28,
    fatMinG: Math.round(p.weightKg * 0.6),
    carbMinG: 50,
  };
}

/** Daily floor/ceiling around a target. Single days may dip lower to repay an overage. */
export function dailyBounds(p: Profile, target: number) {
  return {
    minDaily: round10(Math.max(dayFloor(p.sex), target * 0.7)),
    maxDaily: round10(target * 1.8),
  };
}

// Unit helpers for the imperial input mode; everything is stored metric.
export const kgToLb = (kg: number) => kg * 2.20462;
export const lbToKg = (lb: number) => lb / 2.20462;
export const cmToFtIn = (cm: number) => {
  const inches = Math.round(cm / 2.54);
  return { ft: Math.floor(inches / 12), in: inches % 12 };
};
export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * 2.54;
