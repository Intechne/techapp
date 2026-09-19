import type { Metadata } from 'next';
import { Footer, Header } from '@/components/Chrome';

export const metadata: Metadata = { title: 'Gizlilik', alternates: { canonical: '/gizlilik' }, robots: { index: false } };

export default function Page() {
  return (<><Header /><main className="page"><p className="eyebrow">TechApp</p><h1>Gizlilik ve kişisel verilerin korunması</h1>
    <div className="notice warn">Aydınlatma metni ve gizlilik politikası hazırlanıyor. Metin, Intechne’nin hukuk danışmanları tarafından onaylandığında bu sayfada sürüm numarası ve yürürlük tarihiyle yayınlanacak.</div>
    <h2>TechApp bugün nasıl çalışıyor</h2><div dangerouslySetInnerHTML={{ __html: '<ul><li>Göz atmak için hesap gerekmez. Hesap yalnızca e-posta adresinle açılır; şifre tutulmaz.</li><li>Doğum tarihin yalnızca yaşa uygun içerik ve gerekiyorsa veli onayı için kullanılır; profilinde görünmez, kurumlarla paylaşılmaz.</li><li>Bir etkinliğe katıldığında düzenleyen kurum yalnızca adını ve kayıt durumunu görür.</li><li>Bir fırsata başvururken hangi bilgilerinin paylaşılacağını göndermeden önce görürsün.</li><li>Hesabını uygulamanın içinden silebilirsin.</li></ul>' }} />
  </main><Footer /></>);
}
