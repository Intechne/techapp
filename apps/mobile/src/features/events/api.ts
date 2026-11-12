import { getSupabase } from '../../lib/supabase';
import { fromFunctionError, parsePayload, toAppError } from '../../lib/errors';
import { eventEligibilitySchema, participationCardSchema, type EventEligibility, type EventRegistrationRow, type EventRow, type EventSessionRow, type EventType, type MyGuardianRequestRow, type ParticipationCard } from '../../lib/database.types';
import type { EventWithOrg } from './labels';

/**
 * The event columns the app reads — every field the poster card, detail, registration, Katılımlarım and filter code uses.
 * Never `*`: events also carry created_by / approved_by (staff auth uids), online_url and bookkeeping timestamps the
 * client has no use for. `EventPublicRow` is derived from the same list, so reading a column that is not fetched is a type error.
 */
export const EVENT_PUBLIC_FIELDS = [
  'id', 'organization_id', 'title', 'summary', 'description', 'type', 'format', 'city', 'venue', 'starts_at', 'ends_at',
  'registration_opens_at', 'registration_closes_at', 'registration_mode', 'capacity', 'seats_taken', 'waitlist_enabled',
  'fee_minor_units', 'min_age', 'max_age', 'guardian_required_under', 'audience_note', 'requires_review', 'accepts_volunteers',
  'cancellation_policy', 'support_contact', 'poster_line', 'tone', 'status', 'is_demo',
] as const satisfies readonly (keyof EventRow)[];
export type EventPublicRow = Pick<EventRow, (typeof EVENT_PUBLIC_FIELDS)[number]>;
export const EVENT_PUBLIC_COLUMNS = EVENT_PUBLIC_FIELDS.join(', ');

const EVENT_SELECT = `${EVENT_PUBLIC_COLUMNS}, organization:organizations(id, name, verification)`;
export const PAGE_SIZE = 10;

export interface EventCursor { startsAt: string; id: string }
export interface EventFilters { type: EventType | 'all'; topicInterestIds?: number[]; search?: string;
  /** Skip events whose registration already closed, server-side, so a 10-row page is not eaten by them (Keşfet, list filter). */
  registrationOpenOnly?: boolean;
  /** Can attend in this way: hybrid events count for both. */
  format?: 'in_person' | 'online';
  city?: string;
  /** Starts within the next 7 / 30 / 90 days (WITHIN_DAYS); the bound is computed when the page is fetched. */
  within?: 'week' | 'month' | 'quarter' }

const WITHIN_DAYS = { week: 7, month: 30, quarter: 90 } as const;
const DAY_MS = 86_400_000;
export interface EventsPage { items: EventWithOrg[]; nextCursor: EventCursor | null }

/** Keyset (cursor) pagination on (starts_at, id): stable under inserts, no OFFSET scans. One query, organiser embedded. */
export async function fetchEventsPage(filters: EventFilters, cursor: EventCursor | null): Promise<EventsPage> {
  let query = getSupabase().from('events').select(EVENT_SELECT).eq('status', 'published')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true }).order('id', { ascending: true }).limit(PAGE_SIZE + 1);
  if (filters.type !== 'all') query = query.eq('type', filters.type);
  if (filters.registrationOpenOnly) query = query.gt('registration_closes_at', new Date().toISOString());
  if (filters.format) query = query.in('format', [filters.format, 'hybrid']);
  if (filters.city) query = query.eq('city', filters.city);
  if (filters.within) query = query.lte('starts_at', new Date(Date.now() + WITHIN_DAYS[filters.within] * DAY_MS).toISOString());
  if (filters.topicInterestIds?.length) query = query.in('topic_interest_id', filters.topicInterestIds);
  if (filters.search?.trim()) {
    const term = filters.search.trim().replace(/[%,()]/g, ' ');
    query = query.or(`title.ilike.%${term}%,summary.ilike.%${term}%`);
  }
  if (cursor) query = query.or(`starts_at.gt.${cursor.startsAt},and(starts_at.eq.${cursor.startsAt},id.gt.${cursor.id})`);

  const { data, error } = await query.overrideTypes<EventWithOrg[], { merge: false }>();
  if (error) throw toAppError(error);
  const items = data.slice(0, PAGE_SIZE);
  const last = items[items.length - 1];
  return { items, nextCursor: data.length > PAGE_SIZE && last ? { startsAt: last.starts_at, id: last.id } : null };
}

/**
 * Cities of the events the list can show (published, not yet ended), for the filter sheet: a plain column read,
 * de-duplicated and sorted here. Capped; a city beyond the cap is still reachable through the type/date filters.
 */
export async function fetchEventCities(): Promise<string[]> {
  const { data, error } = await getSupabase().from('events').select('city').eq('status', 'published')
    .gte('ends_at', new Date().toISOString()).not('city', 'is', null).order('city', { ascending: true }).limit(500)
    .overrideTypes<{ city: string | null }[], { merge: false }>();
  if (error) throw toAppError(error);
  return [...new Set(data.map((r) => r.city?.trim()).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'tr'));
}

export interface EventDetail extends EventWithOrg { sessions: EventSessionRow[] }

export async function fetchEvent(eventId: string): Promise<EventDetail> {
  const { data, error } = await getSupabase().from('events')
    .select(`${EVENT_SELECT}, sessions:event_sessions(*)`).eq('id', eventId).single()
    .overrideTypes<EventDetail, { merge: false }>();
  if (error) throw toAppError(error);
  return { ...data, sessions: [...data.sessions].sort((a, b) => a.sort_order - b.sort_order || a.starts_at.localeCompare(b.starts_at)) };
}

export async function fetchEligibility(eventId: string): Promise<EventEligibility> {
  const { data, error } = await getSupabase().rpc('event_eligibility', { p_event_id: eventId });
  if (error) throw toAppError(error);
  return parsePayload(eventEligibilitySchema, data);
}

/** The server decides status atomically. The same idempotency key is reused on retry, so no duplicates. */
export async function registerForEvent(eventId: string, idempotencyKey: string): Promise<EventRegistrationRow> {
  const { data, error } = await getSupabase().rpc('register_for_event', { p_event_id: eventId, p_idempotency_key: idempotencyKey });
  if (error) throw toAppError(error);
  return data;
}

export async function cancelRegistration(registrationId: string): Promise<EventRegistrationRow> {
  const { data, error } = await getSupabase().rpc('cancel_event_registration', { p_registration_id: registrationId });
  if (error) throw toAppError(error);
  return data;
}

export type RegistrationWithEvent = EventRegistrationRow & { event: EventWithOrg };

export async function fetchRegistration(registrationId: string): Promise<RegistrationWithEvent> {
  const { data, error } = await getSupabase().from('event_registrations')
    .select(`*, event:events(${EVENT_SELECT})`).eq('id', registrationId).single()
    .overrideTypes<RegistrationWithEvent, { merge: false }>();
  if (error) throw toAppError(error);
  return data;
}

/** RLS also lets organisation staff read their attendees' rows, so "mine" is filtered by the signed-in user explicitly. */
export async function fetchMyRegistrations(userId: string): Promise<RegistrationWithEvent[]> {
  const { data, error } = await getSupabase().from('event_registrations')
    .select(`*, event:events(${EVENT_SELECT})`).eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    .overrideTypes<RegistrationWithEvent[], { merge: false }>();
  if (error) throw toAppError(error);
  return data;
}

export async function fetchParticipationCard(registrationId: string): Promise<ParticipationCard> {
  const { data, error } = await getSupabase().rpc('get_participation_card', { p_registration_id: registrationId });
  if (error) throw toAppError(error);
  return parsePayload(participationCardSchema, data);
}

export async function fetchGuardianRequest(registrationId: string): Promise<MyGuardianRequestRow | null> {
  const { data, error } = await getSupabase().from('my_guardian_requests').select('*')
    .eq('subject_type', 'event_registration').eq('subject_id', registrationId)
    .order('requested_at', { ascending: false }).limit(1).maybeSingle().overrideTypes<MyGuardianRequestRow, { merge: false }>();
  if (error) throw toAppError(error);
  return data;
}

/** Creates the request, then asks the Edge Function to e-mail the guardian. The app never sees the token. */
export async function sendGuardianRequest(registrationId: string, guardianEmail: string, guardianName: string): Promise<void> {
  const supabase = getSupabase();
  const { data: requestId, error } = await supabase.rpc('create_guardian_request', {
    p_registration_id: registrationId, p_guardian_email: guardianEmail.trim(), p_guardian_name: guardianName.trim(),
  });
  if (error) throw toAppError(error);
  await dispatchGuardianEmail(requestId);
}

export async function dispatchGuardianEmail(requestId: string): Promise<void> {
  const { error } = await getSupabase().functions.invoke('guardian-dispatch', { body: { request_id: requestId } });
  if (error) throw await fromFunctionError(error);
}

export const eventKeys = {
  list: (f: EventFilters) => ['events', 'list', f] as const,
  cities: () => ['events', 'cities'] as const,
  detail: (id: string) => ['events', 'detail', id] as const,
  eligibility: (id: string, userId: string | null) => ['events', 'eligibility', id, userId] as const,
  registration: (id: string) => ['registrations', id] as const,
  myRegistrations: (userId: string | null) => ['registrations', 'mine', userId] as const,
  card: (userId: string | null, registrationId: string) => ['registrations', registrationId, 'card', userId] as const,
  guardian: (id: string) => ['registrations', id, 'guardian'] as const,
};
