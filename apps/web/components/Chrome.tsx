import Link from 'next/link';
import { SITE } from '@/lib/site';

export function Header() {
  return (
    <header className="wrap nav">
      <Link href="/" className="brand" aria-label="TechApp ana sayfa"><b>T.</b> techapp</Link>
      <nav className="nav-links" aria-label="Site">
        <Link href="/#nasil">Nasıl çalışır</Link><Link href="/#etkinlikler">Etkinlikler</Link><Link href="/#kurumlar">Kurumlar için</Link><Link href="/destek">Destek</Link>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer><div className="wrap foot">
      <div><div className="brand"><b>T.</b> techapp</div><p className="muted" style={{ marginTop: 8 }}>Bir Intechne ürünü.</p></div>
      <nav aria-label="Alt bilgi"><Link href="/gizlilik">Gizlilik</Link><Link href="/kosullar">Kullanım koşulları</Link><Link href="/hesap-silme">Hesap silme</Link><Link href="/destek">Destek</Link></nav>
    </div></footer>
  );
}

const STORES = [['ios', 'App Store'], ['android', 'Google Play'], ['huawei', 'AppGallery']] as const;
/** Real links appear only when the listing exists. Until then an honest "yakında", never a dead link. */
export function StoreBadges() {
  return (
    <div className="stores">{STORES.map(([key, label]) => {
      const href = SITE.stores[key];
      return href ? <a key={key} className="store" href={href} rel="noopener"><small>İndir</small>{label}</a>
        : <span key={key} className="store soon" aria-label={`${label}: yakında`}><small>Yakında</small>{label}</span>;
    })}</div>
  );
}
