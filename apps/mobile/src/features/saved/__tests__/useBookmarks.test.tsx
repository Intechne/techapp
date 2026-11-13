import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { makeError } from '../../../lib/errors';
import { useBookmarks } from '../useBookmarks';

// ---- fakes ---------------------------------------------------------------------------------------------------------
let mockUser: string | null = 'u1';
let mockServer: { id: string; target_type: string; target_id: string; created_at: string }[] = [];
const mockAdd = jest.fn(); const mockRemove = jest.fn();
let mockAddGate: Promise<void> | null = null; let mockAddError: unknown = null;
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  fetchBookmarks: async () => mockServer.map((r) => ({ ...r })),
  addBookmark: async (...a: unknown[]) => {
    mockAdd(...a);
    if (mockAddGate) await mockAddGate;
    if (mockAddError) throw mockAddError;
    mockServer.push({ id: `b${mockServer.length}`, target_type: a[1] as string, target_id: a[2] as string, created_at: '2026-11-13T10:00:00Z' });
  },
  removeBookmark: async (...a: unknown[]) => { mockRemove(...a); mockServer = mockServer.filter((r) => !(r.target_type === a[1] && r.target_id === a[2])); },
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }) }));
const mockIntentSet = jest.fn(); let mockResume: { type: 'bookmark'; targetType: string; targetId: string } | null = null;
jest.mock('../../auth/pendingIntent', () => ({
  usePendingIntent: () => ({
    set: mockIntentSet, clear: jest.fn(),
    // Same contract as the real provider: only an intent the matcher accepts is taken.
    consume: (_t: string, match?: (i: unknown) => boolean) => { if (mockResume && (!match || match(mockResume))) { const v = mockResume; mockResume = null; return v; } return null; },
  }),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, [cb]),
}));
const mockToast = jest.fn();
jest.mock('../../../design-system', () => ({ ...jest.requireActual('../../../design-system'), useToast: () => ({ show: mockToast }) }));

beforeEach(() => {
  mockUser = 'u1'; mockServer = []; mockResume = null; mockAddGate = null; mockAddError = null;
  for (const m of [mockAdd, mockRemove, mockIntentSet, mockNavigate, mockToast]) m.mockClear();
});

const setup = async (type: 'event' | 'opportunity' | 'team' | 'course' = 'event') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = await renderHook(() => useBookmarks(type), { wrapper });
  await waitFor(() => expect(hook.result.current.ready).toBe(true));
  return hook;
};

describe('useBookmarks', () => {
  it('reads only the ids of its own type', async () => {
    mockServer = [
      { id: 'b1', target_type: 'event', target_id: 'e1', created_at: '2026-11-01T00:00:00Z' },
      { id: 'b2', target_type: 'team', target_id: 't1', created_at: '2026-11-01T00:00:00Z' },
    ];
    const { result } = await setup('event');
    expect([...result.current.ids]).toEqual(['e1']);
    expect(result.current.requiresAuth).toBe(false);
  });

  it('guest: toggle sends them to AuthEmail with a bookmark intent and saves nothing', async () => {
    mockUser = null;
    const { result } = await setup('team');
    expect(result.current.requiresAuth).toBe(true);
    await act(async () => { result.current.toggle('t9'); });
    expect(mockIntentSet).toHaveBeenCalledWith({ type: 'bookmark', targetType: 'team', targetId: 't9' });
    expect(mockNavigate).toHaveBeenCalledWith('AuthEmail');
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('coming back signed in completes the interrupted save, once, and only for its own type', async () => {
    mockResume = { type: 'bookmark', targetType: 'event', targetId: 'e7' };
    const other = await setup('opportunity');
    await act(async () => {});
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockResume).not.toBeNull(); // not swallowed by the wrong list
    await other.unmount();
    const { result } = await setup('event');
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('u1', 'event', 'e7'));
    await waitFor(() => expect(result.current.ids.has('e7')).toBe(true));
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it('fills the icon optimistically, before the server answers', async () => {
    const { result } = await setup('event');
    let release!: () => void; mockAddGate = new Promise<void>((r) => { release = r; });
    await act(async () => { result.current.toggle('e1'); });
    // The gate is still closed: nothing has reached the server, yet the icon is already filled.
    await waitFor(() => expect(result.current.ids.has('e1')).toBe(true));
    expect(result.current.pending).toBe(true);
    await act(async () => { release(); });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.ids.has('e1')).toBe(true);
  });

  it('server error: reverts the icon and toasts the COPY sentence for the code', async () => {
    mockAddError = makeError('bookmark_target_not_found', 404);
    const { result } = await setup('event');
    await act(async () => { result.current.toggle('e1'); });
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Kaydetmek istediğin içerik artık yayında değil.', 'danger'));
    expect(result.current.ids.has('e1')).toBe(false);
  });

  it('two quick taps on the same id: one request, one final state', async () => {
    const { result } = await setup('event');
    let release!: () => void; mockAddGate = new Promise<void>((r) => { release = r; });
    await act(async () => { result.current.toggle('e1'); result.current.toggle('e1'); });
    await act(async () => { release(); });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockRemove).not.toHaveBeenCalled();
    expect(result.current.ids.has('e1')).toBe(true);
  });

  it('taps on different ids are independent', async () => {
    const { result } = await setup('event');
    let release!: () => void; mockAddGate = new Promise<void>((r) => { release = r; });
    await act(async () => { result.current.toggle('e1'); result.current.toggle('e2'); });
    await act(async () => { release(); });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(mockAdd).toHaveBeenCalledTimes(2);
    expect([...result.current.ids].sort()).toEqual(['e1', 'e2']);
  });

  it('a saved id toggles off with a delete for the caller only', async () => {
    mockServer = [{ id: 'b1', target_type: 'event', target_id: 'e1', created_at: '2026-11-01T00:00:00Z' }];
    const { result } = await setup('event');
    await act(async () => { result.current.toggle('e1'); });
    await waitFor(() => expect(result.current.ids.has('e1')).toBe(false));
    expect(mockRemove).toHaveBeenCalledWith('u1', 'event', 'e1');
  });

  it('opportunity keeps the follow wording (Son tarihler); other types say Kaydedildi', async () => {
    const opp = await setup('opportunity');
    await act(async () => { opp.result.current.toggle('o1'); });
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Takibe aldın. Son tarihler ekranında göreceksin.'));
    await opp.unmount(); mockToast.mockClear();
    const ev = await setup('event');
    await act(async () => { ev.result.current.toggle('e1'); });
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Kaydedildi. Profil > Kaydedilenler’de bulursun.'));
  });
});
