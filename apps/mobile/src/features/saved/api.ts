import { toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import { EVENT_PUBLIC_COLUMNS } from '../events/api';
import { OPPORTUNITY_CARD_COLUMNS } from '../opportunities/api';
import { TEAM_PUBLIC_COLUMNS } from '../teams/api';

/** The four kinds a person can save from the app. (`organization` exists on the server; no card offers it.) */
export type BookmarkType = 'event' | 'opportunity' | 'team' | 'course';
export const BOOKMARK_TYPES: readonly BookmarkType[] = ['event', 'opportunity', 'team', 'course'];

/** Explicit columns: user_id is the caller's own and never needed client-side. */
export const BOOKMARK_COLUMNS = 'id, target_type, target_id, created_at' as const;
export interface BookmarkRow { id: string; target_type: BookmarkType; target_id: string; created_at: string }

export interface SavedItem { type: BookmarkType; id: string; title: string | null; available: boolean }

export const savedKeys = {
  all: ['bookmarks'] as const,
  ids: (userId: string | null) => ['bookmarks', 'ids', userId] as const,
  list: (userId: string | null) => ['bookmarks', 'list', userId] as const,
};

/** "Mine" is filtered by user_id here, not left to policy (a staff account can read more rows under other policies). */
export async function fetchBookmarks(userId: string): Promise<BookmarkRow[]> {
  const { data, error } = await getSupabase().from('bookmarks').select(BOOKMARK_COLUMNS).eq('user_id', userId)
    .in('target_type', [...BOOKMARK_TYPES]).order('created_at', { ascending: false }).limit(200);
  if (error) throw toAppError(error);
  return data as BookmarkRow[];
}

/** Idempotent: saving twice (two devices) is not an error. The server refuses an unpublished target (bookmark_target_not_found). */
export async function addBookmark(userId: string, type: BookmarkType, id: string): Promise<void> {
  const { error } = await getSupabase().from('bookmarks')
    .upsert({ user_id: userId, target_type: type, target_id: id }, { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true }).select('id');
  if (error) throw toAppError(error);
}
export async function removeBookmark(userId: string, type: BookmarkType, id: string): Promise<void> {
  const { error } = await getSupabase().from('bookmarks').delete().eq('user_id', userId).eq('target_type', type).eq('target_id', id);
  if (error) throw toAppError(error);
}

/** Titles come from the same public tables the cards read; RLS hides unpublished rows, which is exactly "no longer available". */
async function titles(table: string, columns: string, titleKey: string, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  // Dynamic table name: the generated client types are per table, the rows here are only read as { id, [titleKey] }.
  const { data, error } = await (getSupabase().from(table as 'events').select(columns).in('id', ids) as unknown as Promise<{ data: Record<string, unknown>[] | null; error: unknown }>);
  if (error) throw toAppError(error);
  return new Map((data ?? []).map((r) => [String(r.id), String(r[titleKey] ?? '')]));
}

/** Everything saved, newest first. A target that is no longer readable keeps its row: `available=false`, `title=null`. */
export async function fetchSaved(userId: string): Promise<SavedItem[]> {
  const rows = await fetchBookmarks(userId);
  const of = (t: BookmarkType) => rows.filter((r) => r.target_type === t).map((r) => r.target_id);
  const [events, opportunities, teams, courses] = await Promise.all([
    titles('events', EVENT_PUBLIC_COLUMNS, 'title', of('event')),
    titles('opportunities', OPPORTUNITY_CARD_COLUMNS, 'title', of('opportunity')),
    titles('teams', TEAM_PUBLIC_COLUMNS, 'name', of('team')),
    titles('courses', 'id, title', 'title', of('course')),
  ]);
  const byType: Record<BookmarkType, Map<string, string>> = { event: events, opportunity: opportunities, team: teams, course: courses };
  return rows.map((r) => {
    const title = byType[r.target_type].get(r.target_id);
    return { type: r.target_type, id: r.target_id, title: title || null, available: title !== undefined };
  });
}
