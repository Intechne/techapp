'use client';
import { useEffect, useState } from 'react';
import { SITE } from '@/lib/site';

export function OpenInApp() {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    const fragment = window.location.hash;
    setHref(`${SITE.appScheme}auth-callback${fragment}`);
    // Drop the tokens from the address bar and history as soon as they have been captured.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);
  return <a className="btn" href={href ?? '#'} aria-disabled={!href}>Uygulamada aç</a>;
}
