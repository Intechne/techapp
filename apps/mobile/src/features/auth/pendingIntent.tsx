import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';

/** What the guest was trying to do when auth interrupted them. Resumed after sign-in; pure local UI state. */
export type PendingIntent =
  | { type: 'register_event'; eventId: string }
  | { type: 'bookmark'; targetType: 'event' | 'opportunity'; targetId: string };

interface Api { set: (intent: PendingIntent) => void; consume: <T extends PendingIntent['type']>(type: T) => Extract<PendingIntent, { type: T }> | null; clear: () => void }
const Ctx = createContext<Api>({ set: () => {}, consume: () => null, clear: () => {} });

export function PendingIntentProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<PendingIntent | null>(null);
  const set = useCallback((intent: PendingIntent) => { ref.current = intent; }, []);
  const clear = useCallback(() => { ref.current = null; }, []);
  const consume = useCallback(<T extends PendingIntent['type']>(type: T) => {
    const current = ref.current;
    if (!current || current.type !== type) return null;
    ref.current = null;
    return current as Extract<PendingIntent, { type: T }>;
  }, []);
  const api = useMemo(() => ({ set, consume, clear }), [set, consume, clear]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
export const usePendingIntent = () => useContext(Ctx);
