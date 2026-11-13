import { MAX_QUERY_LENGTH, WILDCARD_WINDOW, foldTurkish, matchesQuery, normalizeQuery, searchPatterns, searchPlan, toIlikePattern, toTurkishLower, toTurkishUpper } from '../query';

// Review focus 3: user text reaches PostgREST only as the value of one `.ilike(column, pattern)` filter (URL-encoded by
// supabase-js, bound as a parameter by PostgREST). These helpers decide WHAT that value is; api tests prove WHERE it goes.
describe('normalizeQuery', () => {
  it('trims, and under 2 characters is no query', () => {
    expect(normalizeQuery(' a ')).toBeNull();
    expect(normalizeQuery('')).toBeNull();
    expect(normalizeQuery('   \t\n ')).toBeNull();
    expect(normalizeQuery(' ab ')).toBe('ab');
  });

  it('collapses inner whitespace and turns control characters (NUL would make Postgres reject the text) into spaces', () => {
    expect(normalizeQuery('robot   \t kampı')).toBe('robot kampı');
    expect(normalizeQuery('ro\u0000bot')).toBe('ro bot');
    expect(normalizeQuery('\u0000\u0007')).toBeNull();
  });

  it('cuts at 60 characters without splitting an emoji', () => {
    const long = 'a'.repeat(59) + '🤖🤖';
    const q = normalizeQuery(long)!;
    expect(Array.from(q)).toHaveLength(MAX_QUERY_LENGTH);
    expect(q.endsWith('🤖')).toBe(true);
    expect(normalizeQuery('x'.repeat(200))).toBe('x'.repeat(60));
    // A cut that lands on a space does not leave it trailing.
    expect(normalizeQuery('a'.repeat(59) + ' bcd')).toBe('a'.repeat(59));
  });

  it('counts characters, not UTF-16 units: one emoji is too short, two are a query', () => {
    expect(normalizeQuery('🤖')).toBeNull();
    expect(normalizeQuery('🤖🚀')).toBe('🤖🚀');
  });

  it('composes decomposed letters (İ typed as I + combining dot) so the pattern matches stored text', () => {
    expect(normalizeQuery('İstanbul')).toBe('İstanbul');
  });
});

describe('toIlikePattern', () => {
  it('escapes % and _ so they match literally, wrapped in contains-wildcards', () => {
    expect(toIlikePattern('100%_robot')).toBe('%100\\%\\_robot%');
  });

  it('escapes the backslash first (otherwise the escapes it adds would be doubled)', () => {
    expect(toIlikePattern('\\')).toBe('%\\\\%');
    expect(toIlikePattern('a\\%')).toBe('%a\\\\\\%%');
  });

  it('PostgREST turns * into % in like patterns and it cannot be escaped: it becomes a one-character wildcard instead', () => {
    expect(toIlikePattern('a*b')).toBe('%a_b%');
  });

  it.each([
    ['a,b', '%a,b%'],
    ['(x)', '%(x)%'],
    ['"q"', '%"q"%'],
    ["'; drop", "%'; drop%"],
    ['🤖 robot', '%🤖 robot%'],
  ])('leaves %s as literal text (it is one filter value, never part of an or() string)', (input, expected) => {
    expect(toIlikePattern(input)).toBe(expected);
  });
});

describe('Turkish case', () => {
  it('maps İ/i and I/ı like toLocale*Case("tr") — without relying on the engine having Turkish locale data', () => {
    for (const s of ['İSTANBUL', 'istanbul', 'ISPARTA', 'ığdır', 'IĞDIR İÇİN Işıl', 'Gençlik ŞÖLENİ', 'robot']) {
      expect(toTurkishLower(s)).toBe(s.toLocaleLowerCase('tr'));
      expect(toTurkishUpper(s)).toBe(s.toLocaleUpperCase('tr'));
    }
  });

  // supabase/tests/search.test.ts runs these exact patterns against Postgres under several collations.
  it('searches the text as typed, Turkish lower and Turkish upper; ı and I become one-character wildcards', () => {
    expect(searchPatterns('İSTANBUL')).toEqual(['%İSTANBUL%', '%istanbul%']);
    expect(searchPatterns('istanbul')).toEqual(['%istanbul%', '%İSTANBUL%']);
    expect(searchPatterns('ısparta')).toEqual(['%_sparta%']); // upper '%_SPARTA%' differs only in ASCII case
    expect(searchPatterns('ığdır')).toEqual(['%_ğd_r%', '%_ĞD_R%']);
    expect(searchPatterns('GENÇLİK')).toEqual(['%GENÇLİK%', '%gençlik%']);
  });

  it('variants that differ only in ASCII case are one request (ilike folds ASCII under every collation)', () => {
    expect(searchPatterns('robot')).toEqual(['%robot%']);
    expect(searchPatterns('ROBOT')).toEqual(['%ROBOT%']);
  });

  it('keeps escapes intact while adding wildcards', () => {
    expect(searchPatterns('100%_robot')).toEqual(['%100\\%\\_robot%']);
    expect(searchPatterns('IIII_')).toEqual(['%____\\_%']);
    expect(searchPatterns('I_I')).toEqual(['%I\\_I%', '%ı\\_ı%']); // 2 letters: no wildcard
  });
});

describe('short queries never get the ı/I wildcard (fix round 1)', () => {
  it.each(['AI', 'IT', 'IoT', 'Iş', 'ısı', 'ıs'])('%s → no "_" in any pattern', (q) => {
    for (const p of searchPatterns(q)) expect(p).not.toContain('_');
    for (const p of searchPlan(q)) expect(p.wildcard).toBe(false);
  });

  it('from 4 letters on the wildcard applies and the plan says so', () => {
    expect(searchPlan('ığdır').map((p) => p.wildcard)).toEqual([true, true]);
    expect(searchPlan('robot').map((p) => p.wildcard)).toEqual([false]);
    expect(searchPlan('a*b').map((p) => p.wildcard)).toEqual([true]); // PostgREST * → our `_`
    expect(WILDCARD_WINDOW).toBe(30);
  });
});

describe('matchesQuery — the Turkish-insensitive client filter', () => {
  it('folds every I-form to i and lower-cases the Turkish way', () => {
    expect(foldTurkish('IĞDIR İÇİN Işıl')).toBe('iğdir için işil');
    expect(foldTurkish('ığdır ılgaz')).toBe('iğdir ilgaz');
  });

  it('"AI" does not match "Ankara Teknoloji Günü" (what the old %A_% pattern let through)', () => {
    expect(matchesQuery('Ankara Teknoloji Günü', 'AI')).toBe(false);
    expect(matchesQuery('Yapay Zekâ AI Kampı', 'ai')).toBe(true);
    expect(matchesQuery('Bağdat Turu', 'ığdır')).toBe(false); // %_ğd_r% noise
  });

  it('keeps the Turkish matches: IĞDIR → Iğdır, ığdır → IĞDIR, İSTANBUL → istanbul, gençlik → GENÇLİK', () => {
    expect(matchesQuery('Iğdır Bilim Günü', 'IĞDIR')).toBe(true);
    expect(matchesQuery('IĞDIR İÇİN', 'ığdır')).toBe(true);
    expect(matchesQuery('istanbul robot buluşması', 'İSTANBUL')).toBe(true);
    expect(matchesQuery('ISPARTA GENÇLİK ŞENLİĞİ', 'gençlik')).toBe(true);
  });
});
