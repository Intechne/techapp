import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Footer, Header, StoreBadges } from '@/components/Chrome';
import { TYPE_LABEL, formatDate, formatTime, getEvent, placeLabel } from '@/lib/events';
import { SITE } from '@/lib/site';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEvent((await params).id);
  if (!event) return { title: 'Etkinlik bulunamadı', robots: { index: false } };
  const description = `${formatDate(event.starts_at)} · ${placeLabel(event)} — ${event.summary}`;
  return { title: event.title, description, alternates: { canonical: `/events/${event.id}` }, robots: event.is_demo ? { index: false } : undefined,
    openGraph: { title: event.title, description, url: `/events/${event.id}`, type: 'article' } };
}

/** Share target for techapp.intechne.com.tr/events/<id>. With the app installed this URL opens the app (universal link); otherwise this page. */
export default async function EventPage({ params }: Props) {
  const event = await getEvent((await params).id);
  if (!event) notFound();
  const closed = new Date(event.registration_closes_at) <= new Date();
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Event', name: event.title, description: event.summary, startDate: event.starts_at, endDate: event.ends_at,
    eventAttendanceMode: `https://schema.org/${event.format === 'online' ? 'Online' : event.format === 'hybrid' ? 'Mixed' : 'Offline'}EventAttendanceMode`,
    location: event.format === 'online' ? { '@type': 'VirtualLocation', url: `${SITE.origin}/events/${event.id}` } : { '@type': 'Place', name: event.venue ?? event.city ?? '', address: event.city ?? '' },
    organizer: event.organization ? { '@type': 'Organization', name: event.organization.name } : undefined, isAccessibleForFree: event.fee_minor_units === 0 };
  return (
    <>
      <Header />
      <main className="page">
        {!event.is_demo && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
        <div className={`poster ${event.tone}`} style={{ borderRadius: 26, height: 220, fontSize: 30 }}>
          <small>{(event.organization?.name ?? 'TechApp').toLocaleUpperCase('tr')} / {(TYPE_LABEL[event.type] ?? event.type).toLocaleUpperCase('tr')}</small><span>{event.poster_line ?? event.title}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          <span className="tag">{TYPE_LABEL[event.type] ?? event.type}</span>{closed && <span className="tag neutral">Kayıt kapandı</span>}{event.is_demo && <span className="tag neutral">Örnek içerik</span>}
        </div>
        <h1>{event.title}</h1>
        <p style={{ fontSize: 19 }}>{event.summary}</p>
        <div className="meta">
          <div>{formatDate(event.starts_at)} · {formatTime(event.starts_at)}–{formatTime(event.ends_at)}</div>
          <div>{[placeLabel(event), event.venue].filter(Boolean).join(' · ')}</div>
          <div>{[event.audience_note, event.fee_minor_units === 0 ? 'Ücretsiz' : null].filter(Boolean).join(' · ')}</div>
          {event.organization && <div>Düzenleyen: {event.organization.name}{event.organization.verification === 'verified' ? ' · doğrulanmış kurum' : ''}</div>}
        </div>
        <div className="notice">Kayıt TechApp uygulamasından yapılır: yerin ayrılır, katılım kartın uygulamada oluşur.</div>
        <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
          <a className="btn" href={`${SITE.appScheme}events/${event.id}`}>Uygulamada aç</a>
          <p className="muted" style={{ fontSize: 15 }}>Uygulama yüklü değil mi?</p>
          <StoreBadges />
        </div>
      </main>
      <Footer />
    </>
  );
}
