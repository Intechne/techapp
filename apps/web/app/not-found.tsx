import Link from 'next/link';
import { Footer, Header } from '@/components/Chrome';

export default function NotFound() {
  return (<><Header /><main className="page"><p className="eyebrow">404</p><h1>Burada bir şey yok.</h1><p>Aradığın sayfa taşınmış ya da yayından kalkmış olabilir.</p><p style={{ marginTop: 24 }}><Link className="btn" href="/">Ana sayfaya dön</Link></p></main><Footer /></>);
}
