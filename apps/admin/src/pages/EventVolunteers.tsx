import { useMemo, useState } from 'react';
import { VOLUNTEER_LABEL, fmt, supabase, type VolunteerItem, type VolunteerStatus } from '../lib';
import { CheckRow, ErrorNote, ListState, StatusTag, Tabs, useAction, useLoad, type Tone } from '../components/ui';

const FILTERS: readonly ['all' | VolunteerStatus, string][] = [['all', 'Tümü'], ['pending', 'Bekleyen'], ['approved', 'Onaylı'], ['rejected', 'Reddedilen'], ['withdrawn', 'Çekilen']];
const tone: Record<VolunteerStatus, Tone> = { pending: '', approved: 'moss', rejected: 'danger', withdrawn: 'neutral' };

export function EventVolunteers({ eventId, accepts, canEdit, onEventChanged }: { eventId: string; accepts: boolean; canEdit: boolean; onEventChanged: () => Promise<void> }) {
  const [filter, setFilter] = useState<'all' | VolunteerStatus>('all');
  const [duty, setDuty] = useState<Record<string, string>>({});
  const list = useLoad(async () => { const r = await supabase.rpc('admin_event_volunteers', { p_event_id: eventId }); if (r.error) throw r.error; return r.data; }, [eventId]);
  const action = useAction();
  const rows: VolunteerItem[] = list.data ?? [];
  const shown = useMemo(() => rows.filter((v) => filter === 'all' || v.status === filter), [rows, filter]);
  const count = (s: VolunteerStatus) => rows.filter((v) => v.status === s).length;

  const toggle = (next: boolean) => action.run(() => supabase.from('events').update({ accepts_volunteers: next }).eq('id', eventId).select('id').single(), onEventChanged);
  const decide = (v: VolunteerItem, approve: boolean) =>
    action.run(() => supabase.rpc('decide_volunteer', { p_volunteer_id: v.volunteer_id, p_approve: approve, p_duty: approve ? duty[v.volunteer_id]?.trim() || undefined : undefined }), list.reload);

  return (
    <div className="card stack">
      <div className="row between"><h2>Gönüllüler</h2><span className="muted small">{count('approved')} onaylı · {count('pending')} bekleyen</span></div>
      <CheckRow checked={accepts} disabled={!canEdit || action.busy} onChange={toggle}
        label={<>Bu etkinlik için gönüllü başvurusu al<br /><span className="muted small">Açıkken uygulamadaki etkinlik sayfasında "Gönüllü ol" görünür. Yalnızca 18 yaş ve üzeri başvurabilir.</span></>} />
      <p className="muted small">Onayladığın gönüllüler uygulamada sınırlı bir etkinlik özeti görür: program, gönüllülere açık duyurular, katılan takımların adları ve sayılar. Katılımcı adlarını ve iletişim bilgilerini göremezler. Burada da yalnız gönüllünün adı ve notu gösterilir.</p>
      <Tabs tabs={FILTERS} value={filter} onChange={setFilter} label="Gönüllü filtresi" />
      <ErrorNote message={action.error} />
      <ListState loading={list.loading} error={list.error} empty={shown.length === 0} onRetry={list.reload} emptyText={rows.length === 0 ? 'Henüz gönüllü başvurusu yok.' : 'Bu filtrede başvuru yok.'}>
        <table><thead><tr><th>GÖNÜLLÜ</th><th>NOTU</th><th>DURUM</th><th>BAŞVURU</th><th>GÖREV / KARAR</th></tr></thead><tbody>{shown.map((v) => (
          <tr key={v.volunteer_id}><td>{v.display_name ?? '—'}</td><td className="muted" style={{ maxWidth: 280 }}>{v.note ?? '—'}</td>
            <td><StatusTag label={VOLUNTEER_LABEL[v.status]} tone={tone[v.status]} /></td><td className="muted">{fmt(v.created_at)}</td>
            <td>{v.status === 'pending' && canEdit ? (
              <span className="row"><input style={{ maxWidth: 200 }} placeholder="Görev (isteğe bağlı)" aria-label={`${v.display_name ?? 'Gönüllü'} için görev`} maxLength={120} value={duty[v.volunteer_id] ?? ''} onChange={(e) => setDuty((d) => ({ ...d, [v.volunteer_id]: e.target.value }))} />
                <button className="btn" disabled={action.busy} onClick={() => decide(v, true)}>Onayla</button><button className="btn secondary" disabled={action.busy} onClick={() => decide(v, false)}>Reddet</button></span>
            ) : v.status === 'approved' ? <span>{v.duty ?? <span className="muted">Görev belirtilmedi</span>} {canEdit && <button className="linkish" disabled={action.busy} onClick={() => decide(v, false)}>Onayı kaldır</button>}</span>
              : v.status === 'rejected' && canEdit ? <button className="linkish" disabled={action.busy} onClick={() => decide(v, true)}>Yeniden onayla</button> : <span className="muted">—</span>}</td></tr>))}</tbody></table>
      </ListState>
    </div>
  );
}
