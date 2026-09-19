import { useMemo, useState } from 'react';
import { ATT_STATUS_LABEL, REVIEW_ROLES, fmt, fmtDate, fromLocalInput, orgsWith, supabase, type Account, type AttestationRow, type AttestationStatus, type ExperienceRow } from '../lib';
import { ConfirmButton, ErrorNote, Field, ListState, StatusTag, Tabs, useAction, useLoad, type Tone } from '../components/ui';

type Filter = 'requested' | 'verified' | 'closed';
const FILTERS: readonly [Filter, string][] = [['requested', 'Karar bekleyen'], ['verified', 'Doğruladıklarımız'], ['closed', 'Kapananlar']];
const tone: Record<AttestationStatus, Tone> = { requested: '', verified: 'moss', changes_requested: 'apricot', rejected: 'danger', revoked: 'neutral' };
const KIND_LABEL: Record<ExperienceRow['kind'], string> = { project: 'Proje', competition: 'Yarışma', volunteering: 'Gönüllülük', work: 'İş / staj', education: 'Eğitim', event_participation: 'Etkinlik katılımı', other: 'Diğer' };
type Evidence = { id: string; storage_path: string; mime_type: string; caption: string | null };
type Row = AttestationRow & { requester?: string | null; organization: { name: string } | null; experience: (ExperienceRow & { evidence: Evidence[] }) | null };

function Decision({ att, onChanged }: { att: Row; onChanged: () => Promise<void> }) {
  const [scope, setScope] = useState(att.scope ?? ''); const [source, setSource] = useState(''); const [note, setNote] = useState(''); const [until, setUntil] = useState('');
  const action = useAction();
  const decide = (decision: 'verified' | 'changes_requested' | 'rejected') => action.run(() => supabase.rpc('decide_attestation', {
    p_attestation_id: att.id, p_decision: decision, p_scope: scope.trim() || undefined, p_note: note.trim() || undefined, p_source: source.trim() || undefined,
    p_valid_until: decision === 'verified' && until ? fromLocalInput(until) ?? undefined : undefined }), onChanged);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <Field label="Tam olarak neyi doğruluyorsun?" help="Bu cümle kişinin CV’sinde kurumunun adıyla birlikte görünür. Yalnızca kayıtlarınla kanıtlayabildiğin kadarını yaz: “Etkinliğe katıldı” ile “Yazılım ekibinde görev aldı” aynı şey değildir.">
        <input maxLength={300} value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Örn. 2026 sezonunda takımın mekanik ekibinde görev aldı." /></Field>
      <div className="grid2"><Field label="Dayanak (isteğe bağlı)" help="Örn. “organizatör katılım kaydı”, “takım danışmanı beyanı”."><input maxLength={120} value={source} onChange={(e) => setSource(e.target.value)} /></Field>
        <Field label="Geçerlilik sonu (isteğe bağlı)" help="Boşsa süresiz. Süre dolunca kayıt CV’de “kendi beyanı”na döner."><input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} /></Field></div>
      <Field label="Kişiye not (isteğe bağlı)" help="Düzeltme isterken ya da reddederken nedenini yaz; kişi bu notu görür."><textarea maxLength={500} style={{ minHeight: 60 }} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="row"><button type="button" className="btn" disabled={action.busy} onClick={() => decide('verified')}>Doğrula</button>
        <button type="button" className="btn secondary" disabled={action.busy} onClick={() => decide('changes_requested')}>Düzeltme iste</button>
        <ConfirmButton label="Uygun değil" confirmLabel="Evet, talebi reddet" className="btn secondary" disabled={action.busy} onConfirm={() => void decide('rejected')} /></div>
      <ErrorNote message={action.error} />
    </div>
  );
}

function Revoke({ att, onChanged }: { att: Row; onChanged: () => Promise<void> }) {
  const [reason, setReason] = useState(''); const action = useAction();
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Field label="Doğrulamayı iptal et" help="İptal kişinin CV’sine hemen yansır ve geri alınamaz; kişi yeniden talep gönderebilir."><input maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Gerekçe (zorunlu)" /></Field>
      <div><ConfirmButton label="Doğrulamayı iptal et" confirmLabel="Evet, iptal et" disabled={action.busy || reason.trim().length < 3} onConfirm={() => void action.run(() => supabase.rpc('revoke_attestation', { p_attestation_id: att.id, p_reason: reason.trim() }), onChanged)} /></div>
      <ErrorNote message={action.error} />
    </div>
  );
}

function EvidenceLink({ ev }: { ev: Evidence }) {
  const action = useAction();
  // Short-lived signed link: evidence files are never public.
  const open = () => action.run(async () => {
    const r = await supabase.storage.from('evidence').createSignedUrl(ev.storage_path, 120);
    if (r.data?.signedUrl) window.open(r.data.signedUrl, '_blank', 'noopener');
    return { error: r.error };
  });
  return <span><button type="button" className="linkish" disabled={action.busy} onClick={open}>{ev.caption ?? (ev.mime_type === 'application/pdf' ? 'PDF belge' : 'Görsel')}</button>{action.error && <span className="muted small"> · açılamadı</span>}</span>;
}

export function Attestations({ account }: { account: Account }) {
  const [filter, setFilter] = useState<Filter>('requested');
  const canReview = orgsWith(account, REVIEW_ROLES).length > 0;
  // RLS: only owner / admin / reviewer of the named organisation see a request, plus the published experience it points at.
  const list = useLoad(async () => {
    const r = await supabase.from('attestations').select('*, organization:organizations(name), experience:experiences(*, evidence:experience_evidence(id,storage_path,mime_type,caption))')
      .in('organization_id', orgsWith(account, REVIEW_ROLES)).order('requested_at', { ascending: false }).limit(300);
    if (r.error) throw r.error;
    // Name only: the reviewer must know whose experience carries the organisation's name. No contact data, no age.
    const n = await supabase.rpc('admin_attestation_requesters'); if (n.error) throw n.error;
    const names = new Map(n.data.map((x) => [x.attestation_id, x.display_name]));
    return (r.data as unknown as Row[]).map((a) => ({ ...a, requester: names.get(a.id) ?? null }));
  }, [account]);
  const rows = list.data ?? [];
  const shown = useMemo(() => rows.filter((a) => filter === 'closed' ? ['changes_requested', 'rejected', 'revoked'].includes(a.status) : a.status === filter), [rows, filter]);

  if (!canReview) return <div className="stack"><h1>Doğrulama talepleri</h1><div className="notice">Doğrulama taleplerini kurumun sahip, yönetici ve değerlendirici rolleri yanıtlar. Hesabında bu rollerden biri yok.</div></div>;
  return (
    <div className="stack">
      <div><h1>Doğrulama talepleri</h1><p className="muted">Kullanıcılar CV’lerindeki bir deneyimin kurumunca doğrulanmasını ister. Doğruladığın her kayıt, kişinin dijital CV’sinde kurumunun adıyla “Doğrulanmış” olarak görünür.</p></div>
      <Tabs tabs={FILTERS} value={filter} onChange={setFilter} label="Talep filtresi" />
      <ListState loading={list.loading} error={list.error} empty={shown.length === 0} onRetry={list.reload} emptyText={filter === 'requested' ? 'Karar bekleyen talep yok.' : 'Bu filtrede kayıt yok.'}>
        <div className="stack">{shown.map((a) => { const x = a.experience; return (
          <div key={a.id} className="card stack">
            <div className="row between"><div className="row"><StatusTag label={ATT_STATUS_LABEL[a.status]} tone={tone[a.status]} />{x && <StatusTag label={KIND_LABEL[x.kind]} tone="neutral" />}<span className="muted small">{a.organization?.name} · talep {fmt(a.requested_at)}</span></div></div>
            {!x ? <p className="muted">Deneyim artık görüntülenemiyor: sahibi yayından kaldırmış ya da silmiş olabilir.</p> : (<>
              <div><div className="muted small">TALEP EDEN</div><h2>{a.requester ?? 'İsim belirtilmemiş'}</h2></div>
              <h3>{x.title}</h3>
              <dl className="kv"><dt>Beyan edilen görev</dt><dd>{x.role ?? '—'}</dd><dt>Beyan edilen kurum</dt><dd>{x.organization_name ?? '—'}</dd><dt>Tarih</dt><dd>{fmtDate(x.started_on)} – {x.ended_on ? fmtDate(x.ended_on) : 'sürüyor'}</dd>
                <dt>Katkı</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{x.contribution ?? '—'}</dd>{x.link_url && <><dt>Bağlantı</dt><dd><a href={x.link_url} target="_blank" rel="noreferrer">{x.link_url}</a></dd></>}
                <dt>Kanıtlar</dt><dd>{x.evidence.length === 0 ? <span className="muted">Kanıt eklenmemiş</span> : <span className="row">{x.evidence.map((ev) => <EvidenceLink key={ev.id} ev={ev} />)}</span>}</dd>
                {a.scope && a.status !== 'requested' && <><dt>Doğrulanan kapsam</dt><dd>{a.scope}</dd></>}{a.source && <><dt>Dayanak</dt><dd>{a.source}</dd></>}
                {a.decision_note && <><dt>Karar notu</dt><dd>{a.decision_note}</dd></>}{a.decided_at && <><dt>Karar</dt><dd>{fmt(a.decided_at)}{a.valid_until ? ` · ${fmtDate(a.valid_until)} tarihine kadar geçerli` : ''}</dd></>}
                {a.revoked_at && <><dt>İptal</dt><dd>{fmt(a.revoked_at)} — {a.revoke_reason}</dd></>}</dl></>)}
            {a.status === 'requested' && x && <Decision att={a} onChanged={list.reload} />}
            {a.status === 'verified' && <Revoke att={a} onChanged={list.reload} />}
          </div>); })}</div>
      </ListState>
    </div>
  );
}
