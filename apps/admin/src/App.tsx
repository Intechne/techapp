import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase, toUiError, type Account } from './lib';
import { Login } from './pages/Login';
import { Events } from './pages/Events';
import { EventForm } from './pages/EventForm';
import { EventDetail } from './pages/EventDetail';
import { CheckIn } from './pages/CheckIn';
import { Opportunities } from './pages/Opportunities';
import { OpportunityForm } from './pages/OpportunityForm';
import { OpportunityDetail } from './pages/OpportunityDetail';
import { Attestations } from './pages/Attestations';
import { PublishQueue } from './pages/PublishQueue';

const DESKTOP_MIN = 1024;

/** Hash router: #/events[/new|/<id>[/edit|/check-in]] · #/opportunities[/new|/<id>[/edit]] · #/attestations · #/queue */
function useRoute() {
  const [hash, setHash] = useState(location.hash.slice(1) || '/events');
  useEffect(() => { const on = () => setHash(location.hash.slice(1) || '/events'); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return hash.split('/').filter(Boolean);
}
function useViewportWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => { const on = () => setW(window.innerWidth); addEventListener('resize', on); return () => removeEventListener('resize', on); }, []);
  return w;
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const route = useRoute(); const width = useViewportWidth();

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Roles come from the server on every sign-in. They only decide what the UI offers; RLS and RPCs decide what works.
  useEffect(() => {
    setAccount(null); setError(null);
    if (!session) return;
    supabase.rpc('my_account_state').then(({ data, error: e }) => { if (e) setError(toUiError(e).message); else setAccount(data as unknown as Account); });
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [section = 'events', id, action] = route;
  const isCheckIn = section === 'events' && !!id && action === 'check-in';

  if (!configured) return <div className="login"><div className="notice err">Panel yapılandırılmamış: VITE_SUPABASE_URL ve VITE_SUPABASE_PUBLISHABLE_KEY gerekli.</div></div>;
  // The panel is a desktop tool. Only door check-in stays available on tablets and phones.
  if (width < DESKTOP_MIN && !isCheckIn) {
    return (
      <div className="desktop-only">
        <div className="brand" style={{ margin: 0 }}><b>T.</b> techapp <span className="muted small">yönetim</span></div>
        <h1>Yönetim paneli masaüstü için tasarlandı.</h1>
        <p className="muted">Etkinlik, başvuru ve doğrulama işlemleri geniş ekranda yapılır. Lütfen bir bilgisayardan, tarayıcı penceresini en az {DESKTOP_MIN} piksel genişlikte açarak gir.</p>
        <div className="notice">Kapıda giriş kontrolü telefon ve tablette de çalışır: masaüstünde etkinliği açıp <b>Giriş kontrolü</b> bağlantısını bu cihaza gönderebilirsin.</div>
      </div>
    );
  }
  if (session === undefined) return null;
  if (!session) return <Login />;
  if (error) return <div className="login"><div className="notice err" role="alert">{error}</div></div>;
  if (!account) return null;

  const hasAccess = account.is_platform_admin || account.organization_roles.length > 0;
  if (!hasAccess) {
    return (
      <div className="login stack">
        <h1>Bu panele erişimin yok.</h1>
        <p className="muted">Panel, etkinlik düzenleyen kurumların ekipleri içindir. Hesabın bir kuruma bağlı değil. Kurum yöneticinden seni eklemesini isteyebilirsin.</p>
        <button className="btn secondary" onClick={() => supabase.auth.signOut()}>Çıkış yap</button>
      </div>
    );
  }

  if (isCheckIn) return <main className="main" style={{ margin: '0 auto' }}><CheckIn eventId={id!} /></main>;

  const page =
    section === 'opportunities' ? (id === 'new' ? <OpportunityForm account={account} /> : id && action === 'edit' ? <OpportunityForm account={account} opportunityId={id} /> : id ? <OpportunityDetail account={account} opportunityId={id} /> : <Opportunities account={account} />)
      : section === 'attestations' ? <Attestations account={account} />
        : section === 'queue' && account.is_platform_admin ? <PublishQueue />
          : id === 'new' ? <EventForm account={account} />
            : id && action === 'edit' ? <EventForm account={account} eventId={id} />
              : id ? <EventDetail account={account} eventId={id} />
                : <Events account={account} />;

  const active = section === 'opportunities' || section === 'attestations' || (section === 'queue' && account.is_platform_admin) ? section : 'events';
  const NavLink = ({ to, name, children }: { to: string; name: string; children: string }) => <a className="navlink" href={to} aria-current={active === name ? 'page' : undefined}>{children}</a>;

  return (
    <div className="shell">
      <nav className="side" aria-label="Ana menü">
        <div className="brand"><b>T.</b> techapp <span className="muted small">yönetim</span></div>
        <NavLink to="#/events" name="events">Etkinlikler</NavLink>
        <NavLink to="#/opportunities" name="opportunities">Fırsatlar &amp; son tarihler</NavLink>
        <NavLink to="#/attestations" name="attestations">Doğrulama talepleri</NavLink>
        {account.is_platform_admin && <><div className="navgroup">INTECHNE</div><NavLink to="#/queue" name="queue">Yayın onayı kuyruğu</NavLink></>}
        <div className="foot small">
          <div className="muted">{session.user.email}</div>
          <div className="muted">{account.is_platform_admin ? 'Intechne yöneticisi' : `${account.organization_roles.length} kurum rolü`}</div>
          <button className="btn secondary" style={{ marginTop: 8 }} onClick={() => supabase.auth.signOut()}>Çıkış yap</button>
        </div>
      </nav>
      <main className="main">{page}</main>
    </div>
  );
}
