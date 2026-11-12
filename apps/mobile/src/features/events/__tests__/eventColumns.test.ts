import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { EVENT_PUBLIC_COLUMNS, fetchEvent, fetchEventsPage, fetchMyRegistrations, fetchRegistration } from '../api';

// events.created_by / approved_by are staff auth uids. The app never shows them, so it never asks for them:
// every events read names its columns (EVENT_PUBLIC_COLUMNS) instead of `*`.
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

const cols = EVENT_PUBLIC_COLUMNS.split(',').map((c) => c.trim());

/** Fields the poster card, detail, registration and Katılımlarım mappers read (labels.ts, EventDetailScreen, RegistrationStatus). */
const READ_BY_SCREENS = [
  'id', 'title', 'summary', 'description', 'type', 'format', 'city', 'venue', 'starts_at', 'ends_at',
  'registration_opens_at', 'registration_closes_at', 'registration_mode', 'capacity', 'seats_taken', 'waitlist_enabled',
  'fee_minor_units', 'min_age', 'max_age', 'guardian_required_under', 'audience_note', 'requires_review', 'accepts_volunteers',
  'cancellation_policy', 'support_contact', 'poster_line', 'tone', 'is_demo',
];

describe('events are read by an explicit public column list', () => {
  it('EVENT_PUBLIC_COLUMNS has no wildcard and no staff identities', () => {
    expect(EVENT_PUBLIC_COLUMNS).not.toMatch(/\*/);
    expect(cols).not.toContain('created_by');
    expect(cols).not.toContain('approved_by');
    expect(new Set(cols).size).toBe(cols.length);
  });

  it('includes every field the poster / detail mappers read', () => {
    expect(cols).toEqual(expect.arrayContaining(READ_BY_SCREENS));
  });

  it('all four events reads (list, detail, registration, Katılımlarım) use it, organiser embedded', async () => {
    selects.length = 0;
    await fetchEventsPage({ type: 'all', onlineOnly: false }, null);
    await fetchEvent('e1').catch(() => {});
    await fetchRegistration('r1').catch(() => {});
    await fetchMyRegistrations('u1');
    expect(selects).toHaveLength(4);
    for (const s of selects) {
      expect(s).toContain(EVENT_PUBLIC_COLUMNS);
      expect(s).toContain('organization:organizations(id, name, verification)');
      expect(s).not.toMatch(/created_by|approved_by/);
    }
    // The event itself is never read with `*` (event_registrations / event_sessions rows may be).
    expect(selects[0]).not.toMatch(/\*/);
    expect(selects[1]).toMatch(/^[^*]*sessions:event_sessions\(\*\)$/);
    for (const s of selects.slice(2)) expect(s).toMatch(/^\*, event:events\([^*]*\)$/);
  });

  it('no source file reads every column of events', () => {
    const SRC = join(__dirname, '..', '..', '..');
    const files: string[] = [];
    const walk = (dir: string) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) { if (n !== '__tests__') walk(p); } else if (/\.tsx?$/.test(n)) files.push(p); } };
    walk(SRC);
    const offenders = files.filter((f) => {
      const s = readFileSync(f, 'utf8');
      return /from\(\s*['"]events['"]\s*\)[^;]*?\.select\(\s*(\)|['"`]\s*\*)/.test(s) || /\bevents\s*\(\s*\*\s*\)/.test(s);
    }).map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
