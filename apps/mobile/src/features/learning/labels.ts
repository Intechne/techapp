import { metaJoin, tones, type Tone } from '../../design-system';

export const LEVEL_LABEL: Record<string, string> = { beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri' };
export const levelLabel = (level: string): string => LEVEL_LABEL[level] ?? 'Başlangıç';

/** 45 → "45 dk", 90 → "1 sa 30 dk", 6000 → "100 sa". */
export function minutesLabel(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}
/** A published course can still be waiting for its lessons: say that, not "0 ders". */
export const lessonCountLabel = (n: number): string => (n > 0 ? `${n} ders` : 'Dersler yakında');
/** "3 ders · 45 dk"; the duration is left out when the course has none. */
export const courseMeta = (c: { lesson_count: number; estimated_minutes: number | null }): string =>
  metaJoin([lessonCountLabel(c.lesson_count), minutesLabel(c.estimated_minutes)]);

/** The server stores the tone as free text within a check constraint; anything unexpected falls back to moss. */
export const toTone = (t: string): Tone => (t in tones ? (t as Tone) : 'moss');
