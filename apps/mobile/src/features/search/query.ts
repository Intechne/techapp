/**
 * Search text → PostgREST `ilike` filter values. Pure (no Supabase, no React Native) so supabase/tests/search.test.ts
 * can run these exact patterns against Postgres.
 *
 * Safety model: user text is only ever the VALUE of one `.ilike(column, pattern)` filter — supabase-js URL-encodes it
 * and PostgREST binds it as a parameter (`"title" ILIKE $1`) — so `,`, `(`, `)`, quotes and SQL never act as syntax.
 * It is never interpolated into an `or()` / `filter()` string, where `,` and `()` ARE syntax. What remains is LIKE's
 * own syntax (`%`, `_`, `\`), which toIlikePattern escapes.
 */
export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 60;
export const SEARCH_DEBOUNCE_MS = 300;

const CONTROL = /[\u0000-\u001F\u007F]/g;

/** Trimmed, whitespace collapsed, NFC, at most 60 characters (code points); under 2 characters → null (no search). */
export function normalizeQuery(raw: string): string | null {
  const clean = raw.normalize('NFC').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
  const cut = Array.from(clean).slice(0, MAX_QUERY_LENGTH).join('').trim();
  return Array.from(cut).length < MIN_QUERY_LENGTH ? null : cut;
}

/**
 * `%…%` contains-pattern with LIKE's escape character first (`\` → `\\`), then `%` and `_` escaped so they match
 * literally. PostgREST rewrites `*` to `%` in like values and offers no escape for it, so a typed `*` becomes `_`
 * (one character — the closest we can get to the literal) instead of an unbounded wildcard.
 */
export function toIlikePattern(q: string): string {
  const escaped = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/\*/g, '_');
  return `%${escaped}%`;
}

/** toLocaleLowerCase('tr') / toLocaleUpperCase('tr') without depending on the JS engine's locale data (Hermes). */
export const toTurkishLower = (s: string): string => s.replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
export const toTurkishUpper = (s: string): string => s.replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();

/** LIKE never escapes a wildcard we add here: the replacement runs after escaping and only touches ı / I. */
const DOTLESS = /[ıI]/g;
const HAS_DOTLESS = /[ıI]/;
const asciiFold = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
/** Letters only (cased characters): emoji, digits and punctuation do not count. Engine-agnostic (no \p{L}). */
const letterCount = (s: string) => Array.from(s).filter((c) => c.toLowerCase() !== c.toUpperCase()).length;
/**
 * Below this many letters ı / I stay literal: "AI" → "%A_%" or "IT" → "%_T%" would match almost every title.
 * Short queries rely on the Turkish lower / upper variants alone (a short "ıs" can miss "IS…" under a Unicode collation).
 */
export const MIN_WILDCARD_LETTERS = 4;
/** A wildcard request asks for this many rows (at least), so noise the client filters out cannot crowd out real hits. */
export const WILDCARD_WINDOW = 30;

export interface SearchPattern { pattern: string; wildcard: boolean }

/**
 * The patterns one search runs (each its own request; rows merged by id, then filtered with matchesQuery). Pinned
 * against Postgres in supabase/tests/search.test.ts:
 * - Unicode-aware collations fold İ and I to i but keep ı, so "ısparta" would miss "ISPARTA" and "ığdır" would miss
 *   "Iğdır": in queries of 4+ letters ı and I therefore become `_` (one character). `*` becomes `_` too (toIlikePattern).
 * - A "C" collation folds ASCII only, so "istanbul" misses "İstanbul" and "gençlik" misses "GENÇLİK": the Turkish
 *   lower and Turkish upper forms are searched too.
 * Variants that differ only in ASCII case are dropped (every collation folds ASCII), so most queries are one request.
 */
export function searchPlan(q: string): SearchPattern[] {
  const dotless = letterCount(q) >= MIN_WILDCARD_LETTERS;
  const out: SearchPattern[] = [];
  const seen = new Set<string>();
  for (const variant of [q, toTurkishLower(q), toTurkishUpper(q)]) {
    const escaped = toIlikePattern(variant);
    const pattern = dotless ? escaped.replace(DOTLESS, '_') : escaped;
    const key = asciiFold(pattern);
    if (!seen.has(key)) { seen.add(key); out.push({ pattern, wildcard: variant.includes('*') || (dotless && HAS_DOTLESS.test(variant)) }); }
  }
  return out;
}
export const searchPatterns = (q: string): string[] => searchPlan(q).map((p) => p.pattern);

/** Turkish-insensitive fold: every I-form (İ I ı i) → i, then Turkish lower case. */
export const foldTurkish = (s: string): string => toTurkishLower(s.normalize('NFC').replace(/[İIı]/g, 'i'));

/**
 * The client-side check every returned row must pass (title / team name): the folded text contains the folded query.
 * It removes what a wildcard let through ("Iş" in "İşte"…) and keeps the result list the same under every collation.
 */
export const matchesQuery = (text: string, q: string): boolean => foldTurkish(text).includes(foldTurkish(q));
