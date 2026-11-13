import { makeError, toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import { EVENT_PUBLIC_COLUMNS } from '../events/api';
import type { EventWithOrg } from '../events/labels';
import { OPPORTUNITY_PUBLIC_COLUMNS, type OpportunityPublicRow } from '../opportunities/api';
import type { Database } from '../../lib/database.types';

export type OrgType = Database['public']['Enums']['org_type'];

/**
 * What an organisation shows publicly: the columns the `anon` role may read (migration 20260920000300). `verified_by` and
 * `verified_at` are review metadata and never fetched. There is no logo pipeline yet (`logo_path` is read for when there is one).
 */
export const ORGANIZATION_COLUMNS = 'id, slug, name, type, tagline, about, website, logo_path, verification, is_demo' as const;
export interface OrganizationRow { id: string; slug: string; name: string; type: OrgType; tagline: string | null; about: string | null; website: string | null; logo_path: string | null; verification: string; is_demo: boolean }

export const organizationKeys = {
  detail: (id: string) => ['organizations', id] as const,
  events: (id: string) => ['organizations', id, 'events'] as const,
  opportunities: (id: string) => ['organizations', id, 'opportunities'] as const,
};

/** RLS shows a verified organisation to everyone and any organisation to its own members; a row nobody may read is "not found". */
export async function fetchOrganization(id: string): Promise<OrganizationRow> {
  const { data, error } = await getSupabase().from('organizations').select(ORGANIZATION_COLUMNS).eq('id', id).maybeSingle().overrideTypes<OrganizationRow | null, { merge: false }>();
  if (error) throw toAppError(error);
  if (!data) throw makeError('organization_not_found', 404);
  return data;
}

/** Published events that have not ended, soonest first. The organiser is this very organisation, so no embed is needed. */
export async function fetchOrganizationEvents(id: string): Promise<EventWithOrg[]> {
  const { data, error } = await getSupabase().from('events').select(EVENT_PUBLIC_COLUMNS).eq('organization_id', id).eq('status', 'published')
    .gte('ends_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(20).overrideTypes<Omit<EventWithOrg, 'organization'>[], { merge: false }>();
  if (error) throw toAppError(error);
  return data.map((e) => ({ ...e, organization: null }));
}

/** Open calls only (a deadline in the past is never listed), earliest deadline first. */
export async function fetchOrganizationOpportunities(id: string): Promise<OpportunityPublicRow[]> {
  const { data, error } = await getSupabase().from('opportunities').select(OPPORTUNITY_PUBLIC_COLUMNS).eq('organization_id', id).eq('status', 'published')
    .gte('closes_at', new Date().toISOString()).order('closes_at', { ascending: true }).limit(20).overrideTypes<OpportunityPublicRow[], { merge: false }>();
  if (error) throw toAppError(error);
  return data;
}
