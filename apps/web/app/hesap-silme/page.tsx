import type { Metadata } from 'next';
import { Footer, Header } from '@/components/Chrome';

export const metadata: Metadata = { title: 'Hesap silme', alternates: { canonical: '/hesap-silme' } };

export default function Page() {
  return (<><Header /><main className="page"><p className="eyebrow">TechApp</p><h1>Hesabını ve verilerini silme</h1>
    <div className="notice">Hesabını istediğin zaman uygulamanın içinden silebilirsin.</div>
    <h2>Uygulamadan</h2><div dangerouslySetInnerHTML={{ __html: '<ol><li>TechApp’i aç ve <b>Profil</b> sekmesine git.</li><li><b>Hesabımı sil</b>’e dokun ve onayla.</li></ol><p>Onayladığında profilin, ilgi alanların, etkinlik kayıtların, başvuruların, yüklediğin dosyalar ve verdiğin izin kayıtları sunucudan silinir. Bu işlem geri alınamaz.</p>' }} /><h2>Uygulamaya erişemiyorsan</h2><div dangerouslySetInnerHTML={{ __html: '<p>Uygulamaya erişimin yoksa silme talebini destek kanalımız üzerinden iletebileceksin. Kanal açıldığında bu sayfada duyurulacak; talepler hesabın e-posta adresi doğrulanarak işlenecek.</p>' }} /><h2>Saklanan kayıtlar</h2><div dangerouslySetInnerHTML={{ __html: '<p>Hangi kayıtların yasal yükümlülükler nedeniyle ne kadar süre saklanacağı, gizlilik metniyle birlikte burada yayınlanacak.</p>' }} />
  </main><Footer /></>);
}
