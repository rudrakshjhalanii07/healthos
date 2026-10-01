import { Colors } from './theme';

import type { DayType } from '@/lib/planner';

export const DAY_TYPE_STYLE: Record<DayType, { label: string; color: string; bg: string }> = {
  light: { label: 'Light', color: Colors.info, bg: Colors.infoSoft },
  normal: { label: 'Normal', color: Colors.textDim, bg: Colors.surfaceHover },
  flex: { label: 'Burst', color: Colors.warn, bg: Colors.warnSoft },
};

export const NEXT_DAY_TYPE: Record<DayType, DayType> = { normal: 'flex', flex: 'light', light: 'normal' };
