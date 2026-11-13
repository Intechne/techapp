import { useQueries } from '@tanstack/react-query';
import { toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import type { EventRow, TeamRow } from '../../lib/database.types';
import { EVENT_PUBLIC_FIELDS } from '../events/api';
import { OPPORTUNITY_CARD_COLUMNS, type OpportunityCardRow } from '../opportunities/api';
import { TEAM_PUBLIC_COLUMNS } from '../teams/api';
import { COURSE_COLUMNS, type CourseCard } from '../learning/api';
import { matchesQuery, searchPlan, WILDCARD_WINDOW } from './query';

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
type Request = (pattern: string, rows: number, signal?: AbortSignal) => Response;

/** Rows a request asks for: limit + 1 (so "more" is known), or a wider window when the pattern has a wildcard. */
const windowFor = (wildcard: boolean, limit: number) => (wildcard ? Math.max(WILDCARD_WINDOW, (limit + 1) * 2) : limit + 1);

/**
 * One request per pattern (see searchPlan), each with ONE `.ilike(column, pattern)` filter. Rows are merged by id,
 * kept only if their title passes the Turkish-insensitive check (matchesQuery — a wildcard's noise never shows), and
 * re-sorted with the list's own order; `hasMore` and the first `limit` are taken after that filter. Any failed request
 * fails the group: a partial list would read as "that's all".
 */
async function runPatterns<T extends { id: string }>(q: string, limit: number, text: (row: T) => string, request: Request, compare: (a: T, b: T) => number, signal?: AbortSignal): Promise<SearchGroupResult<T>> {
  const responses = await Promise.all(searchPlan(q).map((p) => request(p.pattern, windowFor(p.wildcard, limit), signal)));
  const byId = new Map<string, T>();
  for (const r of responses) {
    if (r.error) throw toAppError(r.error);
    for (const row of (r.data ?? []) as T[]) if (!byId.has(row.id) && matchesQuery(text(row) ?? '', q)) byId.set(row.id, row);
  }
  const all = [...byId.values()].sort((a, b) => compare(a, b) || a.id.localeCompare(b.id));
  return { hits: all.slice(0, limit), hasMore: all.length > limit };
}
const asc = (a: string, b: string) => a.localeCompare(b);

/*
 * Every search request: no postgrest-js retry (react-query retries the group once — see useSearchGroups — instead of
 * 4 × 3 stacked attempts), and react-query's abort signal, so a superseded query's requests are cancelled.
 */

/** Etkinlikler list rule: published and not yet ended (closed registration still listed); soonest first. */
export function searchEvents(q: string, limit: number, signal?: AbortSignal) {
  const now = new Date().toISOString();
  return runPatterns<EventSearchRow>(q, limit, (e) => e.title,
    (p, n, sig) => withSignal(getSupabase().from('events').select(EVENT_SEARCH_COLUMNS).eq('status', 'published').gte('ends_at', now).ilike('title', p).order('starts_at').limit(n).retry(false), sig),
    (a, b) => asc(a.starts_at, b.starts_at), signal);
}
/** Fırsatlar list rule: published, deadline not passed; nearest deadline first. */
export function searchOpportunities(q: string, limit: number, signal?: AbortSignal) {
  const now = new Date().toISOString();
  return runPatterns<OpportunityCardRow>(q, limit, (o) => o.title,
    (p, n, sig) => withSignal(getSupabase().from('opportunities').select(OPPORTUNITY_CARD_COLUMNS).eq('status', 'published').gte('closes_at', now).ilike('title', p).order('closes_at').limit(n).retry(false), sig),
    (a, b) => asc(a.closes_at, b.closes_at), signal);
}
/**
 * Topluluk list order (most members first), both kinds. The list leaves visibility to RLS, which also shows a member
 * their own team under review; search is a public surface, so it asks for active teams explicitly.
 */
export function searchTeams(q: string, limit: number, signal?: AbortSignal) {
  return runPatterns<TeamRow>(q, limit, (t) => t.name,
    (p, n, sig) => withSignal(getSupabase().from('teams').select(TEAM_PUBLIC_COLUMNS).eq('moderation_status', 'active').ilike('name', p).order('member_count', { ascending: false }).limit(n).retry(false), sig),
    (a, b) => b.member_count - a.member_count, signal);
}
/** Gelişim list rule (fetchCourses): published courses with at least one lesson; newest first. */
export function searchCourses(q: string, limit: number, signal?: AbortSignal) {
  return runPatterns<CourseCard>(q, limit, (c) => c.title,
    (p, n, sig) => withSignal(getSupabase().from('courses').select(COURSE_COLUMNS).eq('status', 'published').gt('lesson_count', 0).ilike('title', p).order('published_at', { ascending: false }).limit(n).retry(false), sig),
    (a, b) => asc(b.published_at ?? '', a.published_at ?? ''), signal);
}
/** Attach the abort signal when there is one (a call outside react-query has none). */
function withSignal<B extends { abortSignal: (s: AbortSignal) => B }>(builder: B, signal?: AbortSignal): B {
  return signal ? builder.abortSignal(signal) : builder;
}

export const SEARCH: { [K in SearchGroupKey]: (q: string, limit: number, signal?: AbortSignal) => Promise<SearchGroupResult<SearchHits[K]>> } = {
  events: searchEvents, opportunities: searchOpportunities, teams: searchTeams, courses: searchCourses,
};
export const searchGroup = <K extends SearchGroupKey>(group: K, q: string, limit: number, signal?: AbortSignal) => SEARCH[group](q, limit, signal);

/** The normalized query is the key: an answer is stored under the text it was asked for, so an older one never shows for newer text. */
export const searchKeys = { group: (q: string, group: SearchGroupKey, limit: number) => ['search', q, group, limit] as const };

/** One query per group, so one group failing never hides the others. Disabled while there is no query. A changed query aborts the old requests. */
export function useSearchGroups(q: string | null, groups: readonly SearchGroupKey[], limit: number) {
  return useQueries({
    queries: groups.map((g) => ({
      queryKey: searchKeys.group(q ?? '', g, limit),
      queryFn: ({ signal }: { signal: AbortSignal }) => searchGroup(g, q!, limit, signal) as Promise<SearchGroupResult<SearchHits[SearchGroupKey]>>,
      enabled: !!q,
      staleTime: 60_000,
      // Its own policy, not the app-wide one: one retry (1 s later), then the group's inline error.
      retry: 1,
    })),
  });
}
