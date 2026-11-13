import { TARGET_TABLE, notificationProbe, notificationRoute } from '../route';

const ID = '11111111-1111-4111-8111-111111111111';
const n = (kind: string, target_type: string | null, target_id: string | null = ID) => ({ kind, target_type, target_id });

describe('notificationRoute — every server kind', () => {
  const registrationStatus = { tab: 'EventsTab', screen: 'RegistrationStatus', params: { registrationId: ID } };

  it.each([
    'registration.confirmed', 'registration.promoted', 'registration.promoted_pending', 'registration.rejected', 'registration.expired',
    'guardian.denied', 'guardian.revoked',
  ])('%s → the registration status (the minor / participant sees the next step there)', (kind) => {
    expect(notificationRoute(n(kind, 'event_registration'))).toEqual(registrationStatus);
  });

  it('application.status_changed → Başvurularım (the status itself comes from Status.tsx there)', () => {
    expect(notificationRoute(n('application.status_changed', 'application'))).toEqual({ tab: 'OpportunitiesTab', screen: 'MyApplications', params: {} });
  });

  it('team_join.requested → team workspace on İstekler (managers decide there)', () => {
    expect(notificationRoute(n('team_join.requested', 'team'))).toEqual({ tab: 'CommunityTab', screen: 'TeamWorkspace', params: { teamId: ID, tab: 'İstekler' } });
  });
  it.each(['team_join.accepted', 'team_join.rejected'])('%s → team detail', (kind) => {
    expect(notificationRoute(n(kind, 'team'))).toEqual({ tab: 'CommunityTab', screen: 'TeamDetail', params: { teamId: ID } });
  });

  it('event.reminder_24h → event detail', () => {
    expect(notificationRoute(n('event.reminder_24h', 'event'))).toEqual({ tab: 'EventsTab', screen: 'EventDetail', params: { eventId: ID } });
  });
  it('event.cancelled → Katılımlarım: a cancelled event is no longer public, its closed registration is the place to read', () => {
    expect(notificationRoute(n('event.cancelled', 'event'))).toEqual({ tab: 'EventsTab', screen: 'MyRegistrations', params: {} });
  });
});

describe('notificationRoute — no route', () => {
  it('unknown kind → null (never guess a screen)', () => expect(notificationRoute(n('something.new', 'event'))).toBeNull());
  it('missing target → null for kinds that need one', () => {
    expect(notificationRoute(n('registration.confirmed', null, null))).toBeNull();
    expect(notificationRoute(n('event.reminder_24h', 'event', null))).toBeNull();
  });
  it('a target type that does not fit the kind → null', () => {
    expect(notificationRoute(n('registration.confirmed', 'team'))).toBeNull();
    expect(notificationRoute(n('team_join.accepted', 'event'))).toBeNull();
  });
});

describe('notificationProbe — only detail destinations are probed', () => {
  it.each([['registration.confirmed', 'event_registration'], ['guardian.revoked', 'event_registration'], ['team_join.accepted', 'team'], ['team_join.requested', 'team'], ['event.reminder_24h', 'event']])('%s probes %s', (kind, probe) => {
    expect(notificationProbe(n(kind, probe))).toBe(probe);
  });
  it('list destinations are never probed: Katılımlarım (event.cancelled) and Başvurularım (application.status_changed)', () => {
    expect(notificationProbe(n('event.cancelled', 'event'))).toBeNull();
    expect(notificationProbe(n('application.status_changed', 'application'))).toBeNull();
  });
  it('no route, no probe', () => expect(notificationProbe(n('x.y', 'event'))).toBeNull());
});

describe('notificationRoute — team registration kinds (target team_event_registration)', () => {
  const status = { tab: 'EventsTab', screen: 'TeamRegistrationStatus', params: { teamRegistrationId: ID } };
  it.each(['team_registration.confirmed', 'team_registration.member_declined', 'team_registration.expired'])('%s → the team registration status', (kind) => {
    expect(notificationRoute(n(kind, 'team_event_registration'))).toEqual(status);
  });
  it.each(['team_registration.invited', 'team_registration.guardian_expired'])('%s → no route yet (the member screen is Task 6)', (kind) => {
    expect(notificationRoute(n(kind, 'team_event_registration'))).toBeNull();
    expect(notificationProbe(n(kind, 'team_event_registration'))).toBeNull();
  });
  it('a team registration kind with another target type has no route', () => {
    expect(notificationRoute(n('team_registration.confirmed', 'event_registration'))).toBeNull();
  });
  it('the destination is probed against team_event_registrations', () => {
    expect(notificationProbe(n('team_registration.confirmed', 'team_event_registration'))).toBe('team_event_registration');
    expect(TARGET_TABLE.team_event_registration).toBe('team_event_registrations');
  });
});
