import { type DateKey, weekday } from './dates';
import { capitalize, getFood, servingMacros, type Tag } from './foods';
import { addM, type Macros, type Meal, scaleM, sumM, ZERO } from './macros';
import type { Allowance, Diet, Prefs } from './profile';

// ---- Restrictions ------------------------------------------------------------------------------

const DIET_BLOCKS: Record<Diet, Tag[]> = {
  omnivore: [],
  pescatarian: ['meat'],
  eggetarian: ['meat', 'fish', 'shellfish'],
  vegetarian: ['meat', 'fish', 'shellfish', 'egg'],
  vegan: ['meat', 'fish', 'shellfish', 'egg', 'dairy'],
};

export const DIET_LABEL: Record<Diet, string> = {
  omnivore: 'Non-veg',
  pescatarian: 'Pescatarian',
  eggetarian: 'Veg + eggs',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
};

export function blockedTags(prefs: Prefs): Set<Tag> {
  const blocked = new Set<Tag>(DIET_BLOCKS[prefs.diet]);
  prefs.avoidMeats.forEach((m) => blocked.add(m));
  if (!prefs.dairy) blocked.add('dairy');
  for (const a of prefs.allergies) blocked.add(a);
  return blocked;
}

const TAG_LABEL: Partial<Record<Tag, string>> = {
  meat: 'Contains meat',
  beef: 'Contains beef',
  pork: 'Contains pork',
  fish: 'Contains fish',
  shellfish: 'Shellfish',
  egg: 'Contains egg',
  dairy: 'Contains dairy',
  lactose: 'Contains lactose',
  gluten: 'Contains gluten',
  nuts: 'Tree nuts',
  peanut: 'Peanuts',
  soy: 'Contains soy',
};

/** Human-readable reasons a food clashes with the user's diet or allergies. */
export function conflicts(tags: Tag[], prefs: Prefs): string[] {
  const blocked = blockedTags(prefs);
  // "Contains dairy" already covers lactose for people avoiding dairy entirely.
  const hits = tags.filter((t) => blocked.has(t) && !(t === 'lactose' && blocked.has('dairy')));
  return hits.map((t) => TAG_LABEL[t] ?? t);
}

export const allowed = (key: string, prefs: Prefs) => {
  const food = getFood(key);
  if (!food) return false;
  const blocked = blockedTags(prefs);
  return !(food.t ?? []).some((t) => blocked.has(t));
};

// ---- Swaps -------------------------------------------------------------------------------------

const MILK_DRINKS = ['milk', 'skim milk'];
const MILKY = ['chai', 'latte', 'cappuccino', 'cold coffee', 'smoothie'];
const CURDS = ['yogurt', 'greek yogurt', 'raita', 'lassi', 'buttermilk'];
const PANEER = ['paneer', 'paneer butter masala', 'palak paneer', 'paneer tikka'];
const WHEAT_BREADS = ['roti', 'paratha', 'naan', 'puri', 'aloo paratha', 'bhature'];
const BREADS = ['white bread', 'whole wheat bread', 'sandwich'];
const PASTAS = ['pasta', 'pasta in sauce', 'mac and cheese'];
const NOODLES = ['hakka noodles', 'instant noodles', 'ramen'];
const MEATS = ['chicken breast', 'chicken thigh', 'chicken curry', 'butter chicken', 'chicken tikka', 'mutton curry', 'steak', 'ground beef'];

const MILK_ALT_FOOD = { 'lactose-free': 'lactose-free milk', soy: 'soy milk', oat: 'oat milk', almond: 'almond milk', coconut: null } as const;

export type Swap = { label: string; /** Food to look up when the swap is tapped. */ query: string };

/** Alternatives the user has said they're happy with, for a food that clashes with their prefs. */
export function swapsFor(key: string, prefs: Prefs): Swap[] {
  const food = getFood(key);
  if (!food || conflicts(food.t ?? [], prefs).length === 0) return [];
  const out: Swap[] = [];
  const ok = (k: string) => allowed(k, prefs);
  const to = (query: string, label = capitalize(query)) => ok(query) && out.push({ label, query });

  const milks = prefs.milkAlts.flatMap((a) => (MILK_ALT_FOOD[a] && ok(MILK_ALT_FOOD[a]) ? [MILK_ALT_FOOD[a]] : []));
  if (MILK_DRINKS.includes(key)) milks.forEach((m) => to(m));
  if (MILKY.includes(key) && milks.length) to(milks[0], `Make it with ${milks[0]}`);
  if (CURDS.includes(key)) {
    if (prefs.milkAlts.includes('lactose-free')) to('lactose-free yogurt', 'Lactose-free curd');
    if (prefs.milkAlts.includes('soy')) to('soy yogurt');
    if (prefs.milkAlts.includes('coconut')) to('coconut yogurt');
  }
  if (PANEER.includes(key)) to('tofu', 'Swap paneer for tofu');
  if (key === 'whey protein') {
    if (prefs.supplement === 'isolate') to('whey isolate');
    to('plant protein');
  }

  const gf = prefs.glutenAlts;
  if (WHEAT_BREADS.includes(key) && gf.includes('millet')) to('millet roti', 'Jowar / bajra / ragi roti');
  if (WHEAT_BREADS.includes(key) && gf.includes('rice')) to('dosa', 'Dosa or rice instead');
  if (BREADS.includes(key) && gf.includes('gf-products')) to('gluten-free bread');
  if (PASTAS.includes(key) && gf.includes('gf-products')) {
    to('gluten-free pasta');
    to('lentil pasta');
  }
  if (NOODLES.includes(key) && gf.includes('rice')) to('rice noodles');
  if (key === 'upma' && gf.includes('rice')) to('poha');

  if (MEATS.includes(key) || key === 'white fish' || key === 'salmon') {
    ['paneer', 'tofu', 'soya chunks', 'boiled egg'].filter(ok).slice(0, 2).forEach((v) => to(v, `${capitalize(v)} instead`));
  }
  const seen = new Set<string>();
  return out.filter((w) => !seen.has(w.query) && seen.add(w.query)).slice(0, 3);
}

// ---- Planned treats ----------------------------------------------------------------------------

export const ALLOWANCE_PRESETS: { foodKey: string; label: string; unit: string; servings: number }[] = [
  { foodKey: 'beer', label: 'Beer', unit: 'pint', servings: 1 },
  { foodKey: 'light beer', label: 'Light beer', unit: 'pint', servings: 1 },
  { foodKey: 'wine', label: 'Wine', unit: 'glass', servings: 1 },
  { foodKey: 'whiskey', label: 'Spirits', unit: 'peg (30 ml)', servings: 1 },
  { foodKey: 'cocktail', label: 'Cocktail', unit: 'glass', servings: 1 },
  { foodKey: 'pizza', label: 'Pizza', unit: 'slice', servings: 1 },
  { foodKey: 'ice cream', label: 'Ice cream', unit: 'scoop', servings: 1 },
  { foodKey: 'milk chocolate', label: 'Chocolate', unit: 'bar', servings: 1 },
  { foodKey: 'cake', label: 'Dessert', unit: 'slice', servings: 1 },
];

export function allowanceFromPreset(p: (typeof ALLOWANCE_PRESETS)[number], perWeek: number, days: number[]): Allowance {
  const m = servingMacros(p.foodKey, p.servings) ?? ZERO;
  return { id: `${p.foodKey}-${Date.now().toString(36)}`, foodKey: p.foodKey, label: p.label, unit: p.unit, ...m, perWeek, days };
}

export function allowanceTags(a: Allowance): Tag[] {
  return getFood(a.foodKey)?.t ?? [];
}

/** Treats scheduled for a date: each allowance's weekly quantity is split across its chosen days. */
export function allowancesOn(date: DateKey, prefs: Prefs | null) {
  const wd = weekday(date);
  const items = (prefs?.allowances ?? [])
    .filter((a) => a.days.includes(wd) && a.days.length > 0 && a.perWeek > 0)
    .map((a) => ({ allowance: a, qty: a.perWeek / a.days.length }));
  const macros = sumM(items.map(({ allowance: a, qty }) => scaleM(a, qty)));
  return { items, macros: { kcal: macros.kcal, protein: macros.protein, carbs: macros.carbs, fat: macros.fat } };
}

export function matchesAllowance(entry: { name: string; foodKey?: string }, allowance: Allowance) {
  return (entry.foodKey && entry.foodKey === allowance.foodKey) || entry.name.toLowerCase() === allowance.label.toLowerCase();
}

// ---- Meal ideas --------------------------------------------------------------------------------

const PROTEIN_BY_DIET: Record<Diet, string[]> = {
  omnivore: ['chicken breast', 'white fish', 'boiled egg', 'paneer', 'greek yogurt', 'tuna', 'tofu', 'chicken tikka'],
  pescatarian: ['white fish', 'salmon', 'tuna', 'shrimp', 'boiled egg', 'greek yogurt', 'paneer', 'tofu'],
  eggetarian: ['boiled egg', 'egg white', 'paneer', 'greek yogurt', 'tofu', 'soya chunks', 'moong chilla'],
  vegetarian: ['paneer', 'greek yogurt', 'tofu', 'soya chunks', 'moong chilla', 'tempeh', 'boiled chickpeas'],
  vegan: ['tofu', 'soya chunks', 'tempeh', 'edamame', 'boiled chickpeas', 'moong chilla', 'seitan'],
};
const SIDE_PROTEIN = ['dal', 'rajma', 'chole', 'sprouts', 'lactose-free yogurt', 'soy yogurt'];
const CARBS: Record<'breakfast' | 'main', string[]> = {
  breakfast: ['oats', 'poha', 'idli', 'whole wheat bread', 'gluten-free bread', 'millet roti', 'banana', 'dosa'],
  main: ['white rice', 'roti', 'millet roti', 'quinoa', 'brown rice', 'sweet potato', 'rice noodles', 'potato'],
};
const SNACK_PROTEIN = ['greek yogurt', 'boiled egg', 'roasted chana', 'sprouts', 'edamame', 'soy yogurt', 'lactose-free yogurt', 'tofu', 'egg white'];
const SNACK_CARBS = ['apple', 'banana', 'orange', 'papaya', 'guava'];
const SUPPLEMENT_FOOD = { whey: 'whey protein', isolate: 'whey isolate', plant: 'plant protein', none: null } as const;

export type MealIdea = { items: { name: string; portion: string; macros: Macros }[]; total: Macros; note?: string };

const halfSteps = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n * 2) / 2));

function portionLabel(key: string, servings: number) {
  const food = getFood(key)!;
  const [label, grams] = food.serving;
  if (['serving', 'fillet', 'can', 'steak'].includes(label) || label.includes('(')) return `${Math.round(servings * grams)} g`;
  const qty = Number.isInteger(servings) ? String(servings) : servings === 0.5 ? '½' : servings.toFixed(1);
  const plural = servings > 1 && !label.endsWith('s') ? `${label}s` : label;
  return `${qty} ${plural}`;
}

function item(key: string, servings: number) {
  return { name: capitalize(key), portion: portionLabel(key, servings), macros: servingMacros(key, servings)! };
}

/**
 * Builds one concrete meal that fits a budget and the user's preferences: a protein anchor sized
 * to the protein target, a starch sized to whatever carbs are left, and veg to round it out.
 * `seed` rotates through the options so the user can shuffle.
 */
export function mealIdea(budget: Macros, meal: Meal, prefs: Prefs, seed = 0): MealIdea | null {
  const ok = (k: string) => allowed(k, prefs);
  const pick = (list: string[], offset = 0) => {
    const options = list.filter(ok);
    return options.length ? options[(seed + offset) % options.length] : null;
  };
  // When carbs are nearly spent, only anchor the meal on proteins that barely carry any.
  const lean = (list: string[]) => {
    const options = list.filter(ok);
    if (budget.carbs >= 15) return options;
    const low = options.filter((k) => (servingMacros(k, 1)?.carbs ?? 99) <= Math.max(5, budget.carbs));
    return low.length ? low : options;
  };

  // Almost nothing left: don't invent a meal, just point at near-zero options.
  if (budget.kcal < (meal === 'snack' ? 80 : 150)) {
    const items = [item('green salad', 1)];
    return { items, total: items[0].macros, note: 'Little room left today — salad, clear soup, black coffee or tea.' };
  }

  if (meal === 'snack') {
    const supp = SUPPLEMENT_FOOD[prefs.supplement];
    const proteins = supp && ok(supp) ? [supp, ...SNACK_PROTEIN] : SNACK_PROTEIN;
    const p = pick(lean(proteins));
    const items = p ? [item(p, 1)] : [];
    const used = sumM(items.map((i) => i.macros));
    if (budget.carbs - used.carbs >= 12 && budget.kcal - used.kcal >= 60) {
      const c = pick(SNACK_CARBS, 1);
      if (c) items.push(item(c, 1));
    }
    return items.length ? { items, total: sumM(items.map((i) => i.macros)) } : null;
  }

  const items: MealIdea['items'] = [];
  const protein = pick(lean(PROTEIN_BY_DIET[prefs.diet])) ?? pick(SIDE_PROTEIN);
  if (protein) {
    const per = servingMacros(protein, 1)!;
    const servings = halfSteps((budget.protein * 0.75) / Math.max(per.protein, 1), 0.5, 2.5);
    items.push(item(protein, servings));
  }
  // Veg is nearly free and keeps a trimmed plate from looking empty.
  items.push(item('green salad', 1));
  if (meal !== 'breakfast' && budget.kcal > 350 && ok('dal') && protein !== 'dal') {
    const side = sumM(items.map((i) => i.macros));
    if (budget.protein - side.protein > 12) items.push(item('dal', 1));
  }

  let used = sumM(items.map((i) => i.macros));
  const carbRoom = budget.carbs - used.carbs;
  let note: string | undefined;
  const carb = pick(CARBS[meal === 'breakfast' ? 'breakfast' : 'main'], 2);
  if (carb && carbRoom >= 15) {
    const per = servingMacros(carb, 1)!;
    const servings = halfSteps(carbRoom / Math.max(per.carbs, 1), 0.5, 3);
    if (per.carbs * servings <= carbRoom + 12) items.push(item(carb, servings));
  } else {
    note = 'Skip the starch this time — carbs are tight for this meal.';
  }

  used = sumM(items.map((i) => i.macros));
  if (budget.fat - used.fat > 12 && ok('almonds') && meal === 'breakfast') items.push(item('almonds', 0.5));

  return { items, total: items.reduce((s, i) => addM(s, i.macros), ZERO), note };
}
