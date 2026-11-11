/**
 * Spoken labels for the card family. A card is one screen-reader stop, so its label carries the parts a sighted user
 * scans first (title, type, date or status) in reading order, each once.
 */

/** Drops empty parts and joins the rest with ". " (no doubled full stops when a part already ends in punctuation). */
export function cardLabel(parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (p ?? '').trim().replace(/[\s.…]+$/u, ''))
    .filter(Boolean)
    .join('. ');
}

/**
 * Category and status labels are set in capitals on screen (eyebrow role). Read aloud they become sentence case,
 * so a screen reader says "Kayıt kapandı" instead of spelling capitals. Mixed-case text (names) is never touched.
 */
export function spoken(label: string | null | undefined): string | undefined {
  if (!label) return undefined;
  const hasLower = label !== label.toLocaleUpperCase('tr');
  if (hasLower) return label;
  const lower = label.toLocaleLowerCase('tr');
  return lower.charAt(0).toLocaleUpperCase('tr') + lower.slice(1);
}

/** Long secondary text (summaries) is clipped for speech on a word boundary; the detail screen reads it in full. */
export function clipForSpeech(text: string | null | undefined, max = 140): string | undefined {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return undefined;
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/u, '')}…`;
}

/**
 * Joins meta parts with a middle dot. The space before the dot is non-breaking, so a wrapped line never starts with
 * "· Çevrim içi": the dot stays with the word before it.
 */
export function metaJoin(parts: (string | null | undefined)[]): string {
  return parts.map((p) => (p ?? '').trim()).filter(Boolean).join('\u00A0· ');
}

/** Keeps a short value on one line ("Son gün bugün", a tag): every space becomes non-breaking. */
export const keepTogether = (s: string) => s.replace(/ /g, '\u00A0');

/**
 * A number never leaves its neighbours: the spaces on both sides of a digit run become non-breaking, so "8 gün kaldı",
 * "Son 3 gün", "20 Kasım 2026" and "12.000+ üye" never split across lines. A label ending in a colon stays breakable
 * ("Son başvuru:" / "20 Kasım 2026" on a narrow card), and so do spaces away from numbers.
 * Cards apply it to every meta, footnote and tag they render, so callers cannot forget it.
 */
export function keepNumbersTogether(s: string): string;
export function keepNumbersTogether(s: string | undefined): string | undefined;
export function keepNumbersTogether(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.replace(/(\d\S*) (?=\S)/gu, '$1\u00A0').replace(/([^\s:]) (?=\S*\d)/gu, '$1\u00A0');
}

const thousands = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

/**
 * Counts on cards. Turkish keeps the noun singular after a numeral ("0 üye", "999 üye"), so `other` is only for
 * languages that need it. From 1000 the number is floored to the thousand and marked "+" ("12.000+ üye"): a count on a
 * card is an order of magnitude, and it never grows wider than the layout planned for.
 */
export function formatCount(n: number, noun: { one: string; other: string }): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const word = v === 1 ? noun.one : noun.other;
  if (v < 1000) return `${v}\u00A0${word}`;
  return `${thousands.format(Math.floor(v / 1000) * 1000)}+\u00A0${word}`;
}
