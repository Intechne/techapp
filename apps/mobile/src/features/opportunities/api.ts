import { z } from 'zod';
import { parsePayload, toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import type { OpportunityRow, OpportunityType, Tables } from '../../lib/database.types';

export type OpportunityWithOrg = OpportunityRow & { organization: { id: string; name: string; verification: string } | null };
export type ApplicationRow = Tables<'applications'>;
export type ApplicationWithOpportunity = ApplicationRow & { opportunity: Pick<OpportunityRow, 'id' | 'title' | 'type' | 'closes_at'> & { organization: { name: string } | null } };
const SELECT = '*, organization:organizations(id, name, verification)';

export async function fetchOpportunities(type: OpportunityType | 'all', includeClosed = false): Promise<OpportunityWithOrg[]> {
  let q = getSupabase().from('opportunities').select(SELECT).eq('status', 'published').order('closes_at').limit(100);
  if (!includeClosed) q = q.gte('closes_at', new Date().toISOString());
  if (type !== 'all') q = q.eq('type', type);
  const { data, error } = await q.overrideTypes<OpportunityWithOrg[], { merge: false }>();
  if (error) throw toAppError(error);
  return data;
}
export async function fetchOpportunity(id: string): Promise<OpportunityWithOrg> {
  const { data, error } = await getSupabase().from('opportunities').select(SELECT).eq('id', id).single().overrideTypes<OpportunityWithOrg, { merge: false }>();
  if (error) throw toAppError(error);
  return data;
}

const previewSchema = z.object({ opportunity_id: z.string(), organization: z.string().nullable(), shared_fields: z.array(z.string()), snapshot: z.record(z.string(), z.unknown()) });
export type SharePreview = z.infer<typeof previewSchema>;
/** Exactly what the organisation would receive, built by the same server function that writes the real snapshot. */
export async function fetchSharePreview(opportunityId: string): Promise<SharePreview> {
  const { data, error } = await getSupabase().rpc('application_share_preview', { p_opportunity_id: opportunityId });
  if (error) throw toAppError(error);
  return parsePayload(previewSchema, data);
}
export async function submitApplication(opportunityId: string, idempotencyKey: string, motivation: string): Promise<ApplicationRow> {
  const { data, error } = await getSupabase().rpc('submit_application', { p_opportunity_id: opportunityId, p_idempotency_key: idempotencyKey, p_motivation: motivation.trim() || undefined });
  if (error) throw toAppError(error);
  return data;
}
export async function withdrawApplication(applicationId: string): Promise<ApplicationRow> {
  const { data, error } = await getSupabase().rpc('withdraw_application', { p_application_id: applicationId });
  if (error) throw toAppError(error);
  return data;
}
export async function fetchMyApplications(): Promise<ApplicationWithOpportunity[]> {
  const { data, error } = await getSupabase().from('applications')
    .select('*, opportunity:opportunities(id, title, type, closes_at, organization:organizations(name))').order('created_at', { ascending: false }).limit(100)
    .overrideTypes<ApplicationWithOpportunity[], { merge: false }>();
  if (error) throw toAppError(error);
  return data;
}
export async function fetchMyApplicationFor(opportunityId: string): Promise<ApplicationRow | null> {
  const { data, error } = await getSupabase().from('applications').select('*').eq('opportunity_id', opportunityId).neq('status', 'withdrawn')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw toAppError(error);
  return data;
}

/** "Takip et": a followed call shows up in Son tarihler → Takip ettiklerim. Stored as the user's own bookmark (RLS). */
export async function fetchFollowedOpportunityIds(): Promise<string[]> {
  const { data, error } = await getSupabase().from('bookmarks').select('target_id').eq('target_type', 'opportunity');
  if (error) throw toAppError(error);
  return data.map((b) => b.target_id);
}
export async function setFollowed(userId: string, opportunityId: string, follow: boolean): Promise<void> {
  const supabase = getSupabase();
  const { error } = follow
    ? await supabase.from('bookmarks').upsert({ user_id: userId, target_type: 'opportunity', target_id: opportunityId }, { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true })
    : await supabase.from('bookmarks').delete().eq('target_type', 'opportunity').eq('target_id', opportunityId);
  if (error) throw toAppError(error);
}

export const opportunityKeys = {
  list: (type: string, closed: boolean) => ['opportunities', 'list', type, closed] as const,
  detail: (id: string) => ['opportunities', 'detail', id] as const,
  preview: (id: string, userId: string | null) => ['opportunities', 'preview', id, userId] as const,
  myApplications: (userId: string | null) => ['applications', 'mine', userId] as const,
  myApplicationFor: (id: string, userId: string | null) => ['applications', 'for', id, userId] as const,
  followed: (userId: string | null) => ['opportunities', 'followed', userId] as const,
};
