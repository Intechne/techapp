import { useMemo, useState } from 'react';
import { EDIT_ROLES, OPP_TYPE_LABEL, STATUS_LABEL, daysLeft, fmtDate, orgsWith, supabase, type Account, type OpportunityRow } from '../lib';
import { ListState, StatusTag, Tabs } from '../components/ui';
import { useLoad } from '../components/ui';
import { statusTone } from './Events';

type Filter = 'all' | 'draft' | 'in_review' | 'open' | 'closed' | 'archived';
const FILTERS: readonly [Filter, string][] = [['all', 'Tümü'], ['draft', 'Taslak'], ['in_review', 'İncelemede'], ['open', 'Başvuruya açık'], ['closed', 'Süresi dolan'], ['archived', 'Arşiv / iptal']];
type Row = OpportunityRow & { organization: { name: string } | null };
const isOver = (o: OpportunityRow) => new Date(o.closes_at) <= new Date();

export function Deadline({ iso }: { iso: string }) {
  const d = daysLeft(iso);
  if (d <= 0) return <span className="deadline-over">{fmtDate(iso)} · süresi doldu</span>;
  return <span className={d <= 7 ? 'deadline-soon' : undefined}>{fmtDate(iso)} · {d} gün</span>;
}

export function Opportunities({ account }: { account: Account }) {
  const [filter, setFilter] = useState<Filter>('all');
  const list = useLoad(async () => {
    // RLS scopes this list: organisation members see their own calls (any status); Intechne admins see everything.
    let q = supabase.from('opportunities').select('*, organization:organizations(name)').order('closes_at', { ascending: true }).limit(200);
    if (!account.is_platform_admin) q = q.in('organization_id', account.organization_roles.map((r) => r.organization_id));
    const r = await q; if (r.error) throw r.error; return r.data as unknown as Row[];
  }, [account]);
  const rows = list.data ?? [];
  const shown = useMemo(() => rows.filter((o) => filter === 'all' ? true : filter === 'open' ? o.status === 'published' && !isOver(o) : filter === 'closed' ? o.status === 'published' && isOver(o)
    : filter === 'archived' ? o.status === 'archived' || o.status === 'cancelled' : o.status === filter), [rows, filter]);
  const canCreate = orgsWith(account, EDIT_ROLES).length > 0;

  return (
    <div className="stack">
      <div className="row between"><div><h1>Fırsatlar &amp; son tarihler</h1><p className="muted">Staj, burs, yarışma, hibe ve ödül çağrıları. Uygulamadaki “Son tarihler” takvimi buradan beslenir.</p></div>
        {canCreate && <a className="btn" href="#/opportunities/new" style={{ display: 'inline-flex', alignItems: 'center', color: '#fff' }}>Yeni çağrı</a>}</div>
      <Tabs tabs={FILTERS} value={filter} onChange={setFilter} label="Durum filtresi" />
      <ListState loading={list.loading} error={list.error} empty={shown.length === 0} onRetry={list.reload} emptyText={rows.length === 0 ? 'Henüz çağrı yok. İlk taslağını oluşturup incelemeye gönderebilirsin.' : 'Bu filtrede çağrı yok.'}>
        <div className="card" style={{ padding: 8 }}><table>
          <thead><tr><th>ÇAĞRI</th><th>TÜR</th><th>KURUM</th><th>SON BAŞVURU</th><th>BAŞVURU YERİ</th><th>DURUM</th></tr></thead>
          <tbody>{shown.map((o) => (
            <tr key={o.id}>
              <td><a href={`#/opportunities/${o.id}`}>{o.title}</a>{o.is_demo && <span className="tag neutral" style={{ marginLeft: 8 }}>ÖRNEK</span>}</td>
              <td>{OPP_TYPE_LABEL[o.type]}{o.team_based && <span className="muted small"> · takım</span>}</td><td className="muted">{o.organization?.name ?? '—'}</td>
              <td><Deadline iso={o.closes_at} /></td><td className="muted">{o.apply_url ? 'Dış site' : 'TechApp'}</td>
              <td><StatusTag label={STATUS_LABEL[o.status]} tone={statusTone(o.status)} /></td>
            </tr>))}</tbody>
        </table></div>
      </ListState>
    </div>
  );
}
