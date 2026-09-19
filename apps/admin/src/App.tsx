import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase, toUiError, type Account } from './lib';
import { Login } from './pages/Login';
import { Events } from './pages/Events';
import { EventForm } from './pages/EventForm';
import { EventDetail } from './pages/EventDetail';
import { CheckIn } from './pages/CheckIn';

/** Tiny hash router: #/events, #/events/new, #/events/<id>, #/events/<id>/edit, #/events/<id>/check-in */
function useRoute() {
  const [hash, setHash] = useState(location.hash.slice(1) || '/events');
  useEffect(() => { const on = () => setHash(location.hash.slice(1) || '/events'); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return hash.split('/').filter(Boolean);
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const route = useRoute();

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

  if (!configured) return <div className="login"><div className="notice err">Panel yapılandırılmamış: VITE_SUPABASE_URL ve VITE_SUPABASE_PUBLISHABLE_KEY gerekli.</div></div>;
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

  const [section, id, action] = route;
  const page = section !== 'events' ? <Events account={account} />
    : id === 'new' ? <EventForm account={account} />
      : id && action === 'edit' ? <EventForm account={account} eventId={id} />
        : id && action === 'check-in' ? <CheckIn eventId={id} />
          : id ? <EventDetail account={account} eventId={id} />
            : <Events account={account} />;

  return (
    <div className="shell">
      <nav className="side" aria-label="Ana menü">
        <div className="brand"><b>T.</b> techapp <span className="muted small">yönetim</span></div>
        <a href="#/events" className="active">Etkinlikler</a>
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
