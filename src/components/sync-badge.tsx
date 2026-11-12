import { View } from 'react-native';

import { T } from './ui';

import { Colors } from '@/constants/theme';
import { type SyncStatus, useStore } from '@/lib/store';

const LABEL: Record<Exclude<SyncStatus, 'saved'>, { text: string; short: string; color: string }> = {
  pending: { text: 'Saving…', short: 'Saving…', color: Colors.textMuted },
  saving: { text: 'Saving…', short: 'Saving…', color: Colors.textMuted },
  offline: { text: 'Offline · saved on this device', short: 'Offline', color: Colors.warn },
  error: { text: 'Not synced yet · will retry', short: 'Not synced', color: Colors.danger },
};

/** Says when changes haven't reached the server yet; silent once everything is saved. */
export function SyncBadge({ compact }: { compact?: boolean }) {
  const { syncStatus } = useStore();
  if (syncStatus === 'saved') return null;
  const l = LABEL[syncStatus];
  return (
    <View accessibilityRole="text" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: l.color }} />
      <T variant="caption" color={l.color}>
        {compact ? l.short : l.text}
      </T>
    </View>
  );
}
