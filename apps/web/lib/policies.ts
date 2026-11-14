import { supabaseKey, supabaseUrl } from './site';

/** Public documents with a server-side version (public.policy_versions, migration 20261114000100). No legal text lives here. */
export type PolicyDocument = 'privacy_policy' | 'kvkk_notice' | 'terms_of_use' | 'retention_policy';
export interface PublishedPolicy { purpose: PolicyDocument; version: string; published_at: string; url: string }

const LABEL: Record<PolicyDocument, string> = {
  privacy_policy: 'Gizlilik politikası', kvkk_notice: 'KVKK aydınlatma metni', terms_of_use: 'Kullanım koşulları', retention_policy: 'Saklama politikası',
};
export const policyLabel = (p: PolicyDocument) => LABEL[p];

/**
 * The latest PUBLISHED (non-draft) version of each document, read with the publishable key (policy_versions is readable by
 * anon). Drafts are never shown. Missing table (migration not on this backend yet), no published row or an unreachable
 * backend all mean the same thing on the page: no version line, the "hazırlanıyor" notice stays.
 */
export async function getPublishedPolicies(purposes: PolicyDocument[]): Promise<PublishedPolicy[]> {
  if (!supabaseUrl || !supabaseKey || purposes.length === 0) return [];
  const params = new URLSearchParams({ select: 'purpose,version,published_at,url', purpose: `in.(${purposes.join(',')})`, is_draft: 'is.false', order: 'published_at.desc' });
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/policy_versions?${params}`, { headers: { apikey: supabaseKey }, next: { revalidate: 300 } });
    if (!res.ok) return [];
    const rows = (await res.json()) as PublishedPolicy[];
    // newest first: keep the first row of each purpose, in the order the page asked for
    return purposes.map((p) => rows.find((r) => r.purpose === p)).filter((r): r is PublishedPolicy => Boolean(r && /^https:\/\//.test(r.url)));
  } catch { return []; }
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
export const formatPolicyDate = (iso: string) => dateFmt.format(new Date(iso));
