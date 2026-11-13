import type { MainTabParamList } from '../../navigation/types';

export interface NotificationRouteInput { target_type: string | null; target_id: string | null; kind: string }
export interface NotificationRoute { tab: keyof MainTabParamList; screen: string; params: object }

type TargetType = 'event' | 'event_registration' | 'application' | 'team';

/**
 * Kinds the server writes (20261113000400, `app.notification_kinds()`), the target type each one carries, and where it opens.
 * A kind or a target type that is not listed has no route: the row is still marked read and the person is told the
 * content is gone, never sent to a screen that would 404. Status wording is never built here; the destination screens own it.
 */
const KINDS: Record<string, { target: TargetType | null; open: (id: string | null) => NotificationRoute }> = {
  // Registration lifecycle → the registration's own status screen (the minor / participant sees the next step there).
  'registration.confirmed': { target: 'event_registration', open: (id) => registrationStatus(id) },
  'registration.promoted': { target: 'event_registration', open: (id) => registrationStatus(id) },
  'registration.promoted_pending': { target: 'event_registration', open: (id) => registrationStatus(id) },
  'registration.rejected': { target: 'event_registration', open: (id) => registrationStatus(id) },
  'registration.expired': { target: 'event_registration', open: (id) => registrationStatus(id) },
  'guardian.denied': { target: 'event_registration', open: (id) => registrationStatus(id) },
  'guardian.revoked': { target: 'event_registration', open: (id) => registrationStatus(id) },
  'application.status_changed': { target: 'application', open: () => ({ tab: 'OpportunitiesTab', screen: 'MyApplications', params: {} }) },
  // A join request is for the managers: the workspace opens on İstekler. The requester's answer opens the team.
  'team_join.requested': { target: 'team', open: (id) => ({ tab: 'CommunityTab', screen: 'TeamWorkspace', params: { teamId: id, tab: 'İstekler' } }) },
  'team_join.accepted': { target: 'team', open: (id) => ({ tab: 'CommunityTab', screen: 'TeamDetail', params: { teamId: id } }) },
  'team_join.rejected': { target: 'team', open: (id) => ({ tab: 'CommunityTab', screen: 'TeamDetail', params: { teamId: id } }) },
  'event.reminder_24h': { target: 'event', open: (id) => ({ tab: 'EventsTab', screen: 'EventDetail', params: { eventId: id } }) },
  // A cancelled event is no longer public (events_public_read: published only), so its page would always be "gone".
  // The registration it closed is listed in Katılımlarım with the reason.
  'event.cancelled': { target: 'event', open: () => ({ tab: 'EventsTab', screen: 'MyRegistrations', params: {} }) },
};
const registrationStatus = (id: string | null): NotificationRoute => ({ tab: 'EventsTab', screen: 'RegistrationStatus', params: { registrationId: id } });

export function notificationRoute(n: NotificationRouteInput): NotificationRoute | null {
  const def = KINDS[n.kind];
  if (!def || !n.target_id || n.target_type !== def.target) return null;
  return def.open(n.target_id);
}

/** The table that proves the target is still readable by this person (RLS decides). */
export const TARGET_TABLE: Record<TargetType, 'events' | 'event_registrations' | 'applications' | 'teams'> = {
  event: 'events', event_registration: 'event_registrations', application: 'applications', team: 'teams',
};
export const isTargetType = (t: string | null): t is TargetType => !!t && t in TARGET_TABLE;
