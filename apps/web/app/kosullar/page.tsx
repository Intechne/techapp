import type { Metadata } from 'next';
import { Footer, Header } from '@/components/Chrome';

export const metadata: Metadata = { title: 'Kullanım koşulları', alternates: { canonical: '/kosullar' }, robots: { index: false } };

export default function Page() {
  return (<><Header /><main className="page"><p className="eyebrow">TechApp</p><h1>Kullanım koşulları</h1>
    <div className="notice warn">Kullanım koşulları hazırlanıyor. Metin hukuk onayından sonra bu sayfada sürüm numarası ve yürürlük tarihiyle yayınlanacak.</div>
    
  </main><Footer /></>);
}
