'use client';
import { useEffect, useState } from 'react';
import { supabaseKey, supabaseUrl } from '@/lib/site';

/**
 * Guardian consent. The token travels in the URL FRAGMENT (/veli#<token>), so it never reaches server logs, analytics or referrers.
 * All decisions are made by database functions: guardian_request_preview / guardian_decide / guardian_revoke (single-use, time-limited).
 */
const MESSAGES: Record<string, string> = {
  guardian_token_invalid: 'Bu bağlantı geçerli değil ya da daha önce kullanılmış.',
  guardian_request_expired: 'Bu bağlantının süresi dolmuş. Çocuğunuz uygulamadan yeni bir bağlantı gönderebilir.',
  guardian_request_approved: 'Bu istek daha önce onaylanmış.', guardian_request_denied: 'Bu istek daha önce reddedilmiş.', guardian_request_revoked: 'Bu istek geri çekilmiş.',
  guardian_name_required: 'Lütfen adınızı ve soyadınızı yazın.', policy_version_mismatch: 'Onay metni güncellendi. Sayfayı yenileyip tekrar deneyin.',
};
interface Preview { purpose: string; policy_version: string; expires_at: string; participant_first_name: string; event: { title: string; starts_at: string; city: string | null; venue: string | null; organizer: string } }
type View = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'form'; preview: Preview } | { kind: 'approved'; revokeUrl: string } | { kind: 'denied' } | { kind: 'revoke' } | { kind: 'revoked' };

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  let res: Response;
  try { res = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: supabaseKey, 'content-type': 'application/json' }, body: JSON.stringify(args), cache: 'no-store', referrerPolicy: 'no-referrer' }); }
  catch { throw new Error('Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin. İşleminiz kaydedilmedi.'); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(MESSAGES[(body as { message?: string }).message ?? ''] ?? 'İşlem tamamlanamadı. Lütfen daha sonra tekrar deneyin.');
  return body as T;
}
const when = (iso: string) => new Date(iso).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Istanbul' });

export function GuardianConsent() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [token, setToken] = useState(''); const [name, setName] = useState(''); const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false); const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => window.location.reload(); // a different token in the same tab must start from a clean state
    window.addEventListener('hashchange', onHash);
    const [t = '', mode] = window.location.hash.slice(1).split('&');
    setToken(t);
    if (!/^[0-9a-f]{64}$/.test(t)) { setView({ kind: 'error', message: MESSAGES.guardian_token_invalid! }); return; }
    if (mode === 'revoke') { setView({ kind: 'revoke' }); return; }
    rpc<Preview>('guardian_request_preview', { p_token: t }).then((preview) => setView({ kind: 'form', preview }), (e: Error) => setView({ kind: 'error', message: e.message }));
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const decide = async (approve: boolean, preview: Preview) => {
    setFormError(null);
    if (name.trim().length < 5) return setFormError(MESSAGES.guardian_name_required!);
    if (approve && !agreed) return setFormError('Onay vermek için kutuyu işaretleyin.');
    setBusy(true);
    try {
      const r = await rpc<{ status: string; revoke_token?: string }>('guardian_decide', { p_token: token, p_approve: approve, p_guardian_full_name: name.trim(), p_policy_version: preview.policy_version });
      setView(approve ? { kind: 'approved', revokeUrl: `${window.location.origin}/veli#${r.revoke_token}&revoke` } : { kind: 'denied' });
    } catch (e) { setFormError((e as Error).message); } finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true); setFormError(null);
    try { await rpc('guardian_revoke', { p_revoke_token: token }); setView({ kind: 'revoked' }); } catch (e) { setFormError((e as Error).message); } finally { setBusy(false); }
  };

  if (view.kind === 'loading') return <p className="muted" aria-live="polite">Yükleniyor…</p>;
  if (view.kind === 'error') return (<><h1>Devam edilemiyor.</h1><div className="notice err" role="alert">{view.message}</div></>);
  if (view.kind === 'approved') return (<><h1>Onayınız alındı.</h1><div className="notice ok">Katılım kesinleşti. Teşekkür ederiz.</div>
    <p className="muted" style={{ marginTop: 24, fontSize: 15 }}>Fikrinizi değiştirirseniz onayı aşağıdaki bağlantıdan geri çekebilirsiniz. Bu bağlantı yalnızca bir kez gösterilir; lütfen saklayın.</p><code className="code">{view.revokeUrl}</code></>);
  if (view.kind === 'denied') return (<><h1>Kararınız kaydedildi.</h1><div className="notice ok">Katılım onaylanmadı ve kayıt iptal edildi.</div></>);
  if (view.kind === 'revoked') return (<><h1>Onay geri çekildi.</h1><div className="notice ok">Kayıt iptal edildi.</div></>);
  if (view.kind === 'revoke') return (<><p className="eyebrow">Veli onayı</p><h1>Onayı geri çekmek istiyor musunuz?</h1><p>Katılımcının bu etkinlikteki kaydı iptal edilir.</p>
    {formError && <div className="notice err" role="alert" style={{ marginTop: 16 }}>{formError}</div>}<p style={{ marginTop: 24 }}><button className="btn" disabled={busy} onClick={revoke}>Onayı geri çek</button></p></>);

  const { preview } = view;
  return (
    <>
      <p className="eyebrow">Veli onayı</p>
      <h1>{preview.participant_first_name} bir etkinliğe katılmak istiyor.</h1>
      <p>18 yaşından küçük katılımcılar için bu etkinlikte velinin onayı gerekiyor. Onay yalnızca bu etkinlik için geçerlidir.</p>
      <div className="step" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 22, padding: 22, marginTop: 24, display: 'grid', gap: 4 }}>
        <h3>{preview.event.title}</h3><span className="muted">{when(preview.event.starts_at)}</span>
        <span className="muted">{[preview.event.city, preview.event.venue].filter(Boolean).join(' · ') || 'Çevrim içi'}</span><span className="muted">Düzenleyen: {preview.event.organizer}</span>
      </div>
      <p className="muted" style={{ fontSize: 14, marginTop: 16 }}>Düzenleyenle paylaşılacak bilgiler: katılımcının adı ve kayıt durumu. Bağlantı {when(preview.expires_at)} tarihine kadar geçerlidir. Onay metni sürümü: {preview.policy_version}</p>
      <form className="form" onSubmit={(e) => { e.preventDefault(); void decide(true, preview); }}>
        <label>Adınız ve soyadınız<input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={5} /></label>
        <label className="check"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span>Bu katılımcının velisi / yasal temsilcisiyim ve etkinliğe katılımına onay veriyorum.</span></label>
        {formError && <div className="notice err" role="alert">{formError}</div>}
        <button className="btn" disabled={busy}>Onaylıyorum</button>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => void decide(false, preview)}>Onaylamıyorum</button>
      </form>
    </>
  );
}
