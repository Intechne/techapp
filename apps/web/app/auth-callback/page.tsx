import type { Metadata } from 'next';
import { Header, StoreBadges } from '@/components/Chrome';
import { OpenInApp } from './OpenInApp';

export const metadata: Metadata = { title: 'Girişi tamamla', robots: { index: false, follow: false }, referrer: 'no-referrer' };

/** Landing spot of the e-mailed sign-in link when it is opened in a browser instead of the app. Tokens stay in the fragment and are only handed to the app. */
export default function AuthCallback() {
  return (<><Header /><main className="page"><p className="eyebrow">Giriş</p><h1>Girişini uygulamada tamamla.</h1>
    <p>Bu bağlantı TechApp uygulaması içindir. Uygulama bu cihazda yüklüyse aşağıdaki düğme seni geri götürür. Değilse e-postadaki 6 haneli kodu uygulamaya yazarak da giriş yapabilirsin.</p>
    <div style={{ display: 'grid', gap: 16, marginTop: 24 }}><OpenInApp /><StoreBadges /></div></main></>);
}
