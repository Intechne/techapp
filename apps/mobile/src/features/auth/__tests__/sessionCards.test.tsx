import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SessionProvider, useSession } from '../SessionProvider';

const mockClearCards = jest.fn(async () => {});
const mockKeepOnly = jest.fn(async (_userId: string) => {});
jest.mock('../../events/offlineCard', () => ({ clearCards: () => mockClearCards(), keepOnlyCardsOf: (u: string) => mockKeepOnly(u) }));
let mockRestored: unknown = { user: { id: 'u1' } };
let mockAuthCb: (e: string, s: unknown) => void = () => {};
jest.mock('../../../lib/env', () => ({ env: { isConfigured: true } }));
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ auth: { onAuthStateChange: (cb: typeof mockAuthCb) => { mockAuthCb = cb; return { data: { subscription: { unsubscribe: () => {} } } }; } } }) }));
let mockOutcomes: unknown[] = [];
jest.mock('../../../lib/sessionRestore', () => ({
  RESTORE_TIMEOUT_MS: 1, RETRY_RESTORE_TIMEOUT_MS: 1,
  restoreSessionOnLaunch: async () => mockOutcomes.shift() ?? ({ kind: 'ok', session: mockRestored }),
}));
let mockCtx: { retry: () => void; status: string; userId: string | null } | null = null;
const Probe = () => { const ctx = useSession(); React.useEffect(() => { mockCtx = ctx; }); return null; };

describe('SessionProvider identity end', () => {
  beforeEach(() => { mockClearCards.mockClear(); mockKeepOnly.mockClear(); mockOutcomes = []; mockRestored = { user: { id: 'u1' } }; });
  it('wipes cards once when restore settles signed-out, never when signed-in', async () => {
    mockRestored = null;
    await render(<SessionProvider><></></SessionProvider>);
    await act(async () => {});
    expect(mockClearCards).toHaveBeenCalledTimes(1);
  });
  it('does not wipe when restore settles signed-in, but keeps only that user’s cards', async () => {
    await render(<SessionProvider><></></SessionProvider>);
    await act(async () => {});
    expect(mockClearCards).not.toHaveBeenCalled();
    expect(mockKeepOnly).toHaveBeenCalledWith('u1');
  });
  it('after the offline startup screen: a retry that settles signed-out wipes, one that settles as another user prunes', async () => {
    mockOutcomes = [{ kind: 'unavailable', reason: 'offline' }, { kind: 'ok', session: null }];
    await render(<SessionProvider><Probe /></SessionProvider>);
    await act(async () => {});
    expect(mockCtx?.status).toBe('unavailable');
    expect(mockClearCards).not.toHaveBeenCalled(); // unavailable keeps the saved cards for the offline screen
    await act(async () => { mockCtx?.retry(); });
    await act(async () => {});
    expect(mockCtx?.status).toBe('ready');
    expect(mockClearCards).toHaveBeenCalledTimes(1);

    mockOutcomes = [{ kind: 'unavailable', reason: 'offline' }, { kind: 'ok', session: { user: { id: 'u2' } } }];
    await render(<SessionProvider><Probe /></SessionProvider>);
    await act(async () => {});
    await act(async () => { mockCtx?.retry(); });
    await act(async () => {});
    expect(mockCtx?.userId).toBe('u2');
    expect(mockKeepOnly).toHaveBeenCalledWith('u2');
  });
  it('wipes offline participation cards when the signed-in identity ends, and survives a failing wipe', async () => {
    await render(<SessionProvider><></></SessionProvider>);
    await act(async () => {});
    expect(mockClearCards).not.toHaveBeenCalled();
    mockClearCards.mockRejectedValueOnce(new Error('keystore'));
    await act(async () => { mockAuthCb('SIGNED_OUT', null); });
    expect(mockClearCards).toHaveBeenCalledTimes(1);
  });
});
