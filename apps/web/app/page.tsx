import Link from 'next/link';
import { Footer, Header, StoreBadges } from '@/components/Chrome';
import { TYPE_LABEL, formatDate, getUpcomingEvents, placeLabel } from '@/lib/events';

export const revalidate = 300;

const LOOP = [['01', 'Keşfet', 'İlgi alanına göre etkinlik, fırsat ve takım. Göz atmak için hesap gerekmez.'], ['02', 'Katıl', 'Tek dokunuşla kayıt. Yerin ayrılır, katılım kartın cebinde.'], ['03', 'Üret', 'Takımına katıl, görev al, birlikte bir şey ortaya koy.'],
  ['04', 'Görünür kıl', 'Yaptıkların profilinde: kendi beyanın ve kurumların doğruladıkları ayrı ayrı.'], ['05', 'Yeni fırsat', 'Staj, gönüllülük, girişim programı. Neyi paylaştığını her başvuruda görürsün.']] as const;
const WHO = [['Lise öğrencileri', 'Nereden başlayacağını bul: başlangıç atölyeleri, danışmanlı takımlar, yaşına uygun etkinlikler.'], ['Üniversiteliler ve yeni mezunlar', 'Hackathon, topluluk, staj ve girişim programlarıyla deneyimini büyüt, portföyünü kur.'], ['Robotik ve teknoloji takımları', 'Kadro, görevler, açık roller ve yarışma hazırlığı tek yerde.']] as const;
const TRUST = [['Veriniz sizde kalır', 'Bir başvuruda kurumla hangi bilgilerin paylaşılacağını göndermeden önce görürsün. Kurumlar gençlerin profillerini toplu hâlde sorgulayamaz.'], ['18 yaş altı için veli onayı', 'Gerektiğinde veli, etkinliği ve düzenleyeni görerek süreli ve tek kullanımlık bir bağlantıyla onay verir; istediğinde geri çekebilir.'],
  ['Doğrulanmış kurumlar', 'Etkinlikler yayınlanmadan önce incelenir. Düzenleyen kurumun doğrulama durumu her ilanda görünür.'], ['Gerçek katılım, gerçek kayıt', 'Katılım kartındaki kod kişisel bilgi taşımaz; giriş yalnızca yetkili ekip tarafından, sunucuda doğrulanır.']] as const;

export default async function Home() {
  const events = await getUpcomingEvents(3);
  return (
    <>
      <Header />
      <main>
        <div className="wrap hero">
          <div>
            <p className="eyebrow">Intechne ekosistemi</p>
            <h1 style={{ marginTop: 16 }}>Bir fikrin varsa,<br /><em>bir yerin var.</em></h1>
            <p className="lead">Teknoloji, girişimcilik, robotik ve sosyal etki alanlarında etkinlikleri keşfet, takımlara katıl, üret ve yaptıklarını görünür kıl.</p>
            <StoreBadges />
          </div>
          <div className="art" aria-hidden="true"><i className="o1" /><i className="o2" /><i className="o3" /><div className="words">merak.<br />üretim.<br /><span>etki.</span></div></div>
        </div>

        <section id="nasil" className="wrap">
          <p className="eyebrow">Nasıl çalışır</p><h2 style={{ marginTop: 12, maxWidth: '16em' }}>İlgi, deneyime dönüşür.</h2>
          <div className="loop">{LOOP.map(([n, t, d]) => <div key={n} className="step"><span className="n">{n}</span><h3>{t}</h3><p className="muted" style={{ fontSize: 15 }}>{d}</p></div>)}</div>
        </section>

        {events.length > 0 && (
          <section id="etkinlikler" className="wrap">
            <p className="eyebrow">Yaklaşan etkinlikler</p><h2 style={{ marginTop: 12 }}>Bir araya gel. Yeni bir şey başlat.</h2>
            <div className="grid3">{events.map((e) => (
              <Link key={e.id} href={`/events/${e.id}`} className="card">
                <div className={`poster ${e.tone}`}><small>{(e.organization?.name ?? 'TechApp').toLocaleUpperCase('tr')} / {(TYPE_LABEL[e.type] ?? e.type).toLocaleUpperCase('tr')}</small><span>{e.poster_line ?? e.title}</span></div>
                <div className="card-body"><span className="tag">{TYPE_LABEL[e.type] ?? e.type}</span><h3>{e.title}</h3><p className="muted" style={{ fontSize: 15 }}>{formatDate(e.starts_at)} · {placeLabel(e)}</p></div>
              </Link>))}</div>
          </section>
        )}

        <section className="wrap">
          <p className="eyebrow">Kimler için</p><h2 style={{ marginTop: 12 }}>Başlangıç noktan farklı olabilir.</h2>
          <div className="grid3">{WHO.map(([t, d]) => <div key={t} className="step"><h3>{t}</h3><p className="muted" style={{ fontSize: 15 }}>{d}</p></div>)}</div>
        </section>

        <section className="wrap">
          <p className="eyebrow">Güven</p><h2 style={{ marginTop: 12, maxWidth: '18em' }}>Genç ve sade görünür. Arka tarafta ciddi çalışır.</h2>
          <div className="trust">{TRUST.map(([t, d]) => <div key={t} className="step"><h3>{t}</h3><p className="muted" style={{ fontSize: 15 }}>{d}</p></div>)}</div>
        </section>

        <section id="kurumlar" className="wrap"><div className="dark">
          <p className="eyebrow" style={{ color: '#C9D9B8' }}>Kurumlar ve organizatörler için</p>
          <h2 style={{ marginTop: 12, maxWidth: '16em' }}>Etkinliğini doğru gençlerle buluştur.</h2>
          <p style={{ marginTop: 16, maxWidth: '38em' }}>Yönetim panelinden etkinliğini hazırla, incelemeye gönder, kayıtları ve bekleme listesini takip et, kapıda QR ile giriş kontrolü yap. Katılımcıların yalnızca ihtiyacın olan bilgisini görürsün.</p>
          <div style={{ marginTop: 28 }}><Link className="btn lime" href="/destek">Bizimle iletişime geç</Link></div>
        </div></section>
      </main>
      <Footer />
    </>
  );
}
