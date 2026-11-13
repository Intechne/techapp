import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmButton } from '../components/ui';
import { TEAM_LIVE, TEAM_REASON_LABEL, TEAM_STATUS_LABEL, fmt, roleIn, supabase, toUiError, type Account, type EventRow, type TeamMemberStep, type TeamRegItem, type TeamRegStatus } from '../lib';

type Filter = 'all' | 'pending_review' | 'pending_members' | 'confirmed' | 'waitlisted' | 'ended';
const FILTERS: [Filter, string][] = [['all', 'Tümü'], ['pending_review', 'Değerlendirmede'], ['pending_members', 'Üyeler bekleniyor'], ['confirmed', 'Onaylı'], ['waitlisted', 'Bekleme'], ['ended', 'Sona eren']];
const tone = (s: TeamRegStatus) => (s === 'confirmed' ? 'moss' : s === 'waitlisted' ? 'apricot' : s === 'rejected' ? 'danger' : s === 'cancelled' || s === 'expired' ? 'neutral' : '');
const STEP_LABEL: Record<TeamMemberStep, string> = { invited: 'Davet bekliyor', guardian: 'Veli onayı bekliyor', ready: 'Hazır', declined: 'Katılmıyor' };
const ROLE_LABEL: Record<string, string> = { captain: 'Kaptan', mentor: 'Mentor', member: 'Üye' };
const BELOW_MIN = 'roster_below_min_after_close';

// A live team's member steps mean what they say. For a team that has ended the server derives 'declined' from the member's
// registration being cancelled/rejected/expired, so it would read as a refusal the member never made: dead teams show an
// "ended" label instead of a step (ledger M-2).
function memberLabel(t: TeamRegItem, m: TeamRegItem['members'][number]): { text: string; tone: string } {
  if (!TEAM_LIVE.includes(t.status)) return { text: 'Takım sona erdi', tone: 'neutral' };
  if (m.state === 'declined') return { text: 'Daveti reddetti', tone: 'neutral' };
  if (m.state === 'removed') return { text: 'Kadrodan çıkarıldı', tone: 'neutral' };
  if (m.step === 'declined') return { text: 'Katılımı sona erdi', tone: 'danger' };
  return { text: STEP_LABEL[m.step], tone: m.step === 'ready' ? 'moss' : m.step === 'guardian' ? 'apricot' : '' };
}

export function EventTeamRegistrations({ account, eventId }: { account: Account; eventId: string }) {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [rows, setRows] = useState<TeamRegItem[] | null>(null);
  const [error, setError] = useState<string | null>(null); const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [filter, setFilter] = useState<Filter>('all'); const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const e = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
    if (e.error || !e.data) { setError(e.error ? toUiError(e.error).message : 'Etkinlik bulunamadı ya da görme yetkin yok.'); return; }
    setEvent(e.data);
    // Not in the hand-patched generated types yet; the row shape is TeamRegItem (lib.ts).
    const r = await (supabase.rpc as unknown as (fn: string, args: object) => PromiseLike<{ data: unknown; error: unknown }>)('admin_event_team_registrations', { p_event_id: eventId });
    if (r.error) setError(toUiError(r.error).message); else { setError(null); setRows(r.data as TeamRegItem[]); }
    setNow(Date.now());
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const role = roleIn(account, event?.organization_id);
  const canReview = account.is_platform_admin || (!!role && ['owner', 'admin', 'reviewer'].includes(role));

  const decide = async (id: string, approve: boolean) => {
    setBusy(true); setActionError(null);
    const { error: err } = await (supabase.rpc as unknown as (fn: string, args: object) => PromiseLike<{ error: unknown }>)('review_team_registration', { p_team_registration_id: id, p_approve: approve });
    setBusy(false); if (err) setActionError(toUiError(err).message); await load();
  };

  const shown = useMemo(() => (rows ?? [])
    .filter((t) => (filter === 'all' ? true : filter === 'ended' ? !TEAM_LIVE.includes(t.status) : t.status === filter))
    // Decisions first; the server order (oldest first, the waitlist order) is kept inside each group.
    .map((t, i) => ({ t, i })).sort((a, b) => Number(b.t.status === 'pending_review') - Number(a.t.status === 'pending_review') || a.i - b.i).map((x) => x.t), [rows, filter]);

  if (error && !rows) return <div className="stack"><a href={`#/events/${eventId}`}>← Etkinlik</a><div className="notice err" role="alert">{error}</div></div>;
  if (!event || !rows) return <p className="muted">Yükleniyor…</p>;
  const pendingReview = rows.filter((t) => t.status === 'pending_review').length;

  return (
    <div className="stack">
      <a href={`#/events/${eventId}`}>← {event.title}</a>
      <div className="row between"><div><h1>Takım kayıtları</h1><p className="muted">{event.title} · takım kontenjanı {event.teams_taken}{event.team_capacity ? ` / ${event.team_capacity}` : ''}{event.team_waitlist_count > 0 ? ` · +${event.team_waitlist_count} bekleyen` : ''} · kadro {event.team_min_size}{event.team_max_size ? `–${event.team_max_size}` : '+'} kişi</p></div>
        {pendingReview > 0 && <span className="tag">{pendingReview} takım karar bekliyor</span>}</div>
      <div className="card stack">
        <p className="muted small">Yalnızca değerlendirme için gereken bilgi gösterilir: takım adı, üyelerin görünen adları ve her üyenin adımı. E-posta, yaş ve veli bilgisi kurumlarla paylaşılmaz.</p>
        <div className="tabs" role="group" aria-label="Takım durumu filtresi">{FILTERS.map(([v, l]) => <button key={v} aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>)}</div>
        {actionError && <div className="notice err" role="alert">{actionError}</div>}
        {error && <div className="notice err" role="alert">{error}</div>}
        {shown.length === 0 ? <p className="muted">{rows.length === 0 ? 'Henüz takım kaydı yok.' : 'Bu filtrede takım yok.'}</p> : (
          <table><thead><tr><th>TAKIM</th><th>DURUM</th><th>HAZIR / KADRO</th><th>SON TARİH</th><th /></tr></thead><tbody>{shown.map((t) => {
            const lapsed = t.status === 'pending_members' && !!t.hold_expires_at && new Date(t.hold_expires_at).getTime() <= now;
            const isOpen = open.has(t.id);
            return (
              <Fragment key={t.id}>
                <tr>
                  <td><button type="button" className="linkish" aria-expanded={isOpen} onClick={() => setOpen((o) => { const n = new Set(o); if (isOpen) n.delete(t.id); else n.add(t.id); return n; })}>{isOpen ? '▾' : '▸'} {t.team_name}</button></td>
                  <td><span className={`tag ${lapsed ? 'neutral' : tone(t.status)}`}>{lapsed ? 'Süresi doldu, kapanıyor' : TEAM_STATUS_LABEL[t.status]}</span></td>
                  <td>{t.ready_count} / {t.roster_size}</td>
                  <td className="muted">{t.status === 'pending_members' && t.hold_expires_at ? fmt(t.hold_expires_at) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{t.status === 'pending_review' && canReview && (
                    <span className="row" style={{ justifyContent: 'flex-end' }}>
                      <ConfirmButton label={t.status_reason === BELOW_MIN ? 'Bu kadroyla onayla' : 'Onayla'} confirmLabel="Evet, onayla" className="btn" confirmClassName="btn" disabled={busy} onConfirm={() => void decide(t.id, true)} />
                      <ConfirmButton label="Reddet" confirmLabel="Evet, reddet: üyelerin kayıtları da reddedilir" className="btn secondary" disabled={busy} onConfirm={() => void decide(t.id, false)} />
                    </span>)}</td>
                </tr>
                {isOpen && (
                  <tr><td colSpan={5} style={{ background: 'var(--paper, #FAFAF6)' }}>
                    <div className="stack" style={{ gap: 8 }}>
                      {t.status_reason && <p className="small" style={{ margin: 0 }}><b>Neden:</b> {t.status === 'pending_review' && t.status_reason === BELOW_MIN ? 'Kayıt kapandıktan sonra kadro alt sınırın altına düştü. Takım şu haliyle onaylanabilir ya da reddedilebilir.' : TEAM_REASON_LABEL[t.status_reason] ?? 'Bu durum sunucu tarafından belirlendi.'}</p>}
                      {t.members.length === 0 ? <p className="muted small" style={{ margin: 0 }}>Kadro bilgisi yok.</p> : (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>{t.members.map((m, i) => { const l = memberLabel(t, m); return (
                          <li key={i} className="row between"><span>{m.display_name ?? 'Adı görünmüyor'} <span className="muted small">· {ROLE_LABEL[m.role_at_submit] ?? m.role_at_submit}</span></span><span className={`tag ${l.tone}`}>{l.text}</span></li>); })}</ul>)}
                    </div></td></tr>)}
              </Fragment>);
          })}</tbody></table>)}
      </div>
    </div>
  );
}
