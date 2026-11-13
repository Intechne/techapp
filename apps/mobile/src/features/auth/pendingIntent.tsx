import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';

/** What the guest was trying to do when auth interrupted them. Resumed after sign-in; pure local UI state. */
export type PendingIntent =
  | { type: 'register_event'; eventId: string }
  | { type: 'apply_opportunity'; opportunityId: string }
  | { type: 'volunteer_event'; eventId: string }
  | { type: 'apply_recruitment'; teamId: string; postId: string }
  | { type: 'bookmark'; targetType: 'event' | 'opportunity' | 'team' | 'course'; targetId: string };

interface Api { set: (intent: PendingIntent) => void; consume: <T extends PendingIntent['type']>(type: T, match?: (intent: Extract<PendingIntent, { type: T }>) => boolean) => Extract<PendingIntent, { type: T }> | null; clear: () => void }
const Ctx = createContext<Api>({ set: () => {}, consume: () => null, clear: () => {} });

export function PendingIntentProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<PendingIntent | null>(null);
  const set = useCallback((intent: PendingIntent) => { ref.current = intent; }, []);
  const clear = useCallback(() => { ref.current = null; }, []);
  /** `match`: several screens may be mounted at once (tabs); one that does not own the intent must leave it for the one that does. */
  const consume = useCallback(<T extends PendingIntent['type']>(type: T, match?: (intent: Extract<PendingIntent, { type: T }>) => boolean) => {
    const current = ref.current;
    if (!current || current.type !== type) return null;
    const typed = current as Extract<PendingIntent, { type: T }>;
    if (match && !match(typed)) return null;
    ref.current = null;
    return typed;
  }, []);
  const api = useMemo(() => ({ set, consume, clear }), [set, consume, clear]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
export const usePendingIntent = () => useContext(Ctx);
