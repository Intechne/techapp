import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConsentCenterScreen } from '../ConsentCenterScreen';
import { consentAction, consentPurposeLabel, type ConsentRow } from '../labels';

const row = (over: Partial<ConsentRow> = {}): ConsentRow => ({
  id: 'c1', purpose: 'event_participation', policy_version: 'event_participation@2026-09-draft', granted_by: 'self',
  subject_type: 'event_registration', subject_id: 'r1', granted_at: '2026-11-10T09:00:00Z', withdrawn_at: null, ...over,
});
let mockRows: ConsentRow[] = []; let mockFail = false;
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  fetchConsents: async () => { if (mockFail) throw { code: 'PT500', message: 'server_error' }; return mockRows; },
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));
const navigate = jest.fn(); const tabNavigate = jest.fn();
const nav = { navigate, goBack: jest.fn(), getParent: () => ({ navigate: tabNavigate }) };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><ConsentCenterScreen {...({ navigation: nav, route: { key: 'k', name: 'ConsentCenter' } } as unknown as React.ComponentProps<typeof ConsentCenterScreen>)} /></QueryClientProvider></SafeAreaProvider>);
};
beforeEach(() => { mockRows = []; mockFail = false; navigate.mockClear(); tabNavigate.mockClear(); });

describe('consentPurposeLabel', () => {
  it('names the two purposes written today', () => {
    expect(consentPurposeLabel('event_participation')).toBe('Etkinliğe katılım');
    expect(consentPurposeLabel('application_data_sharing')).toBe('Başvuruda bilgi paylaşımı');
  });
  it('an unknown purpose is "Diğer izin" and never gets an invented description', () => {
    expect(consentPurposeLabel('something_new')).toBe('Diğer izin');
    expect(consentPurposeLabel('')).toBe('Diğer izin');
  });
});

describe('consentAction', () => {
  it('an active participation consent is undone by cancelling the registration', () => {
    expect(consentAction(row())).toEqual({ kind: 'cancel_registration', target: 'r1' });
    expect(consentAction(row({ granted_by: 'guardian' }))).toEqual({ kind: 'cancel_registration', target: 'r1' });
  });
  it('an active application consent is undone by withdrawing the application', () => {
    expect(consentAction(row({ purpose: 'application_data_sharing', subject_type: 'application', subject_id: 'a1' }))).toEqual({ kind: 'withdraw_application', target: 'a1' });
  });
  it('withdrawn, unknown or subject-less consents have no action', () => {
    expect(consentAction(row({ withdrawn_at: '2026-11-11T00:00:00Z' }))).toEqual({ kind: 'none' });
    expect(consentAction(row({ subject_type: 'mystery' }))).toEqual({ kind: 'none' });
    expect(consentAction(row({ subject_id: null }))).toEqual({ kind: 'none' });
  });
});

describe('Rıza merkezi', () => {
  it('shows version, who gave it (Sen / Velin) and the date', async () => {
    mockRows = [row(), row({ id: 'c2', granted_by: 'guardian', policy_version: 'event_participation@2026-09-draft', granted_at: '2026-11-11T09:00:00Z', subject_id: 'r2' })];
    await open();
    const cards = await screen.findAllByTestId('consent-card');
    expect(cards).toHaveLength(2);
    const first = within(cards[0]!);
    expect(first.getByText('Etkinliğe katılım')).toBeTruthy();
    expect(first.getByText(/event_participation@2026-09-draft/)).toBeTruthy();
    expect(first.getByText(/Sen/)).toBeTruthy();
    expect(first.getByText(/10 Kasım 2026/)).toBeTruthy();
    expect(within(cards[1]!).getByText(/Velin/)).toBeTruthy();
  });

  it('a withdrawn consent shows its withdrawal date and no action', async () => {
    mockRows = [row({ withdrawn_at: '2026-11-12T10:00:00Z' })];
    await open();
    const card = within(await screen.findByTestId('consent-card'));
    expect(card.getByText('GERİ ÇEKİLDİ')).toBeTruthy();
    expect(card.getByText(/12 Kasım 2026/)).toBeTruthy();
    expect(card.queryByRole('button')).toBeNull();
  });

  it('an active participation consent offers "Kaydı iptal et" → RegistrationStatus', async () => {
    mockRows = [row()];
    await open();
    fireEvent.press(await screen.findByRole('button', { name: 'Kaydı iptal et' }));
    expect(navigate).toHaveBeenCalledWith('RegistrationStatus', { registrationId: 'r1' });
  });

  it('an active application consent offers "Başvuruyu geri çek" → Başvurularım', async () => {
    mockRows = [row({ purpose: 'application_data_sharing', subject_type: 'application', subject_id: 'a1' })];
    await open();
    expect(await screen.findByText('Başvuruda bilgi paylaşımı')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Başvuruyu geri çek' }));
    expect(tabNavigate).toHaveBeenCalledWith('OpportunitiesTab', { screen: 'MyApplications' });
  });

  it('an unknown purpose reads "Diğer izin" with its raw version', async () => {
    mockRows = [row({ purpose: 'mystery', policy_version: 'mystery@v9', subject_type: null, subject_id: null })];
    await open();
    const card = within(await screen.findByTestId('consent-card'));
    expect(card.getByText('Diğer izin')).toBeTruthy();
    expect(card.getByText(/mystery@v9/)).toBeTruthy();
  });

  it('empty and error states', async () => {
    await open();
    expect(await screen.findByText(/Henüz kayıtlı bir iznin yok/)).toBeTruthy();
    mockFail = true;
    await open();
    expect(await screen.findByRole('button', { name: /Tekrar dene/ })).toBeTruthy();
  });

  it('says how consent is undone, without adding a generic revoke', async () => {
    mockRows = [row()];
    await open();
    await screen.findByTestId('consent-card');
    expect(screen.getByText(/Kaydı iptal ettiğinde ya da başvuruyu geri çektiğinde/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(/Tümünü geri çek/)).toBeNull());
  });
});
