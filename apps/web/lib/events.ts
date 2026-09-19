import { supabaseKey, supabaseUrl } from './site';

export interface PublicEvent {
  id: string; title: string; poster_line: string | null; summary: string; type: string; format: 'in_person' | 'online' | 'hybrid'; tone: 'iris' | 'moss' | 'apricot' | 'ink';
  city: string | null; venue: string | null; starts_at: string; ends_at: string; registration_closes_at: string; audience_note: string | null; fee_minor_units: number; is_demo: boolean;
  organization: { name: string; verification: string } | null;
}
const SELECT = 'id,title,poster_line,summary,type,format,tone,city,venue,starts_at,ends_at,registration_closes_at,audience_note,fee_minor_units,is_demo,organization:organizations(name,verification)';
export const TYPE_LABEL: Record<string, string> = { hackathon: 'Hackathon', competition: 'Yarışma', workshop: 'Atölye', conference: 'Konferans', meetup: 'Buluşma', social_impact: 'Sosyal etki', training: 'Eğitim', festival: 'Şenlik' };

/** Reads through the public API with the publishable key: RLS only ever returns published events. */
async function query(params: string): Promise<PublicEvent[]> {
  if (!supabaseUrl || !supabaseKey) return [];
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/events?select=${encodeURIComponent(SELECT)}&${params}`, { headers: { apikey: supabaseKey }, next: { revalidate: 300 } });
    return res.ok ? ((await res.json()) as PublicEvent[]) : [];
  } catch { return []; }
}
export const getEvent = async (id: string) => (/^[0-9a-f-]{36}$/.test(id) ? (await query(`id=eq.${id}&limit=1`))[0] ?? null : null);
export const getUpcomingEvents = (limit = 3) => query(`status=eq.published&ends_at=gte.${new Date().toISOString()}&order=starts_at.asc&limit=${limit}`);

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' });
const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const placeLabel = (e: PublicEvent) => (e.format === 'online' ? 'Çevrim içi' : [e.city, e.format === 'hybrid' ? 'Hibrit' : 'Yüz yüze'].filter(Boolean).join(' · '));
