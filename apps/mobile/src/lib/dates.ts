const TR_TZ = 'Europe/Istanbul';

export type BirthDateResult = { ok: true; iso: string } | { ok: false; error: string };

/**
 * Strict GG.AA.YYYY parser. Rejects impossible calendar dates (31.02), future dates and implausible ages.
 * The server validates again with its own clock; this only gives fast feedback.
 */
export function parseBirthDate(input: string, today: Date = new Date()): BirthDateResult {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input.trim());
  if (!m) return { ok: false, error: 'Tarihi GG.AA.YYYY biçiminde yaz.' };
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false, error: 'Takvimde böyle bir tarih yok.' };
  }
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (date.getTime() > todayUtc) return { ok: false, error: 'Doğum tarihi gelecekte olamaz.' };
  if (year < today.getFullYear() - 100) return { ok: false, error: 'Doğum yılını kontrol eder misin?' };
  return { ok: true, iso: `${m[3]}-${m[2]}-${m[1]}` };
}

const dayMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', timeZone: TR_TZ });
const full = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TR_TZ });
const time = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: TR_TZ });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: TR_TZ });

export const formatDate = (iso: string) => full.format(new Date(iso));
export const formatTime = (iso: string) => time.format(new Date(iso));

export function formatDateRange(startIso: string, endIso: string): string {
  const [s, e] = [new Date(startIso), new Date(endIso)];
  return dayKey.format(s) === dayKey.format(e) ? full.format(s) : `${dayMonth.format(s)} – ${full.format(e)}`;
}
export const formatTimeRange = (startIso: string, endIso: string) => `${formatTime(startIso)}–${formatTime(endIso)}`;
