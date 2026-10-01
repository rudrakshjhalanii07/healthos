import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Badge, Card, CardHeader, ProgressBar, T } from './ui';

import { Colors, Spacing } from '@/constants/theme';
import type { DayMacros } from '@/lib/macros';

export const MACRO_COLOR = { protein: Colors.accent, carbs: Colors.info, fat: Colors.warn } as const;

export function MacroCard({
  dm,
  title,
  treats,
  style,
}: {
  dm: DayMacros;
  title: string;
  treats: string[];
  style?: StyleProp<ViewStyle>;
}) {
  const rows = [
    { key: 'protein' as const, label: 'Protein', floor: true },
    { key: 'carbs' as const, label: 'Carbs', floor: false },
    { key: 'fat' as const, label: 'Fat', floor: false },
  ];

  return (
    <Card style={style}>
      <CardHeader
        title={title}
        right={
          dm.cut.carbs + dm.cut.fat >= 5 ? (
            <Badge color={Colors.warn} bg={Colors.warnSoft}>
              Payback day
            </Badge>
          ) : undefined
        }
      />
      <View style={{ gap: Spacing.three }}>
        {rows.map((r) => {
          const target = dm.target[r.key];
          const eaten = dm.eaten[r.key];
          const left = target - eaten;
          // Going over on protein is fine; only carbs and fat turn amber.
          const over = !r.floor && left < -2;
          const cut = r.key === 'carbs' ? dm.cut.carbs : r.key === 'fat' ? dm.cut.fat : 0;
          return (
            <View key={r.key} style={{ gap: 6 }}>
              <View style={styles.row}>
                <View style={[styles.dot, { backgroundColor: MACRO_COLOR[r.key] }]} />
                <T variant="label" color={Colors.text} style={{ flex: 1 }}>
                  {r.label}
                  {cut >= 5 && (
                    <T variant="caption" color={Colors.warn}>
                      {'  '}−{Math.round(cut)} g payback
                    </T>
                  )}
                </T>
                <T variant="mono" color={over ? Colors.warn : Colors.text} style={{ fontSize: 12.5 }}>
                  {Math.round(eaten)}
                  <T variant="caption"> / {Math.round(target)} g</T>
                </T>
              </View>
              <ProgressBar value={target > 0 ? eaten / target : 0} color={over ? Colors.warn : MACRO_COLOR[r.key]} />
              <T variant="caption">
                {r.floor
                  ? left > 0
                    ? `${Math.round(left)} g to go`
                    : 'Target hit'
                  : left >= 0
                    ? `${Math.round(left)} g left`
                    : `${Math.round(-left)} g over — trimmed from the next meal`}
              </T>
            </View>
          );
        })}
      </View>
      {treats.length > 0 && (
        <T variant="caption" style={styles.footer}>
          Includes planned {treats.join(', ')} · {Math.round(dm.allowance.kcal)} kcal set aside
        </T>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: { marginTop: 'auto', paddingTop: Spacing.three, borderTopWidth: 1, borderTopColor: Colors.border },
});
