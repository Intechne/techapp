import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { defaultPrefs, loadPrefs, savePrefs, type LocalPrefs } from '../../lib/localPrefs';

interface Api { prefs: LocalPrefs; ready: boolean; update: (patch: Partial<Omit<LocalPrefs, 'version'>>) => void }
const Ctx = createContext<Api>({ prefs: defaultPrefs, ready: false, update: () => {} });

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [ready, setReady] = useState(false);
  useEffect(() => { loadPrefs().then(setPrefs).finally(() => setReady(true)); }, []);
  // Functional update: never writes a stale snapshot back (the v4 reset bug).
  const update = useCallback((patch: Partial<Omit<LocalPrefs, 'version'>>) => {
    setPrefs((current) => { const next = { ...current, ...patch }; void savePrefs(next); return next; });
  }, []);
  const api = useMemo(() => ({ prefs, ready, update }), [prefs, ready, update]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
export const usePrefs = () => useContext(Ctx);
