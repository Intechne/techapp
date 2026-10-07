import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StartupUnavailableScreen } from '../StartupUnavailableScreen';
import { AppErrorBoundary } from '../../../app/AppErrorBoundary';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (ui: React.ReactElement) => <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>;

describe('StartupUnavailableScreen', () => {
  it('shows plain copy without debug details and retries on tap', async () => {
    const onRetry = jest.fn();
    await render(wrap(<StartupUnavailableScreen reason="unreachable" onRetry={onRetry} />));
    expect(screen.getByText("TechApp'e şu anda bağlanamıyoruz.")).toBeTruthy();
    expect(screen.getByText('İnternet bağlantını kontrol edip tekrar deneyebilirsin.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tekrar Dene' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('distinguishes an offline device and a server outage', async () => {
    await render(wrap(<StartupUnavailableScreen reason="offline" onRetry={() => {}} />));
    expect(screen.getByText('İnternet bağlantın yok gibi görünüyor.')).toBeTruthy();
    await render(wrap(<StartupUnavailableScreen reason="server_error" onRetry={() => {}} />));
    expect(screen.getByText('Bizim tarafta geçici bir sorun var. Birazdan tekrar deneyebilirsin.')).toBeTruthy();
  });
});

describe('AppErrorBoundary', () => {
  it('replaces a crashed tree with a recoverable screen and no debug text', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => { throw new Error('boom-internal-detail'); };
    await render(<AppErrorBoundary><Boom /></AppErrorBoundary>);
    expect(screen.getByText('Bir şeyler ters gitti.')).toBeTruthy();
    expect(screen.queryByText(/boom-internal-detail/)).toBeNull();
    spy.mockRestore();
  });
});
