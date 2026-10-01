import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Chips, Stepper } from './form';
import { Badge, Button, IconButton, Icons, T } from './ui';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { ALLOWANCE_PRESETS, allowanceFromPreset, allowanceTags, conflicts } from '@/lib/diet';
import type { Allowance, Prefs } from '@/lib/profile';

export const WEEKDAY_CHIPS = [1, 2, 3, 4, 5, 6, 0].map((wd) => ({
  value: wd,
  label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd],
}));

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

/**
 * Edits planned treats. New treats default to the user's heaviest days (from their learned
 * weekday pattern), so nothing assumes the weekend.
 */
export function TreatsEditor({
  prefs,
  onChange,
  dayWeights,
}: {
  prefs: Prefs;
  onChange: (allowances: Allowance[]) => void;
  dayWeights: number[];
}) {
  const [custom, setCustom] = useState({ label: '', kcal: '', carbs: '' });
  const [adding, setAdding] = useState(false);
  const list = prefs.allowances;
  const top = Math.max(...dayWeights);
  const heavy = dayWeights.flatMap((w, wd) => (w >= top - 0.05 ? [wd] : []));
  const defaultDays = top > 1.05 ? heavy : [];
  const update = (id: string, patch: Partial<Allowance>) => onChange(list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const addCustom = () => {
    const kcal = Number(custom.kcal);
    if (!custom.label.trim() || !(kcal > 0)) return;
    const carbs = Math.min(Number(custom.carbs) || 0, kcal / 4);
    onChange([
      ...list,
      {
        id: newId('custom'),
        foodKey: `custom:${custom.label.trim().toLowerCase()}`,
        label: custom.label.trim(),
        unit: 'serving',
        kcal,
        carbs,
        protein: 0,
        fat: Math.max(0, (kcal - carbs * 4) / 9),
        perWeek: 1,
        days: defaultDays,
      },
    ]);
    setCustom({ label: '', kcal: '', carbs: '' });
  };

  return (
    <View style={{ gap: Spacing.two }}>
      {list.length === 0 && !adding && (
        <T variant="caption">None yet. Recurring treats in your log (beer, dessert…) are picked up automatically.</T>
      )}
      {list.map((a) => {
        const clash = conflicts(allowanceTags(a), prefs);
        return (
          <View key={a.id} style={styles.item}>
            <View style={styles.head}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="label" color={Colors.text}>
                  {a.label}
                </T>
                <T variant="caption">
                  {fmt(a.kcal)} kcal · {Math.round(a.carbs)} g carbs per {a.unit}
                </T>
              </View>
              {clash.map((c) => (
                <Badge key={c} color={Colors.warn} bg={Colors.warnSoft}>
                  {c}
                </Badge>
              ))}
              <IconButton label={`Remove ${a.label}`} onPress={() => onChange(list.filter((x) => x.id !== a.id))}>
                <Icons.X size={14} color={Colors.textMuted} />
              </IconButton>
            </View>
            <View style={styles.row}>
              <Stepper value={a.perWeek} onChange={(perWeek) => update(a.id, { perWeek })} min={1} max={21} format={(v) => `${v}×`} />
              <T variant="caption">per week, on</T>
            </View>
            <Chips value={a.days} onChange={(days) => update(a.id, { days })} options={WEEKDAY_CHIPS} />
            {a.days.length === 0 && (
              <T variant="caption" color={Colors.warn}>
                Pick the day(s) this usually happens.
              </T>
            )}
          </View>
        );
      })}

      {adding ? (
        <>
          <View style={styles.presets}>
            {ALLOWANCE_PRESETS.map((p) => (
              <Pressable
                key={p.foodKey}
                onPress={() => onChange([...list, allowanceFromPreset(p, 1, defaultDays)])}
                style={(s) => [styles.preset, (s as { hovered?: boolean }).hovered && { borderColor: Colors.borderStrong }]}>
                <Icons.Plus size={12} color={Colors.textDim} />
                <T variant="label" style={{ fontSize: 12.5 }}>
                  {p.label}
                </T>
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            <TextInput
              value={custom.label}
              onChangeText={(label) => setCustom((c) => ({ ...c, label }))}
              placeholder="Something else…"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, { flex: 2 }]}
            />
            <TextInput
              value={custom.kcal}
              onChangeText={(kcal) => setCustom((c) => ({ ...c, kcal: kcal.replace(/[^0-9]/g, '') }))}
              placeholder="kcal"
              keyboardType="number-pad"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, { flex: 1, fontFamily: Fonts.mono }]}
            />
            <TextInput
              value={custom.carbs}
              onChangeText={(carbs) => setCustom((c) => ({ ...c, carbs: carbs.replace(/[^0-9]/g, '') }))}
              placeholder="carbs g"
              keyboardType="number-pad"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, { flex: 1, fontFamily: Fonts.mono }]}
            />
            <Button size="sm" onPress={addCustom} disabled={!custom.label.trim() || !(Number(custom.kcal) > 0)}>
              Add
            </Button>
          </View>
        </>
      ) : (
        <Button size="sm" kind="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => setAdding(true)} icon={<Icons.Plus size={13} color={Colors.textDim} />}>
          Add a treat
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  input: {
    minWidth: 0,
    height: 38,
    paddingHorizontal: 10,
    color: Colors.text,
    fontFamily: Fonts.sans,
    fontSize: 13.5,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.sm,
    outlineWidth: 0,
  },
});
