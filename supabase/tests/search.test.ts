// Faz 3b Task 13 — unified search. Review focus 3: `%`, `_`, `,`, `(`, `)` and Turkish case (İSTANBUL / istanbul).
// The app sends each pattern as ONE PostgREST filter value (`title=ilike.<pattern>`), which PostgREST runs as
// `"title" ILIKE $1` with the value bound as a parameter: there is no string to break out of. What can go wrong is
// matching — so these tests pin how Postgres `ilike` treats Turkish letters, and prove the patterns the app really
// builds (searchPatterns, imported from the mobile code) find the row under every collation we might run on.
import { beforeAll, describe, expect, it } from 'vitest';
import { searchPatterns, toIlikePattern } from '../../apps/mobile/src/features/search/query';
import { admin, asAnon, createEvent, createOrg } from './helpers';

const TITLES = {
  istanbul: 'İstanbul Robot Kampı',
  isparta: 'ISPARTA GENÇLİK ŞENLİĞİ',
  igdir: 'Iğdır Bilim Günü',
  literal: 'Kupa 100%_robot yarışı',
  lookalike: 'Kupa 100xxrobot yarışı',
  backslash: 'Yol a\\b ayrımı',
} as const;
type Key = keyof typeof TITLES;
const ids = {} as Record<Key, string>;

/**
 * Collations: the database default (this machine's initdb locale), "C" (ASCII-only case folding — what a C/POSIX
 * database does), pg_c_utf8 (Unicode simple case mapping, like glibc C.UTF-8 which hosted Postgres commonly uses) and
 * en_US.UTF-8 when the OS provides it.
 */
let collations: string[] = [];

beforeAll(async () => {
  const org = await createOrg();
  for (const [k, title] of Object.entries(TITLES)) ids[k as Key] = await createEvent(org, { title });
  const have = (await admin(`select collname from pg_collation where collname in ('pg_c_utf8', 'en_US.UTF-8')`)).rows.map((r) => r.collname as string);
  collations = ['default', 'C', ...have];
});

const collate = (c: string) => (c === 'default' ? '' : ` collate "${c}"`);
/** Which fixture rows a single pattern finds, exactly the way PostgREST runs one `ilike` filter (as anon, under RLS). */
async function find(pattern: string, collation = 'default'): Promise<Key[]> {
  const rows = await asAnon((q) => q(`select id from public.events where id = any($2::uuid[]) and title${collate(collation)} ilike $1`, [pattern, Object.values(ids)]));
  const found = new Set(rows.rows.map((r) => r.id as string));
  return (Object.keys(ids) as Key[]).filter((k) => found.has(ids[k]));
}
/** What the app finds: the union of its patterns (it merges the per-pattern results by id). */
async function appFinds(query: string, collation: string): Promise<Key[]> {
  const all = new Set<Key>();
  for (const p of searchPatterns(query)) for (const k of await find(p, collation)) all.add(k);
  return [...all];
}

describe('Postgres ilike and Turkish letters (pinned)', () => {
  it('reports the collations under test (the default is whatever initdb picked on this machine)', async () => {
    const db = (await admin(`select datcollate, datctype from pg_database where datname = current_database()`)).rows[0];
    expect(typeof db.datctype).toBe('string');
    expect(collations).toContain('C');
    expect(collations).toContain('pg_c_utf8'); // builtin since Postgres 17; the embedded server is newer
  });

  it('Unicode-aware collations fold İ and I to i, but keep ı: "İSTANBUL" finds İstanbul, "ısparta" does not find ISPARTA', async () => {
    const db = (await admin(`select datctype from pg_database where datname = current_database()`)).rows[0].datctype as string;
    for (const c of collations.filter((x) => x !== 'C')) {
      if (c === 'default' && /^(C|POSIX)$/.test(db)) continue;
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

  it('the second (Turkish lower) pattern is what finds İstanbul from "İSTANBUL" under C; under Unicode collations the first already does', async () => {
    const [raw, lower] = searchPatterns('İSTANBUL');
    expect(await find(raw!, 'C')).toEqual(['istanbul']); // İ matches İ exactly, STANBUL folds as ASCII
    expect(await find(searchPatterns('istanbul')[0]!, 'C')).toEqual([]); // raw "istanbul": i ≠ İ under C
    expect(await find(searchPatterns('istanbul')[1]!, 'C')).toEqual(['istanbul']); // Turkish upper "İSTANBUL"
    expect(await find(lower!, 'pg_c_utf8')).toEqual(['istanbul']);
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
    expect((await admin(`select count(*)::int n from public.events where id = any($1::uuid[])`, [Object.values(ids)])).rows[0].n).toBe(6);
  });
});
