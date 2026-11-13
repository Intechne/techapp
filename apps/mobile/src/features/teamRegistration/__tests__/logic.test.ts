import { eventCta, memberIdsFromError, rosterProblem, initialSelection } from '../logic';
import { makeError } from '../../../lib/errors';

const team = (id: string, registration_id: string | null = null, role: 'captain' | 'mentor' = 'captain') =>
  ({ team_id: id, name: `Takım ${id}`, role, active_member_count: 4, registration_id, registration_status: registration_id ? 'pending_members' as const : null });
const manager = { manageable_teams: [team('t1')] };
const nobody = { manageable_teams: [] };

describe('eventCta', () => {
  it('individual event: the individual CTA, flag or not', () => {
    expect(eventCta({ mode: 'individual', eligibility: nobody, signedIn: true, flag: true })).toMatchObject({ kind: 'individual', label: 'Etkinliğe katıl' });
    expect(eventCta({ mode: 'individual', eligibility: nobody, signedIn: true, flag: false }).kind).toBe('individual');
  });

  it('team event, user manages no team → team_info that names captain AND mentor', () => {
    const cta = eventCta({ mode: 'team', eligibility: nobody, signedIn: true, flag: true });
    expect(cta.kind).toBe('team_info');
    expect(cta.label).toBe('Takım kaydını kaptanın ya da mentorun yapar');
  });

  it('team event, captain or mentor of a team → team', () => {
    expect(eventCta({ mode: 'team', eligibility: manager, signedIn: true, flag: true })).toMatchObject({ kind: 'team', label: 'Takımımı kaydet', teamRegistrationId: null });
    expect(eventCta({ mode: 'team', eligibility: { manageable_teams: [team('t1', null, 'mentor')] }, signedIn: true, flag: true }).kind).toBe('team');
  });

  it('team event whose managed teams are all registered → open the status of the registration', () => {
    expect(eventCta({ mode: 'team', eligibility: { manageable_teams: [team('t1', 'r1')] }, signedIn: true, flag: true }))
      .toMatchObject({ kind: 'team', label: 'Takım kaydını gör', teamRegistrationId: 'r1' });
  });

  it('both + manager: individual is primary, the team CTA is a separate secondary', () => {
    const cta = eventCta({ mode: 'both', eligibility: manager, signedIn: true, flag: true });
    expect(cta).toMatchObject({ kind: 'individual', label: 'Etkinliğe katıl', secondary: { kind: 'team', label: 'Takımımı kaydet' } });
  });

  it('both + non-manager: individual only', () => {
    expect(eventCta({ mode: 'both', eligibility: nobody, signedIn: true, flag: true }).secondary).toBeUndefined();
  });

  it('flag off: a team event gives team_info and NEVER team; both gives no secondary', () => {
    expect(eventCta({ mode: 'team', eligibility: manager, signedIn: true, flag: false }).kind).toBe('team_info');
    expect(eventCta({ mode: 'both', eligibility: manager, signedIn: true, flag: false }).secondary).toBeUndefined();
    for (const mode of ['individual', 'team', 'both'] as const) {
      const cta = eventCta({ mode, eligibility: manager, signedIn: true, flag: false });
      expect(cta.kind).not.toBe('team');
      expect(cta.secondary).toBeUndefined();
    }
  });

  it('guest on a team event → sign_in (never team)', () => {
    expect(eventCta({ mode: 'team', eligibility: undefined, signedIn: false, flag: true })).toMatchObject({ kind: 'sign_in', label: 'Giriş yap' });
  });

  it('team event while the eligibility is still loading → none', () => {
    expect(eventCta({ mode: 'team', eligibility: undefined, signedIn: true, flag: true }).kind).toBe('none');
  });
});

describe('rosterProblem', () => {
  it('too few / too many / fine', () => {
    expect(rosterProblem(1, 2, 5)).toBe('too_few');
    expect(rosterProblem(6, 2, 5)).toBe('too_many');
    expect(rosterProblem(3, 2, null)).toBeNull();
    expect(rosterProblem(2, 2, 5)).toBeNull();
    expect(rosterProblem(5, 2, 5)).toBeNull();
  });
});

describe('memberIdsFromError', () => {
  it('reads the offending ids from the JSON array in the error detail', () => {
    expect(memberIdsFromError(makeError('member_already_registered', 409, { detail: '["a","b"]' }))).toEqual(['a', 'b']);
  });
  it('ignores a missing, malformed or non-string detail (never throws)', () => {
    expect(memberIdsFromError(makeError('member_not_active', 422))).toEqual([]);
    expect(memberIdsFromError(makeError('member_not_active', 422, { detail: 'not json' }))).toEqual([]);
    expect(memberIdsFromError(makeError('member_not_active', 422, { detail: '[1,{"a":2}]' }))).toEqual([]);
  });
});

describe('initialSelection', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('selects everyone when the roster fits the size window', () => {
    expect(initialSelection(ids, 2, 5)).toEqual(new Set(ids));
    expect(initialSelection(ids, 2, null)).toEqual(new Set(ids));
  });
  it('selects nobody when the team is larger than the maximum (the manager chooses)', () => {
    expect(initialSelection(ids, 1, 3)).toEqual(new Set());
  });
});
