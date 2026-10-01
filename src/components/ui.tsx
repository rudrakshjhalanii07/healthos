import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  Text,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

/** react-native-web adds `hovered` to the Pressable state. */
type PressState = { pressed: boolean; hovered?: boolean };

type TextVariant = 'display' | 'title' | 'body' | 'label' | 'caption' | 'mono';

export function T({
  variant = 'body',
  color,
  style,
  ...props
}: TextProps & { variant?: TextVariant; color?: string }) {
  return <Text {...props} style={[text.base, text[variant], color ? { color } : null, style]} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.cardHeader}>
      <T variant="label">{title}</T>
      {right}
    </View>
  );
}

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({ children, kind = 'secondary', size = 'md', icon, style, disabled, ...props }: ButtonProps) {
  const palette = BUTTONS[kind];
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={(s) => {
        const { pressed, hovered } = s as PressState;
        return [
          styles.button,
          size === 'sm' && styles.buttonSm,
          { backgroundColor: hovered ? palette.hover : palette.bg, borderColor: palette.border },
          pressed && { transform: [{ scale: 0.98 }] },
          disabled && { opacity: 0.4 },
          style,
        ];
      }}>
      {icon}
      <T variant="label" color={palette.fg} style={size === 'sm' && { fontSize: 12 }}>
        {children}
      </T>
    </Pressable>
  );
}

const BUTTONS = {
  primary: { bg: Colors.accent, hover: Colors.accentHover, border: Colors.accent, fg: Colors.onAccent },
  secondary: { bg: Colors.surfaceRaised, hover: Colors.surfaceHover, border: Colors.borderStrong, fg: Colors.text },
  ghost: { bg: 'transparent', hover: Colors.surfaceHover, border: 'transparent', fg: Colors.textDim },
  danger: { bg: Colors.dangerSoft, hover: Colors.dangerHover, border: Colors.dangerBorder, fg: Colors.danger },
};

export function IconButton({
  children,
  label,
  onPress,
  style,
}: {
  children: ReactNode;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={(s) => {
        const { pressed, hovered } = s as PressState;
        return [styles.iconButton, hovered && { backgroundColor: Colors.surfaceHover }, pressed && { opacity: 0.7 }, style];
      }}>
      {children}
    </Pressable>
  );
}

export function Segmented<V extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}>
            <T variant="label" color={active ? Colors.text : Colors.textMuted} style={{ fontSize: 12.5 }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ children, color, bg }: { children: ReactNode; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <T variant="caption" color={color} style={{ fontWeight: '600' }}>
        {children}
      </T>
    </View>
  );
}

export function ProgressBar({ value, color = Colors.accent }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

// Icons — 24px grid strokes so they match at any size.
type IconProps = { size?: number; color?: string };
function Icon({ d, size = 16, color = Colors.textDim }: IconProps & { d: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export const Icons = {
  ChevronLeft: (p: IconProps) => <Icon {...p} d="M15 18l-6-6 6-6" />,
  ChevronRight: (p: IconProps) => <Icon {...p} d="M9 18l6-6-6-6" />,
  Plus: (p: IconProps) => <Icon {...p} d="M12 5v14M5 12h14" />,
  X: (p: IconProps) => <Icon {...p} d="M18 6L6 18M6 6l12 12" />,
  Check: (p: IconProps) => <Icon {...p} d="M20 6L9 17l-5-5" />,
  Settings: (p: IconProps) => (
    <Icon {...p} d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
  ),
  Sparkle: (p: IconProps) => <Icon {...p} d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />,
  Pencil: (p: IconProps) => <Icon {...p} d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />,
  Search: (p: IconProps) => <Icon {...p} d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />,
  Lock: (p: IconProps) => <Icon {...p} d="M5 11h14v10H5zM8 11V7a4 4 0 118 0v4" />,
  Sun: (p: IconProps) => (
    <Icon {...p} d="M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  ),
  Moon: (p: IconProps) => <Icon {...p} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
  Sunset: (p: IconProps) => (
    <Icon {...p} d="M17 18a5 5 0 00-10 0M12 9V2M4.22 10.22l1.42 1.42M1 18h2M21 18h2M18.36 11.64l1.42-1.42M23 22H1M16 5l-4 4-4-4" />
  ),
  Flame: (p: IconProps) => (
    <Icon {...p} d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8 0 4 3 7 7 7z" />
  ),
};

const text = StyleSheet.create({
  base: { fontFamily: Fonts.sans, color: Colors.text },
  display: { fontSize: 40, fontWeight: '600', letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  title: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  body: { fontSize: 14, lineHeight: 20, color: Colors.textDim },
  label: { fontSize: 13, fontWeight: '500', color: Colors.textDim },
  caption: { fontSize: 11.5, color: Colors.textMuted, letterSpacing: 0.1 },
  mono: { fontFamily: Fonts.mono, fontSize: 13, fontVariant: ['tabular-nums'] },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  buttonSm: { height: 30, paddingHorizontal: 10, borderRadius: Radius.sm },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 3,
    gap: 2,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9 },
  segmentActive: { backgroundColor: Colors.surfaceHover, borderWidth: 1, borderColor: Colors.borderStrong, margin: -1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  track: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceHover, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
