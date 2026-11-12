import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { OPPORTUNITY_CARD_COLUMNS, OPPORTUNITY_PUBLIC_COLUMNS, fetchMyApplications, fetchOpportunities, fetchOpportunity } from '../api';

// opportunities.created_by / approved_by are staff auth uids. The app never shows them, so it never asks for them:
// every opportunities read names its columns instead of `*`.
const selects: string[] = [];
function mockBuilder() {
  const b: Record<string, unknown> = {};
  for (const m of ['eq', 'gt', 'gte', 'lte', 'in', 'or', 'order', 'limit', 'overrideTypes']) b[m] = () => b;
  b.select = (s: string) => { selects.push(s); return b; };
  b.single = () => b;
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  return b;
}
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ from: () => mockBuilder() }) }));

const cols = OPPORTUNITY_PUBLIC_COLUMNS.split(',').map((c) => c.trim());
/** Fields the list / detail / apply / Son tarihler screens and toOpportunityRow read. */
const READ_BY_SCREENS = [
  'id', 'title', 'summary', 'description', 'type', 'tone', 'city', 'is_remote', 'audience_note', 'reward_note', 'skills',
  'min_age', 'max_age', 'guardian_required_under', 'opens_at', 'closes_at', 'shared_fields', 'apply_url', 'team_based', 'is_demo',
];

describe('opportunities are read by an explicit public column list', () => {
  it('OPPORTUNITY_PUBLIC_COLUMNS has no wildcard and no staff identities', () => {
    expect(OPPORTUNITY_PUBLIC_COLUMNS).not.toMatch(/\*/);
    expect(cols).not.toContain('created_by');
    expect(cols).not.toContain('approved_by');
    expect(new Set(cols).size).toBe(cols.length);
  });
  it('includes every field the screens read; the card list (Keşfet) is a subset of it', () => {
    expect(cols).toEqual(expect.arrayContaining(READ_BY_SCREENS));
    const card = OPPORTUNITY_CARD_COLUMNS.split(',').map((c) => c.trim());
    expect(card).toEqual(expect.arrayContaining(['id', 'title', 'type', 'closes_at', 'is_remote', 'city', 'audience_note', 'reward_note', 'is_demo']));
    for (const c of card) expect(cols).toContain(c);
  });
  it('list and detail use it with the organisation embedded; the applications join names its opportunity columns', async () => {
    selects.length = 0;
    await fetchOpportunities('all');
    await fetchOpportunity('o1').catch(() => {});
    await fetchMyApplications('u1');
    expect(selects).toHaveLength(3);
    for (const s of selects.slice(0, 2)) {
      expect(s).toContain(OPPORTUNITY_PUBLIC_COLUMNS);
      expect(s).toContain('organization:organizations(id, name, verification)');
      expect(s).not.toMatch(/created_by|approved_by|\*/);
    }
    expect(selects[2]).toMatch(/^\*, opportunity:opportunities\([^*]*\)$/); // the user's own application row + a named opportunity subset
    expect(selects[2]).not.toMatch(/created_by|approved_by/);
  });
  it('no source file reads every column of opportunities', () => {
    const SRC = join(__dirname, '..', '..', '..');
    const files: string[] = [];
    const walk = (dir: string) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) { if (n !== '__tests__') walk(p); } else if (/\.tsx?$/.test(n)) files.push(p); } };
    walk(SRC);
    const offenders = files.filter((f) => {
      const s = readFileSync(f, 'utf8');
      return /from\(\s*['"]opportunities['"]\s*\)[^;]*?\.select\(\s*(\)|['"`]\s*\*)/.test(s) || /\bopportunities\s*\(\s*\*\s*\)/.test(s);
    }).map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
