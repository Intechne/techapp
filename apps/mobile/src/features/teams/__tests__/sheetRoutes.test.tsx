import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { makeError } from '../../../lib/errors';
import { RecruitmentApplyScreen } from '../RecruitmentApplySheet';
import { TeamJoinRequestScreen } from '../TeamJoinSheet';

const mockApply = jest.fn(); const mockJoin = jest.fn(); const mockToast = jest.fn();
jest.mock('../api', () => ({
  ...jest.requireActual('../api'),
  applyToRecruitment: (...a: unknown[]) => mockApply(...a),
  requestJoin: (...a: unknown[]) => mockJoin(...a),
}));
jest.mock('../../auth/SessionProvider', () => ({ useSession: () => ({ userId: 'u1' }) }));
jest.mock('../../../design-system', () => ({ ...jest.requireActual('../../../design-system'), useToast: () => ({ show: mockToast }) }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const goBack = jest.fn();
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const wrap = (ui: React.ReactElement, qc = client()) => render(<SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={qc}>{ui}</QueryClientProvider></SafeAreaProvider>);
beforeEach(() => { mockApply.mockReset(); mockJoin.mockReset(); mockToast.mockClear(); goBack.mockClear(); });

const applyProps = { navigation: { goBack }, route: { key: 'k', name: 'RecruitmentApply', params: { teamId: 't1', postId: 'p1', title: 'Mekanik ekibine katıl', roleLabel: 'Mekanik lideri' } } } as unknown as React.ComponentProps<typeof RecruitmentApplyScreen>;
describe('Role başvur sheet route', () => {
  it('shows the role as typed and submits the note; success pops the sheet and confirms with a toast', async () => {
    mockApply.mockResolvedValue({ id: 'a1' });
    await wrap(<RecruitmentApplyScreen {...applyProps} />);
    expect(screen.getByText('Role başvur')).toBeTruthy();
    expect(screen.getByText('Mekanik lideri')).toBeTruthy();
    expect(screen.getByText('Mekanik ekibine katıl')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Kısa bir not (isteğe bağlı)'), 'CAD biliyorum');
    await fireEvent.press(screen.getByRole('button', { name: 'Başvuruyu gönder' }));
    await waitFor(() => expect(mockApply).toHaveBeenCalledWith('p1', 'CAD biliyorum'));
    await waitFor(() => expect(goBack).toHaveBeenCalled());
    expect(mockToast).toHaveBeenCalledWith('Başvurun takıma ulaştı.', 'success');
  });
  it('a server refusal stays in the sheet with the app copy and no retry', async () => {
    mockApply.mockRejectedValue(makeError('already_team_member', 409));
    await wrap(<RecruitmentApplyScreen {...applyProps} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Başvuruyu gönder' }));
    expect(await screen.findByText('Zaten bu takımın üyesisin.')).toBeTruthy();
    expect(goBack).not.toHaveBeenCalled();
    expect(screen.queryByText('Tekrar dene')).toBeNull();
  });
  it('success refreshes my applications (the opener shows GÖNDERİLDİ through the query, not a callback)', async () => {
    mockApply.mockResolvedValue({ id: 'a1' });
    const qc = client(); const invalidate = jest.spyOn(qc, 'invalidateQueries');
    await wrap(<RecruitmentApplyScreen {...applyProps} />, qc);
    await fireEvent.press(screen.getByRole('button', { name: 'Başvuruyu gönder' }));
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });
});

const joinProps = { navigation: { goBack }, route: { key: 'k', name: 'TeamJoinRequest', params: { teamId: 't1' } } } as unknown as React.ComponentProps<typeof TeamJoinRequestScreen>;
describe('Katılma isteği sheet route', () => {
  it('sends the note, refreshes the teams queries, pops the sheet and confirms', async () => {
    mockJoin.mockResolvedValue(undefined);
    const qc = client(); const invalidate = jest.spyOn(qc, 'invalidateQueries');
    await wrap(<TeamJoinRequestScreen {...joinProps} />, qc);
    expect(screen.getByText('Katılma isteği')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Kısa bir not (isteğe bağlı)'), 'Merhaba');
    await fireEvent.press(screen.getByRole('button', { name: 'İsteği gönder' }));
    await waitFor(() => expect(mockJoin).toHaveBeenCalledWith('t1', 'Merhaba'));
    await waitFor(() => expect(goBack).toHaveBeenCalled());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['teams'] });
    expect(mockToast).toHaveBeenCalledWith('İsteğin gönderildi.', 'success');
  });
  it('a failure stays in the sheet', async () => {
    mockJoin.mockRejectedValue(makeError('network_unreachable', 0));
    await wrap(<TeamJoinRequestScreen {...joinProps} />);
    await fireEvent.press(screen.getByRole('button', { name: 'İsteği gönder' }));
    expect(await screen.findByText('İsteğin gönderilmedi')).toBeTruthy();
    expect(goBack).not.toHaveBeenCalled();
  });
});
