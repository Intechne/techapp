// Faz 3b Task 13 — unified search. Review focus 3: `%`, `_`, `,`, `(`, `)` and Turkish case (İSTANBUL / istanbul).
// The app sends each pattern as ONE PostgREST filter value (`title=ilike.<pattern>`), which PostgREST runs as
// `"title" ILIKE $1` with the value bound as a parameter: there is no string to break out of. What can go wrong is
// matching — so these tests pin how Postgres `ilike` treats Turkish letters, and prove the patterns the app really
// builds (searchPatterns + the client filter matchesQuery, imported from the mobile code) find the row — and only the
// row — under every collation we might run on. Only NAMED collations are used, so the result never depends on the
// locale initdb picked on the machine running the tests.
import { beforeAll, describe, expect, it } from 'vitest';
import { matchesQuery, searchPatterns, toIlikePattern } from '../../apps/mobile/src/features/search/query';
import { admin, asAnon, createEvent, createOrg } from './helpers';

const TITLES = {
  istanbul: 'İstanbul Robot Kampı',
  isparta: 'ISPARTA GENÇLİK ŞENLİĞİ',
  igdir: 'Iğdır Bilim Günü',
  literal: 'Kupa 100%_robot yarışı',
  lookalike: 'Kupa 100xxrobot yarışı',
  backslash: 'Yol a\\b ayrımı',
  ai: 'Yapay Zekâ AI Kampı',
  unrelated: 'Ankara Teknoloji Günü',
} as const;
type Key = keyof typeof TITLES;
const ids = {} as Record<Key, string>;

/**
 * Named collations only: "C" (ASCII-only case folding — what a C/POSIX database does), pg_c_utf8 (builtin since
 * Postgres 17: Unicode simple case mapping, like glibc C.UTF-8 which hosted Postgres commonly uses) and en_US.UTF-8
 * when the OS provides it. Never the database default, which is whatever locale initdb found on this machine.
 */
let collations: string[] = [];

beforeAll(async () => {
  const org = await createOrg();
  for (const [k, title] of Object.entries(TITLES)) ids[k as Key] = await createEvent(org, { title });
  const en = (await admin(`select 1 from pg_collation where collname = 'en_US.UTF-8'`)).rowCount;
  collations = ['C', 'pg_c_utf8', ...(en ? ['en_US.UTF-8'] : [])];
});

const collate = (c: string) => ` collate "${c}"`;
/** Which fixture rows a single pattern finds, exactly the way PostgREST runs one `ilike` filter (as anon, under RLS). */
async function find(pattern: string, collation = 'pg_c_utf8'): Promise<Key[]> {
  const rows = await asAnon((q) => q(`select id from public.events where id = any($2::uuid[]) and title${collate(collation)} ilike $1`, [pattern, Object.values(ids)]));
  const found = new Set(rows.rows.map((r) => r.id as string));
  return (Object.keys(ids) as Key[]).filter((k) => found.has(ids[k]));
}
/** What the app shows: the union of its patterns (merged by id), then only rows whose title passes matchesQuery. */
async function appFinds(query: string, collation: string): Promise<Key[]> {
  const all = new Set<Key>();
  for (const p of searchPatterns(query)) for (const k of await find(p, collation)) all.add(k);
  return [...all].filter((k) => matchesQuery(TITLES[k], query));
}

describe('Postgres ilike and Turkish letters (pinned)', () => {
  it('tests named collations only: C and pg_c_utf8 always (en_US.UTF-8 when the OS has it)', () => {
    expect(collations.slice(0, 2)).toEqual(['C', 'pg_c_utf8']); // pg_c_utf8: builtin since Postgres 17; the embedded server is newer
    expect(collations).not.toContain('default');
  });

  it('Unicode-aware collations fold İ and I to i, but keep ı: "İSTANBUL" finds İstanbul, "ısparta" does not find ISPARTA', async () => {
    for (const c of collations.filter((x) => x !== 'C')) {
      expect(await find('%İSTANBUL%', c), c).toEqual(['istanbul']);
      expect(await find('%istanbul%', c), c).toEqual(['istanbul']);
      expect(await find('%ISTANBUL%', c), c).toEqual(['istanbul']);
      expect(await find('%ısparta%', c), c).toEqual([]);
      expect(await find('%ığdır%', c), c).toEqual([]);
      expect(await find('%iğdir%', c), c).toEqual([]); // the row has a lower-case ı in the middle
    }
  });

  it('"C" folds ASCII only: "istanbul" misses İstanbul and "gençlik" misses GENÇLİK — the raw pattern alone is not enough', async () => {
    expect(await find('%istanbul%', 'C')).toEqual([]);
    expect(await find('%İstanbul%', 'C')).toEqual(['istanbul']);
    expect(await find('%gençlik%', 'C')).toEqual([]);
    expect(await find('%GENÇLİK%', 'C')).toEqual(['isparta']);
  });
});

describe('the app’s patterns find the row under every collation', () => {
  it.each([
    ['İSTANBUL', 'istanbul'], ['istanbul', 'istanbul'], ['İstanbul', 'istanbul'], ['ISTANBUL', 'istanbul'],
    ['ISPARTA', 'isparta'], ['Isparta', 'isparta'], ['ısparta', 'isparta'], ['gençlik', 'isparta'], ['GENÇLİK', 'isparta'],
    ['ığdır', 'igdir'], ['IĞDIR', 'igdir'], ['Iğdır', 'igdir'], ['bilim günü', 'igdir'], ['BİLİM GÜNÜ', 'igdir'],
  ] as [string, Key][])('%s → %s', async (query, key) => {
    for (const c of collations) expect(await appFinds(query, c), `${query} under ${c}`).toContain(key);
  });

  it('under C, "İSTANBUL" is found by its typed pattern but "istanbul" only by its second (Turkish upper) one; under pg_c_utf8 the Turkish lower pattern of "İSTANBUL" finds it too', async () => {
    const [raw, lower] = searchPatterns('İSTANBUL');
    expect(await find(raw!, 'C')).toEqual(['istanbul']); // İ matches İ exactly, STANBUL folds as ASCII
    expect(await find(searchPatterns('istanbul')[0]!, 'C')).toEqual([]); // raw "istanbul": i ≠ İ under C
    expect(await find(searchPatterns('istanbul')[1]!, 'C')).toEqual(['istanbul']); // Turkish upper "İSTANBUL"
    expect(await find(lower!, 'pg_c_utf8')).toEqual(['istanbul']);
  });
});

describe('short queries: no wildcard, nothing unrelated (fix round 1)', () => {
  it('"AI" finds the AI row and NOT "Ankara Teknoloji Günü" under every collation; the old %A_% pattern would have', async () => {
    for (const c of collations) {
      expect(await appFinds('AI', c), c).toEqual(['ai']);
      expect(await appFinds('ai', c), c).toEqual(['ai']);
    }
    expect(await find('%A_%')).toContain('unrelated'); // what the wildcard did before
  });

  it.each(['IT', 'IoT', 'Iz', 'ısı'])('"%s" returns no fixture row (the titles do not contain it)', async (query) => {
    for (const c of collations) expect(await appFinds(query, c), `${query} under ${c}`).toEqual([]);
  });

  it('a wildcard match that is only noise is removed by the client filter', async () => {
    // "%_ğd_r%" would also match "Bağdar"-like titles; the filter keeps only titles that contain "ığdır" folded.
    expect(matchesQuery(TITLES.unrelated, 'ığdır')).toBe(false);
    for (const c of collations) expect(await appFinds('IĞDIR', c), c).toEqual(['igdir']);
  });
});

describe('escaping', () => {
  it('the escaped pattern matches a literal % and _ only; the unescaped one would also match look-alikes', async () => {
    for (const c of collations) {
      expect(await find(toIlikePattern('100%_robot'), c), c).toEqual(['literal']);
      expect(await find('%100%_robot%', c), c).toEqual(['literal', 'lookalike']);
    }
  });

  it('a backslash is a literal backslash', async () => {
    expect(await find(toIlikePattern('a\\b'))).toEqual(['backslash']);
    expect(await find(toIlikePattern('\\'))).toEqual(['backslash']);
  });

  it.each(['a,b', '(x)', '"q"', "'; drop table public.events; --", '🤖🚀', '\\%', '*)'])('%s runs as plain text: no error, no match', async (input) => {
    for (const p of searchPatterns(input)) expect(await find(p)).toEqual([]);
    expect((await admin(`select count(*)::int n from public.events where id = any($1::uuid[])`, [Object.values(ids)])).rows[0].n).toBe(Object.keys(TITLES).length);
  });
});
