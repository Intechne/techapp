import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { makeError } from '../../../lib/errors';
import { ReportSheet, type ReportSubject } from '../ReportSheet';

const mockSubmit = jest.fn();
jest.mock('../api', () => ({ ...jest.requireActual('../api'), submitReport: (...a: unknown[]) => mockSubmit(...a) }));
const mockToast = jest.fn();
jest.mock('../../../design-system', () => ({ ...jest.requireActual('../../../design-system'), useToast: () => ({ show: mockToast }) }));

const subject: ReportSubject = { targetType: 'team_project', targetId: 'p1', label: 'Otonom Kol v2' };
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const onClose = jest.fn(); const onSignIn = jest.fn();
const open = (userId: string | null = 'u1', s: ReportSubject | null = subject) => render(
  <SafeAreaProvider initialMetrics={metrics}><QueryClientProvider client={new QueryClient()}><ReportSheet subject={s} userId={userId} onClose={onClose} onSignIn={onSignIn} /></QueryClientProvider></SafeAreaProvider>);
beforeEach(() => { mockSubmit.mockReset(); mockSubmit.mockResolvedValue(undefined); onClose.mockClear(); onSignIn.mockClear(); mockToast.mockClear(); });

describe('Bildir sheet', () => {
  it('lists the server reasons, names the content as typed, and submits the chosen reason with optional details', async () => {
    await open();
    expect(screen.getByText('Otonom Kol v2')).toBeTruthy();
    for (const l of ['Uygunsuz içerik', 'Yanıltıcı bilgi', 'Spam ya da reklam', 'Güvenlik sorunu', 'Taciz ya da zorbalık', 'Gizlilik ihlali', 'Diğer']) expect(screen.getByRole('radio', { name: new RegExp(l) })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: /Gizlilik ihlali/ }));
    await fireEvent.changeText(screen.getByLabelText(/Eklemek istediğin/), 'Bir çocuğun adı yazılmış.');
    await fireEvent.press(screen.getByRole('button', { name: 'Bildirimi gönder' }));
    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith({ targetType: 'team_project', targetId: 'p1', reason: 'privacy', details: 'Bir çocuğun adı yazılmış.' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('Bildirimin alındı'), 'success');
  });

  it('no reason chosen: the sheet says so and sends nothing (the primary button is never disabled)', async () => {
    await open();
    const send = screen.getByRole('button', { name: 'Bildirimi gönder' });
    expect(send.props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(send);
    expect(screen.getByText('Bir neden seç.')).toBeTruthy();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('a second report on the same content: the honest sentence, and the only action left is closing', async () => {
    mockSubmit.mockRejectedValue(makeError('already_reported', 409));
    await open();
    await fireEvent.press(screen.getByRole('radio', { name: /Spam/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bildirimi gönder' }));
    expect(await screen.findByText(/zaten bildirdin/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bildirimi gönder' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Tamam' }));
    expect(onClose).toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('another failure stays in the sheet with its own copy and the person can try again', async () => {
    mockSubmit.mockRejectedValueOnce(makeError('network_unreachable', 0));
    await open();
    await fireEvent.press(screen.getByRole('radio', { name: /Diğer/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bildirimi gönder' }));
    expect(await screen.findByText(/İnternet bağlantını/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Bildirimi gönder' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('a guest is asked to sign in: no reasons, no form, nothing submitted — and nothing is queued to submit later', async () => {
    await open(null);
    expect(screen.getByText('Bildirmek için giriş yapman gerekiyor.')).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Bildirimi gönder' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Giriş yap' }));
    expect(onSignIn).toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
