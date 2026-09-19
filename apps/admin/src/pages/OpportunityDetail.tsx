import { useMemo, useState } from 'react';
import { APP_STATUS_LABEL, APP_TRANSITIONS, EDIT_ROLES, EDUCATION_LABEL, OPP_TYPE_LABEL, REVIEW_ROLES, SHARED_FIELDS, STATUS_LABEL, fmt, roleIn, supabase,
  type Account, type ApplicationHistoryRow, type ApplicationRow, type ApplicationStatus, type OpportunityRow, type PublishStatus } from '../lib';
import { ConfirmButton, ErrorNote, ListState, StatusTag, Tabs, useAction, useLoad, type Tone } from '../components/ui';
import { statusTone } from './Events';
import { Deadline } from './Opportunities';

type Filter = 'all' | ApplicationStatus;
const FILTERS: readonly [Filter, string][] = [['all', 'Tümü'], ['submitted', 'Yeni'], ['in_review', 'İncelemede'], ['info_requested', 'Ek bilgi istendi'], ['accepted', 'Kabul'], ['declined', 'Uygun bulunmadı'], ['withdrawn', 'Geri çekilen']];
const appTone: Record<ApplicationStatus, Tone> = { draft: 'neutral', submitted: '', in_review: '', info_requested: 'apricot', accepted: 'moss', declined: 'danger', withdrawn: 'neutral', closed: 'neutral' };
const MOVE_LABEL: Partial<Record<ApplicationStatus, string>> = { in_review: 'İncelemeye al', info_requested: 'Ek bilgi iste', accepted: 'Kabul et', declined: 'Uygun bulunmadı', closed: 'Kapat' };
const FIELD_LABEL = Object.fromEntries(SHARED_FIELDS);
interface SnapshotExperience { title: string; role: string | null; contribution: string | null; kind: string; verified: boolean }

/** Shows exactly what the applicant agreed to share at submission: nothing is read from their live profile. */
function Snapshot({ app }: { app: ApplicationRow }) {
  const snap = (app.snapshot ?? {}) as Record<string, unknown>;
  const value = (key: string, v: unknown) => {
    if (v === null || v === undefined || v === '') return <span className="muted">Boş bırakılmış</span>;
    if (key === 'education_stage') return EDUCATION_LABEL[String(v)] ?? String(v);
    if (key === 'interests') return (v as string[]).join(' · ') || <span className="muted">Seçilmemiş</span>;
    if (key === 'experiences') {
      const list = v as SnapshotExperience[];
      if (list.length === 0) return <span className="muted">Yayınlanmış deneyim yok</span>;
      return <div className="stack" style={{ gap: 8 }}>{list.map((x, i) => <div key={i}><b>{x.title}</b>{x.role ? ` · ${x.role}` : ''} <StatusTag label={x.verified ? 'Doğrulanmış' : 'Kendi beyanı'} tone={x.verified ? 'moss' : 'neutral'} />{x.contribution && <div className="muted small">{x.contribution}</div>}</div>)}</div>;
    }
    return String(v);
  };
  return <dl className="kv">{app.shared_fields.map((f) => <div key={f} style={{ display: 'contents' }}><dt>{FIELD_LABEL[f] ?? f}</dt><dd>{value(f, snap[f])}</dd></div>)}
    <dt>Motivasyon</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{app.motivation ?? <span className="muted">Yazılmamış</span>}</dd></dl>;
}

function ApplicationItem({ app, history, canReview, onChanged }: { app: ApplicationRow; history: ApplicationHistoryRow[]; canReview: boolean; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false); const [note, setNote] = useState('');
  const action = useAction();
  const snap = (app.snapshot ?? {}) as Record<string, unknown>;
  const name = (snap.display_name ?? snap.legal_name ?? 'İsim paylaşılmadı') as string;
  const moves = APP_TRANSITIONS[app.status] ?? [];
  const move = (to: ApplicationStatus) => action.run(() => supabase.rpc('set_application_status', { p_application_id: app.id, p_status: to, p_note: note.trim() || undefined }), async () => { setNote(''); await onChanged(); });

  return (
    <div className="item">
      <div className="row between"><div className="row"><b>{name}</b><StatusTag label={APP_STATUS_LABEL[app.status]} tone={appTone[app.status]} /><span className="muted small">{fmt(app.submitted_at)}</span></div>
        <button type="button" className="linkish" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Kapat' : 'Başvuruyu aç'}</button></div>
      {open && (<>
        <Snapshot app={app} />
        {history.length > 0 && <div className="muted small">{history.map((h) => <div key={h.id}>{fmt(h.created_at)} · {APP_STATUS_LABEL[h.to_status]}{h.actor_kind === 'applicant' ? ' (başvuran)' : ''}{h.note ? ` — “${h.note}”` : ''}</div>)}</div>}
        {canReview && moves.length > 0 && (<>
          <label>Başvurana not (isteğe bağlı)<textarea maxLength={500} style={{ minHeight: 60 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bu not başvuran tarafından görülür." /></label>
          <div className="row">{moves.map((to) => to === 'declined' || to === 'closed'
            ? <ConfirmButton key={to} label={MOVE_LABEL[to]!} confirmLabel={`Evet: ${MOVE_LABEL[to]!.toLocaleLowerCase('tr')}`} className="btn secondary" disabled={action.busy} onConfirm={() => void move(to)} />
            : <button key={to} type="button" className={to === 'accepted' ? 'btn' : 'btn secondary'} disabled={action.busy} onClick={() => move(to)}>{MOVE_LABEL[to]}</button>)}</div>
          <ErrorNote message={action.error} /></>)}
      </>)}
    </div>
  );
}

export function OpportunityDetail({ account, opportunityId }: { account: Account; opportunityId: string }) {
  const [filter, setFilter] = useState<Filter>('all');
  const opp = useLoad(async () => {
    const r = await supabase.from('opportunities').select('*, organization:organizations(name)').eq('id', opportunityId).maybeSingle();
    if (r.error) throw r.error; return r.data as unknown as (OpportunityRow & { organization: { name: string } | null }) | null;
  }, [opportunityId]);
  // RLS returns applications only to owner / admin / reviewer roles of the owning organisation; drafts are never visible.
  const apps = useLoad(async () => {
    const r = await supabase.from('applications').select('*').eq('opportunity_id', opportunityId).order('submitted_at', { ascending: false }).limit(500);
    if (r.error) throw r.error;
    const h = await supabase.from('application_status_history').select('*').in('application_id', r.data.map((a) => a.id)).order('created_at');
    if (h.error) throw h.error; return { rows: r.data, history: h.data };
  }, [opportunityId]);
  const action = useAction();
  const o = opp.data;
  const role = roleIn(account, o?.organization_id);
  const canEdit = !!role && EDIT_ROLES.includes(role); const canReview = !!role && REVIEW_ROLES.includes(role);
  const rows = apps.data?.rows ?? [];
  const shown = useMemo(() => rows.filter((a) => filter === 'all' || a.status === filter), [rows, filter]);
  const count = (s: ApplicationStatus[]) => rows.filter((a) => s.includes(a.status)).length;
  // The buttons only propose a transition; publishing is an Intechne approval enforced by a database trigger.
  const move = (to: PublishStatus) => action.run(() => supabase.from('opportunities').update({ status: to }).eq('id', opportunityId).select('id').single(), opp.reload);

  if (opp.error) return <ErrorNote message={opp.error} />;
  if (opp.loading && !o) return <p className="muted">Yükleniyor…</p>;
  if (!o) return <div className="notice err" role="alert">Çağrı bulunamadı ya da görme yetkin yok.</div>;

  return (
    <div className="stack">
      <a href="#/opportunities">← Fırsatlar</a>
      <div className="row between">
        <div><div className="row"><StatusTag label={STATUS_LABEL[o.status]} tone={statusTone(o.status)} /><StatusTag label={OPP_TYPE_LABEL[o.type]} tone="neutral" />{o.is_demo && <StatusTag label="ÖRNEK" tone="neutral" />}</div>
          <h1 style={{ marginTop: 8 }}>{o.title}</h1><p className="muted">{o.organization?.name} · Son başvuru: <Deadline iso={o.closes_at} />{o.reward_note ? ` · ${o.reward_note}` : ''}</p></div>
        {canEdit && ['draft', 'in_review', 'published'].includes(o.status) && <a className="btn secondary" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }} href={`#/opportunities/${opportunityId}/edit`}>Düzenle</a>}
      </div>

      <div className="card stack"><h2>Yayın akışı</h2>
        {o.status === 'draft' && <p className="muted">Taslak yalnızca kurumun ekibine görünür. Hazır olduğunda incelemeye gönder; Intechne onaylayınca uygulamada yayınlanır.</p>}
        {o.status === 'in_review' && <p className="muted">{account.is_platform_admin ? 'Bu çağrı yayın onayı bekliyor.' : 'Intechne ekibi inceliyor. Onaylandığında uygulamada görünür.'}</p>}
        {o.status === 'published' && <p className="muted">Yayında{o.published_at ? ` · ${fmt(o.published_at)}` : ''}. Son başvuru tarihi geçince yeni başvuru alınmaz; çağrı takvimde “süresi doldu” olarak kalır.</p>}
        <div className="row">
          {o.status === 'draft' && canEdit && <button className="btn" disabled={action.busy} onClick={() => move('in_review')}>İncelemeye gönder</button>}
          {o.status === 'in_review' && canEdit && <button className="btn secondary" disabled={action.busy} onClick={() => move('draft')}>Taslağa geri al</button>}
          {o.status === 'in_review' && account.is_platform_admin && <><button className="btn" disabled={action.busy} onClick={() => move('published')}>Onayla ve yayınla</button><button className="btn secondary" disabled={action.busy} onClick={() => move('draft')}>Düzeltme iste</button></>}
          {o.status === 'published' && (canEdit || account.is_platform_admin) && <ConfirmButton label="Yayından kaldır" confirmLabel="Evet, çağrıyı iptal et" disabled={action.busy} onConfirm={() => void move('cancelled')} />}
          {['draft', 'cancelled'].includes(o.status) && canEdit && <button className="btn secondary" disabled={action.busy} onClick={() => move('archived')}>Arşivle</button>}
        </div>
        <ErrorNote message={action.error} />
      </div>

      {o.apply_url ? (
        <div className="card stack"><h2>Başvurular dış sitede</h2><p className="muted">Bu çağrının başvuruları <a href={o.apply_url} target="_blank" rel="noreferrer">{new URL(o.apply_url).host}</a> üzerinden alınıyor. TechApp yalnızca son tarihi takip eder; burada başvuru listesi oluşmaz.</p></div>
      ) : (<>
        <div className="grid3">
          <div className="card"><div className="muted small">TOPLAM BAŞVURU</div><div className="stat">{count(['submitted', 'in_review', 'info_requested', 'accepted', 'declined', 'closed'])}</div></div>
          <div className="card"><div className="muted small">KARAR BEKLEYEN</div><div className="stat">{count(['submitted', 'in_review', 'info_requested'])}</div></div>
          <div className="card"><div className="muted small">KABUL</div><div className="stat">{count(['accepted'])}</div></div>
        </div>
        <div className="card stack"><h2>Başvurular</h2>
          <p className="muted small">Her başvuruda yalnızca başvuranın gönderirken onayladığı alanlar görünür: {o.shared_fields.map((f) => FIELD_LABEL[f] ?? f).join(', ')}. Bilgiler gönderim anında dondurulur; başvuranın profiline buradan erişilemez.</p>
          {!canReview && !apps.loading && rows.length === 0 && <div className="notice">Başvuruları yalnızca kurumun sahip, yönetici ve değerlendirici rolleri görebilir.</div>}
          <Tabs tabs={FILTERS} value={filter} onChange={setFilter} label="Başvuru filtresi" />
          <ListState loading={apps.loading} error={apps.error} empty={shown.length === 0} onRetry={apps.reload} emptyText={rows.length === 0 ? 'Henüz başvuru yok.' : 'Bu filtrede başvuru yok.'}>
            <div className="stack" style={{ gap: 10 }}>{shown.map((a) => <ApplicationItem key={a.id} app={a} canReview={canReview} onChanged={apps.reload} history={(apps.data?.history ?? []).filter((h) => h.application_id === a.id)} />)}</div>
          </ListState>
        </div></>)}
    </div>
  );
}
