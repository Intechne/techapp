import { useState } from 'react';
import { AUDIENCE_HELP, AUDIENCE_LABEL, fmt, supabase, type AnnouncementRow, type Audience } from '../lib';
import { CheckRow, ConfirmButton, ErrorNote, Field, ListState, StatusTag, useAction, useLoad } from '../components/ui';

const AUDIENCES: Audience[] = ['all', 'participants', 'volunteers'];
const blank = { id: null as string | null, audience: 'all' as Audience, title: '', body: '', pinned: false };

export function EventAnnouncements({ eventId, canEdit }: { eventId: string; canEdit: boolean }) {
  const [form, setForm] = useState(blank); const [saved, setSaved] = useState<string | null>(null);
  const list = useLoad(async () => {
    const r = await supabase.from('event_announcements').select('*').eq('event_id', eventId).order('pinned', { ascending: false }).order('created_at', { ascending: false });
    if (r.error) throw r.error; return r.data;
  }, [eventId]);
  const action = useAction();

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaved(null);
    const values = { audience: form.audience, title: form.title.trim(), body: form.body.trim(), pinned: form.pinned };
    const { data: user } = await supabase.auth.getUser();
    const ok = await action.run(() => form.id
      ? supabase.from('event_announcements').update(values).eq('id', form.id).select('id').single()
      : supabase.from('event_announcements').insert({ ...values, event_id: eventId, created_by: user.user?.id }).select('id').single(), list.reload);
    if (ok) { setSaved(form.id ? 'Duyuru güncellendi.' : `Duyuru yayınlandı: ${AUDIENCE_LABEL[form.audience]}.`); setForm(blank); }
  };
  const remove = (a: AnnouncementRow) => action.run(() => supabase.from('event_announcements').delete().eq('id', a.id).select('id').single(), list.reload);

  return (
    <div className="stack">
      {canEdit && (
        <form className="card stack" onSubmit={save}>
          <h2>{form.id ? 'Duyuruyu düzenle' : 'Yeni duyuru'}</h2>
          <div className="grid2">
            <Field label="Kimler görecek" help={AUDIENCE_HELP[form.audience]}>
              <select value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as Audience }))}>{AUDIENCES.map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}</select></Field>
            <Field label="Başlık"><input required minLength={3} maxLength={120} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
          </div>
          <Field label="Metin" help="Kişisel veri ya da iletişim bilgisi yazma; duyurular seçtiğin gruptaki herkese görünür."><textarea required maxLength={2000} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} /></Field>
          <CheckRow checked={form.pinned} onChange={(v) => setForm((f) => ({ ...f, pinned: v }))} label="Üste sabitle" />
          <ErrorNote message={action.error} />
          {saved && <div className="notice ok" role="status">{saved}</div>}
          <div className="row"><button className="btn" disabled={action.busy}>{form.id ? 'Kaydet' : 'Duyuruyu yayınla'}</button>{form.id && <button type="button" className="btn secondary" onClick={() => setForm(blank)}>Vazgeç</button>}</div>
        </form>
      )}
      <div className="card stack"><h2>Duyurular</h2>
        <ListState loading={list.loading} error={list.error} empty={(list.data ?? []).length === 0} onRetry={list.reload} emptyText="Henüz duyuru yok.">
          {(list.data ?? []).map((a) => (
            <div key={a.id} className={`item ${a.pinned ? 'pinned' : ''}`}>
              <div className="row between"><div className="row"><StatusTag label={AUDIENCE_LABEL[a.audience]} tone={a.audience === 'volunteers' ? 'apricot' : a.audience === 'participants' ? 'moss' : ''} />{a.pinned && <StatusTag label="Sabit" tone="neutral" />}<span className="muted small">{fmt(a.created_at)}</span></div>
                {canEdit && <span className="row"><button className="btn secondary" onClick={() => { setSaved(null); setForm({ id: a.id, audience: a.audience, title: a.title, body: a.body, pinned: a.pinned }); scrollTo({ top: 0, behavior: 'smooth' }); }}>Düzenle</button>
                  <ConfirmButton label="Sil" confirmLabel="Evet, sil" disabled={action.busy} onConfirm={() => void remove(a)} /></span>}</div>
              <h3>{a.title}</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{a.body}</p>
            </div>))}
        </ListState>
      </div>
    </div>
  );
}
