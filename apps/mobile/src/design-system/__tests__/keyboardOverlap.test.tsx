import React from 'react';
import { Keyboard, Platform, StyleSheet, Text as RNText, View } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Screen } from '../components/Screen';
import { keyboardOverlap } from '../useKeyboardOverlap';

describe('keyboardOverlap', () => {
  it('is the part of the container below the keyboard top, never negative', () => {
    expect(keyboardOverlap(800, 500)).toBe(300);
    expect(keyboardOverlap(400, 500)).toBe(0);
  });
});

describe('Screen footer on Android', () => {
  const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 24, left: 0, right: 0, bottom: 24 } };
  afterEach(() => jest.restoreAllMocks());
  it('moves above the keyboard on keyboardDidShow and back on hide', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const handlers: Record<string, (e?: unknown) => void> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, h: (e?: unknown) => void) => { handlers[name] = h; return { remove: jest.fn() }; }) as never);
    // Container spans y 24..800 in window coordinates.
    jest.spyOn(View.prototype as never, 'measureInWindow' as never).mockImplementation(((cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 24, 360, 776)) as never);
    await render(<SafeAreaProvider initialMetrics={metrics}><Screen footer={<RNText>Kodu gönder</RNText>}><RNText>x</RNText></Screen></SafeAreaProvider>);
    const footerStyle = () => StyleSheet.flatten(screen.getByText('Kodu gönder').parent!.parent!.props.style);
    expect(footerStyle().marginBottom).toBe(0);
    await act(async () => handlers.keyboardDidShow!({ endCoordinates: { screenY: 500, height: 300 } }));
    expect(footerStyle().marginBottom).toBe(300);
    await act(async () => handlers.keyboardDidHide!());
    expect(footerStyle().marginBottom).toBe(0);
  });
});
