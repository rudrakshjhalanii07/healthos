import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { Badge, Button, Card, CardHeader, Icons, Segmented, T } from './ui';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { conflicts, swapsFor } from '@/lib/diet';
import { estimateFood } from '@/lib/foods';
import { MEAL_LABEL, MEAL_ORDER, type Macros, type MealPlan } from '@/lib/macros';
import { assumedMacros } from '@/lib/model';
import type { Prefs } from '@/lib/profile';
import { type Entry, type Meal, useStore } from '@/lib/store';

export const MEALS: { value: Meal; label: string }[] = MEAL_ORDER.map((m) => ({ value: m, label: MEAL_LABEL[m] }));

function mealForNow(): Meal {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 18) return 'snack';
  return 'dinner';
}

type NewEntry = Omit<Entry, 'id' | 'createdAt' | 'date' | 'meal'>;

const r = (n: number) => Math.round(n);

/** What logging `m` into `meal` does to the rest of the day, shown before the user commits. */
function impact(m: Macros, meal: Meal, plan: MealPlan | null): { tone: 'good' | 'warn'; text: string } | null {
  if (!plan) return null;
  const row = plan.meals.find((x) => x.meal === meal);
  const label = MEAL_LABEL[meal].toLowerCase();
  if (row && (row.status === 'next' || row.status === 'upcoming')) {
    const overC = m.carbs - row.budget.carbs;
    const overF = m.fat - row.budget.fat;
    if (overC > 8 || overF > 5) {
      const parts = [overC > 8 ? `+${r(overC)} g carbs` : null, overF > 5 ? `+${r(overF)} g fat` : null].filter(Boolean);
      return { tone: 'warn', text: `${parts.join(', ')} over ${label}’s budget — the meals after it get trimmed to make up.` };
    }
    return { tone: 'good', text: `Fits ${label} — leaves ${r(Math.max(0, row.budget.kcal - m.kcal))} kcal of its budget.` };
  }
  const leftC = plan.remaining.carbs - m.carbs;
  if (leftC < -5) return { tone: 'warn', text: `Takes today ${r(-leftC)} g over on carbs — tomorrow’s meals absorb it.` };
  return { tone: 'good', text: `Leaves ${r(Math.max(0, plan.remaining.kcal - m.kcal))} kcal for the rest of today.` };
}

export function FoodLogger({
  dayLabel,
  onAdd,
  mealPlan,
  prefs,
  style,
}: {
  dayLabel: string;
  onAdd: (entry: NewEntry, meal: Meal) => void;
  /** Only passed for days that can still be rebalanced (today and later). */
  mealPlan: MealPlan | null;
  prefs: Prefs;
  style?: StyleProp<ViewStyle>;
}) {
  const { data } = useStore();
  const [mode, setMode] = useState<'estimate' | 'manual'>('estimate');
  const [meal, setMeal] = useState<Meal>(mealForNow);
  const [query, setQuery] = useState('');
  const [manual, setManual] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' });

  const suggestions = estimateFood(query, 4);
  const recents = [...data.entries]
    .sort((a, b) => b.createdAt - a.createdAt)
    .filter((e, i, all) => all.findIndex((x) => x.name === e.name && x.kcal === e.kcal) === i)
    .slice(0, 6);

  const add = (entry: NewEntry) => {
    onAdd(entry, meal);
    setQuery('');
    setManual({ name: '', kcal: '', protein: '', carbs: '', fat: '' });
  };

  const addEstimate = (s: (typeof suggestions)[number]) =>
    add({
      name: s.name,
      detail: s.detail,
      kcal: s.kcal,
      protein: s.protein,
      carbs: s.carbs,
      fat: s.fat,
      foodKey: s.key,
      tags: s.tags,
      source: 'estimate',
    });

  const manualKcal = Number(manual.kcal);
  const manualValid =
    manual.name.trim().length > 0 && Number.isFinite(manualKcal) && manualKcal > 0 && manualKcal < 10000;
  const hasMacros = manual.protein !== '' || manual.carbs !== '' || manual.fat !== '';
  const manualMacros: Macros = hasMacros
    ? { kcal: manualKcal, protein: Number(manual.protein) || 0, carbs: Number(manual.carbs) || 0, fat: Number(manual.fat) || 0 }
    : assumedMacros(manualKcal);
  const submitManual = () => {
    if (!manualValid) return;
    add({
      name: manual.name.trim(),
      kcal: Math.round(manualKcal),
      protein: r(manualMacros.protein),
      carbs: r(manualMacros.carbs),
      fat: r(manualMacros.fat),
      macrosEstimated: !hasMacros,
      source: 'manual',
    });
  };

  const top = suggestions[0];
  const topImpact = top ? impact(top, meal, mealPlan) : null;
  const manualImpact = manualValid ? impact(manualMacros, meal, mealPlan) : null;

  return (
    <Card style={style}>
      <CardHeader
        title={`Log food · ${dayLabel}`}
        right={
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'estimate', label: 'Estimate' },
              { value: 'manual', label: 'Manual' },
            ]}
            style={{ width: 200 }}
          />
        }
      />

      <View style={styles.meals}>
        {MEALS.map((m) => {
          const active = m.value === meal;
          const budget = mealPlan?.meals.find((x) => x.meal === m.value);
          const open = budget && (budget.status === 'next' || budget.status === 'upcoming');
          return (
            <Pressable key={m.value} onPress={() => setMeal(m.value)} style={[styles.meal, active && styles.mealActive]}>
              <T variant="label" color={active ? Colors.accent : Colors.textMuted} style={{ fontSize: 12.5 }}>
                {m.label}
                {open ? <T variant="caption"> · {r(budget.budget.kcal)}</T> : null}
              </T>
            </Pressable>
          );
        })}
      </View>

      {mode === 'estimate' ? (
        <View style={{ gap: Spacing.two }}>
          <View style={styles.inputWrap}>
            <Icons.Search size={16} color={Colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Try “2 eggs”, “200g chicken breast”, “1 cup rice”"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              autoCorrect={false}
              onSubmitEditing={() => top && addEstimate(top)}
            />
          </View>

          {query.trim().length >= 2 && suggestions.length === 0 && (
            <View style={styles.empty}>
              <T variant="body" style={{ flexShrink: 1, marginRight: 'auto' }}>
                No estimate for “{query.trim()}”.
              </T>
              <Button
                size="sm"
                onPress={() => {
                  setManual((m) => ({ ...m, name: query.trim() }));
                  setMode('manual');
                }}>
                Enter calories
              </Button>
            </View>
          )}

          {suggestions.map((s, i) => {
            const clash = conflicts(s.tags, prefs);
            const swaps = clash.length ? swapsFor(s.key, prefs) : [];
            return (
              <View key={s.key} style={{ gap: 6 }}>
                <Pressable
                  onPress={() => addEstimate(s)}
                  style={(st) => {
                    const hovered = (st as { hovered?: boolean }).hovered;
                    return [
                      styles.suggestion,
                      (hovered || i === 0) && styles.suggestionHot,
                      clash.length > 0 && { borderColor: Colors.warnBorder },
                    ];
                  }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <T variant="label" color={Colors.text}>
                        {s.name}
                      </T>
                      {clash.map((c) => (
                        <Badge key={c} color={Colors.warn} bg={Colors.warnSoft}>
                          {c}
                        </Badge>
                      ))}
                    </View>
                    <T variant="caption">
                      {s.detail} · P {r(s.protein)} · C {r(s.carbs)} · F {r(s.fat)}
                    </T>
                  </View>
                  <T variant="mono" color={Colors.text}>
                    {s.kcal.toLocaleString('en-US')}
                    <T variant="caption"> kcal</T>
                  </T>
                  <View style={[styles.addDot, i === 0 && { backgroundColor: Colors.accent }]}>
                    <Icons.Plus size={14} color={i === 0 ? Colors.onAccent : Colors.textDim} />
                  </View>
                </Pressable>
                {swaps.length > 0 && (
                  <View style={styles.swaps}>
                    <T variant="caption">Works for you instead:</T>
                    {swaps.map((w) => (
                      <Pressable key={w.query} onPress={() => setQuery(w.query)} style={styles.swap}>
                        <T variant="caption" color={Colors.info}>
                          {w.label}
                        </T>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}

          {topImpact && <ImpactLine {...topImpact} />}
          {suggestions.length > 0 && (
            <T variant="caption">Press Enter to add the top match. Estimates are typical values — adjust in Manual if needed.</T>
          )}
        </View>
      ) : (
        <View style={{ gap: Spacing.two }}>
          <View style={styles.manualRow}>
            <View style={[styles.inputWrap, { flex: 1 }]}>
              <TextInput
                value={manual.name}
                onChangeText={(name) => setManual((m) => ({ ...m, name }))}
                placeholder="Food name"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                onSubmitEditing={submitManual}
              />
            </View>
            <NumBox value={manual.kcal} onChange={(kcal) => setManual((m) => ({ ...m, kcal }))} suffix="kcal" width={120} onSubmit={submitManual} />
          </View>
          <View style={styles.manualRow}>
            <NumBox value={manual.protein} onChange={(protein) => setManual((m) => ({ ...m, protein }))} suffix="g protein" onSubmit={submitManual} />
            <NumBox value={manual.carbs} onChange={(carbs) => setManual((m) => ({ ...m, carbs }))} suffix="g carbs" onSubmit={submitManual} />
            <NumBox value={manual.fat} onChange={(fat) => setManual((m) => ({ ...m, fat }))} suffix="g fat" onSubmit={submitManual} />
          </View>
          <T variant="caption">Macros are optional — leave them blank and a typical mixed split is assumed.</T>
          {manualImpact && <ImpactLine {...manualImpact} />}
          <Button kind="primary" disabled={!manualValid} onPress={submitManual} icon={<Icons.Plus size={16} color={Colors.onAccent} />}>
            Add entry
          </Button>
        </View>
      )}

      {recents.length > 0 && (
        <View style={{ gap: Spacing.two, marginTop: 'auto' }}>
          <T variant="caption" style={styles.sectionLabel}>
            RECENT
          </T>
          <View style={styles.chips}>
            {recents.map((e) => (
              <Pressable
                key={e.id}
                onPress={() =>
                  add({
                    name: e.name,
                    detail: e.detail,
                    kcal: e.kcal,
                    protein: e.protein,
                    carbs: e.carbs,
                    fat: e.fat,
                    macrosEstimated: e.macrosEstimated,
                    foodKey: e.foodKey,
                    tags: e.tags,
                    source: e.source,
                  })
                }
                style={(st) => {
                  const hovered = (st as { hovered?: boolean }).hovered;
                  return [styles.chip, hovered && { borderColor: Colors.borderStrong, backgroundColor: Colors.surfaceHover }];
                }}>
                <T variant="label" color={Colors.text} style={{ fontSize: 12.5 }}>
                  {e.name}
                </T>
                <T variant="mono" color={Colors.textMuted} style={{ fontSize: 11.5 }}>
                  {e.kcal}
                </T>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

function ImpactLine({ tone, text }: { tone: 'good' | 'warn'; text: string }) {
  const color = tone === 'warn' ? Colors.warn : Colors.accent;
  return (
    <View style={[styles.impact, { borderColor: tone === 'warn' ? Colors.warnBorder : Colors.accentBorder }]}>
      <View style={[styles.impactDot, { backgroundColor: color }]} />
      <T variant="caption" color={Colors.text} style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

function NumBox({
  value,
  onChange,
  suffix,
  width,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  width?: number;
  onSubmit: () => void;
}) {
  return (
    <View style={[styles.inputWrap, width ? { width } : { flex: 1 }]}>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
        placeholder="0"
        placeholderTextColor={Colors.textMuted}
        keyboardType="number-pad"
        style={[styles.input, { fontFamily: Fonts.mono }]}
        onSubmitEditing={onSubmit}
      />
      <T variant="caption">{suffix}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  meals: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  meal: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mealActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentSoft },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 46,
    paddingHorizontal: 14,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 14.5,
    outlineWidth: 0,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionHot: { backgroundColor: Colors.surfaceRaised, borderColor: Colors.borderStrong },
  addDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHover,
  },
  swaps: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingLeft: 14 },
  swap: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.infoSoft,
  },
  impact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  impactDot: { width: 6, height: 6, borderRadius: 3 },
  manualRow: { flexDirection: 'row', gap: Spacing.two },
  sectionLabel: { fontWeight: '600', letterSpacing: 0.8, fontSize: 10.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
});
