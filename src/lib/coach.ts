import { formatDay } from './dates';
import { type DayMacros, MEAL_LABEL, type MealPlan } from './macros';
import type { DayPlan } from './planner';

export type Hint = { tone: 'good' | 'warn' | 'info'; title: string; text: string };

const g = (n: number) => `${Math.round(n)} g`;
const kcal = (n: number) => `${Math.round(n).toLocaleString('en-US')} kcal`;

function macroList(parts: [number, string][], sign = '') {
  return parts
    .filter(([n]) => n >= 5)
    .map(([n, label]) => `${sign}${g(n)} ${label}`)
    .join(', ');
}

/**
 * Turns the plan for one day into plain-language guidance: what yesterday's overage costs today,
 * what the very next meal should look like after earlier meals ran over, and what spills into tomorrow.
 */
export function coachHints({
  day,
  dm,
  meals,
  nextDay,
  nextDm,
  mainMeals,
}: {
  day: DayPlan;
  dm: DayMacros;
  meals: MealPlan;
  nextDay?: DayPlan;
  nextDm?: DayMacros;
  mainMeals: number;
}): Hint[] {
  const hints: Hint[] = [];
  const isToday = day.status === 'today' && !day.locked;
  const upcoming = day.status === 'future' || isToday;

  // 1. Yesterday's overage, repaid here first.
  if (upcoming && day.payback > 0) {
    const excess = macroList([
      [dm.prevExcess.carbs, 'carbs'],
      [dm.prevExcess.fat, 'fat'],
    ], '+');
    const perMeal = macroList([
      [dm.cut.carbs / mainMeals, 'carbs'],
      [dm.cut.fat / mainMeals, 'fat'],
    ], '−');
    const rest = day.carriedOver - day.payback;
    hints.push({
      tone: 'warn',
      title: day.status === 'today' ? 'Making up for yesterday' : 'Making up for the day before',
      text:
        `It ran ${kcal(day.carriedOver)} over${excess ? ` (${excess})` : ''}, so this day is ${kcal(day.payback)} lighter` +
        `${perMeal ? `: ${perMeal} in each main meal` : ''}.` +
        (rest > 20 ? ` The other ${kcal(rest)} is spread over the rest of the week.` : ''),
    });
  }

  // 2. The very next meal, after whatever earlier meals did today.
  if (isToday && meals.next) {
    const n = meals.next;
    const label = MEAL_LABEL[n.meal].toLowerCase();
    const heavy = meals.meals.filter((m) => m.status === 'done' && m.eaten.carbs - m.usual.carbs > 10);
    const fatty = meals.meals.filter((m) => m.status === 'done' && m.eaten.fat - m.usual.fat > 6);
    const dc = n.budget.carbs - n.usual.carbs;
    const df = n.budget.fat - n.usual.fat;

    if (meals.remaining.carbs <= 0) {
      hints.push({
        tone: 'warn',
        title: 'Carbs are done for today',
        text: `You’re ${g(-meals.remaining.carbs)} past today’s carbs. Keep the rest of today to protein and veg — anything more is taken out of tomorrow’s meals.`,
      });
    } else if ((heavy.length || fatty.length) && (dc < -8 || df < -5)) {
      const why = [
        ...heavy.map((m) => `${MEAL_LABEL[m.meal].toLowerCase()} ran +${g(m.eaten.carbs - m.usual.carbs)} carbs`),
        ...fatty.map((m) => `${MEAL_LABEL[m.meal].toLowerCase()} ran +${g(m.eaten.fat - m.usual.fat)} fat`),
      ].join(' and ');
      const limits = [
        dc < -8 ? `≤ ${g(n.budget.carbs)} carbs (usually ${g(n.usual.carbs)})` : null,
        df < -5 ? `≤ ${g(n.budget.fat)} fat (usually ${g(n.usual.fat)})` : null,
      ].filter(Boolean);
      hints.push({
        tone: 'warn',
        title: `Keep ${label} lighter`,
        text: `${why ? `${capitalize(why)}, so ` : ''}aim for ${limits.join(' and ')} at ${label}. Doing it now keeps tomorrow untouched.`,
      });
    } else if (n.budget.kcal - n.usual.kcal > 80) {
      hints.push({
        tone: 'good',
        title: 'Room to spare',
        text: `Earlier meals came in light — ${label} can go up to ${kcal(n.budget.kcal)}.`,
      });
    }

    const proteinLeft = dm.target.protein - dm.eaten.protein;
    const doneCount = meals.meals.filter((m) => m.status === 'done' || m.status === 'skipped').length;
    if (doneCount >= 2 && proteinLeft > dm.target.protein * 0.5) {
      const tight = meals.remaining.kcal < proteinLeft * 4;
      hints.push({
        tone: 'info',
        title: 'Protein is behind',
        text: tight
          ? `${g(proteinLeft)} protein still to go but calories are tight — lean picks (egg whites, tofu, whey, fish) close the gap without going over.`
          : `${g(proteinLeft)} protein still to go — make it the centre of ${label} (~${g(n.budget.protein)}).`,
      });
    }
  }

  // 3. What today's overage will cost tomorrow.
  if (isToday && meals.over.kcal > 20) {
    if (nextDay && nextDm && nextDay.payback === 0) {
      hints.push({
        tone: 'info',
        title: `${kcal(meals.over.kcal)} over today`,
        text: 'No drama — it’s spread thinly over the rest of the week.',
      });
    } else if (nextDay && nextDm) {
      const cut = macroList([
        [nextDm.cut.carbs / mainMeals, 'carbs'],
        [nextDm.cut.fat / mainMeals, 'fat'],
      ], '−');
      hints.push({
        tone: 'warn',
        title: `${kcal(meals.over.kcal)} over today`,
        text: `If it stays that way, ${formatDay(nextDay.date, { weekday: 'long' })} repays ${kcal(nextDay.payback)}${cut ? ` — ${cut} per main meal` : ''}.`,
      });
    } else {
      hints.push({
        tone: 'warn',
        title: `${kcal(meals.over.kcal)} over today`,
        text: 'It’s the last day of the week, so the extra goes against this week’s total.',
      });
    }
  }

  // 4. Planned treats.
  if (upcoming && dm.allowance.kcal > 0) {
    const left = meals.allowanceLeft.kcal;
    hints.push({
      tone: 'info',
      title: 'Treats planned',
      text:
        left > 10
          ? `${kcal(left)} is set aside for your planned treats — the meal budgets already leave room for them.`
          : 'Your planned treats are logged. Meal budgets now cover everything that’s left.',
    });
  }

  return hints;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
