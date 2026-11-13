import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import { useUnreadCount } from '../api';

let mockUser: string | null = 'u1'; let mockCount = 2; let fetches = 0;
const mockFilters: [string, unknown[]][] = [];
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }) }));
jest.mock('../../../lib/supabase', () => ({
  getSupabase: () => ({
    from: (t: string) => {
      const b: Record<string, unknown> = {};
      mockFilters.push([`from:${t}`, []]);
      for (const m of ['select', 'eq', 'is']) b[m] = (...a: unknown[]) => { mockFilters.push([m, a]); return b; };
      b.then = (r: (v: unknown) => unknown) => { fetches += 1; return Promise.resolve({ count: mockCount, error: null }).then(r); };
      return b;
    },
  }),
}));
// A focus effect the test can fire by hand: the screen gaining focus again.
const focusCallbacks: (() => void)[] = [];
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb: () => void) => { const R = jest.requireActual('react'); R.useEffect(() => { focusCallbacks.push(cb); cb(); }, [cb]); },
}));

function Probe() { return <Text testID="n">{String(useUnreadCount())}</Text>; }
const mount = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const utils = await render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
  return { client, ...utils };
};
beforeEach(() => { mockUser = 'u1'; mockCount = 2; fetches = 0; mockFilters.length = 0; focusCallbacks.length = 0; });

describe('useUnreadCount', () => {
  it('reads the caller\'s own unread rows as a head count (no row data leaves the server)', async () => {
    await mount();
    await waitFor(() => expect(screen.getByTestId('n').children[0]).toBe('2'));
    expect(mockFilters).toEqual(expect.arrayContaining([['from:notifications', []], ['select', ['id', { count: 'exact', head: true }]], ['eq', ['user_id', 'u1']], ['is', ['read_at', null]]]));
  });

  it('a guest asks nothing and sees 0', async () => {
    mockUser = null;
    await mount();
    expect(screen.getByTestId('n').children[0]).toBe('0');
    expect(fetches).toBe(0);
  });

  it('refreshes when the screen gains focus again, but not twice on first mount', async () => {
    await mount();
    await waitFor(() => expect(fetches).toBe(1));
    mockCount = 7;
    await act(async () => { focusCallbacks.at(-1)!(); });
    await waitFor(() => expect(screen.getByTestId('n').children[0]).toBe('7'));
    expect(fetches).toBe(2);
  });
});
