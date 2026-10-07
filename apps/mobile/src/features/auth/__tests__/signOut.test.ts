import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultPrefs, loadPrefs, savePrefs } from '../../../lib/localPrefs';
import { queryClient } from '../../../lib/queryClient';
import { signOut } from '../authService';

const mockAuthSignOut = jest.fn(async () => ({ error: null as unknown }));
jest.mock('../../../lib/supabase', () => ({ getSupabase: () => ({ auth: { signOut: mockAuthSignOut } }) }));

describe('signOut', () => {
  beforeEach(async () => { await AsyncStorage.clear(); queryClient.clear(); mockAuthSignOut.mockClear(); });

  it('ends the session and drops every cached server response, but keeps device preferences', async () => {
    await savePrefs({ ...defaultPrefs, onboarded: true, educationStage: 'university', interestSlugs: ['robotik'] });
    queryClient.setQueryData(['account-state', 'u1'], { user_id: 'u1' });
    await signOut();
    expect(mockAuthSignOut).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(await loadPrefs()).toEqual({ ...defaultPrefs, onboarded: true, educationStage: 'university', interestSlugs: ['robotik'] });
  });

  it('still clears cached data when the network call fails, without reporting an error for an offline sign-out', async () => {
    mockAuthSignOut.mockResolvedValueOnce({ error: { name: 'AuthRetryableFetchError', message: 'Network request failed', status: 0 } });
    queryClient.setQueryData(['registrations', 'mine', 'u1'], []);
    await expect(signOut()).resolves.toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
