import type { Metadata } from 'next';
import { Footer, Header } from '@/components/Chrome';
import { PolicyVersions } from '@/components/PolicyVersions';

export const metadata: Metadata = { title: 'Kullanım koşulları', alternates: { canonical: '/kosullar' }, robots: { index: false } };

export default function Page() {
  // The text placeholder stays until the approved text replaces it; the version line appears only for a published version.
  return (<><Header /><main className="page"><p className="eyebrow">TechApp</p><h1>Kullanım koşulları</h1>
    <div className="notice warn">Kullanım koşulları hazırlanıyor. Metin hukuk onayından sonra bu sayfada sürüm numarası ve yürürlük tarihiyle yayınlanacak.</div>
    <PolicyVersions purposes={['terms_of_use']} />
    
  </main><Footer /></>);
}
