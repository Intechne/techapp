import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SessionProvider } from '../SessionProvider';

const mockClearCards = jest.fn(async () => {});
jest.mock('../../events/offlineCard', () => ({ clearCards: () => mockClearCards() }));
let mockRestored: unknown = { user: { id: 'u1' } };
let mockAuthCb: (e: string, s: unknown) => void = () => {};
jest.mock('../../../lib/env', () => ({ env: { isConfigured: true } }));
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ auth: { onAuthStateChange: (cb: typeof mockAuthCb) => { mockAuthCb = cb; return { data: { subscription: { unsubscribe: () => {} } } }; } } }) }));
jest.mock('../../../lib/sessionRestore', () => ({
  RESTORE_TIMEOUT_MS: 1, RETRY_RESTORE_TIMEOUT_MS: 1,
  restoreSessionOnLaunch: async () => ({ kind: 'ok', session: mockRestored }),
}));

describe('SessionProvider identity end', () => {
  beforeEach(() => { mockClearCards.mockClear(); mockRestored = { user: { id: 'u1' } }; });
  it('wipes cards once when restore settles signed-out, never when signed-in', async () => {
    mockRestored = null;
    await render(<SessionProvider><></></SessionProvider>);
    await act(async () => {});
    expect(mockClearCards).toHaveBeenCalledTimes(1);
  });
  it('does not wipe when restore settles signed-in', async () => {
    await render(<SessionProvider><></></SessionProvider>);
    await act(async () => {});
    expect(mockClearCards).not.toHaveBeenCalled();
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
