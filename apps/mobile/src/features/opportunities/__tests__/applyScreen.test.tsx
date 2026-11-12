import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OpportunityApplyScreen } from '../OpportunityApplyScreen';

const opp = (over: Record<string, unknown> = {}) => ({
  id: 'o1', title: 'Yaz stajı', min_age: null, max_age: null, guardian_required_under: 18, closes_at: '2027-01-01T00:00:00Z', ...over,
});
let mockOpportunity = opp();
let mockMinor: boolean | null = false;
const mockSubmit = jest.fn(async () => 'a1');
jest.mock('expo-crypto', () => ({ randomUUID: () => 'key-1' }));
jest.mock('../../../design-system', () => ({ ...jest.requireActual('../../../design-system'), useToast: () => ({ show: jest.fn() }) }));
jest.mock('../../../lib/analytics', () => ({ track: jest.fn() }));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }), useAccountState: () => ({ data: { is_minor: mockMinor } }) }));
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  fetchOpportunity: async () => mockOpportunity,
  fetchSharePreview: async () => ({ organization: 'Intechne', shared_fields: ['display_name'], snapshot: { display_name: 'Ayşe Kaya' } }),
  submitApplication: (...a: unknown[]) => (mockSubmit as unknown as (...x: unknown[]) => unknown)(...a),
}));

const navigation = { goBack: jest.fn(), replace: jest.fn(), navigate: jest.fn() };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } } });
  const props = { navigation, route: { key: 'k', name: 'OpportunityApply', params: { opportunityId: 'o1' } } } as unknown as React.ComponentProps<typeof OpportunityApplyScreen>;
  await render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={client}><OpportunityApplyScreen {...props} /></QueryClientProvider></SafeAreaProvider>);
};
beforeEach(() => { mockOpportunity = opp(); mockMinor = false; mockSubmit.mockClear(); });

describe('Başvuru ekranı', () => {
  it('eligible: the shared fields, the consent checkbox and the submit button are all there; submitting without consent shows the error and sends nothing', async () => {
    await open();
    expect(await screen.findByText('Intechne şunları görecek')).toBeTruthy();
    expect(screen.getByText('Ayşe Kaya')).toBeTruthy();
    expect(screen.getByRole('checkbox')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Başvuruyu gönder' }));
    expect(screen.getByText('Devam etmek için bu kutuyu işaretlemen gerekiyor.')).toBeTruthy();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('eligible + consent: submits once with the shared fields', async () => {
    await open();
    await fireEvent.press(await screen.findByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Başvuruyu gönder' }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith('o1', 'key-1', '', ['display_name']));
    expect(mockSubmit).toHaveBeenCalledTimes(1);
  });

  it('age-ineligible: the reason only — no checkbox, no shared-field list, no motivation field, no submit', async () => {
    mockOpportunity = opp({ min_age: 18 }); mockMinor = true;
    await open();
    expect(await screen.findByText('Bu fırsata başvuramıyorsun')).toBeTruthy();
    expect(screen.getByText('Bu fırsata şimdilik yalnızca 18 yaş ve üzeri başvurabiliyor.')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('Intechne şunları görecek')).toBeNull();
    expect(screen.queryByText('Ayşe Kaya')).toBeNull();
    expect(screen.queryByText(/Neden başvuruyorsun/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Başvuruyu gönder' })).toBeNull();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
