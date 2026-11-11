import { cvSchema } from '../cvSchema';
import { profileStats, type MyRegistrationLike } from '../profileStats';

const now = new Date('2026-11-11T12:00:00Z');
const cv = cvSchema.parse({
  profile: { id: 'u1', display_name: 'Elif', headline: null, bio: null, city: null, education_stage: null, discoverable: false, skills: [] },
  interests: [], volunteering: [], teams: [],
  experiences: [
    { id: 'x1', kind: 'project', title: 'A', role: null, contribution: null, organization_name: null, link_url: null, started_on: null, ended_on: null, status: 'published', visibility: 'profile', attestation: null },
    { id: 'x2', kind: 'project', title: 'B', role: null, contribution: null, organization_name: null, link_url: null, started_on: null, ended_on: null, status: 'published', visibility: 'profile',
      attestation: { id: 'a', status: 'verified', scope: null, source: null, decided_at: '2026-01-01T00:00:00Z', decision_note: null, valid_until: null, organization: 'Org' } },
  ],
  participations: [
    { event_id: 'e1', title: 'E1', type: 'x', starts_at: '2026-05-01T10:00:00Z', organizer: null, checked_in_at: '2026-05-01T10:05:00Z' },
    { event_id: 'e2', title: 'E2', type: 'x', starts_at: '2026-06-01T10:00:00Z', organizer: null, checked_in_at: '2026-06-01T10:05:00Z' },
  ],
});
const reg = (id: string, status: MyRegistrationLike['status'], starts_at: string): MyRegistrationLike => ({ id, status, event: { starts_at } });

describe('profileStats', () => {
  it('counts attended from check-ins only, never from registrations', () => {
    const s = profileStats(cv, [reg('r1', 'confirmed', '2026-05-01T10:00:00Z'), reg('r2', 'confirmed', '2026-12-01T10:00:00Z')], now);
    expect(s.attended).toBe(2);
    expect(s.experiences).toBe(2);
    expect(s.verified).toBe(1);
  });

  it('lists future live registrations ascending by start', () => {
    const s = profileStats(cv, [
      reg('late', 'confirmed', '2027-02-01T10:00:00Z'), reg('guard', 'pending_guardian', '2026-12-01T10:00:00Z'),
      reg('wait', 'waitlisted', '2027-01-01T10:00:00Z'), reg('rev', 'pending_review', '2026-11-20T10:00:00Z'),
    ], now);
    expect(s.upcoming.map((r) => r.id)).toEqual(['rev', 'guard', 'wait', 'late']);
  });

  it('does not count a past confirmed registration without check-in anywhere', () => {
    const s = profileStats(cv, [reg('past', 'confirmed', '2026-09-01T10:00:00Z')], now);
    expect(s.upcoming).toEqual([]);
    expect(s.attended).toBe(2);
  });

  it('never counts cancelled, rejected or expired registrations', () => {
    const s = profileStats(cv, (['cancelled', 'rejected', 'expired'] as const).map((st) => reg(st, st, '2027-01-01T10:00:00Z')), now);
    expect(s.upcoming).toEqual([]);
  });

  it('marks an upcoming confirmed registration as checked in when the CV holds a check-in for its event', () => {
    const s = profileStats(cv, [
      { ...reg('in', 'confirmed', '2026-12-01T10:00:00Z'), event_id: 'e1' },
      { ...reg('out', 'confirmed', '2026-12-02T10:00:00Z'), event_id: 'e9' },
      { ...reg('wait', 'waitlisted', '2026-12-03T10:00:00Z'), event_id: 'e1' },
    ], now);
    expect(s.upcoming.map((r) => [r.id, r.checkedIn])).toEqual([['in', true], ['out', false], ['wait', false]]);
  });
});
