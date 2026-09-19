import { useState } from 'react';
import { supabase, toUiError } from '../lib';

export function Login() {
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    // shouldCreateUser: false → the panel never creates accounts; staff are invited through organisation membership.
    const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } });
    setBusy(false); if (err) setError(toUiError(err).message); else setSent(true);
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    setBusy(false); if (err) setError(toUiError(err).message);
  };

  return (
    <div className="login stack">
      <div className="brand" style={{ font: '800 22px Manrope, sans-serif' }}><b style={{ color: 'var(--iris)' }}>T.</b> techapp yönetim</div>
      <h1>{sent ? 'Kodunu gir.' : 'Ekip girişi'}</h1>
      <p className="muted">{sent ? `${email} adresine gönderdiğimiz 6 haneli kodu yaz.` : 'Kurum e-postanla giriş yap. Şifre yok; adresine tek kullanımlık bir kod gönderiyoruz.'}</p>
      {!sent ? (
        <form className="stack" onSubmit={send}>
          <label>E-posta<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <button className="btn" disabled={busy}>Kodu gönder</button>
        </form>
      ) : (
        <form className="stack" onSubmit={verify}>
          <label>Doğrulama kodu<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label>
          <button className="btn" disabled={busy || code.length < 6}>Giriş yap</button>
          <button type="button" className="btn secondary" onClick={() => { setSent(false); setCode(''); }}>Farklı e-posta kullan</button>
        </form>
      )}
      {error && <div className="notice err" role="alert">{error}</div>}
    </div>
  );
}
