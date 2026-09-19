import { useEffect, useState } from 'react';
import { supabase, toUiError, type Account, type EventInsert, type EventRow } from '../lib';

const TYPES: [EventRow['type'], string][] = [['hackathon', 'Hackathon'], ['competition', 'Yarışma'], ['workshop', 'Atölye'], ['conference', 'Konferans'], ['meetup', 'Buluşma'], ['social_impact', 'Sosyal etki'], ['training', 'Eğitim'], ['festival', 'Şenlik']];
const EDIT_ROLES = ['owner', 'admin', 'editor'];
const slugify = (s: string) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
// <input type="datetime-local"> works in the browser's zone; the panel is operated from Türkiye.
const toLocal = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
const num = (v: string) => (v.trim() === '' ? null : Number(v));

interface Form { organization_id: string; title: string; slug: string; poster_line: string; summary: string; description: string; type: EventRow['type']; format: EventRow['format'];
  topic_interest_id: string; tone: string; city: string; venue: string; online_url: string; starts_at: string; ends_at: string; registration_opens_at: string; registration_closes_at: string;
  capacity: string; waitlist_enabled: boolean; requires_review: boolean; registration_mode: EventRow['registration_mode']; min_age: string; max_age: string; guardian_required_under: string;
  audience_note: string; cancellation_policy: string; support_contact: string }

const empty = (org: string): Form => ({ organization_id: org, title: '', slug: '', poster_line: '', summary: '', description: '', type: 'workshop', format: 'in_person', topic_interest_id: '', tone: 'iris',
  city: '', venue: '', online_url: '', starts_at: '', ends_at: '', registration_opens_at: '', registration_closes_at: '', capacity: '', waitlist_enabled: true, requires_review: false,
  registration_mode: 'individual', min_age: '', max_age: '', guardian_required_under: '18', audience_note: '', cancellation_policy: '', support_contact: '' });

export function EventForm({ account, eventId }: { account: Account; eventId?: string }) {
  const orgs = account.organization_roles.filter((r) => EDIT_ROLES.includes(r.role)).map((r) => r.organization_id);
  const [form, setForm] = useState<Form>(empty(orgs[0] ?? ''));
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [interests, setInterests] = useState<{ id: number; label_tr: string }[]>([]);
  const [status, setStatus] = useState<EventRow['status']>('draft');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    supabase.from('interests').select('id,label_tr').order('sort_order').then(({ data }) => setInterests(data ?? []));
    supabase.from('organizations').select('id,name').in('id', orgs).then(({ data }) => setOrgNames(Object.fromEntries((data ?? []).map((o) => [o.id, o.name]))));
    if (!eventId) return;
    supabase.from('events').select('*').eq('id', eventId).single().then(({ data: e, error: err }) => {
      if (err || !e) { setError(toUiError(err).message); return; }
      setStatus(e.status);
      setForm({ organization_id: e.organization_id, title: e.title, slug: e.slug, poster_line: e.poster_line ?? '', summary: e.summary, description: e.description ?? '', type: e.type, format: e.format,
        topic_interest_id: e.topic_interest_id?.toString() ?? '', tone: e.tone, city: e.city ?? '', venue: e.venue ?? '', online_url: e.online_url ?? '', starts_at: toLocal(e.starts_at), ends_at: toLocal(e.ends_at),
        registration_opens_at: toLocal(e.registration_opens_at), registration_closes_at: toLocal(e.registration_closes_at), capacity: e.capacity?.toString() ?? '', waitlist_enabled: e.waitlist_enabled,
        requires_review: e.requires_review, registration_mode: e.registration_mode, min_age: e.min_age?.toString() ?? '', max_age: e.max_age?.toString() ?? '',
        guardian_required_under: e.guardian_required_under?.toString() ?? '', audience_note: e.audience_note ?? '', cancellation_policy: e.cancellation_policy ?? '', support_contact: e.support_contact ?? '' });
    });
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (new Date(form.ends_at) <= new Date(form.starts_at)) return setError('Bitiş, başlangıçtan sonra olmalı.');
    if (new Date(form.registration_closes_at) > new Date(form.ends_at)) return setError('Son kayıt tarihi etkinlik bitişinden sonra olamaz.');
    setBusy(true);
    // Status, counters, approval and tenant are not part of this payload: the server owns them.
    const payload = {
      title: form.title.trim(), slug: form.slug || slugify(form.title), poster_line: form.poster_line.trim() || null, summary: form.summary.trim(), description: form.description.trim() || null,
      type: form.type, format: form.format, topic_interest_id: num(form.topic_interest_id), tone: form.tone, city: form.city.trim() || null, venue: form.venue.trim() || null,
      online_url: form.online_url.trim() || null, starts_at: toIso(form.starts_at)!, ends_at: toIso(form.ends_at)!, registration_opens_at: toIso(form.registration_opens_at),
      registration_closes_at: toIso(form.registration_closes_at)!, capacity: num(form.capacity), waitlist_enabled: form.waitlist_enabled, requires_review: form.requires_review,
      registration_mode: form.registration_mode, min_age: num(form.min_age), max_age: num(form.max_age), guardian_required_under: num(form.guardian_required_under),
      audience_note: form.audience_note.trim() || null, cancellation_policy: form.cancellation_policy.trim() || null, support_contact: form.support_contact.trim() || null,
    } satisfies Partial<EventInsert>;
    const { data: userData } = await supabase.auth.getUser();
    const res = eventId
      ? await supabase.from('events').update(payload).eq('id', eventId).select('id').single()
      : await supabase.from('events').insert({ ...payload, organization_id: form.organization_id, created_by: userData.user?.id }).select('id').single();
    setBusy(false);
    if (res.error) return setError(res.error.code === 'PGRST116' ? 'Bu etkinliği düzenleme yetkin yok.' : toUiError(res.error).message);
    location.hash = `#/events/${res.data.id}`;
  };

  if (orgs.length === 0 && !eventId) return <div className="notice err">Etkinlik oluşturma yetkin yok.</div>;
  const T = (p: { k: keyof Form; label: string; type?: string; required?: boolean; max?: number; help?: string }) => (
    <label>{p.label}<input type={p.type ?? 'text'} required={p.required} maxLength={p.max} value={form[p.k] as string} onChange={(e) => set(p.k, e.target.value as never)} />{p.help && <span className="muted small" style={{ fontWeight: 400 }}>{p.help}</span>}</label>);

  return (
    <form className="stack" onSubmit={save}>
      <div className="row between"><h1>{eventId ? 'Etkinliği düzenle' : 'Yeni etkinlik'}</h1><a href={eventId ? `#/events/${eventId}` : '#/events'}>Vazgeç</a></div>
      {status === 'published' && <div className="notice warn">Bu etkinlik yayında. Yaptığın değişiklikler katılımcılara hemen yansır.</div>}
      <div className="card stack"><h2>Temel bilgiler</h2>
        {!eventId && <label>Düzenleyen kurum<select value={form.organization_id} onChange={(e) => set('organization_id', e.target.value)}>{orgs.map((o) => <option key={o} value={o}>{orgNames[o] ?? o}</option>)}</select></label>}
        <div className="grid2"><label>Başlık<input required minLength={4} maxLength={120} value={form.title} onChange={(e) => { set('title', e.target.value); if (!eventId) set('slug', slugify(e.target.value)); }} /></label>
          {T({ k: 'slug', label: 'Kısa ad (slug)', required: true, max: 80, help: 'Bağlantılarda kullanılır: küçük harf, rakam ve tire.' })}</div>
        {T({ k: 'poster_line', label: 'Afiş cümlesi', max: 80, help: 'Kartın üzerindeki kısa, güçlü cümle. Örn. “Bir fikir. Gerçek bir etki.”' })}
        <label>Özet<textarea required maxLength={280} style={{ minHeight: 70 }} value={form.summary} onChange={(e) => set('summary', e.target.value)} /></label>
        <label>Açıklama<textarea maxLength={6000} value={form.description} onChange={(e) => set('description', e.target.value)} /></label>
        <div className="grid3">
          <label>Tür<select value={form.type} onChange={(e) => set('type', e.target.value as never)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Konu<select value={form.topic_interest_id} onChange={(e) => set('topic_interest_id', e.target.value)}><option value="">Seçilmedi</option>{interests.map((i) => <option key={i.id} value={i.id}>{i.label_tr}</option>)}</select></label>
          <label>Afiş tonu<select value={form.tone} onChange={(e) => set('tone', e.target.value)}><option value="iris">Iris</option><option value="moss">Moss</option><option value="apricot">Apricot</option><option value="ink">Ink</option></select></label>
        </div></div>
      <div className="card stack"><h2>Zaman ve yer</h2>
        <div className="grid2">{T({ k: 'starts_at', label: 'Başlangıç', type: 'datetime-local', required: true })}{T({ k: 'ends_at', label: 'Bitiş', type: 'datetime-local', required: true })}
          {T({ k: 'registration_opens_at', label: 'Kayıt açılışı (boşsa hemen)', type: 'datetime-local' })}{T({ k: 'registration_closes_at', label: 'Son kayıt', type: 'datetime-local', required: true })}</div>
        <div className="grid3"><label>Biçim<select value={form.format} onChange={(e) => set('format', e.target.value as never)}><option value="in_person">Yüz yüze</option><option value="online">Çevrim içi</option><option value="hybrid">Hibrit</option></select></label>
          {T({ k: 'city', label: 'Şehir' })}{T({ k: 'venue', label: 'Mekân' })}</div>
        {form.format !== 'in_person' && T({ k: 'online_url', label: 'Çevrim içi bağlantı (https://)', type: 'url' })}</div>
      <div className="card stack"><h2>Katılım kuralları</h2>
        <div className="grid3">{T({ k: 'capacity', label: 'Kontenjan (boş = sınırsız)', type: 'number' })}{T({ k: 'min_age', label: 'En küçük yaş', type: 'number' })}{T({ k: 'max_age', label: 'En büyük yaş', type: 'number' })}</div>
        <div className="grid2"><label>Kayıt biçimi<select value={form.registration_mode} onChange={(e) => set('registration_mode', e.target.value as never)}><option value="individual">Bireysel</option><option value="team">Takım</option><option value="both">İkisi de</option></select></label>
          {T({ k: 'guardian_required_under', label: 'Şu yaşın altı için veli onayı iste', type: 'number', help: 'Boş bırakırsan veli onayı istenmez. Yaş ve onay her kayıtta sunucuda kontrol edilir.' })}</div>
        <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={form.waitlist_enabled} onChange={(e) => set('waitlist_enabled', e.target.checked)} /> Kontenjan dolunca bekleme listesi aç</label>
        <label className="row" style={{ fontWeight: 500 }}><input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={form.requires_review} onChange={(e) => set('requires_review', e.target.checked)} /> Kayıtları ekibimiz tek tek değerlendirsin</label>
        {T({ k: 'audience_note', label: 'Kimler için', max: 120, help: 'Örn. “Lise + üniversite”' })}
        <label>İptal politikası<textarea maxLength={1000} style={{ minHeight: 70 }} value={form.cancellation_policy} onChange={(e) => set('cancellation_policy', e.target.value)} /></label>
        {T({ k: 'support_contact', label: 'Destek iletişimi', max: 200 })}</div>
      {error && <div className="notice err" role="alert">{error}</div>}
      <div className="row"><button className="btn" disabled={busy}>{eventId ? 'Değişiklikleri kaydet' : 'Taslağı oluştur'}</button><span className="muted small">Etkinlik taslak olarak kaydedilir; yayın için incelemeye gönderilir.</span></div>
    </form>
  );
}
