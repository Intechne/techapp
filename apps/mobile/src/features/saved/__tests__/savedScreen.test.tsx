import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SavedScreen } from '../SavedScreen';

let mockUser: string | null = 'u1';
let mockItems: { type: string; id: string; title: string | null; available: boolean }[] = []; let mockFail = false;
const mockRemove = jest.fn(); const mockToast = jest.fn();
jest.mock('../api', () => ({ ...jest.requireActual('../api'), fetchSaved: async () => { if (mockFail) throw { code: 'PT500', message: 'server_error' }; return mockItems; } }));
jest.mock('../useBookmarks', () => ({ ...jest.requireActual('../useBookmarks'), useBookmarkRemoval: () => ({ remove: mockRemove }) }));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: mockUser }) }));
jest.mock('../../../design-system', () => ({ ...jest.requireActual('../../../design-system'), useToast: () => ({ show: mockToast }) }));

const navigate = jest.fn(); const tabNavigate = jest.fn();
const nav = { navigate, goBack: jest.fn(), getParent: () => ({ navigate: tabNavigate }) };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const props = { navigation: nav, route: { key: 'k', name: 'Saved' } } as unknown as React.ComponentProps<typeof SavedScreen>;
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><SavedScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};
const ITEMS = [
  { type: 'event', id: 'e1', title: 'İyi Bir Gelecek Hackathonu', available: true },
  { type: 'opportunity', id: 'o1', title: 'Yaz stajı', available: true },
  { type: 'team', id: 't1', title: 'Orbit Robotik', available: true },
];
beforeEach(() => { mockUser = 'u1'; mockItems = []; mockFail = false; for (const m of [mockRemove, mockToast, navigate, tabNavigate]) m.mockClear(); });

describe('Kaydedilenler', () => {
  it('empty: says what to do, no chips', async () => {
    await open();
    expect(await screen.findByText('Henüz kaydettiğin bir şey yok')).toBeTruthy();
    expect(screen.queryByText('Etkinlik')).toBeNull();
  });

  it('filled: one row per saved item, in the server order', async () => {
    mockItems = ITEMS;
    await open();
    expect(await screen.findByText('İyi Bir Gelecek Hackathonu')).toBeTruthy();
    expect(screen.getByText('Yaz stajı')).toBeTruthy();
    expect(screen.getByText('Orbit Robotik')).toBeTruthy();
  });

  it('type filter: Tümü / Etkinlik / Fırsat / Takım; Eğitim only when a course is saved', async () => {
    mockItems = ITEMS;
    await open();
    await screen.findByText('Yaz stajı');
    for (const c of ['Tümü', 'Etkinlik', 'Fırsat', 'Takım']) expect(screen.getByRole('button', { name: c })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Eğitim' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Fırsat' }));
    expect(screen.queryByText('Orbit Robotik')).toBeNull();
    expect(screen.getByText('Yaz stajı')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fırsat' }).props.accessibilityState.selected).toBe(true);
  });

  it('Eğitim chip appears once a course is saved', async () => {
    mockItems = [...ITEMS, { type: 'course', id: 'c1', title: 'Arduino’ya giriş', available: true }];
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Eğitim' }));
    expect(screen.getByText('Arduino’ya giriş')).toBeTruthy();
    expect(screen.queryByText('Yaz stajı')).toBeNull();
  });

  it('filtered-empty: names the type and offers Tümü', async () => {
    mockItems = [ITEMS[0]!];
    await open();
    await screen.findByText('İyi Bir Gelecek Hackathonu');
    await fireEvent.press(screen.getByRole('button', { name: 'Takım' }));
    expect(screen.getByText('Kayıtlı takım yok')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tümünü göster' }));
    expect(screen.getByText('İyi Bir Gelecek Hackathonu')).toBeTruthy();
  });

  it('unavailable target: dimmed row "Artık yayında değil" + "Listeden çıkar"; tap explains, never navigates', async () => {
    mockItems = [{ type: 'event', id: 'e5', title: null, available: false }];
    await open();
    const note = await screen.findByText('Artık yayında değil');
    expect(note).toBeTruthy();
    await fireEvent.press(note);
    expect(mockToast).toHaveBeenCalledWith('Bu içerik artık yayında değil. İstersen listeden çıkarabilirsin.');
    expect(navigate).not.toHaveBeenCalled(); expect(tabNavigate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Listeden çıkar' }));
    expect(mockRemove).toHaveBeenCalledWith('event', 'e5');
  });

  it('available rows open their own screen', async () => {
    mockItems = ITEMS;
    await open();
    await fireEvent.press(await screen.findByText('İyi Bir Gelecek Hackathonu'));
    expect(navigate).toHaveBeenCalledWith('EventDetail', { eventId: 'e1' });
    await fireEvent.press(screen.getByText('Yaz stajı'));
    expect(tabNavigate).toHaveBeenCalledWith('OpportunitiesTab', { screen: 'OpportunityDetail', params: { opportunityId: 'o1' }, initial: false });
    await fireEvent.press(screen.getByText('Orbit Robotik'));
    expect(tabNavigate).toHaveBeenCalledWith('CommunityTab', { screen: 'TeamDetail', params: { teamId: 't1' }, initial: false });
  });

  it('unsave on a live row removes it from the list', async () => {
    mockItems = [ITEMS[0]!];
    await open();
    const row = await screen.findByText('İyi Bir Gelecek Hackathonu');
    expect(row).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydedildi' }));
    expect(mockRemove).toHaveBeenCalledWith('event', 'e1');
  });

  it('a load error is shown with retry, not an empty list', async () => {
    mockFail = true;
    await open();
    await waitFor(() => expect(screen.getByText('Bir şey ters gitti')).toBeTruthy());
    expect(screen.queryByText('Henüz kaydettiğin bir şey yok')).toBeNull();
  });
});
