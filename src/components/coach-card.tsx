import { useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Button, Card, CardHeader, Icons, T } from './ui';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Hint } from '@/lib/coach';
import { type IdeaKind, mealIdea } from '@/lib/diet';
import { type DayBudget, type Macros, scaleM } from '@/lib/macros';
import type { Prefs } from '@/lib/profile';

const toneColor = { good: Colors.accent, warn: Colors.warn, info: Colors.info };
const r = (n: number) => Math.round(n);

/** A single plate's worth of what's left: at most ~40% of the day, so the idea stays one sitting. */
function plateFor(left: Macros, dayKcal: number): { budget: Macros; kind: IdeaKind } {
  const cap = dayKcal * 0.4;
  const budget = left.kcal > cap ? scaleM(left, cap / left.kcal) : left;
  const kind: IdeaKind = budget.kcal < 250 ? 'snack' : new Date().getHours() < 11 ? 'breakfast' : 'main';
  return { budget, kind };
}

export function CoachCard({
  hints,
  budget,
  target,
  prefs,
  isToday,
  style,
}: {
  hints: Hint[];
  budget: DayBudget;
  /** The whole day's target, used to size the idea to one plate. */
  target: Macros;
  prefs: Prefs;
  isToday: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [seed, setSeed] = useState(0);
  const plate = plateFor(budget.left, target.kcal);
  const idea = isToday ? mealIdea(plate.budget, plate.kind, prefs, seed) : null;

  return (
    <Card style={style}>
      <CardHeader
        title="Coach"
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icons.Sparkle size={13} color={Colors.accent} />
            <T variant="caption" color={Colors.accent}>
              Rebalances after every entry
            </T>
          </View>
        }
      />

      {hints.length > 0 && (
        <View style={{ gap: Spacing.three }}>
          {hints.map((h) => (
            <View key={h.title} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.dot, { backgroundColor: toneColor[h.tone] }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="label" color={Colors.text}>
                  {h.title}
                </T>
                <T variant="body" style={{ fontSize: 13.5 }}>
                  {h.text}
                </T>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ gap: 6 }}>
        <T variant="caption" style={styles.sectionLabel}>
          {isToday ? 'LEFT TODAY' : 'DAY BUDGET'}
        </T>
        <BudgetRow label={isToday ? 'Left' : 'Planned'} m={isToday ? budget.left : target} />
        {budget.eaten.kcal > 0 && <BudgetRow label="Eaten" m={budget.eaten} muted />}
      </View>

      {idea && (
        <View style={styles.idea}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T variant="caption" style={styles.sectionLabel}>
              IDEA THAT FITS WHAT’S LEFT
            </T>
            <Button size="sm" kind="ghost" onPress={() => setSeed((s) => s + 1)}>
              Shuffle
            </Button>
          </View>
          {idea.items.map((i) => (
            <View key={i.name} style={styles.ideaRow}>
              <T variant="label" color={Colors.text} style={{ flex: 1 }}>
                {i.name} <T variant="caption">· {i.portion}</T>
              </T>
              <T variant="mono" color={Colors.textDim} style={{ fontSize: 12 }}>
                {r(i.macros.kcal)}
              </T>
            </View>
          ))}
          <T variant="caption">
            ≈ {r(idea.total.kcal)} kcal · P {r(idea.total.protein)} · C {r(idea.total.carbs)} · F {r(idea.total.fat)}
            {idea.note ? ` — ${idea.note}` : ''}
          </T>
        </View>
      )}
    </Card>
  );
}

function BudgetRow({ label, m, muted }: { label: string; m: Macros; muted?: boolean }) {
  return (
    <View style={[styles.budgetRow, !muted && styles.budgetHot]}>
      <T variant="label" color={muted ? Colors.textMuted : Colors.text} style={{ width: 88 }}>
        {label}
      </T>
      <View style={styles.budgetNums}>
        <T variant="mono" color={muted ? Colors.textDim : Colors.text} style={{ fontSize: 12.5, minWidth: 64 }}>
          {r(m.kcal)}
          <T variant="caption"> kcal</T>
        </T>
        <T variant="caption" style={styles.macro}>
          P {r(m.protein)}
        </T>
        <T variant="caption" style={styles.macro}>
          C {r(m.carbs)}
        </T>
        <T variant="caption" style={styles.macro}>
          F {r(m.fat)}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  sectionLabel: { fontWeight: '600', letterSpacing: 0.8, fontSize: 10.5 },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  budgetHot: { borderColor: Colors.accentBorder },
  budgetNums: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', columnGap: 10 },
  macro: { minWidth: 36, textAlign: 'right' },
  idea: {
    gap: 6,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
  },
  ideaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
