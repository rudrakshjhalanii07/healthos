import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Badge, Card, CardHeader, IconButton, Icons, T } from './ui';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { entryMacros } from '@/lib/model';
import type { Entry } from '@/lib/store';

export function DayLog({
  title,
  entries,
  onRemove,
  isTreat,
  style,
}: {
  style?: StyleProp<ViewStyle>;
  title: string;
  entries: Entry[];
  onRemove: (id: string) => void;
  isTreat: (e: Entry) => boolean;
}) {
  const total = entries.reduce((s, e) => s + e.kcal, 0);

  return (
    <Card style={style}>
      <CardHeader
        title={title}
        right={
          <T variant="mono" color={Colors.text}>
            {total.toLocaleString('en-US')} <T variant="caption">kcal</T>
          </T>
        }
      />

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Icons.Flame size={22} color={Colors.textMuted} />
          <T variant="body" style={{ textAlign: 'center' }}>
            Nothing logged yet.{'\n'}Add whatever you’ve eaten and the rest of your week re-balances automatically.
          </T>
        </View>
      ) : (
        <View style={{ gap: Spacing.one }}>
          {entries.map((e) => {
            const m = entryMacros(e);
            return (
              <View key={e.id} style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="label" color={Colors.text}>
                    {e.name}
                  </T>
                  <T variant="caption">
                    {e.detail ? `${e.detail} · ` : ''}P {Math.round(m.protein)} · C {Math.round(m.carbs)} · F {Math.round(m.fat)}
                    {e.macrosEstimated ? ' (est.)' : ''}
                  </T>
                </View>
                {isTreat(e) && (
                  <Badge color={Colors.warn} bg={Colors.warnSoft}>
                    planned treat
                  </Badge>
                )}
                {e.source === 'manual' && (
                  <Badge color={Colors.textDim} bg={Colors.surfaceHover}>
                    manual
                  </Badge>
                )}
                <T variant="mono" color={Colors.text} style={{ minWidth: 52, textAlign: 'right' }}>
                  {e.kcal.toLocaleString('en-US')}
                </T>
                <IconButton label={`Remove ${e.name}`} onPress={() => onRemove(e.id)} style={{ width: 28, height: 28 }}>
                  <Icons.X size={14} color={Colors.textMuted} />
                </IconButton>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
