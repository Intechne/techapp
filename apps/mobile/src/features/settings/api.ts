import { toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import type { ConsentRow } from './labels';

export const settingsKeys = {
  notificationPrefs: (userId: string | null) => ['settings', 'notification-prefs', userId] as const,
  consents: (userId: string | null) => ['settings', 'consents', userId] as const,
};

/** Explicit columns, never `*`. */
export const CONSENT_COLUMNS = 'id, purpose, policy_version, granted_by, subject_type, subject_id, granted_at, withdrawn_at' as const;

/** No row = defaults (event_reminders on), as in the migration. Own row only (RLS), filtered by user_id here as well. */
export async function fetchNotificationPrefs(userId: string): Promise<{ event_reminders: boolean }> {
  const { data, error } = await getSupabase().from('notification_preferences').select('event_reminders').eq('user_id', userId).maybeSingle();
  if (error) throw toAppError(error);
  return { event_reminders: data?.event_reminders ?? true };
}

/** The only write path to notification_preferences. */
export async function setEventReminders(enabled: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('set_notification_preferences', { p_event_reminders: enabled });
  if (error) throw toAppError(error);
}

/** Same write the profile editor used: a plain update of the own row; the server trigger refuses minors (discoverable_requires_adult). */
export async function setDiscoverable(userId: string, enabled: boolean): Promise<void> {
  const { error } = await getSupabase().from('profiles').update({ discoverable: enabled }).eq('id', userId).select('id').single();
  if (error) throw toAppError(error);
}

/** Own consent rows, newest first. Read only: the consent center never writes. */
export async function fetchConsents(userId: string): Promise<ConsentRow[]> {
  const { data, error } = await getSupabase().from('consents').select(CONSENT_COLUMNS).eq('user_id', userId).order('granted_at', { ascending: false }).limit(200);
  if (error) throw toAppError(error);
  return data as ConsentRow[];
}
