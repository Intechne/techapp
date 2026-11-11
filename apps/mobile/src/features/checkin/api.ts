import { getSupabase } from '../../lib/supabase';
import { makeError, parsePayload, toAppError } from '../../lib/errors';
import { checkInResultSchema, type CheckInResult } from '../../lib/database.types';

/** Roles the server accepts for check-in (public.check_in_participant / check_in_by_short_code). Display only. */
export const CHECKIN_ROLES: readonly string[] = ['owner', 'admin', 'checkin_staff'];

export interface CheckInEvent { id: string; title: string; starts_at: string; ends_at: string }

/** A full card token (QR payload): `TA1.<registration id>.<signature>`. Anything else typed by hand is a short code. */
export const isFullToken = (input: string) => /^TA1\./.test(input.trim());

/** Same normalisation as the server: trim, upper-case, drop spaces and hyphens. */
export const normaliseShortCode = (input: string) => input.replace(/[\s-]/g, '').toUpperCase();

const istanbulDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' });

/**
 * Events the picker offers: published, of an organisation where the user has a check-in role, whose check-in window
 * (starts_at − 3 h … ends_at) is open now or opens later today (Istanbul). Convenience only — the server decides.
 */
export async function fetchCheckInEvents(orgIds: readonly string[], now: Date = new Date()): Promise<CheckInEvent[]> {
  if (orgIds.length === 0) return [];
  // Türkiye is UTC+3 all year. Window opens 3 h before start → a start up to 03:00 tomorrow still opens today.
  const endOfToday = new Date(`${istanbulDay.format(now)}T23:59:59.999+03:00`);
  const latestStart = new Date(endOfToday.getTime() + 3 * 36e5);
  const { data, error } = await getSupabase().from('events').select('id, title, starts_at, ends_at')
    .in('organization_id', [...orgIds]).eq('status', 'published')
    .gte('ends_at', now.toISOString()).lte('starts_at', latestStart.toISOString())
    .order('starts_at', { ascending: true }).limit(20);
  if (error) throw toAppError(error);
  return data as CheckInEvent[];
}

export interface CheckInInput { value: string; eventId: string | null; source: 'camera' | 'manual' }

/** Camera scans and pasted tokens go to check_in_participant; a typed short code to check_in_by_short_code (event-bound). */
export async function checkIn({ value, eventId, source }: CheckInInput): Promise<CheckInResult> {
  const supabase = getSupabase();
  const token = value.trim();
  const fullToken = source === 'camera' || isFullToken(token);
  if (!fullToken && !eventId) throw makeError('checkin_event_required');
  const { data, error } = fullToken
    ? await supabase.rpc('check_in_participant', eventId ? { p_token: token, p_expected_event_id: eventId } : { p_token: token })
    : await supabase.rpc('check_in_by_short_code', { p_event_id: eventId!, p_short_code: normaliseShortCode(token) });
  if (error) throw toAppError(error);
  return parsePayload(checkInResultSchema, data);
}
