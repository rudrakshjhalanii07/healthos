import { formatDay } from './dates';
import type { DayBudget, DayMacros } from './macros';
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
 * what's left of today after everything logged so far, and what spills into tomorrow.
 */
export function coachHints({
  day,
  dm,
  budget,
  nextDay,
  nextDm,
}: {
  day: DayPlan;
  dm: DayMacros;
  budget: DayBudget;
  nextDay?: DayPlan;
  nextDm?: DayMacros;
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
    const cut = macroList([
      [dm.cut.carbs, 'carbs'],
      [dm.cut.fat, 'fat'],
    ], '−');
    const rest = day.carriedOver - day.payback;
    hints.push({
      tone: 'warn',
      title: day.status === 'today' ? 'Making up for yesterday' : 'Making up for the day before',
      text:
        `It ran ${kcal(day.carriedOver)} over${excess ? ` (${excess})` : ''}, so this day is ${kcal(day.payback)} lighter` +
        `${cut ? ` (${cut})` : ''}.` +
        (rest > 20 ? ` The other ${kcal(rest)} is spread over the rest of the week.` : ''),
    });
  }

  // 2. What's left of today, after everything logged so far.
  if (isToday && budget.eaten.kcal > 0) {
    const left = budget.remaining;
    if (left.carbs <= 0) {
      hints.push({
        tone: 'warn',
        title: 'Carbs are done for today',
        text: `You’re ${g(-left.carbs)} past today’s carbs. Keep the rest of today to protein and veg — anything more is taken out of tomorrow.`,
      });
    } else if (left.fat <= 0) {
      hints.push({
        tone: 'warn',
        title: 'Fat is done for today',
        text: `You’re ${g(-left.fat)} past today’s fat. Lean protein, veg and plain carbs fit what’s left.`,
      });
    }

    const proteinLeft = dm.target.protein - dm.eaten.protein;
    if (budget.eaten.kcal >= dm.target.kcal * 0.5 && proteinLeft > dm.target.protein * 0.5) {
      const tight = left.kcal < proteinLeft * 4;
      hints.push({
        tone: 'info',
        title: 'Protein is behind',
        text: tight
          ? `${g(proteinLeft)} protein still to go but calories are tight — lean picks (egg whites, tofu, whey, fish) close the gap without going over.`
          : `${g(proteinLeft)} protein still to go — make it the centre of whatever you eat next.`,
      });
    }
  }

  // 3. What today's overage will cost tomorrow.
  if (isToday && budget.over.kcal > 20) {
    if (nextDay && nextDm && nextDay.payback === 0) {
      hints.push({
        tone: 'info',
        title: `${kcal(budget.over.kcal)} over today`,
        text: 'No drama — it’s spread thinly over the rest of the week.',
      });
    } else if (nextDay && nextDm) {
      const cut = macroList([
        [nextDm.cut.carbs, 'carbs'],
        [nextDm.cut.fat, 'fat'],
      ], '−');
      hints.push({
        tone: 'warn',
        title: `${kcal(budget.over.kcal)} over today`,
        text: `If it stays that way, ${formatDay(nextDay.date, { weekday: 'long' })} repays ${kcal(nextDay.payback)}${cut ? ` (${cut})` : ''}.`,
      });
    } else {
      hints.push({
        tone: 'warn',
        title: `${kcal(budget.over.kcal)} over today`,
        text: 'It’s the last day of the week, so the extra goes against this week’s total.',
      });
    }
  }

  // 4. Planned treats.
  if (upcoming && dm.allowance.kcal > 0) {
    const left = budget.allowanceLeft.kcal;
    hints.push({
      tone: 'info',
      title: 'Treats planned',
      text:
        left > 10
          ? `${kcal(left)} is set aside for your planned treats — today’s budget already leaves room for them.`
          : 'Your planned treats are logged. Today’s budget now covers everything that’s left.',
    });
  }

  return hints;
}

