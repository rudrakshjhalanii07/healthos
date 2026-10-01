import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Badge, Button, IconButton, Icons, Segmented, T } from './ui';

import { SunTimes } from './theme-toggle';
import { TreatsEditor } from './treats-editor';

import { DAY_TYPE_STYLE, NEXT_DAY_TYPE } from '@/constants/day-types';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { classifyWeight, DAY_WEIGHT } from '@/lib/planner';
import { energyPlan } from '@/lib/profile';
import { CAN_SWITCH_LIVE, useThemeMode } from '@/lib/theme-mode';
import { type Settings, useStore } from '@/lib/store';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner Pressable stops backdrop presses from closing when tapping the panel. */}
        <Pressable style={styles.panel} onPress={() => {}}>
          {visible && <SettingsForm onClose={onClose} />}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SettingsForm({ onClose }: { onClose: () => void }) {
  const { data, username, updateSettings, updatePrefs, resetAll, signOut } = useStore();
  const theme = useThemeMode();
  const recommended = data.profile ? (data.learned?.dailyTarget ?? energyPlan(data.profile).target) * 7 : null;
  const [draft, setDraft] = useState<Settings>(data.settings);
  const [confirmReset, setConfirmReset] = useState(false);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const valid =
    draft.weeklyGoal >= 3500 &&
    draft.minDaily >= 800 &&
    draft.maxDaily > draft.minDaily &&
    draft.minDaily * 7 <= draft.weeklyGoal &&
    draft.maxDaily * 7 >= draft.weeklyGoal;

  return (
    <>
      <View style={styles.header}>
        <View style={{ gap: 2 }}>
          <T variant="title">Plan settings</T>
          <T variant="caption">Your weekly budget and how it gets spread across days.</T>
        </View>
        <IconButton label="Close" onPress={onClose}>
          <Icons.X size={18} />
        </IconButton>
      </View>

      <ScrollView contentContainerStyle={{ gap: Spacing.four, padding: Spacing.four }}>
        <View style={styles.profile}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="label" color={Colors.text}>
              @{username}
            </T>
            <T variant="caption">Measurements, goal, diet and allergies.</T>
          </View>
          <Button
            size="sm"
            onPress={() => {
              onClose();
              router.push('/onboarding');
            }}>
            Edit profile
          </Button>
          <Button
            size="sm"
            kind="ghost"
            onPress={() => {
              onClose();
              signOut();
            }}>
            Switch user
          </Button>
        </View>

        <Field label="Appearance">
          {CAN_SWITCH_LIVE && (
          <Segmented
            value={theme.mode}
            onChange={theme.setMode}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          )}
          <SunTimes />
        </Field>

        <Field label="Weekly calorie goal" hint={`≈ ${Math.round(draft.weeklyGoal / 7).toLocaleString('en-US')} kcal / day on average`}>
          <NumberInput value={draft.weeklyGoal} onChange={(v) => set('weeklyGoal', v)} suffix="kcal / week" />
          <View style={styles.presets}>
            {recommended && (
              <Pressable
                onPress={() => set('weeklyGoal', recommended)}
                style={[styles.preset, draft.weeklyGoal === recommended && styles.presetActive]}>
                <T variant="mono" style={{ fontSize: 12 }} color={draft.weeklyGoal === recommended ? Colors.accent : Colors.textDim}>
                  Recommended · {recommended.toLocaleString('en-US')}
                </T>
              </Pressable>
            )}
            {[1600, 1800, 2000, 2200, 2500].map((d) => (
              <Pressable
                key={d}
                onPress={() => set('weeklyGoal', d * 7)}
                style={[styles.preset, draft.weeklyGoal === d * 7 && styles.presetActive]}>
                <T variant="mono" style={{ fontSize: 12 }} color={draft.weeklyGoal === d * 7 ? Colors.accent : Colors.textDim}>
                  {d}/day
                </T>
              </Pressable>
            ))}
          </View>
        </Field>

        <View style={{ flexDirection: 'row', gap: Spacing.three }}>
          <Field label="Daily floor" hint="Never plan below this" style={{ flex: 1 }}>
            <NumberInput value={draft.minDaily} onChange={(v) => set('minDaily', v)} suffix="kcal" />
          </Field>
          <Field label="Daily ceiling" hint="Never plan above this" style={{ flex: 1 }}>
            <NumberInput value={draft.maxDaily} onChange={(v) => set('maxDaily', v)} suffix="kcal" />
          </Field>
        </View>

        <Field label="Week starts on">
          <Segmented
            value={String(draft.weekStartsOn) as '0' | '1'}
            onChange={(v) => set('weekStartsOn', Number(v) as 0 | 1)}
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
            ]}
          />
        </Field>

        <Field
          label="Weekday split"
          hint={
            data.learned
              ? 'Learned from your logs — heavier days get a bigger share. Tap a day to override.'
              : 'Flat until your pattern is learned. Tap a day to set it by hand.'
          }>
          <View style={styles.weekdays}>
            {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
              const w = draft.dayWeights[wd] ?? 1;
              const type = classifyWeight(w);
              const t = DAY_TYPE_STYLE[type];
              return (
                <Pressable
                  key={wd}
                  style={styles.weekday}
                  onPress={() =>
                    set('dayWeights', draft.dayWeights.map((x, i) => (i === wd ? DAY_WEIGHT[NEXT_DAY_TYPE[type]] : x)))
                  }>
                  <T variant="caption" style={{ fontWeight: '600' }}>
                    {WEEKDAYS[wd]}
                  </T>
                  <Badge color={t.color} bg={t.bg}>
                    {t.label}
                  </Badge>
                  <T variant="mono" style={{ fontSize: 11 }} color={Colors.textMuted}>
                    {w > 1 ? '+' : w < 1 ? '−' : '±'}
                    {Math.abs(Math.round((w - 1) * 100))}%
                  </T>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field
          label="When a day runs over"
          hint={
            {
              fast: 'Up to 40% of the next day goes to paying it back; the rest spreads over the week.',
              balanced: 'Up to 30% of the next day goes to paying it back; the rest spreads over the week.',
              gentle: 'Spread evenly over the rest of the week — no single day takes the hit.',
            }[draft.correction]
          }>
          <Segmented
            value={draft.correction}
            onChange={(v) => set('correction', v)}
            options={[
              { value: 'fast', label: 'Fix fast' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'gentle', label: 'Gentle' },
            ]}
          />
        </Field>

        {data.prefs && (
          <Field label="Planned treats" hint="Reserved on their days; the rest of the week trims a little to make room. Saved immediately.">
            <TreatsEditor
              prefs={data.prefs}
              dayWeights={draft.dayWeights}
              onChange={(allowances) => updatePrefs({ allowances })}
            />
          </Field>
        )}

        {!valid && (
          <T variant="caption" color={Colors.warn}>
            Check the numbers: the weekly goal must fit between 7× floor and 7× ceiling, and the floor should be at
            least 800 kcal.
          </T>
        )}

        <View style={styles.danger}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="label" color={Colors.text}>
              Reset everything
            </T>
            <T variant="caption">Deletes this profile’s log, weigh-ins and learned plan, and starts learning again. Profile and preferences stay.</T>
          </View>
          <Button
            kind="danger"
            size="sm"
            onPress={() => {
              if (!confirmReset) return setConfirmReset(true);
              resetAll();
              onClose();
            }}>
            {confirmReset ? 'Click again to confirm' : 'Reset'}
          </Button>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button kind="ghost" onPress={onClose}>
          Cancel
        </Button>
        <Button
          kind="primary"
          disabled={!valid}
          onPress={() => {
            updateSettings(draft);
            onClose();
          }}>
          Save changes
        </Button>
      </View>
    </>
  );
}

function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ gap: Spacing.two }, style]}>
      <T variant="label" color={Colors.text}>
        {label}
      </T>
      {children}
      {hint ? <T variant="caption">{hint}</T> : null}
    </View>
  );
}

function NumberInput({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <View style={styles.inputWrap}>
      <TextInput
        value={value ? String(value) : ''}
        onChangeText={(t) => onChange(Number(t.replace(/[^0-9]/g, '')) || 0)}
        keyboardType="number-pad"
        style={styles.input}
      />
      <T variant="caption">{suffix}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  panel: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
    cursor: 'auto',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: Spacing.four,
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
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
    fontFamily: Fonts.mono,
    fontSize: 15,
    outlineWidth: 0,
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preset: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentSoft },
  weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  weekday: {
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    minWidth: 58,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  danger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dangerHover,
  },
});
