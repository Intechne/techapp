import { useEffect, useState } from 'react';
import { EDIT_ROLES, OPP_TYPE_LABEL, SHARED_FIELDS, fromLocalInput, numOrNull, orgsWith, slugify, supabase, toLocalInput, toUiError, type Account, type OpportunityInsert, type OpportunityRow, type OpportunityType } from '../lib';
import { CoverField } from '../components/CoverField';
import { CheckRow, ErrorNote, Field } from '../components/ui';

interface Form { organization_id: string; title: string; slug: string; summary: string; description: string; type: OpportunityType; topic_interest_id: string; tone: string; city: string; is_remote: boolean;
  audience_note: string; skills: string; min_age: string; max_age: string; guardian_required_under: string; opens_at: string; closes_at: string; shared_fields: string[];
  external: boolean; apply_url: string; reward_note: string; team_based: boolean }

const empty = (org: string): Form => ({ organization_id: org, title: '', slug: '', summary: '', description: '', type: 'internship', topic_interest_id: '', tone: 'iris', city: '', is_remote: false, audience_note: '',
  skills: '', min_age: '', max_age: '', guardian_required_under: '18', opens_at: '', closes_at: '', shared_fields: ['display_name', 'education_stage'], external: false, apply_url: '', reward_note: '', team_based: false });

export function OpportunityForm({ account, opportunityId }: { account: Account; opportunityId?: string }) {
  const orgs = orgsWith(account, EDIT_ROLES);
  const [form, setForm] = useState<Form>(empty(orgs[0] ?? ''));
  const [orgNames, setOrgNames] = useState<Record<string, string>>({});
  const [interests, setInterests] = useState<{ id: number; label_tr: string }[]>([]);
  const [status, setStatus] = useState<OpportunityRow['status']>('draft');
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    supabase.from('interests').select('id,label_tr').order('sort_order').then(({ data }) => setInterests(data ?? []));
    supabase.from('organizations').select('id,name').in('id', orgs).then(({ data }) => setOrgNames(Object.fromEntries((data ?? []).map((o) => [o.id, o.name]))));
    if (!opportunityId) return;
    supabase.from('opportunities').select('*').eq('id', opportunityId).single().then(({ data: o, error: err }) => {
      if (err || !o) { setError(toUiError(err).message); return; }
      setStatus(o.status); setCoverPath(o.cover_path);
      setForm({ organization_id: o.organization_id, title: o.title, slug: o.slug, summary: o.summary, description: o.description ?? '', type: o.type, topic_interest_id: o.topic_interest_id?.toString() ?? '', tone: o.tone,
        city: o.city ?? '', is_remote: o.is_remote, audience_note: o.audience_note ?? '', skills: o.skills.join(', '), min_age: o.min_age?.toString() ?? '', max_age: o.max_age?.toString() ?? '',
        guardian_required_under: o.guardian_required_under?.toString() ?? '', opens_at: toLocalInput(o.opens_at), closes_at: toLocalInput(o.closes_at), shared_fields: o.shared_fields,
        external: !!o.apply_url, apply_url: o.apply_url ?? '', reward_note: o.reward_note ?? '', team_based: o.team_based });
    });
  }, [opportunityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    const skills = form.skills.split(',').map((s) => s.trim()).filter(Boolean);
    if (skills.length > 12) return setError('En fazla 12 beceri yazabilirsin.');
    if (form.opens_at && new Date(form.opens_at) >= new Date(form.closes_at)) return setError('Başvuru açılışı, son başvuru tarihinden önce olmalı.');
    if (form.external && !/^https:\/\//.test(form.apply_url.trim())) return setError('Dış başvuru bağlantısı https:// ile başlamalı.');
    if (!form.external && form.shared_fields.length === 0) return setError('Başvuranın paylaşacağı en az bir alan seç.');
    setBusy(true);
    // Status, approval and tenant are not part of this payload: the server owns them.
    const payload = {
      title: form.title.trim(), slug: form.slug || slugify(form.title), summary: form.summary.trim(), description: form.description.trim() || null, type: form.type, topic_interest_id: numOrNull(form.topic_interest_id),
      tone: form.tone, city: form.city.trim() || null, is_remote: form.is_remote, audience_note: form.audience_note.trim() || null, skills, min_age: numOrNull(form.min_age), max_age: numOrNull(form.max_age),
      guardian_required_under: numOrNull(form.guardian_required_under), opens_at: fromLocalInput(form.opens_at), closes_at: fromLocalInput(form.closes_at)!, shared_fields: form.shared_fields,
      apply_url: form.external ? form.apply_url.trim() : null, reward_note: form.reward_note.trim() || null, team_based: form.team_based,
    } satisfies Partial<OpportunityInsert>;
    const { data: userData } = await supabase.auth.getUser();
    const res = opportunityId
      ? await supabase.from('opportunities').update(payload).eq('id', opportunityId).select('id').single()
      : await supabase.from('opportunities').insert({ ...payload, organization_id: form.organization_id, created_by: userData.user?.id }).select('id').single();
    setBusy(false);
    if (res.error) return setError(res.error.code === 'PGRST116' ? 'Bu çağrıyı düzenleme yetkin yok.' : toUiError(res.error).message);
    location.hash = `#/opportunities/${res.data.id}`;
  };

  if (orgs.length === 0 && !opportunityId) return <div className="notice err">Çağrı oluşturma yetkin yok.</div>;
  const toggleField = (key: string, on: boolean) => set('shared_fields', on ? [...form.shared_fields, key] : form.shared_fields.filter((f) => f !== key));

  return (
    <form className="stack" onSubmit={save}>
      <div className="row between"><h1>{opportunityId ? 'Çağrıyı düzenle' : 'Yeni çağrı'}</h1><a href={opportunityId ? `#/opportunities/${opportunityId}` : '#/opportunities'}>Vazgeç</a></div>
      {status === 'published' && <div className="notice warn">Bu çağrı yayında. Değişiklikler hemen yansır; daha önce gönderilmiş başvuruların paylaşılan bilgileri değişmez.</div>}
      <div className="card stack"><h2>Temel bilgiler</h2>
        {!opportunityId && <Field label="Çağrıyı açan kurum"><select value={form.organization_id} onChange={(e) => set('organization_id', e.target.value)}>{orgs.map((o) => <option key={o} value={o}>{orgNames[o] ?? o}</option>)}</select></Field>}
        <div className="grid2"><Field label="Başlık"><input required minLength={4} maxLength={120} value={form.title} onChange={(e) => { set('title', e.target.value); if (!opportunityId) set('slug', slugify(e.target.value)); }} /></Field>
          <Field label="Kısa ad (slug)" help="Bağlantılarda kullanılır: küçük harf, rakam ve tire."><input required maxLength={80} pattern="[a-z0-9-]{3,80}" value={form.slug} onChange={(e) => set('slug', e.target.value)} /></Field></div>
        <Field label="Özet"><textarea required maxLength={280} style={{ minHeight: 70 }} value={form.summary} onChange={(e) => set('summary', e.target.value)} /></Field>
        <Field label="Açıklama"><textarea maxLength={6000} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="grid3">
          <Field label="Tür"><select value={form.type} onChange={(e) => set('type', e.target.value as OpportunityType)}>{(Object.entries(OPP_TYPE_LABEL) as [OpportunityType, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Konu"><select value={form.topic_interest_id} onChange={(e) => set('topic_interest_id', e.target.value)}><option value="">Seçilmedi</option>{interests.map((i) => <option key={i.id} value={i.id}>{i.label_tr}</option>)}</select></Field>
          <Field label="Kart tonu"><select value={form.tone} onChange={(e) => set('tone', e.target.value)}><option value="iris">Iris</option><option value="moss">Moss</option><option value="apricot">Apricot</option><option value="ink">Ink</option></select></Field>
        </div>
        <Field label="Ödül / destek notu" help="Örn. “50.000 TL’ye kadar hibe” ya da “Aylık burs + mentorluk”. Kesin olmayan tutar yazma."><input maxLength={160} value={form.reward_note} onChange={(e) => set('reward_note', e.target.value)} /></Field>
      </div>
      <div className="card stack">
        {opportunityId
          ? <CoverField entity="opportunities" entityId={opportunityId} ownerId={form.organization_id} coverPath={coverPath} published={status === 'published'} onChanged={(p) => { setCoverPath(p); if (status === 'published') setStatus('in_review'); }} />
          : <><h2>Kapak görseli</h2><p className="muted">Kapak görselini fırsatı taslak olarak kaydettikten sonra ekleyebilirsin.</p></>}
      </div>
      <div className="card stack"><h2>Tarihler ve yer</h2>
        <div className="grid2"><Field label="Başvuru açılışı (boşsa hemen)"><input type="datetime-local" value={form.opens_at} onChange={(e) => set('opens_at', e.target.value)} /></Field>
          <Field label="Son başvuru" help="Uygulamadaki son tarih takvimi ve hatırlatmalar bu tarihe göre çalışır."><input type="datetime-local" required value={form.closes_at} onChange={(e) => set('closes_at', e.target.value)} /></Field></div>
        <div className="grid2"><Field label="Şehir"><input maxLength={60} value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="Kimler için" help="Örn. “Üniversite 2. sınıf ve üzeri”"><input maxLength={120} value={form.audience_note} onChange={(e) => set('audience_note', e.target.value)} /></Field></div>
        <CheckRow checked={form.is_remote} onChange={(v) => set('is_remote', v)} label="Uzaktan katılım mümkün" />
        <CheckRow checked={form.team_based} onChange={(v) => set('team_based', v)} label="Takım olarak başvurulur" />
      </div>
      <div className="card stack"><h2>Uygunluk</h2>
        <div className="grid3"><Field label="En küçük yaş"><input type="number" min={0} max={120} value={form.min_age} onChange={(e) => set('min_age', e.target.value)} /></Field>
          <Field label="En büyük yaş"><input type="number" min={0} max={120} value={form.max_age} onChange={(e) => set('max_age', e.target.value)} /></Field>
          <Field label="Şu yaşın altı başvuramaz" help="Başvurularda veli onayı henüz yok; bu yaşın altındakiler sunucuda reddedilir. Boş = yaş sınırı yok."><input type="number" min={0} max={21} value={form.guardian_required_under} onChange={(e) => set('guardian_required_under', e.target.value)} /></Field></div>
        <Field label="Aranan beceriler" help="Virgülle ayır, en fazla 12."><input value={form.skills} onChange={(e) => set('skills', e.target.value)} placeholder="Python, devre tasarımı, sunum" /></Field>
      </div>
      <div className="card stack"><h2>Başvuru yeri</h2>
        <CheckRow checked={form.external} onChange={(v) => set('external', v)} label={<>Başvuru kendi sitemizde alınıyor<br /><span className="muted small">TechApp yalnızca son tarihi takip eder ve kullanıcıyı bağlantıya yönlendirir; başvuru ve kişisel veri toplamaz.</span></>} />
        {form.external ? <Field label="Başvuru bağlantısı (https://)"><input type="url" required value={form.apply_url} onChange={(e) => set('apply_url', e.target.value)} /></Field> : (<>
          <p className="muted small">Başvuran, gönder demeden önce tam olarak hangi bilgileri paylaşacağını görür. Yalnızca gerçekten ihtiyacın olanları seç; seçmediğin hiçbir alan sana ulaşmaz.</p>
          <div className="checkgrid">{SHARED_FIELDS.map(([key, label]) => <CheckRow key={key} checked={form.shared_fields.includes(key)} onChange={(v) => toggleField(key, v)} label={label} />)}</div></>)}
      </div>
      <ErrorNote message={error} />
      <div className="row"><button className="btn" disabled={busy}>{opportunityId ? 'Değişiklikleri kaydet' : 'Taslağı oluştur'}</button><span className="muted small">Çağrı taslak olarak kaydedilir; yayın için incelemeye gönderilir.</span></div>
    </form>
  );
}
