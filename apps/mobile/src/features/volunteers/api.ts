import { z } from 'zod';
import { parsePayload, toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';

export type VolunteerRow = Database['public']['Tables']['event_volunteers']['Row'];

export const volunteerKeys = {
  mine: (eventId: string, userId: string | null) => ['volunteers', eventId, 'mine', userId] as const,
  brief: (eventId: string) => ['volunteers', eventId, 'brief'] as const,
};

/** Shape of `volunteer_event_brief()`: a deliberately small operational view. It never carries participant identities. */
export const volunteerBriefSchema = z.object({
  event: z.object({ id: z.string(), title: z.string(), starts_at: z.string(), ends_at: z.string(), city: z.string().nullable(), venue: z.string().nullable(),
    format: z.enum(['in_person', 'online', 'hybrid']), support_contact: z.string().nullable(), organizer: z.string().nullable() }),
  my_duty: z.string().nullable(),
  sessions: z.array(z.object({ title: z.string(), starts_at: z.string(), ends_at: z.string().nullable(), location_note: z.string().nullable() })),
  announcements: z.array(z.object({ id: z.string(), title: z.string(), body: z.string(), pinned: z.boolean(), created_at: z.string() })),
  teams: z.array(z.object({ name: z.string(), category: z.string().nullable() })),
  stats: z.object({ confirmed: z.number(), checked_in: z.number(), capacity: z.number().nullable(), volunteers: z.number() }),
});
export type VolunteerBrief = z.infer<typeof volunteerBriefSchema>;

/** My own application row for this event (RLS: own rows only), or null when I never applied. */
export async function fetchMyVolunteering(eventId: string, userId: string): Promise<VolunteerRow | null> {
  const { data, error } = await getSupabase().from('event_volunteers').select('*').eq('event_id', eventId).eq('user_id', userId).maybeSingle();
  if (error) throw toAppError(error);
  return data;
}

/** Idempotent on the server: applying twice returns the same row; a withdrawn or rejected application is reopened. */
export async function applyAsVolunteer(eventId: string, note: string): Promise<VolunteerRow> {
  const { data, error } = await getSupabase().rpc('apply_as_volunteer', { p_event_id: eventId, p_note: note.trim() || undefined });
  if (error) throw toAppError(error);
  return data;
}

export async function withdrawVolunteer(eventId: string): Promise<VolunteerRow> {
  const { data, error } = await getSupabase().rpc('withdraw_volunteer', { p_event_id: eventId });
  if (error) throw toAppError(error);
  return data;
}

/** Answers only for approved volunteers (403 volunteer_not_approved otherwise). */
export async function fetchVolunteerBrief(eventId: string): Promise<VolunteerBrief> {
  const { data, error } = await getSupabase().rpc('volunteer_event_brief', { p_event_id: eventId });
  if (error) throw toAppError(error);
  return parsePayload(volunteerBriefSchema, data);
}
