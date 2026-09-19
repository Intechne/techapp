import { OPP_TYPE_LABEL, fmt, supabase } from '../lib';
import { ErrorNote, ListState, StatusTag, useAction, useLoad } from '../components/ui';
import { Deadline } from './Opportunities';

interface Item { kind: 'events' | 'opportunities'; id: string; title: string; summary: string; org: string; meta: string; closesAt?: string; updatedAt: string; isDemo: boolean }

/** Intechne-only: everything waiting for publish approval. The trigger refuses `published` from anyone else. */
export function PublishQueue() {
  const list = useLoad(async (): Promise<Item[]> => {
    const [ev, op] = await Promise.all([
      supabase.from('events').select('id,title,summary,starts_at,city,format,updated_at,is_demo,organization:organizations(name)').eq('status', 'in_review').order('updated_at'),
      supabase.from('opportunities').select('id,title,summary,type,closes_at,updated_at,is_demo,organization:organizations(name)').eq('status', 'in_review').order('updated_at'),
    ]);
    if (ev.error) throw ev.error; if (op.error) throw op.error;
    const org = (o: unknown) => (o as { name: string } | null)?.name ?? '—';
    return [
      ...ev.data.map((e): Item => ({ kind: 'events', id: e.id, title: e.title, summary: e.summary, org: org(e.organization), meta: `Etkinlik · ${fmt(e.starts_at)} · ${e.format === 'online' ? 'Çevrim içi' : e.city ?? 'Yer belirtilmedi'}`, updatedAt: e.updated_at, isDemo: e.is_demo })),
      ...op.data.map((o): Item => ({ kind: 'opportunities', id: o.id, title: o.title, summary: o.summary, org: org(o.organization), meta: OPP_TYPE_LABEL[o.type], closesAt: o.closes_at, updatedAt: o.updated_at, isDemo: o.is_demo })),
    ].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  }, []);
  const action = useAction();
  const move = (i: Item, to: 'published' | 'draft') => action.run(() => supabase.from(i.kind).update({ status: to }).eq('id', i.id).select('id').single(), list.reload);
  const rows = list.data ?? [];

  return (
    <div className="stack">
      <div><h1>Yayın onayı kuyruğu</h1><p className="muted">Kurumların incelemeye gönderdiği etkinlik ve çağrılar, en uzun bekleyen en üstte. Onayladığın içerik uygulamada hemen görünür; “Düzeltme iste” içeriği kurumun taslağına geri gönderir.</p></div>
      <ErrorNote message={action.error} />
      <ListState loading={list.loading} error={list.error} empty={rows.length === 0} onRetry={list.reload} emptyText="Onay bekleyen içerik yok.">
        <div className="stack">{rows.map((i) => (
          <div key={`${i.kind}-${i.id}`} className="card stack" style={{ gap: 10 }}>
            <div className="row between"><div className="row"><StatusTag label={i.kind === 'events' ? 'Etkinlik' : 'Çağrı'} />{i.isDemo && <StatusTag label="ÖRNEK" tone="neutral" />}<span className="muted small">{i.org} · gönderim {fmt(i.updatedAt)}</span></div>
              <a href={`#/${i.kind}/${i.id}`}>Tümünü incele →</a></div>
            <h2>{i.title}</h2><p className="muted" style={{ margin: 0 }}>{i.meta}{i.closesAt && <> · Son başvuru: <Deadline iso={i.closesAt} /></>}</p><p style={{ margin: 0 }}>{i.summary}</p>
            <div className="row"><button type="button" className="btn" disabled={action.busy} onClick={() => move(i, 'published')}>Onayla ve yayınla</button><button type="button" className="btn secondary" disabled={action.busy} onClick={() => move(i, 'draft')}>Düzeltme iste</button></div>
          </div>))}</div>
      </ListState>
    </div>
  );
}
