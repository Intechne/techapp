import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import { useSession } from '../auth/SessionProvider';
import { usePendingIntent } from '../auth/pendingIntent';
import { addBookmark, fetchBookmarks, removeBookmark, savedKeys, type BookmarkRow, type BookmarkType, type SavedItem } from './api';

/** One request per (user, type, id) at a time, across every mounted list and detail: a second tap while it runs is ignored. */
const inflight = new Set<string>();

const SAVED_TOAST: Record<BookmarkType, string> = {
  // Saving a call means following its deadline (Son tarihler → Takip ettiklerim): the words stay specific.
  opportunity: 'Takibe aldın. Son tarihler ekranında göreceksin.',
  event: 'Kaydedildi. Profil > Kaydedilenler’de bulursun.',
  team: 'Kaydedildi. Profil > Kaydedilenler’de bulursun.',
  course: 'Kaydedildi. Profil > Kaydedilenler’de bulursun.',
};
const REMOVED_TOAST: Record<BookmarkType, string> = { opportunity: 'Takipten çıkarıldı.', event: 'Kayıt kaldırıldı.', team: 'Kayıt kaldırıldı.', course: 'Kayıt kaldırıldı.' };

/**
 * The write path shared by every save control and by the Kaydedilenler list: optimistic cache update, targeted revert
 * and a COPY toast on failure. Returns false when the call was ignored (guest, or the same id is already in flight).
 */
function useBookmarkWrite() {
  const { userId } = useSession();
  const qc = useQueryClient(); const toast = useToast();
  const [running, setRunning] = useState(0);

  const write = useCallback(async (type: BookmarkType, id: string, want: boolean, opts: { quiet?: boolean } = {}): Promise<boolean> => {
    if (!userId) return false;
    const key = `${userId}:${type}:${id}`;
    if (inflight.has(key)) return false;
    inflight.add(key); setRunning((n) => n + 1);
    const idsKey = savedKeys.ids(userId); const listKey = savedKeys.list(userId);
    await qc.cancelQueries({ queryKey: savedKeys.all });
    const prevIds = qc.getQueryData<BookmarkRow[]>(idsKey); const prevList = qc.getQueryData<SavedItem[]>(listKey);
    const without = (rows: BookmarkRow[] | undefined) => (rows ?? []).filter((r) => !(r.target_type === type && r.target_id === id));
    qc.setQueryData<BookmarkRow[]>(idsKey, want ? [{ id: `pending:${key}`, target_type: type, target_id: id, created_at: new Date().toISOString() }, ...without(prevIds)] : without(prevIds));
    if (!want) qc.setQueryData<SavedItem[]>(listKey, (rows) => rows?.filter((r) => !(r.type === type && r.id === id)));
    try {
      await (want ? addBookmark(userId, type, id) : removeBookmark(userId, type, id));
      if (!opts.quiet) toast.show(want ? SAVED_TOAST[type] : REMOVED_TOAST[type]);
      return true;
    } catch (e) {
      // Revert only this item, so another id's optimistic change in flight is left alone.
      const was = (prevIds ?? []).find((r) => r.target_type === type && r.target_id === id);
      qc.setQueryData<BookmarkRow[]>(idsKey, (rows) => (was ? [was, ...without(rows)] : without(rows)));
      if (prevList) qc.setQueryData<SavedItem[]>(listKey, prevList);
      toast.show(toAppError(e).message, 'danger');
      return false;
    } finally {
      inflight.delete(key); setRunning((n) => n - 1);
      // Refetch only once this user's last write settles: a refetch while another write is in flight would come back
      // without that write's row and briefly un-fill its optimistic icon.
      const prefix = `${userId}:`;
      if (![...inflight].some((k) => k.startsWith(prefix))) void qc.invalidateQueries({ queryKey: savedKeys.all });
    }
  }, [userId, qc, toast]);

  return { userId, write, pending: running > 0 };
}

/** Kaydedilenler: take a saved item out of the list, whatever its type (including a target that is gone). */
export function useBookmarkRemoval() {
  const { write } = useBookmarkWrite();
  return { remove: (type: BookmarkType, id: string) => write(type, id, false) };
}

/**
 * The save state and action for one kind of card. Guests get `requiresAuth`: the control stays visible, and a tap
 * sends them to sign-in with a pending intent, so the save completes when they come back.
 */
export function useBookmarks(type: BookmarkType): { ids: Set<string>; toggle: (id: string) => void; pending: boolean; requiresAuth: boolean; ready: boolean } {
  const { userId, write, pending } = useBookmarkWrite();
  const navigation = useNavigation<{ navigate: (route: 'AuthEmail') => void }>();
  const intent = usePendingIntent();
  const query = useQuery({ queryKey: savedKeys.ids(userId), queryFn: () => fetchBookmarks(userId!), enabled: !!userId });
  const ids = useMemo(() => new Set((query.data ?? []).filter((r) => r.target_type === type).map((r) => r.target_id)), [query.data, type]);

  // Back from sign-in: finish the save the guest started (only the list that owns that type takes the intent).
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    const resumed = intent.consume('bookmark', (i) => i.targetType === type);
    if (resumed) void write(type, resumed.targetId, true);
  }, [userId, intent, type, write]));

  const toggle = useCallback((id: string) => {
    if (!userId) { intent.set({ type: 'bookmark', targetType: type, targetId: id }); navigation.navigate('AuthEmail'); return; }
    void write(type, id, !ids.has(id));
  }, [userId, intent, navigation, type, write, ids]);
  return { ids, toggle, pending, requiresAuth: !userId, ready: !userId || query.isSuccess };
}
