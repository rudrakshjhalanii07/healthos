import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { Badge, Button, Card, CardHeader, IconButton, Icons, ProgressBar, T } from './ui';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatDay, todayKey } from '@/lib/dates';
import { CALIBRATION_DAYS, DAYS_FOR_PLAN, type Habits, type Proposal, weightTrend } from '@/lib/learn';
import { type Allowance, kgToLb, lbToKg, type Profile } from '@/lib/profile';
import type { WeighIn } from '@/lib/store';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Plain-language observations about the user's habits. */
function observations(h: Habits, weightKg: number, proteinTarget: number) {
  const out: string[] = [];
  if (h.avgIntake) out.push(`You average ~${fmt(h.avgIntake)} kcal on fully logged days.`);
  const heavy = ORDER.filter((wd) => h.dayWeights[wd] >= 1.1);
  const light = ORDER.filter((wd) => h.dayWeights[wd] <= 0.9);
  if (heavy.length) {
    const lift = Math.round((Math.max(...heavy.map((wd) => h.dayWeights[wd])) - 1) * 100);
    out.push(`${heavy.map((wd) => WD[wd]).join(', ')} run heavier — up to ${lift}% above your average.`);
  }
  if (light.length) out.push(`${light.map((wd) => WD[wd]).join(', ')} are your lighter days.`);
  const target = proteinTarget / weightKg;
  if (h.proteinPerKg && h.proteinPerKg < target - 0.3) {
    out.push(`Protein averages ${h.proteinPerKg.toFixed(1)} g/kg — the plan nudges it toward ${target.toFixed(1)}.`);
  }
  if (h.treats.length) {
    out.push(`Recurring: ${h.treats.map((t) => `${t.allowance.label.toLowerCase()} (${t.occurrences}×)`).join(', ')}.`);
  }
  if (h.variability > 0.3) out.push('Intake swings a lot day to day — burst days will absorb some of that.');
  return out;
}

export function CalibrationCard({
  day,
  completeDays,
  habits,
  canReadEarly,
  onReadEarly,
  profile,
  proteinTarget,
  hasTrend,
}: {
  day: number;
  completeDays: number;
  habits: Habits | null;
  canReadEarly: boolean;
  onReadEarly: () => void;
  profile: Profile;
  proteinTarget: number;
  hasTrend: boolean;
}) {
  const notes = habits && habits.completeDays >= 2 ? observations(habits, profile.weightKg, proteinTarget) : [];
  return (
    <Card style={styles.learning}>
      <CardHeader
        title={`Learning your pattern · day ${day} of ${CALIBRATION_DAYS}`}
        right={
          canReadEarly ? (
            <Button size="sm" onPress={onReadEarly} icon={<Icons.Sparkle size={13} color={Colors.text} />}>
              Build my plan now
            </Button>
          ) : undefined
        }
      />
      <View style={{ gap: 6 }}>
        <ProgressBar value={completeDays / DAYS_FOR_PLAN} />
        <T variant="caption">
          {completeDays} of {DAYS_FOR_PLAN} full days logged. Eat the way you normally do — the plan is built from your real habits.
        </T>
      </View>
      {notes.length > 0 ? (
        <View style={{ gap: 6 }}>
          <T variant="caption" style={styles.sectionLabel}>
            SO FAR
          </T>
          {notes.map((n) => (
            <View key={n} style={{ flexDirection: 'row', gap: 8 }}>
              <View style={styles.dot} />
              <T variant="body" style={{ flex: 1, fontSize: 13.5, color: Colors.text }}>
                {n}
              </T>
            </View>
          ))}
        </View>
      ) : (
        <T variant="caption">Log a couple of full days and your first observations show up here.</T>
      )}
      {!hasTrend && (
        <T variant="caption" color={Colors.info}>
          Tip: weigh in 3+ times a week and your real maintenance replaces the formula estimate.
        </T>
      )}
    </Card>
  );
}

const SOURCE_LABEL = {
  'weight-trend': 'from your intake vs. weight trend',
  stated: 'the number you gave',
  formula: 'formula estimate — add weigh-ins to calibrate',
};

export function ProposalCard({
  proposal: p,
  profile,
  proteinTarget,
  onApply,
  onDismiss,
  early,
}: {
  proposal: Proposal;
  profile: Profile;
  proteinTarget: number;
  onApply: (treats: Allowance[]) => void;
  onDismiss: () => void;
  early?: boolean;
}) {
  const [keep, setKeep] = useState<string[]>(p.treats.map((t) => t.foodKey));
  const notes = observations(p.habits, profile.weightKg, proteinTarget);
  const isUpdate = p.kind === 'update';
  const maxW = Math.max(...p.dayWeights);

  return (
    <Card style={styles.proposal}>
      <CardHeader
        title={isUpdate ? 'Plan check-in' : early ? 'Early plan (from limited data)' : 'Your plan is ready'}
        right={
          <Badge color={Colors.accent} bg={Colors.accentSoft}>
            Based on {p.habits.completeDays} full days
          </Badge>
        }
      />

      {isUpdate && p.changes.length > 0 && (
        <View style={{ gap: 4 }}>
          {p.changes.map((c) => (
            <T key={c} variant="body" style={{ color: Colors.text, fontSize: 13.5 }}>
              • {c}
            </T>
          ))}
        </View>
      )}

      <View style={styles.cols}>
        <View style={styles.col}>
          <T variant="caption">Maintenance</T>
          <T variant="display" style={{ fontSize: 26 }}>
            {fmt(p.maintenance)}
          </T>
          <T variant="caption">{SOURCE_LABEL[p.maintenanceSource]}</T>
        </View>
        <View style={styles.col}>
          <T variant="caption">Target now</T>
          <T variant="display" style={{ fontSize: 26 }} color={Colors.accent}>
            {fmt(p.dailyTarget)}
          </T>
          <T variant="caption">kcal/day avg · {fmt(p.dailyTarget * 7)}/week</T>
        </View>
      </View>

      {p.stepped && (
        <T variant="caption" color={Colors.warn}>
          You’re averaging ~{fmt(p.habits.avgIntake)}. Jumping straight to {fmt(p.goalTarget)} rarely sticks, so this starts at{' '}
          {fmt(p.dailyTarget)} and steps toward the goal at each weekly check-in.
        </T>
      )}

      <View style={{ gap: 6 }}>
        <T variant="caption" style={styles.sectionLabel}>
          YOUR WEEK SHAPE
        </T>
        <View style={styles.bars}>
          {ORDER.map((wd) => {
            const w = p.dayWeights[wd];
            return (
              <View key={wd} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      { height: `${(w / maxW) * 100}%`, backgroundColor: w >= 1.1 ? Colors.warn : w <= 0.9 ? Colors.info : Colors.textMuted },
                    ]}
                  />
                </View>
                <T variant="mono" style={{ fontSize: 11 }}>
                  {fmt((p.dailyTarget * 7 * w) / 7)}
                </T>
                <T variant="caption" style={{ fontSize: 10.5 }}>
                  {WD[wd]}
                </T>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.chips}>
        <Badge color={Colors.textDim} bg={Colors.surfaceHover}>
          Protein {proteinTarget} g/day
        </Badge>
        <Badge color={Colors.textDim} bg={Colors.surfaceHover}>
          Fat {pct(p.fatPct)} of kcal (your usual)
        </Badge>
      </View>

      {p.treats.length > 0 && (
        <View style={{ gap: 6 }}>
          <T variant="caption" style={styles.sectionLabel}>
            PLAN THESE IN INSTEAD OF FIGHTING THEM?
          </T>
          {p.treats.map((t) => {
            const on = keep.includes(t.foodKey);
            return (
              <Pressable
                key={t.foodKey}
                onPress={() => setKeep((k) => (on ? k.filter((x) => x !== t.foodKey) : [...k, t.foodKey]))}
                style={[styles.treat, on && styles.treatOn]}>
                <View style={[styles.check, on && styles.checkOn]}>{on && <Icons.Check size={10} color={Colors.onAccent} />}</View>
                <T variant="label" color={Colors.text} style={{ flex: 1 }}>
                  {t.perWeek}× {t.label.toLowerCase()} a week{t.days.length ? ` · ${t.days.map((d) => WD[d]).join('/')}` : ''}
                </T>
                <T variant="caption">{fmt(t.kcal * t.perWeek)} kcal/wk</T>
              </Pressable>
            );
          })}
        </View>
      )}

      {!isUpdate && notes.length > 0 && (
        <View style={{ gap: 4 }}>
          {notes.slice(0, 4).map((n) => (
            <T key={n} variant="caption">
              • {n}
            </T>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Button kind="ghost" onPress={onDismiss}>
          {isUpdate ? 'Not now' : early ? 'Keep learning' : 'Remind me later'}
        </Button>
        <Button
          kind="primary"
          onPress={() => onApply(p.treats.filter((t) => keep.includes(t.foodKey)))}
          icon={<Icons.Check size={15} color={Colors.onAccent} />}>
          {isUpdate ? 'Update plan' : 'Use this plan'}
        </Button>
      </View>
    </Card>
  );
}

export function WeightCard({
  weighIns,
  profile,
  onAdd,
  onRemove,
  style,
}: {
  weighIns: WeighIn[];
  profile: Profile;
  onAdd: (kg: number) => void;
  onRemove: (date: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const [text, setText] = useState('');
  const imperial = profile.units === 'imperial';
  const show = (kg: number) => (imperial ? kgToLb(kg) : kg).toFixed(1);
  const unit = imperial ? 'lb' : 'kg';
  const trend = weightTrend(weighIns, todayKey());
  const recent = [...weighIns].reverse().slice(0, 4);
  const value = Number(text);
  const valid = value > 0 && (imperial ? lbToKg(value) : value) >= 30 && (imperial ? lbToKg(value) : value) <= 300;
  const submit = () => {
    if (!valid) return;
    onAdd(Math.round((imperial ? lbToKg(value) : value) * 10) / 10);
    setText('');
  };

  return (
    <Card style={style}>
      <CardHeader
        title="Weigh-ins"
        right={
          trend ? (
            <T variant="caption" color={Colors.text}>
              {trend.kgPerWeek > 0 ? '+' : '−'}
              {show(Math.abs(trend.kgPerWeek))} {unit}/wk
            </T>
          ) : undefined
        }
      />
      <View style={styles.weightRow}>
        <View style={styles.inputWrap}>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.replace(/[^0-9.]/g, ''))}
            placeholder={show(profile.weightKg)}
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
            style={styles.input}
            onSubmitEditing={submit}
          />
          <T variant="caption">{unit}</T>
        </View>
        <Button kind="primary" size="sm" disabled={!valid} onPress={submit}>
          Log today
        </Button>
      </View>
      {recent.length > 0 ? (
        <View style={{ gap: 4 }}>
          {recent.map((w) => (
            <View key={w.date} style={styles.weighIn}>
              <T variant="caption" style={{ flex: 1 }}>
                {formatDay(w.date, { weekday: 'short', month: 'short', day: 'numeric' })}
              </T>
              <T variant="mono" color={Colors.text} style={{ fontSize: 12.5 }}>
                {show(w.kg)} {unit}
              </T>
              <IconButton label="Remove weigh-in" onPress={() => onRemove(w.date)} style={{ width: 24, height: 24 }}>
                <Icons.X size={12} color={Colors.textMuted} />
              </IconButton>
            </View>
          ))}
        </View>
      ) : null}
      <T variant="caption" style={{ marginTop: 'auto' }}>
        {trend
          ? `Trend over ${trend.spanDays} days from ${trend.points} weigh-ins — this is what calibrates your maintenance.`
          : 'Same time of day, 3+ times a week. Two weeks of weigh-ins turns the maintenance estimate into your real number.'}
      </T>
    </Card>
  );
}

const styles = StyleSheet.create({
  learning: { borderColor: Colors.accentBorder },
  proposal: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentTint },
  sectionLabel: { fontWeight: '600', letterSpacing: 0.8, fontSize: 10.5 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: Colors.accent },
  cols: { flexDirection: 'row', gap: Spacing.four, flexWrap: 'wrap' },
  col: { gap: 2, minWidth: 150 },
  bars: { flexDirection: 'row', gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 3 },
  barTrack: { height: 56, width: 18, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  treat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  treatOn: { borderColor: Colors.accentBorder },
  check: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two, flexWrap: 'wrap' },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 38,
    paddingHorizontal: 12,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
  },
  input: { flex: 1, minWidth: 0, height: '100%', color: Colors.text, fontFamily: Fonts.mono, fontSize: 14, outlineWidth: 0 },
  weighIn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
