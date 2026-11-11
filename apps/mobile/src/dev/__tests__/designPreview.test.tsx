import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DesignPreviewScreen } from '../DesignPreviewScreen';
import { previewData } from '../fixtures/previewData';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const mount = () => render(<SafeAreaProvider initialMetrics={metrics}><DesignPreviewScreen /></SafeAreaProvider>);

let mockParams: { data?: string; state?: string } | undefined;
const mockSetParams = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ setParams: mockSetParams, canGoBack: () => false, goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

describe('DesignPreviewScreen', () => {
  beforeEach(() => { mockParams = undefined; mockSetParams.mockClear(); });

  it.each(['demo', 'worst'] as const)('renders every card family for the %s data set', async (data) => {
    mockParams = { data };
    await mount();
    // The full title is in the card's spoken label, whatever the visual clamp does.
    const labels = screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel ?? ''));
    for (const p of previewData[data].posters) expect(labels.some((l) => l.startsWith(p.title))).toBe(true);
    for (const r of previewData[data].rows) expect(labels.some((l) => l.startsWith(r.title))).toBe(true);
  });

  it.each(['loading', 'empty', 'filtered', 'error', 'offline'])('renders the %s state', async (state) => {
    mockParams = { data: 'worst', state };
    await mount();
    expect(screen.getByTestId('techapp-design-preview-screen')).toBeTruthy();
  });

  it('falls back to demo data / data state for unknown params and writes switches to the route params', async () => {
    mockParams = { data: 'nonsense', state: 'nonsense' };
    await mount();
    expect(screen.getByText('İyi Bir Gelecek Hackathonu')).toBeTruthy();
    await fireEvent.press(screen.getByText('En kötü durum'));
    expect(mockSetParams).toHaveBeenCalledWith({ data: 'worst' });
  });
});
