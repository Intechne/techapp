import { supabaseKey, supabaseUrl } from './site';

export interface PublicCvAttestation { status: 'verified'; scope: string | null; source: string | null; decided_at: string | null; valid_until: string | null; organization: string | null }
export interface PublicCvExperience {
  kind: string; title: string; role: string | null; contribution: string | null; organization_name: string | null; link_url: string | null;
  started_on: string | null; ended_on: string | null; attestation: PublicCvAttestation | null;
}
export interface PublicCv {
  profile: { display_name: string | null; headline: string | null; bio: string | null; city: string | null; education_stage: string | null; skills: string[] };
  interests: string[];
  experiences: PublicCvExperience[];
  participations: { title: string; type: string; starts_at: string; organizer: string | null; checked_in_at: string }[];
  volunteering: { title: string; starts_at: string; duty: string | null; organizer: string | null }[];
  teams: { name: string; kind: 'team' | 'community'; role: 'captain' | 'mentor' | 'member'; title: string | null; since: string | null }[];
}

export const KIND_LABEL: Record<string, string> = { project: 'Proje', competition: 'Yarışma', volunteering: 'Gönüllülük', work: 'İş / staj', education: 'Eğitim', event_participation: 'Etkinlik katılımı', other: 'Diğer' };
export const EDUCATION_LABEL: Record<string, string> = { middle_school: 'Ortaokul', high_school: 'Lise', university: 'Üniversite', graduate: 'Yeni mezun', other: 'Diğer' };
export const TEAM_ROLE_LABEL: Record<string, string> = { captain: 'Kaptan', mentor: 'Mentor', member: 'Üye' };

/**
 * Reads a shared CV through `public_cv(token)`. Never cached: when the owner switches sharing off, or an organisation
 * revokes a verification, the very next page load has to show it. Unknown and switched-off links both come back as null.
 */
export async function getPublicCv(token: string): Promise<PublicCv | null> {
  if (!supabaseUrl || !supabaseKey || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/public_cv`, {
      method: 'POST', cache: 'no-store', headers: { apikey: supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: token }),
    });
    return res.ok ? ((await res.json()) as PublicCv) : null;
  } catch { return null; }
}

const monthFmt = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
export const formatMonth = (iso: string) => monthFmt.format(new Date(iso));
export function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return '';
  if (start && !end) return `${formatMonth(start)} – sürüyor`;
  if (!start) return formatMonth(end!);
  const a = formatMonth(start); const b = formatMonth(end!);
  return a === b ? a : `${a} – ${b}`;
}
