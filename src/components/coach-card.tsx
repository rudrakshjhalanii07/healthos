import { useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Badge, Button, Card, CardHeader, Icons, T } from './ui';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Hint } from '@/lib/coach';
import { mealIdea } from '@/lib/diet';
import { MEAL_LABEL, type MealBudget, type MealPlan } from '@/lib/macros';
import type { Prefs } from '@/lib/profile';

const toneColor = { good: Colors.accent, warn: Colors.warn, info: Colors.info };
const r = (n: number) => Math.round(n);

export function CoachCard({
  hints,
  meals,
  prefs,
  isToday,
  style,
}: {
  hints: Hint[];
  meals: MealPlan;
  prefs: Prefs;
  isToday: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const [seed, setSeed] = useState(0);
  const next = meals.next;
  const idea = next ? mealIdea(next.budget, next.meal, prefs, seed) : null;

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
          MEAL BUDGETS
        </T>
        {meals.meals.map((m) => (
          <MealRow key={m.meal} m={m} />
        ))}
      </View>

      {isToday && next && idea && (
        <View style={styles.idea}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T variant="caption" style={styles.sectionLabel}>
              IDEA FOR {MEAL_LABEL[next.meal].toUpperCase()}
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

function MealRow({ m }: { m: MealBudget }) {
  const upcoming = m.status === 'next' || m.status === 'upcoming';
  const dc = m.budget.carbs - m.usual.carbs;
  const shown = upcoming ? m.budget : m.eaten;

  return (
    <View style={[styles.mealRow, m.status === 'next' && styles.mealNext]}>
      <View style={{ width: 88, gap: 2 }}>
        <T variant="label" color={upcoming ? Colors.text : Colors.textMuted}>
          {MEAL_LABEL[m.meal]}
        </T>
        {m.status === 'next' ? (
          <Badge color={Colors.accent} bg={Colors.accentSoft}>
            Next
          </Badge>
        ) : (
          <T variant="caption" style={{ fontSize: 10.5 }}>
            {m.status === 'done' ? 'eaten' : m.status === 'skipped' ? 'skipped' : 'planned'}
          </T>
        )}
      </View>
      {m.status === 'skipped' ? (
        <T variant="caption" style={{ flex: 1 }}>
          Budget moved to later meals
        </T>
      ) : (
        <View style={styles.mealNums}>
          <T variant="mono" color={upcoming ? Colors.text : Colors.textDim} style={{ fontSize: 12.5, minWidth: 64 }}>
            {upcoming ? '≤ ' : ''}
            {r(shown.kcal)}
            <T variant="caption"> kcal</T>
          </T>
          <T variant="caption" style={styles.macro}>
            P {r(shown.protein)}
          </T>
          <T variant="caption" style={styles.macro} color={upcoming && dc < -8 ? Colors.warn : undefined}>
            C {r(shown.carbs)}
            {upcoming && Math.abs(dc) >= 8 ? ` (${dc > 0 ? '+' : '−'}${r(Math.abs(dc))})` : ''}
          </T>
          <T variant="caption" style={styles.macro}>
            F {r(shown.fat)}
          </T>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  sectionLabel: { fontWeight: '600', letterSpacing: 0.8, fontSize: 10.5 },
  mealRow: {
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
  mealNext: { borderColor: Colors.accentBorder },
  mealNums: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', columnGap: 10 },
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
