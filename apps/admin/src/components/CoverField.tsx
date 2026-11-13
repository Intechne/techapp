import { useEffect, useState } from 'react';
import { COVER_ERROR_COPY, CoverError, prepareCover, removeCover, replaceCover, thumbPathOf, type CoverClient, type CoverEntity, type PreparedCover } from '../cover';
import { supabase, toUiError } from '../lib';

const client: CoverClient = {
  storage: supabase.storage,
  // The generated Args type has no `null` (SQL default null); the function accepts it.
  rpc: (name, args) => supabase.rpc(name, args as never),
};

const publicUrl = (path: string) => supabase.storage.from('covers').getPublicUrl(path).data.publicUrl;
const message = (e: unknown) => (e instanceof CoverError ? COVER_ERROR_COPY[e.code] : toUiError(e).message);

/**
 * Cover image of an event or opportunity. Acts on its own (not part of the form's save): choose -> preview -> save.
 * Publishing state is passed in because a cover change on a published item sends it back to review (server rule), and the
 * person must be told BEFORE confirming.
 */
export function CoverField({ entity, entityId, ownerId, coverPath, published, onChanged }: {
  entity: CoverEntity; entityId: string; ownerId: string; coverPath: string | null; published: boolean; onChanged: (path: string | null) => void;
}) {
  const [pending, setPending] = useState<{ prepared: PreparedCover; preview: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.preview); }, [pending]);

  const done = (path: string | null, cleanupFailed: boolean) => {
    onChanged(path);
    setNote([published ? 'Kapak değişti; içerik yeniden onaya gönderildi.' : 'Kapak kaydedildi.',
      cleanupFailed ? 'Eski görsel dosyaları silinemedi; yeni kapak etkilenmedi.' : null].filter(Boolean).join(' '));
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null); setNote(null); setBusy(true);
    try { const prepared = await prepareCover(file); setPending({ prepared, preview: URL.createObjectURL(prepared.full) }); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const save = async () => {
    if (!pending) return;
    setError(null); setBusy(true);
    try {
      const r = await replaceCover(client, { entity, entityId, ownerId, oldPath: coverPath, prepared: pending.prepared });
      setPending(null); done(r.path, r.cleanupFailed);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!coverPath) return;
    setError(null); setNote(null); setBusy(true);
    try { const r = await removeCover(client, { entity, entityId, ownerId, oldPath: coverPath }); done(null, r.cleanupFailed); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  };

  const shown = pending?.preview ?? (coverPath ? publicUrl(thumbPathOf(coverPath)) : null);
  return (
    <div className="stack" data-testid="cover-field">
      <h2>Kapak görseli</h2>
      {shown
        ? <img src={shown} alt="" style={{ width: '100%', maxWidth: 480, aspectRatio: '16 / 10', objectFit: 'cover', borderRadius: 14, background: 'var(--line)' }} />
        : <p className="muted">Kapak yok: kartlarda ve detayda ikonlu afiş görünür.</p>}
      {published && <div className="notice warn">Bu içerik yayında. Kapağı eklemek, değiştirmek ya da kaldırmak içeriği yeniden onaya gönderir; onaylanana kadar yayından kalkar.</div>}
      <p className="muted small">JPEG, PNG veya WebP · en fazla 2 MB. Görsel tarayıcıda WebP’ye çevrilir; konum ve kamera bilgileri (EXIF) yüklenmez.</p>
      <div className="row">
        {pending
          ? <><button type="button" className="btn" disabled={busy} onClick={() => void save()}>{busy ? 'Yükleniyor…' : 'Bu kapağı kaydet'}</button>
              <button type="button" className="btn secondary" disabled={busy} onClick={() => setPending(null)}>Vazgeç</button></>
          : <><label className="btn secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>{coverPath ? 'Kapağı değiştir' : 'Kapak seç'}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} style={{ display: 'none' }}
                  onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} /></label>
              {coverPath && <button type="button" className="btn secondary" disabled={busy} onClick={() => void remove()}>Kapağı kaldır</button>}</>}
      </div>
      {error && <div className="notice err" role="alert">{error}</div>}
      {note && <div className="notice ok" role="status">{note}</div>}
    </div>
  );
}
