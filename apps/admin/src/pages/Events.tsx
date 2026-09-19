import { useEffect, useMemo, useState } from 'react';
import { STATUS_LABEL, closedForRegistration, fmt, supabase, toUiError, type Account, type EventRow } from '../lib';

type Filter = 'all' | 'draft' | 'in_review' | 'published' | 'closed' | 'cancelled' | 'archived';
const FILTERS: [Filter, string][] = [['all', 'Tümü'], ['draft', 'Taslak'], ['in_review', 'İncelemede'], ['published', 'Yayında'], ['closed', 'Kaydı kapanan'], ['cancelled', 'İptal'], ['archived', 'Arşiv']];
export const statusTone = (s: EventRow['status']) => (s === 'published' ? 'moss' : s === 'in_review' ? '' : s === 'cancelled' ? 'danger' : 'neutral');
const EDIT_ROLES = ['owner', 'admin', 'editor'];

export function Events({ account }: { account: Account }) {
  const [rows, setRows] = useState<(EventRow & { organization: { name: string } | null })[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    // RLS scopes this list: organisation members see their own events (any status); Intechne admins see everything.
    const orgIds = account.organization_roles.map((r) => r.organization_id);
    let q = supabase.from('events').select('*, organization:organizations(name)').order('starts_at', { ascending: true }).limit(200);
    if (!account.is_platform_admin) q = q.in('organization_id', orgIds);
    q.then(({ data, error: e }) => { if (e) setError(toUiError(e).message); else setRows(data as never); });
  }, [account]);

  const shown = useMemo(() => (rows ?? []).filter((e) => filter === 'all' ? true : filter === 'closed' ? closedForRegistration(e) : filter === 'published' ? e.status === 'published' && !closedForRegistration(e) : e.status === filter), [rows, filter]);
  const canCreate = account.organization_roles.some((r) => EDIT_ROLES.includes(r.role));

  return (
    <div className="stack">
      <div className="row between"><div><h1>Etkinlikler</h1><p className="muted">{account.is_platform_admin ? 'Tüm kurumların etkinlikleri ve yayın onayı bekleyenler.' : 'Kurumunun etkinlikleri.'}</p></div>
        {canCreate && <a className="btn" href="#/events/new" style={{ display: 'inline-flex', alignItems: 'center', color: '#fff' }}>Yeni etkinlik</a>}</div>
      <div className="tabs" role="group" aria-label="Durum filtresi">{FILTERS.map(([v, l]) => <button key={v} aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>)}</div>
      {error ? <div className="notice err" role="alert">{error}</div> : !rows ? <p className="muted">Yükleniyor…</p> : shown.length === 0 ? (
        <div className="card"><h3>{filter === 'all' ? 'Henüz etkinlik yok' : 'Bu durumda etkinlik yok'}</h3><p className="muted">{canCreate ? 'İlk taslağını oluşturup incelemeye gönderebilirsin.' : 'Etkinlik oluşturma yetkin yok; giriş kontrolü için yayındaki etkinlikler burada görünür.'}</p></div>
      ) : (
        <div className="card" style={{ padding: 8 }}><table>
          <thead><tr><th>ETKİNLİK</th><th>KURUM</th><th>TARİH</th><th>DOLULUK</th><th>DURUM</th></tr></thead>
          <tbody>{shown.map((e) => (
            <tr key={e.id}>
              <td><a href={`#/events/${e.id}`}>{e.title}</a>{e.is_demo && <span className="tag neutral" style={{ marginLeft: 8 }}>ÖRNEK</span>}</td>
              <td className="muted">{e.organization?.name ?? '—'}</td><td>{fmt(e.starts_at)}</td>
              <td>{e.seats_taken}{e.capacity ? ` / ${e.capacity}` : ''}{e.waitlist_count > 0 && <span className="muted"> · +{e.waitlist_count} bekleyen</span>}</td>
              <td><span className={`tag ${statusTone(e.status)}`}>{STATUS_LABEL[e.status]}</span>{closedForRegistration(e) && <span className="tag apricot" style={{ marginLeft: 6 }}>Kayıt kapandı</span>}</td>
            </tr>))}</tbody>
        </table></div>
      )}
    </div>
  );
}
