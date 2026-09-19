import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Footer, Header } from '@/components/Chrome';
import { EDUCATION_LABEL, KIND_LABEL, TEAM_ROLE_LABEL, formatMonth, formatRange, getPublicCv, safeHost, type PublicCvExperience } from '@/lib/cv';

type Props = { params: Promise<{ token: string }> };
export const dynamic = 'force-dynamic';

/** The link itself is the key, so it is kept out of search engines and out of the Referer header of outgoing clicks. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cv = await getPublicCv((await params).token);
  return { title: cv?.profile.display_name ? `${cv.profile.display_name} · doğrulanmış CV` : 'CV bulunamadı', robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

function Experience({ x }: { x: PublicCvExperience }) {
  const a = x.attestation;
  return (
    <article className={`cv-item${a ? ' verified' : ''}`}>
      <div className="cv-item-head">
        <span className={`tag ${a ? 'moss' : 'neutral'}`}>{a ? `✓ ${a.organization ?? 'Kurum'} doğruladı` : 'Kendi beyanı'}</span>
        <span className="muted cv-when">{formatRange(x.started_on, x.ended_on)}</span>
      </div>
      <h3>{x.title}</h3>
      <p className="cv-sub">{[KIND_LABEL[x.kind] ?? x.kind, x.role, x.organization_name].filter(Boolean).join(' · ')}</p>
      {x.contribution && <p>{x.contribution}</p>}
      {x.link_url && safeHost(x.link_url) && <p><a href={x.link_url} rel="noopener noreferrer nofollow" target="_blank">{safeHost(x.link_url)}</a></p>}
      {a && (
        <div className="cv-proof">
          <b>Doğrulanan:</b> {a.scope ?? 'Kapsam belirtilmemiş'}
          <span className="muted">{[a.source ? `Dayanak: ${a.source}` : null, a.decided_at ? formatMonth(a.decided_at) : null, a.valid_until ? `${formatMonth(a.valid_until)} tarihine kadar geçerli` : null].filter(Boolean).join(' · ')}</span>
        </div>
      )}
    </article>
  );
}

export default async function CvPage({ params }: Props) {
  const cv = await getPublicCv((await params).token);
  if (!cv) notFound();
  const { profile, interests, experiences, participations, volunteering, teams } = cv;
  const verified = experiences.filter((x) => x.attestation); const declared = experiences.filter((x) => !x.attestation);
  const sub = [profile.city, profile.education_stage ? EDUCATION_LABEL[profile.education_stage] : null].filter(Boolean).join(' · ');
  const records = participations.length + volunteering.length;
  return (
    <>
      <Header />
      <main className="page cv">
        <header className="cv-hero">
          <small>TECHAPP · DOĞRULANMIŞ DİJİTAL CV</small>
          <h1>{profile.display_name ?? 'İsimsiz'}</h1>
          {profile.headline && <p className="cv-headline">{profile.headline}</p>}
          {sub && <p className="cv-sub">{sub}</p>}
          <dl className="cv-stats"><div><dt>Doğrulanmış deneyim</dt><dd>{verified.length}</dd></div><div><dt>Giriş kaydıyla katılım</dt><dd>{records}</dd></div><div><dt>Kendi beyanı</dt><dd>{declared.length}</dd></div></dl>
        </header>

        {profile.bio && <p style={{ fontSize: 18, marginTop: 28 }}>{profile.bio}</p>}
        <div className="notice" style={{ marginTop: 24 }}>Bu sayfadaki her kayıt kaynağıyla birlikte gösterilir. <b>Doğrulanmış</b> kayıtlar adı yazan kurumun kendi kayıtlarına dayanır; <b>kendi beyanı</b> kayıtlar yalnızca kişinin ifadesidir. Bir doğrulama iptal edilirse bu sayfaya anında yansır.</div>

        {verified.length > 0 && <section><h2>Kurumların doğruladığı deneyimler</h2>{verified.map((x, i) => <Experience key={i} x={x} />)}</section>}

        {records > 0 && (
          <section><h2>Etkinlik kayıtları</h2><p className="muted" style={{ fontSize: 15 }}>Düzenleyenin kapıdaki giriş kaydına dayanır. Katılımı gösterir; bir beceri ya da başarı ölçümü değildir.</p>
            <ul className="cv-list">
              {participations.map((p, i) => <li key={`p${i}`}><b>{p.title}</b><span className="muted">Katılımcı · {[p.organizer, formatMonth(p.starts_at)].filter(Boolean).join(' · ')}</span></li>)}
              {volunteering.map((v, i) => <li key={`v${i}`}><b>{v.title}</b><span className="muted">Gönüllü{v.duty ? ` · ${v.duty}` : ''} · {[v.organizer, formatMonth(v.starts_at)].filter(Boolean).join(' · ')}</span></li>)}
            </ul></section>
        )}

        {teams.length > 0 && (
          <section><h2>Takımlar ve topluluklar</h2>
            <ul className="cv-list">{teams.map((t, i) => <li key={i}><b>{t.name}</b><span className="muted">{[t.title, TEAM_ROLE_LABEL[t.role], t.since ? `${formatMonth(t.since)} tarihinden beri` : null].filter(Boolean).join(' · ')}</span></li>)}</ul>
            <p className="muted" style={{ fontSize: 14 }}>Üyelik ve rol takımın TechApp kaydından gelir; unvanı takım yönetimi verir.</p></section>
        )}

        {declared.length > 0 && <section><h2>Kendi beyanı deneyimler</h2>{declared.map((x, i) => <Experience key={i} x={x} />)}</section>}

        {(profile.skills.length > 0 || interests.length > 0) && (
          <section><h2>Beceriler ve ilgi alanları</h2>
            <div className="cv-chips">{profile.skills.map((s) => <span key={s} className="tag neutral">{s}</span>)}{interests.map((s) => <span key={`i-${s}`} className="tag">{s}</span>)}</div>
            <p className="muted" style={{ fontSize: 14 }}>Beceriler kişinin kendi beyanıdır; ölçülmüş ya da doğrulanmış değildir.</p></section>
        )}

        {experiences.length + records + teams.length === 0 && <p className="muted" style={{ marginTop: 32 }}>Bu CV’de henüz paylaşılan bir kayıt yok.</p>}
        <p className="muted cv-foot">Bu bağlantı CV sahibi tarafından paylaşıldı ve dilediği an kapatılabilir. Sayfa {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeZone: 'Europe/Istanbul' }).format(new Date())} tarihinde güncel veriden oluşturuldu.</p>
      </main>
      <Footer />
    </>
  );
}
