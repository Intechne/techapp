import type { EventType } from '../../lib/database.types';
import type { EventFilters } from './api';
import { EVENT_TYPE_FILTERS } from './labels';

/**
 * Etkinlikler list filters. Client state only: the list keeps them in its route params (the filter sheet hands the edited
 * set back with popTo), and they become optional filters on the existing keyset-paged list query — no new RPC.
 * Route params are strings once they pass through a web URL, so they are read back through `readListFilters`.
 */
export type FormatFilter = 'any' | 'in_person' | 'online';
export type WithinFilter = 'any' | 'week' | 'month' | 'quarter';
export interface EventListFilters { type: EventType | 'all'; format: FormatFilter; city: string | null; within: WithinFilter; openOnly: boolean }

/** EventsList / EventFilters route params: only the non-default filters, as strings. */
export type EventListParams = { type?: string; format?: string; city?: string; within?: string; open?: string | boolean } | undefined;

export const DEFAULT_LIST_FILTERS: EventListFilters = { type: 'all', format: 'any', city: null, within: 'any', openOnly: false };
/** `setParams` merges: every key set to undefined clears the list's filters. */
export const CLEARED_LIST_PARAMS = { type: undefined, format: undefined, city: undefined, within: undefined, open: undefined };

export const FORMAT_FILTERS: readonly { value: FormatFilter; label: string }[] = [
  { value: 'any', label: 'Fark etmez' }, { value: 'in_person', label: 'Yüz yüze' }, { value: 'online', label: 'Çevrim içi' },
];
export const WITHIN_FILTERS: readonly { value: WithinFilter; label: string }[] = [
  { value: 'any', label: 'Her zaman' }, { value: 'week', label: '7 gün içinde' }, { value: 'month', label: '30 gün içinde' }, { value: 'quarter', label: '3 ay içinde' },
];

const TYPES = new Set<string>(EVENT_TYPE_FILTERS.map((f) => f.value));
const pick = <T extends string>(v: unknown, options: readonly { value: T }[], fallback: T): T =>
  (typeof v === 'string' && options.some((o) => o.value === v) ? v : fallback) as T;

export function readListFilters(params: EventListParams): EventListFilters {
  const p = params ?? {};
  const city = typeof p.city === 'string' ? p.city.trim() : '';
  return {
    type: typeof p.type === 'string' && TYPES.has(p.type) ? (p.type as EventType | 'all') : 'all',
    format: pick(p.format, FORMAT_FILTERS, 'any'),
    city: city || null,
    within: pick(p.within, WITHIN_FILTERS, 'any'),
    openOnly: p.open === true || p.open === '1' || p.open === 'true',
  };
}

export function toListParams(f: EventListFilters): NonNullable<EventListParams> {
  return {
    ...(f.type !== 'all' ? { type: f.type } : null),
    ...(f.format !== 'any' ? { format: f.format } : null),
    ...(f.city ? { city: f.city } : null),
    ...(f.within !== 'any' ? { within: f.within } : null),
    ...(f.openOnly ? { open: '1' } : null),
  };
}

export const activeFilterCount = (f: EventListFilters): number => Object.keys(toListParams(f)).length;
export const filterButtonLabel = (count: number) => (count > 0 ? `Filtrele · ${count}` : 'Filtrele');

export function toQueryFilters(f: EventListFilters): EventFilters {
  return {
    type: f.type,
    ...(f.format !== 'any' ? { format: f.format } : null),
    ...(f.city ? { city: f.city } : null),
    ...(f.within !== 'any' ? { within: f.within } : null),
    ...(f.openOnly ? { registrationOpenOnly: true } : null),
  };
}

/** Which list the root-stack filter sheet edits: the Events stack's key and the EventsList route key (set by the list). */
export interface EventFiltersTarget { listKey?: string; stackKey?: string }

/** The bits of a navigation state this lookup reads (a full or partial state). */
interface NavStateLike { key?: string; routes: readonly { name: string; key?: string; state?: NavStateLike }[] }

/**
 * The filter sheet lives on the root stack, above the tab bar (Android draws the tab bar over a sheet presented inside a
 * tab). It finds the Etkinlikler list it edits — root → Main (tabs) → EventsTab (stack) → EventsList — so it can target
 * that route with setParams. Null when the Events stack is not mounted.
 */
export function findEventsList(root: NavStateLike | undefined): { stackKey: string; listKey: string } | null {
  const tabs = root?.routes.find((r) => r.name === 'Main')?.state;
  const stack = tabs?.routes.find((r) => r.name === 'EventsTab')?.state;
  const list = stack?.routes.find((r) => r.name === 'EventsList');
  return stack?.key && list?.key ? { stackKey: stack.key, listKey: list.key } : null;
}
