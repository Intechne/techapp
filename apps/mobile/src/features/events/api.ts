import { getSupabase } from '../../lib/supabase';
import { toAppError } from '../../lib/errors';
import type { EventEligibility, EventRegistrationRow, EventSessionRow, EventType, MyGuardianRequestRow, ParticipationCard } from '../../lib/database.types';
import type { EventWithOrg } from './labels';

const EVENT_SELECT = '*, organization:organizations(id, name, verification)';
export const PAGE_SIZE = 10;

export interface EventCursor { startsAt: string; id: string }
export interface EventFilters { type: EventType | 'all'; onlineOnly: boolean; topicInterestIds?: number[]; search?: string }
export interface EventsPage { items: EventWithOrg[]; nextCursor: EventCursor | null }

/** Keyset (cursor) pagination on (starts_at, id): stable under inserts, no OFFSET scans. One query, organiser embedded. */
export async function fetchEventsPage(filters: EventFilters, cursor: EventCursor | null): Promise<EventsPage> {
  let query = getSupabase().from('events').select(EVENT_SELECT).eq('status', 'published')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true }).order('id', { ascending: true }).limit(PAGE_SIZE + 1);
  if (filters.type !== 'all') query = query.eq('type', filters.type);
  if (filters.onlineOnly) query = query.in('format', ['online', 'hybrid']);
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
  return data;
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

export async function fetchMyRegistrations(): Promise<RegistrationWithEvent[]> {
  const { data, error } = await getSupabase().from('event_registrations')
    .select(`*, event:events(${EVENT_SELECT})`).order('created_at', { ascending: false }).limit(50)
    .overrideTypes<RegistrationWithEvent[], { merge: false }>();
  if (error) throw toAppError(error);
  return data;
}

export async function fetchParticipationCard(registrationId: string): Promise<ParticipationCard> {
  const { data, error } = await getSupabase().rpc('get_participation_card', { p_registration_id: registrationId });
  if (error) throw toAppError(error);
  return data;
}

export async function fetchGuardianRequest(registrationId: string): Promise<MyGuardianRequestRow | null> {
  const { data, error } = await getSupabase().from('my_guardian_requests').select('*')
    .eq('subject_type', 'event_registration').eq('subject_id', registrationId)
    .order('requested_at', { ascending: false }).limit(1).maybeSingle();
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
  if (error) throw toAppError(error);
}

export const eventKeys = {
  list: (f: EventFilters) => ['events', 'list', f] as const,
  detail: (id: string) => ['events', 'detail', id] as const,
  eligibility: (id: string, userId: string | null) => ['events', 'eligibility', id, userId] as const,
  registration: (id: string) => ['registrations', id] as const,
  myRegistrations: (userId: string | null) => ['registrations', 'mine', userId] as const,
  card: (id: string) => ['registrations', id, 'card'] as const,
  guardian: (id: string) => ['registrations', id, 'guardian'] as const,
};
