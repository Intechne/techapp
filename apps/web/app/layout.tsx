import type { Metadata, Viewport } from 'next';
import { DM_Sans, Manrope } from 'next/font/google';
import { SITE } from '@/lib/site';
import './globals.css';

const heading = Manrope({ subsets: ['latin', 'latin-ext'], weight: ['700', '800'], variable: '--font-heading', display: 'swap' });
const body = DM_Sans({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  openGraph: { type: 'website', locale: 'tr_TR', siteName: SITE.name, title: `${SITE.name} — ${SITE.tagline}`, description: SITE.description, url: SITE.origin },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: '/' },
};
export const viewport: Viewport = { themeColor: '#F6F7F2', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="tr" className={`${heading.variable} ${body.variable}`}><body>{children}</body></html>;
}
