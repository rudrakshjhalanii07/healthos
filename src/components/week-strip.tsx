import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Badge, T } from './ui';

import { DAY_TYPE_STYLE, NEXT_DAY_TYPE } from '@/constants/day-types';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { type DateKey, formatDay } from '@/lib/dates';
import type { DayPlan, DayType, WeekPlan } from '@/lib/planner';

const BAR_HEIGHT = 132;

type Props = {
  plan: WeekPlan;
  selected: DateKey;
  onSelect: (date: DateKey) => void;
  onCycleType: (date: DateKey, next: DayType) => void;
  compact: boolean;
};

export function WeekStrip({ plan, selected, onSelect, onCycleType, compact }: Props) {
  const scale = Math.max(...plan.days.flatMap((d) => [d.consumed, d.target])) * 1.12 || 1;

  const columns = plan.days.map((day) => (
    <DayColumn
      key={day.date}
      day={day}
      scale={scale}
      selected={day.date === selected}
      onPress={() => onSelect(day.date)}
      onCycleType={() => onCycleType(day.date, NEXT_DAY_TYPE[day.type])}
      compact={compact}
    />
  ));

  if (compact) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {columns}
      </ScrollView>
    );
  }
  return <View style={styles.row}>{columns}</View>;
}

function DayColumn({
  day,
  scale,
  selected,
  onPress,
  onCycleType,
  compact,
}: {
  day: DayPlan;
  scale: number;
  selected: boolean;
  onPress: () => void;
  onCycleType: () => void;
  compact: boolean;
}) {
  const over = day.consumed > day.target;
  const isFuture = day.status === 'future';
  const targetH = (day.target / scale) * BAR_HEIGHT;
  const fillH = (day.consumed / scale) * BAR_HEIGHT;
  const type = DAY_TYPE_STYLE[day.type];

  return (
    <Pressable
      onPress={onPress}
      style={(s) => {
        const hovered = (s as { hovered?: boolean }).hovered;
        return [
          styles.col,
          compact && styles.colCompact,
          hovered && !selected && { backgroundColor: Colors.surfaceRaised },
          selected && styles.colSelected,
        ];
      }}>
      <View style={styles.colHead}>
        <T variant="caption" color={day.status === 'today' ? Colors.accent : Colors.textMuted} style={styles.weekday}>
          {day.status === 'today' ? 'TODAY' : formatDay(day.date, { weekday: 'short' }).toUpperCase()}
        </T>
        <T variant="title" color={isFuture ? Colors.textDim : Colors.text}>
          {formatDay(day.date, { day: 'numeric' })}
        </T>
      </View>

      <View style={styles.barArea}>
        {/* Planned target: dashed ghost for future days, marker line otherwise. */}
        <View
          style={[
            styles.ghost,
            { height: targetH },
            isFuture ? styles.ghostFuture : styles.ghostPast,
            selected && isFuture && { borderColor: Colors.accent },
          ]}
        />
        {day.consumed > 0 && (
          <View
            style={[
              styles.fill,
              {
                height: fillH,
                backgroundColor: over ? Colors.warn : day.locked ? Colors.accentDim : Colors.accent,
              },
            ]}
          />
        )}
        {!isFuture && <View style={[styles.targetLine, { bottom: targetH }]} />}
      </View>

      <View style={{ alignItems: 'center', gap: 2 }}>
        <T variant="mono" color={isFuture ? Colors.textDim : Colors.text} style={{ fontSize: 12.5 }}>
          {(day.status === 'future' ? day.target : day.consumed).toLocaleString('en-US')}
        </T>
        <T variant="caption" style={{ fontSize: 10.5 }}>
          {day.status === 'future'
            ? 'planned'
            : day.assumed
              ? 'not logged'
              : `of ${day.target.toLocaleString('en-US')}`}
        </T>
      </View>

      <Pressable
        disabled={day.locked}
        onPress={onCycleType}
        accessibilityLabel={`Day type: ${type.label}. Tap to change.`}
        style={{ opacity: day.locked ? 0.45 : 1 }}>
        <Badge color={type.color} bg={type.bg}>
          {type.label}
        </Badge>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colCompact: { width: 84, flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  colSelected: { backgroundColor: Colors.surfaceRaised, borderColor: Colors.borderStrong },
  colHead: { alignItems: 'center', gap: 2 },
  weekday: { fontWeight: '600', letterSpacing: 0.8, fontSize: 10.5 },
  barArea: {
    height: BAR_HEIGHT,
    width: 36,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  ghost: { position: 'absolute', bottom: 0, width: '100%', borderRadius: 8 },
  ghostFuture: { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderStrong, backgroundColor: Colors.ghostFill },
  ghostPast: { backgroundColor: Colors.surfaceHover },
  fill: { position: 'absolute', bottom: 0, width: '100%', borderRadius: 8 },
  targetLine: {
    position: 'absolute',
    left: -6,
    right: -6,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.text,
    opacity: 0.7,
  },
});
