import { IconButton, Icons, T } from './ui';

import { Colors } from '@/constants/theme';
import { formatIstMinutes } from '@/lib/sun';
import { CAN_SWITCH_LIVE, NEXT_MODE, useThemeMode } from '@/lib/theme-mode';

const LABEL = { auto: 'Auto (IST sunrise/sunset)', light: 'Light', dark: 'Dark' };

/** Cycles Auto → Light → Dark. Auto follows sunrise and sunset in IST. */
export function ThemeToggle() {
  const { mode, resolved, setMode } = useThemeMode();
  if (!CAN_SWITCH_LIVE) return null;
  const Icon = mode === 'auto' ? Icons.Sunset : resolved === 'dark' ? Icons.Moon : Icons.Sun;
  return (
    <IconButton label={`Theme: ${LABEL[mode]}. Tap to change.`} onPress={() => setMode(NEXT_MODE[mode])}>
      <Icon size={16} color={mode === 'auto' ? Colors.textDim : Colors.text} />
    </IconButton>
  );
}

export function SunTimes() {
  const { sun, resolved, mode } = useThemeMode();
  return (
    <T variant="caption">
      Today in IST: sunrise {formatIstMinutes(sun.sunrise)}, sunset {formatIstMinutes(sun.sunset)}.
      {!CAN_SWITCH_LIVE ? ' The app picks light or dark from these when it opens.' : mode === 'auto' ? ` Currently ${resolved}.` : ''}
    </T>
  );
}
