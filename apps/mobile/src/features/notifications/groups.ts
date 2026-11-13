import { istanbulDay } from '../opportunities/labels';

export type NotificationGroup = 'Bugün' | 'Bu hafta' | 'Daha önce';

/**
 * Bugün / Bu hafta / Daha önce on Europe/Istanbul calendar days (same day maths as the Fırsatlar Son tarihler groups).
 * The week runs Monday 00:00 – Sunday; "Bu hafta" is the earlier days of this week, today has its own group.
 * Input order (newest first) is kept; empty groups are omitted.
 */
export function groupNotifications<T extends { created_at: string }>(rows: readonly T[], now: Date = new Date()): { label: NotificationGroup; items: T[] }[] {
  const today = istanbulDay(now);
  const weekStart = today - ((today + 3) % 7); // 1970-01-01 was a Thursday; Monday-based weekday = (day + 3) % 7
  const groups: Record<NotificationGroup, T[]> = { Bugün: [], 'Bu hafta': [], 'Daha önce': [] };
  for (const row of rows) {
    const day = istanbulDay(new Date(row.created_at));
    groups[day >= today ? 'Bugün' : day >= weekStart ? 'Bu hafta' : 'Daha önce'].push(row);
  }
  return (['Bugün', 'Bu hafta', 'Daha önce'] as const).filter((label) => groups[label].length > 0).map((label) => ({ label, items: groups[label] }));
}
