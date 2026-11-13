import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import { toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import { useSession } from '../auth/SessionProvider';
import { TARGET_TABLE, isTargetType } from './route';

/** Explicit columns (never `*`). title / body are the server's words (`app.notification_copy`); the client renders them as is. */
export const NOTIFICATION_COLUMNS = 'id, kind, title, body, target_type, target_id, read_at, created_at' as const;
export interface NotificationRow {
  id: string; kind: string; title: string; body: string | null; target_type: string | null; target_id: string | null;
  read_at: string | null; created_at: string;
}

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (userId: string | null) => ['notifications', 'list', userId] as const,
  unread: (userId: string | null) => ['notifications', 'unread', userId] as const,
};

const LIST_LIMIT = 100;

/** Own rows (RLS) newest first; filtered by user_id here as well so a staff account never reads someone else's. */
export async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await getSupabase().from('notifications').select(NOTIFICATION_COLUMNS).eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(LIST_LIMIT);
  if (error) throw toAppError(error);
  return data as NotificationRow[];
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await getSupabase().from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null);
  if (error) throw toAppError(error);
  return count ?? 0;
}

/** The only write path (direct UPDATE is revoked). `undefined` = every own unread row. Returns how many rows changed. */
export async function markRead(ids?: string[]): Promise<number> {
  const { data, error } = await getSupabase().rpc('mark_notifications_read', ids ? { p_ids: ids } : {});
  if (error) throw toAppError(error);
  return data ?? 0;
}

/**
 * Is the target still readable by this person? RLS answers: an unpublished event, a withdrawn application or a team
 * that is gone reads as no row. A request that fails (offline) proves nothing, so it counts as available and the
 * destination screen shows its own error state.
 */
export async function targetAvailable(targetType: string | null, targetId: string | null): Promise<boolean> {
  if (!isTargetType(targetType) || !targetId) return false;
  const { data, error } = await getSupabase().from(TARGET_TABLE[targetType]).select('id').eq('id', targetId).maybeSingle();
  if (error) return true;
  return !!data;
}

/**
 * Unread count for the bell. Refreshes when the screen holding it gains focus and when the app returns to the foreground
 * (focusManager is wired to AppState in lib/appFocus; staleTime 0 lets that refetch run). Decision: no realtime channel
 * and no polling interval.
 */
export function useUnreadCount(): number {
  const { userId } = useSession();
  const q = useQuery({ queryKey: notificationKeys.unread(userId), queryFn: () => fetchUnreadCount(userId!), enabled: !!userId, staleTime: 0 });
  const qc = useQueryClient();
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; } // the mount fetch already covers the first focus
    if (userId) void qc.invalidateQueries({ queryKey: notificationKeys.unread(userId) });
  }, [qc, userId]));
  // A failed refresh shows no badge: the last good number would read as current when it is not.
  return q.isError ? 0 : q.data ?? 0;
}
