import { useQueries } from '@tanstack/react-query';
import { toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import type { EventRow, TeamRow } from '../../lib/database.types';
import { EVENT_PUBLIC_FIELDS } from '../events/api';
import { OPPORTUNITY_CARD_COLUMNS, type OpportunityCardRow } from '../opportunities/api';
import { TEAM_PUBLIC_COLUMNS } from '../teams/api';
import { COURSE_COLUMNS, type CourseCard } from '../learning/api';
import { searchPatterns } from './query';

/** What a search row shows (type, date, place, cover). A subset of the public event list: no 6 000-character description. */
export const EVENT_SEARCH_FIELDS = ['id', 'title', 'type', 'format', 'city', 'starts_at', 'ends_at', 'tone', 'is_demo', 'cover_path', 'cover_blurhash'] as const satisfies readonly (typeof EVENT_PUBLIC_FIELDS)[number][];
export type EventSearchRow = Pick<EventRow, (typeof EVENT_SEARCH_FIELDS)[number]>;
export const EVENT_SEARCH_COLUMNS = EVENT_SEARCH_FIELDS.join(', ');

export type SearchGroupKey = 'events' | 'opportunities' | 'teams' | 'courses';
export const SEARCH_GROUPS: readonly SearchGroupKey[] = ['events', 'opportunities', 'teams', 'courses'];
export interface SearchHits { events: EventSearchRow; opportunities: OpportunityCardRow; teams: TeamRow; courses: CourseCard }
export interface SearchGroupResult<T> { hits: T[]; hasMore: boolean }
/** Rows per group on the grouped screen, and on a single group's "Tümünü gör" screen (no paging beyond it). */
export const GROUP_LIMIT = 5;
export const EXPANDED_LIMIT = 30;

type Response = PromiseLike<{ data: unknown; error: unknown }>;

/**
 * One request per pattern (see searchPatterns), each with ONE `.ilike(column, pattern)` filter, `limit + 1` rows so
 * "more" is known. Rows are merged by id and re-sorted with the list's own order, so the first `limit` are the same
 * ones a single query would return. Any failed request fails the group: a partial list would read as "that's all".
 */
async function runPatterns<T extends { id: string }>(q: string, limit: number, request: (pattern: string, rows: number) => Response, compare: (a: T, b: T) => number): Promise<SearchGroupResult<T>> {
  const responses = await Promise.all(searchPatterns(q).map((p) => request(p, limit + 1)));
  const byId = new Map<string, T>();
  for (const r of responses) {
    if (r.error) throw toAppError(r.error);
    for (const row of (r.data ?? []) as T[]) if (!byId.has(row.id)) byId.set(row.id, row);
  }
  const all = [...byId.values()].sort((a, b) => compare(a, b) || a.id.localeCompare(b.id));
  return { hits: all.slice(0, limit), hasMore: all.length > limit };
}
const asc = (a: string, b: string) => a.localeCompare(b);

/** Etkinlikler list rule: published and not yet ended (closed registration still listed); soonest first. */
export function searchEvents(q: string, limit: number) {
  const now = new Date().toISOString();
  return runPatterns<EventSearchRow>(q, limit,
    (p, n) => getSupabase().from('events').select(EVENT_SEARCH_COLUMNS).eq('status', 'published').gte('ends_at', now).ilike('title', p).order('starts_at').limit(n),
    (a, b) => asc(a.starts_at, b.starts_at));
}
/** Fırsatlar list rule: published, deadline not passed; nearest deadline first. */
export function searchOpportunities(q: string, limit: number) {
  const now = new Date().toISOString();
  return runPatterns<OpportunityCardRow>(q, limit,
    (p, n) => getSupabase().from('opportunities').select(OPPORTUNITY_CARD_COLUMNS).eq('status', 'published').gte('closes_at', now).ilike('title', p).order('closes_at').limit(n),
    (a, b) => asc(a.closes_at, b.closes_at));
}
/**
 * Topluluk list order (most members first), both kinds. The list leaves visibility to RLS, which also shows a member
 * their own team under review; search is a public surface, so it asks for active teams explicitly.
 */
export function searchTeams(q: string, limit: number) {
  return runPatterns<TeamRow>(q, limit,
    (p, n) => getSupabase().from('teams').select(TEAM_PUBLIC_COLUMNS).eq('moderation_status', 'active').ilike('name', p).order('member_count', { ascending: false }).limit(n),
    (a, b) => b.member_count - a.member_count);
}
/** Gelişim list rule (fetchCourses): published courses with at least one lesson; newest first. */
export function searchCourses(q: string, limit: number) {
  return runPatterns<CourseCard>(q, limit,
    (p, n) => getSupabase().from('courses').select(COURSE_COLUMNS).eq('status', 'published').gt('lesson_count', 0).ilike('title', p).order('published_at', { ascending: false }).limit(n),
    (a, b) => asc(b.published_at ?? '', a.published_at ?? ''));
}

export const SEARCH: { [K in SearchGroupKey]: (q: string, limit: number) => Promise<SearchGroupResult<SearchHits[K]>> } = {
  events: searchEvents, opportunities: searchOpportunities, teams: searchTeams, courses: searchCourses,
};
export const searchGroup = <K extends SearchGroupKey>(group: K, q: string, limit: number) => SEARCH[group](q, limit);

/** The normalized query is the key: an answer is stored under the text it was asked for, so an older one never shows for newer text. */
export const searchKeys = { group: (q: string, group: SearchGroupKey, limit: number) => ['search', q, group, limit] as const };

/** One query per group, so one group failing never hides the others. Disabled while there is no query. */
export function useSearchGroups(q: string | null, groups: readonly SearchGroupKey[], limit: number) {
  return useQueries({
    queries: groups.map((g) => ({
      queryKey: searchKeys.group(q ?? '', g, limit),
      queryFn: () => searchGroup(g, q!, limit) as Promise<SearchGroupResult<SearchHits[SearchGroupKey]>>,
      enabled: !!q,
      staleTime: 60_000,
    })),
  });
}
