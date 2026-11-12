import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Badge, Button, IconButton, Icons, Segmented, T } from './ui';

import { SunTimes } from './theme-toggle';
import { TreatsEditor } from './treats-editor';

import { DAY_TYPE_STYLE, NEXT_DAY_TYPE } from '@/constants/day-types';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { classifyWeight, DAY_WEIGHT } from '@/lib/planner';
import { dayFloor, energyPlan, safeFloor } from '@/lib/profile';
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
  const { data, email, updateSettings, updatePrefs, resetAll, signOut } = useStore();
  const theme = useThemeMode();
  const recommended = data.profile ? (data.learned?.dailyTarget ?? energyPlan(data.profile).target) * 7 : null;
  const [draft, setDraft] = useState<Settings>(data.settings);
  const [confirmReset, setConfirmReset] = useState(false);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }));
  // Without a profile, fall back to the lower (female) limits rather than blocking the form.
  const sex = data.profile?.sex ?? 'female';
  const weeklyMin = safeFloor(sex) * 7;
  const dailyMin = dayFloor(sex);
  const valid =
    draft.weeklyGoal >= weeklyMin &&
    draft.minDaily >= dailyMin &&
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
              {email}
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
            Check the numbers: the weekly goal must be at least {weeklyMin.toLocaleString('en-US')} kcal (
            {safeFloor(sex).toLocaleString('en-US')}/day) and fit between 7× floor and 7× ceiling, and the daily floor
            must be at least {dailyMin.toLocaleString('en-US')} kcal. Going lower isn’t safe without medical
            supervision.
          </T>
        )}

        <AccountSection onClose={onClose} />

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

/** Download and permanent deletion of the account's data, plus the privacy page. */
function AccountSection({ onClose }: { onClose: () => void }) {
  const { exportData, deleteAccount } = useStore();
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setError(null);
    try {
      const payload = await exportData();
      if (Platform.OS !== 'web') return;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `healthos-export-${payload.exportedAt.slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Couldn’t download your data. Try again.');
    }
  };

  const remove = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Couldn’t delete your account. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label="Your data" hint="Everything HealthOS stores about you, and how to take it with you or erase it.">
      <View style={[styles.profile, { gap: Spacing.two }]}>
        <View style={{ flex: 1, gap: 2, minWidth: 180 }}>
          <T variant="label" color={Colors.text}>
            Download my data
          </T>
          <T variant="caption">Your profile, log, weigh-ins and plan as a JSON file.</T>
        </View>
        <Button size="sm" onPress={download}>
          Download
        </Button>
      </View>

      <View style={[styles.danger, { flexWrap: 'wrap' }]}>
        <View style={{ flex: 1, gap: 2, minWidth: 180 }}>
          <T variant="label" color={Colors.text}>
            Delete account
          </T>
          <T variant="caption">Permanently erases your account and all its data from our servers. This can’t be undone.</T>
        </View>
        {!deleting && (
          <Button kind="danger" size="sm" onPress={() => setDeleting(true)}>
            Delete…
          </Button>
        )}
        {deleting && (
          <View style={{ width: '100%', gap: Spacing.two }}>
            <View style={styles.inputWrap}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password to confirm"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                style={styles.input}
                onSubmitEditing={remove}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' }}>
              <Button
                size="sm"
                kind="ghost"
                onPress={() => {
                  setDeleting(false);
                  setPassword('');
                  setError(null);
                }}>
                Cancel
              </Button>
              <Button size="sm" kind="danger" disabled={!password || busy} onPress={remove}>
                {busy ? 'Deleting…' : 'Delete forever'}
              </Button>
            </View>
          </View>
        )}
      </View>

      {error && (
        <T variant="caption" color={Colors.danger}>
          {error}
        </T>
      )}
      <Pressable
        onPress={() => {
          onClose();
          router.push('/privacy');
        }}
        hitSlop={6}>
        <T variant="caption" color={Colors.accent}>
          Privacy policy & health disclaimer
        </T>
      </Pressable>
    </Field>
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
