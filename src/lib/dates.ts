/** Dates are stored as local-time `YYYY-MM-DD` keys so they sort and compare as strings. */
export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  // Noon avoids DST edge cases when adding days.
  return new Date(y, m - 1, d, 12);
}

export function todayKey(): DateKey {
  return toKey(new Date());
}

export function addDays(key: DateKey, n: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function weekday(key: DateKey): number {
  return fromKey(key).getDay();
}

export function startOfWeek(key: DateKey, weekStartsOn: 0 | 1): DateKey {
  const diff = (weekday(key) - weekStartsOn + 7) % 7;
  return addDays(key, -diff);
}

export function weekDates(start: DateKey): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatDay(key: DateKey, opts: Intl.DateTimeFormatOptions): string {
  return fromKey(key).toLocaleDateString('en-US', opts);
}

export function weekRangeLabel(start: DateKey): string {
  const end = addDays(start, 6);
  const s = fromKey(start);
  const e = fromKey(end);
  const sameMonth = s.getMonth() === e.getMonth();
  const left = formatDay(start, { month: 'short', day: 'numeric' });
  const right = sameMonth ? String(e.getDate()) : formatDay(end, { month: 'short', day: 'numeric' });
  return `${left} – ${right}`;
}
