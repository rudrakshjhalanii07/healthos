import type { ReactNode } from 'react';
import { Pressable, type StyleProp, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { Icons, T } from './ui';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type PressState = { pressed: boolean; hovered?: boolean };

export function Field({
  label,
  hint,
  children,
  style,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
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

/** Large tappable cards for single-choice questions with a short description. */
export function Choice<V extends string>({
  value,
  options,
  onChange,
  columns = 2,
}: {
  value: V;
  options: { value: V; label: string; hint?: string }[];
  onChange: (v: V) => void;
  columns?: number;
}) {
  return (
    <View style={styles.grid}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={(s) => [
              styles.card,
              { flexBasis: `${100 / columns - 3}%` },
              (s as PressState).hovered && !active && { borderColor: Colors.borderStrong },
              active && styles.cardActive,
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T variant="label" color={active ? Colors.text : Colors.textDim} style={{ flex: 1, fontWeight: '600' }}>
                {o.label}
              </T>
              <View style={[styles.radio, active && styles.radioActive]}>
                {active && <Icons.Check size={10} color={Colors.onAccent} />}
              </View>
            </View>
            {o.hint ? <T variant="caption">{o.hint}</T> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact multi-select pills. */
export function Chips<V extends string | number>({
  value,
  options,
  onChange,
}: {
  value: V[];
  options: { value: V; label: string }[];
  onChange: (v: V[]) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(active ? value.filter((v) => v !== o.value) : [...value, o.value])}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            style={(s) => [
              styles.chip,
              (s as PressState).hovered && !active && { borderColor: Colors.borderStrong },
              active && styles.chipActive,
            ]}>
            <T variant="label" color={active ? Colors.accent : Colors.textDim} style={{ fontSize: 12.5 }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SingleChips<V extends string | number>({
  value,
  options,
  onChange,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return <Chips value={[value]} options={options} onChange={(next) => onChange(next.find((v) => v !== value) ?? value)} />;
}

export function NumberField({
  value,
  onChange,
  suffix,
  decimals = false,
  placeholder,
  style,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
  decimals?: boolean;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.inputWrap, style]}>
      <TextInput
        defaultValue={value == null ? '' : String(value)}
        onChangeText={(t) => {
          const clean = t.replace(decimals ? /[^0-9.]/g : /[^0-9]/g, '');
          const n = Number(clean);
          onChange(clean === '' || !Number.isFinite(n) ? null : n);
        }}
        keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
      />
      {suffix ? <T variant="caption">{suffix}</T> : null}
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
}) {
  const btn = (delta: number, label: string, icon: ReactNode) => {
    const next = Math.round((value + delta) * 100) / 100;
    const disabled = next < min || next > max;
    return (
      <Pressable
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => onChange(next)}
        style={[styles.stepBtn, disabled && { opacity: 0.35 }]}>
        {icon}
      </Pressable>
    );
  };
  return (
    <View style={styles.stepper}>
      {btn(-step, 'Decrease', <T variant="title">−</T>)}
      <T variant="mono" color={Colors.text} style={{ minWidth: 44, textAlign: 'center', fontSize: 15 }}>
        {format(value)}
      </T>
      {btn(step, 'Increase', <Icons.Plus size={14} color={Colors.text} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: {
    flexGrow: 1,
    minWidth: 140,
    gap: 4,
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  cardActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentTint },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  chipActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentSoft },
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    padding: 3,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.bg,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceHover,
  },
});
