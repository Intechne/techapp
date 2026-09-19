import { useCallback, useEffect, useRef, useState } from 'react';
import { fmt, supabase, toUiError } from '../lib';

type Outcome = { kind: 'ok' | 'repeat' | 'error'; title: string; detail: string };
interface Detector { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> }
declare global { interface Window { BarcodeDetector?: new (o: { formats: string[] }) => Detector } }

/**
 * Web check-in. Input: camera (BarcodeDetector where the browser has it), a USB/Bluetooth scanner (types into the field + Enter) or paste.
 * The token is opaque; validity, event match, status and the operator's permission are all decided by check_in_participant() on the server.
 */
export function CheckIn({ eventId }: { eventId: string }) {
  const [title, setTitle] = useState(''); const [code, setCode] = useState(''); const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null); const [camera, setCamera] = useState(false); const [count, setCount] = useState(0);
  const video = useRef<HTMLVideoElement>(null); const input = useRef<HTMLInputElement>(null); const lastScan = useRef({ token: '', at: 0 }); const busyRef = useRef(false);

  useEffect(() => { supabase.from('events').select('title').eq('id', eventId).maybeSingle().then(({ data }) => setTitle(data?.title ?? '')); }, [eventId]);

  const submit = useCallback(async (raw: string) => {
    const token = raw.trim(); if (!token || busyRef.current) return;
    busyRef.current = true; setBusy(true);
    const { data, error } = await supabase.rpc('check_in_participant', { p_token: token, p_expected_event_id: eventId });
    busyRef.current = false; setBusy(false); setCode(''); input.current?.focus();
    if (error) { const e = toUiError(error); setOutcome({ kind: 'error', title: e.code === 'network' ? 'Bağlantı yok — giriş KAYDEDİLMEDİ' : 'Giriş onaylanmadı', detail: e.message }); return; }
    const r = data as { result: string; holder_name: string | null; checked_in_at: string };
    if (r.result === 'checked_in') { setCount((c) => c + 1); setOutcome({ kind: 'ok', title: r.holder_name ?? 'Katılımcı', detail: 'Giriş onaylandı.' }); }
    else setOutcome({ kind: 'repeat', title: r.holder_name ?? 'Katılımcı', detail: `Bu kart daha önce okutuldu: ${fmt(r.checked_in_at)}. İkinci giriş kaydedilmedi.` });
  }, [eventId]);

  useEffect(() => {
    if (!camera || !window.BarcodeDetector) return;
    let stream: MediaStream | null = null; let timer = 0; let stopped = false;
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((s) => {
      if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s; if (video.current) { video.current.srcObject = s; void video.current.play(); }
      timer = window.setInterval(async () => {
        if (!video.current || busyRef.current) return;
        const found = await detector.detect(video.current).catch(() => []);
        const token = found[0]?.rawValue; const now = Date.now();
        if (token && (token !== lastScan.current.token || now - lastScan.current.at > 4000)) { lastScan.current = { token, at: now }; void submit(token); }
      }, 400);
    }).catch(() => { setCamera(false); setOutcome({ kind: 'error', title: 'Kamera açılamadı', detail: 'Tarayıcı izinlerini kontrol et ya da kodu elle gir.' }); });
    return () => { stopped = true; clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [camera, submit]);

  const tone = outcome?.kind === 'ok' ? { background: 'var(--moss-soft)', color: 'var(--moss)' } : outcome?.kind === 'repeat' ? { background: 'var(--apricot)', color: 'var(--apricot-ink)' } : { background: 'var(--danger-soft)', color: 'var(--danger)' };
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <a href={`#/events/${eventId}`}>← {title || 'Etkinlik'}</a>
      <div className="row between"><h1>Giriş kontrolü</h1><span className="tag moss">Bu oturumda {count} giriş</span></div>
      <div className="result" style={outcome ? tone : { background: 'var(--surface)', border: '1px dashed var(--line)' }} role="status" aria-live="assertive">
        {outcome ? <><h2>{outcome.title}</h2><p style={{ margin: '8px 0 0' }}>{outcome.detail}</p></> : <p className="muted" style={{ margin: 0 }}>Katılım kartındaki QR kodu okut ya da kodu aşağıya gir.</p>}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void submit(code); }}>
        <input ref={input} autoFocus style={{ flex: 1 }} placeholder="TA1.… (okuyucu ya da yapıştır)" aria-label="Katılım kodu" autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn" disabled={busy || !code.trim()}>Doğrula</button>
      </form>
      {window.BarcodeDetector
        ? <><button className="btn secondary" onClick={() => setCamera((c) => !c)}>{camera ? 'Kamerayı kapat' : 'Kamerayla okut'}</button>{camera && <video ref={video} muted playsInline />}</>
        : <p className="muted small">Bu tarayıcı kamerayla QR okumayı desteklemiyor. USB/Bluetooth okuyucu kullanabilir ya da mobil uygulamadaki Giriş kontrolü ekranından okutabilirsin.</p>}
    </div>
  );
}
