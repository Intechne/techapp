import type { Metadata } from 'next';
import { Footer, Header } from '@/components/Chrome';

export const metadata: Metadata = { title: 'Destek', alternates: { canonical: '/destek' } };

export default function Page() {
  return (<><Header /><main className="page"><p className="eyebrow">TechApp</p><h1>Yardıma mı ihtiyacın var?</h1>
    <div className="notice">Destek kanalımız açılış öncesinde burada duyurulacak. Kurumlar ve etkinlik düzenleyenler için iletişim bilgileri de bu sayfada yer alacak.</div>
    <h2>Sık sorulanlar</h2><div dangerouslySetInnerHTML={{ __html: '<ul><li><b>Giriş kodum gelmedi.</b> Gereksiz (spam) klasörüne bak; bir dakika sonra yeni kod isteyebilirsin.</li><li><b>Velime giden bağlantının süresi doldu.</b> Uygulamada kaydını aç ve “Bağlantıyı yeniden gönder”e dokun. Bağlantılar 72 saat geçerlidir.</li><li><b>Katılım kartım nerede?</b> Profil → Katılımlarım. Kart, kaydın onaylandığında oluşur.</li></ul>' }} />
  </main><Footer /></>);
}
