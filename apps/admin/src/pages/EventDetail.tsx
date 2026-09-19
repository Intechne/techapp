import { useCallback, useEffect, useMemo, useState } from 'react';
import { REG_LABEL, STATUS_LABEL, closedForRegistration, fmt, supabase, toUiError, type Account, type EventRow, type PublishStatus, type RegistrationItem, type RegistrationStatus } from '../lib';
import { statusTone } from './Events';

const REG_FILTERS: ['all' | RegistrationStatus | 'checked_in', string][] = [['all', 'Tümü'], ['confirmed', 'Onaylı'], ['pending_review', 'Değerlendirmede'], ['pending_guardian', 'Veli onayı'], ['waitlisted', 'Bekleme'], ['cancelled', 'İptal'], ['checked_in', 'Giriş yapan']];
const regTone = (s: RegistrationStatus) => (s === 'confirmed' ? 'moss' : s === 'waitlisted' ? 'apricot' : s === 'rejected' ? 'danger' : s === 'cancelled' || s === 'expired' ? 'neutral' : '');

export function EventDetail({ account, eventId }: { account: Account; eventId: string }) {
  const [event, setEvent] = useState<(EventRow & { organization: { name: string } | null }) | null>(null);
  const [regs, setRegs] = useState<RegistrationItem[] | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<(typeof REG_FILTERS)[number][0]>('all'); const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const e = await supabase.from('events').select('*, organization:organizations(name)').eq('id', eventId).maybeSingle();
    if (e.error || !e.data) { setError(e.error ? toUiError(e.error).message : 'Etkinlik bulunamadı ya da görme yetkin yok.'); return; }
    setEvent(e.data as never);
    const r = await supabase.rpc('admin_event_registrations', { p_event_id: eventId });
    if (r.error) setRegError(toUiError(r.error).message); else setRegs(r.data);
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  const role = account.organization_roles.find((r) => r.organization_id === event?.organization_id)?.role;
  const canEdit = !!role && ['owner', 'admin', 'editor'].includes(role);
  const canReview = !!role && ['owner', 'admin', 'reviewer'].includes(role);
  const canCheckIn = !!role && ['owner', 'admin', 'checkin_staff'].includes(role);

  // The buttons only propose a transition. The status machine and the publish rule live in database triggers.
  const move = async (to: PublishStatus, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true); setError(null);
    const { error: err } = await supabase.from('events').update({ status: to }).eq('id', eventId).select('id').single();
    setBusy(false); if (err) setError(toUiError(err).message); await load();
  };
  const review = async (id: string, approve: boolean) => {
    setBusy(true); setError(null);
    const { error: err } = await supabase.rpc('review_event_registration', { p_registration_id: id, p_approve: approve });
    setBusy(false); if (err) setError(toUiError(err).message); await load();
  };

  const shown = useMemo(() => (regs ?? []).filter((r) => (filter === 'all' ? true : filter === 'checked_in' ? !!r.checked_in_at : r.status === filter)
    && (r.display_name ?? '').toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))), [regs, filter, search]);
  const count = (s: RegistrationStatus) => (regs ?? []).filter((r) => r.status === s).length;

  if (error && !event) return <div className="notice err" role="alert">{error}</div>;
  if (!event) return <p className="muted">Yükleniyor…</p>;

  return (
    <div className="stack">
      <a href="#/events">← Etkinlikler</a>
      <div className="row between">
        <div><div className="row"><span className={`tag ${statusTone(event.status)}`}>{STATUS_LABEL[event.status]}</span>{closedForRegistration(event) && <span className="tag apricot">Kayıt kapandı</span>}{event.is_demo && <span className="tag neutral">ÖRNEK</span>}</div>
          <h1 style={{ marginTop: 8 }}>{event.title}</h1><p className="muted">{event.organization?.name} · {fmt(event.starts_at)} · {event.format === 'online' ? 'Çevrim içi' : event.city ?? 'Yer belirtilmedi'}</p></div>
        <div className="row">
          {canEdit && ['draft', 'in_review', 'published'].includes(event.status) && <a className="btn secondary" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }} href={`#/events/${eventId}/edit`}>Düzenle</a>}
          {canCheckIn && event.status === 'published' && <a className="btn lime" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--ink)' }} href={`#/events/${eventId}/check-in`}>Giriş kontrolü</a>}
        </div>
      </div>

      <div className="card stack"><h2>Yayın akışı</h2>
        {event.status === 'draft' && <p className="muted">Taslak yalnızca kurumun ekibine görünür. Hazır olduğunda incelemeye gönder; Intechne onaylayınca uygulamada yayınlanır.</p>}
        {event.status === 'in_review' && <p className="muted">{account.is_platform_admin ? 'Bu etkinlik yayın onayı bekliyor.' : 'Intechne ekibi inceliyor. Onaylandığında uygulamada görünür.'}</p>}
        {event.status === 'published' && <p className="muted">Yayında{event.published_at ? ` · ${fmt(event.published_at)}` : ''}. İptal edersen bütün kayıtlar iptal olur ve katılım kartları geçersizleşir.</p>}
        <div className="row">
          {event.status === 'draft' && canEdit && <button className="btn" disabled={busy} onClick={() => move('in_review')}>İncelemeye gönder</button>}
          {event.status === 'in_review' && canEdit && <button className="btn secondary" disabled={busy} onClick={() => move('draft')}>Taslağa geri al</button>}
          {event.status === 'in_review' && account.is_platform_admin && <><button className="btn" disabled={busy} onClick={() => move('published')}>Onayla ve yayınla</button><button className="btn secondary" disabled={busy} onClick={() => move('draft')}>Düzeltme iste</button></>}
          {event.status === 'published' && (canEdit || account.is_platform_admin) && <button className="btn danger" disabled={busy} onClick={() => move('cancelled', 'Etkinlik iptal edilsin mi? Tüm kayıtlar iptal olur. Bu işlem geri alınamaz.')}>Etkinliği iptal et</button>}
          {['draft', 'cancelled'].includes(event.status) && canEdit && <button className="btn secondary" disabled={busy} onClick={() => move('archived')}>Arşivle</button>}
        </div>
        {error && <div className="notice err" role="alert">{error}</div>}
      </div>

      <div className="grid3">
        <div className="card"><div className="muted small">ONAYLI</div><div className="stat">{count('confirmed')}{event.capacity ? <span className="muted" style={{ fontSize: 16 }}> / {event.capacity}</span> : null}</div></div>
        <div className="card"><div className="muted small">BEKLEYEN (veli · değerlendirme · liste)</div><div className="stat">{count('pending_guardian')} · {count('pending_review')} · {count('waitlisted')}</div></div>
        <div className="card"><div className="muted small">GİRİŞ YAPAN</div><div className="stat">{(regs ?? []).filter((r) => r.checked_in_at).length}</div></div>
      </div>

      <div className="card stack"><div className="row between"><h2>Kayıtlar</h2><input style={{ maxWidth: 260 }} placeholder="İsimle ara" aria-label="İsimle ara" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <p className="muted small">Yalnızca giriş ve değerlendirme için gereken bilgi gösterilir: ad ve kayıt durumu. İletişim ve yaş bilgisi kurumlarla paylaşılmaz.</p>
        <div className="tabs" role="group" aria-label="Kayıt filtresi">{REG_FILTERS.map(([v, l]) => <button key={v} aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>)}</div>
        {regError ? <div className="notice err" role="alert">{regError}</div> : !regs ? <p className="muted">Yükleniyor…</p> : shown.length === 0 ? <p className="muted">{regs.length === 0 ? 'Henüz kayıt yok.' : 'Bu filtrede kayıt yok.'}</p> : (
          <table><thead><tr><th>KATILIMCI</th><th>DURUM</th><th>KAYIT</th><th>GİRİŞ</th><th /></tr></thead><tbody>{shown.map((r) => (
            <tr key={r.registration_id}><td>{r.display_name ?? '—'}</td>
              <td><span className={`tag ${regTone(r.status)}`}>{REG_LABEL[r.status]}</span>{r.status === 'pending_guardian' && <span className="muted small"> · {r.guardian_status === 'pending' ? 'bağlantı gönderildi' : 'veli bilgisi bekleniyor'}</span>}</td>
              <td className="muted">{fmt(r.created_at)}</td><td>{r.checked_in_at ? <span className="tag moss">{fmt(r.checked_in_at)}</span> : <span className="muted">—</span>}</td>
              <td style={{ textAlign: 'right' }}>{r.status === 'pending_review' && canReview && <span className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" disabled={busy} onClick={() => review(r.registration_id, true)}>Kabul et</button><button className="btn secondary" disabled={busy} onClick={() => review(r.registration_id, false)}>Reddet</button></span>}</td></tr>))}</tbody></table>)}
      </div>
    </div>
  );
}
