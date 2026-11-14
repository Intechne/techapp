import fs from 'fs';
import path from 'path';
import React from 'react';
import { AccessibilityInfo, StyleSheet, Text as RNText, View as RNView } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Reanimated from 'react-native-reanimated';
import { EASE_IN_OUT, EASE_OUT, spring, timing } from '../motion';
import { Skeleton } from '../components/States';
import * as Overlays from '../components/Overlays';
import { ToastProvider, useToast, useToastFooterInset } from '../components/Overlays';
import { Screen } from '../components/Screen';
import { NavigationContext } from '@react-navigation/native';
import { motion } from '../tokens';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const reduce = (on: boolean) => jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(on);
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

describe('motion.ts — the one place durations, springs and curves live', () => {
  it('durations and springs are exactly tokens.motion, every config follows the system reduce-motion setting', () => {
    expect(timing('fast')).toMatchObject({ duration: motion.fast, reduceMotion: Reanimated.ReduceMotion.System });
    expect(timing('standard')).toMatchObject({ duration: motion.standard, reduceMotion: Reanimated.ReduceMotion.System });
    expect(timing('exit')).toMatchObject({ duration: motion.exit, reduceMotion: Reanimated.ReduceMotion.System });
    expect(spring('snappy')).toMatchObject({ ...motion.spring.snappy, reduceMotion: Reanimated.ReduceMotion.System });
    expect(spring('gentle')).toMatchObject({ ...motion.spring.gentle, reduceMotion: Reanimated.ReduceMotion.System });
  });
  it('exports the two curves (no ease-in) and timings use ease-out', () => {
    expect(EASE_OUT).toBeDefined();
    expect(EASE_IN_OUT).toBeDefined();
    expect(EASE_OUT).not.toBe(EASE_IN_OUT);
    expect(timing('fast').easing).toBe(EASE_OUT);
    expect(timing('exit').easing).toBe(EASE_OUT);
  });
});

describe('sources', () => {
  it('States.tsx and Overlays.tsx no longer import Animated from react-native', () => {
    for (const f of ['components/States.tsx', 'components/Overlays.tsx']) {
      const rn = read(f).match(/import\s*\{([^}]*)\}\s*from 'react-native';/);
      expect(rn?.[1] ?? '').not.toMatch(/\bAnimated\b/);
    }
  });
  it('the bottom sheet is gone: sheets are native form-sheet routes', () => {
    expect((Overlays as Record<string, unknown>).BottomSheet).toBeUndefined();
    expect(typeof Overlays.SheetFrame).toBe('function');
  });
});

describe('Skeleton', () => {
  afterEach(() => jest.restoreAllMocks());
  it('pulses on the UI thread when motion is allowed', async () => {
    reduce(false);
    const repeat = jest.spyOn(Reanimated, 'withRepeat');
    await render(<Skeleton />);
    await act(async () => {});
    expect(repeat).toHaveBeenCalled();
  });
  it('reduced motion: opacity stays fixed at 1', async () => {
    reduce(true);
    const { toJSON } = await render(<Skeleton />);
    await act(async () => {});
    const node = toJSON() as unknown as { props: { style: import('react-native').StyleProp<import('react-native').ViewStyle> } };
    expect(StyleSheet.flatten(node.props.style).opacity).toBe(1);
  });
});

describe('Toast', () => {
  afterEach(() => jest.restoreAllMocks());
  const Trigger = () => { const t = useToast(); return <RNText onPress={() => t.show('Kaydedildi', 'success')}>aç</RNText>; };
  const open = async () => {
    await render(<SafeAreaProvider initialMetrics={metrics}><ToastProvider><Trigger /></ToastProvider></SafeAreaProvider>);
    await act(async () => {});
    await fireEvent.press(screen.getByText('aç'));
    return StyleSheet.flatten(screen.getByText('Kaydedildi').parent!.props.style as never) as { transform?: unknown[]; opacity?: number };
  };
  it('slides 8 px up and fades in when motion is allowed', async () => {
    reduce(false);
    const style = await open();
    expect(style.transform).toEqual([{ translateY: expect.any(Number) }]);
  });
  it('reduced motion: opacity only, no translate', async () => {
    reduce(true);
    const style = await open();
    expect(style.transform).toBeUndefined();
    expect(style).toHaveProperty('opacity');
  });
});

describe('Toast never covers a pinned Screen footer', () => {
  afterEach(() => jest.restoreAllMocks());
  const Trigger = () => { const t = useToast(); return <RNText onPress={() => t.show('Kaydedildi', 'success')}>aç</RNText>; };
  const bottomOf = () => (StyleSheet.flatten(screen.getByText('Kaydedildi').parent!.props.style as never) as { bottom: number }).bottom;
  const NAV = 76; // insets.bottom (0) + layout.bottomNavHeight
  it('without a footer the toast sits above the bottom nav as before', async () => {
    reduce(false);
    await render(<SafeAreaProvider initialMetrics={metrics}><ToastProvider><Trigger /></ToastProvider></SafeAreaProvider>);
    await act(async () => {});
    await fireEvent.press(screen.getByText('aç'));
    expect(bottomOf()).toBeGreaterThanOrEqual(NAV);
  });
  it('a Screen with a footer registers its height; the toast rises above it and drops back when the screen goes away', async () => {
    reduce(false);
    const ui = (withScreen: boolean) => (
      <SafeAreaProvider initialMetrics={metrics}><ToastProvider><Trigger />
        {withScreen && <Screen scroll={false} footer={<RNText>Devam</RNText>}><RNText>içerik</RNText></Screen>}
      </ToastProvider></SafeAreaProvider>
    );
    const { rerender } = await render(ui(true));
    await act(async () => {});
    await fireEvent(screen.getByText('Devam'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 200 } } });
    await fireEvent.press(screen.getByText('aç'));
    expect(bottomOf()).toBeGreaterThan(200);
    await rerender(ui(false));
    expect(bottomOf()).toBeLessThan(200);
  });
  it('a footer above a tab bar: the toast clears the footer top as measured in the window, not just its height', async () => {
    reduce(false);
    const proto = (RNView as unknown as { prototype: { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } }).prototype;
    const prev = proto.measureInWindow;
    proto.measureInWindow = (cb) => cb(0, 844 - 76 - 120, 390, 120); // footer 120 tall, sitting 76 above the window bottom
    try {
      await render(<SafeAreaProvider initialMetrics={metrics}><ToastProvider><Trigger /><Screen scroll={false} footer={<RNText>Devam</RNText>}><RNText>içerik</RNText></Screen></ToastProvider></SafeAreaProvider>);
      await act(async () => {});
      await fireEvent(screen.getByText('Devam'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 120 } } });
      await fireEvent.press(screen.getByText('aç'));
      expect(bottomOf()).toBeGreaterThan(196);
    } finally { proto.measureInWindow = prev; }
  });
  it('useToastFooterInset is a no-op outside a provider', () => {
    expect(typeof useToastFooterInset).toBe('function');
  });
});

describe('toast inset follows the focused screen', () => {
  afterEach(() => jest.restoreAllMocks());
  const fakeNav = () => {
    const l: Record<string, (() => void)[]> = {};
    let focused = true;
    const nav = { isFocused: () => focused, addListener: (e: string, f: () => void) => { (l[e] ??= []).push(f); return () => { l[e] = l[e]!.filter((x) => x !== f); }; } };
    return { nav: nav as never, set: (v: boolean) => { focused = v; (l[v ? 'focus' : 'blur'] ?? []).forEach((f) => f()); } };
  };
  const Trigger = () => { const t = useToast(); return <RNText onPress={() => t.show('Kaydedildi', 'success')}>aç</RNText>; };
  const bottomOf = () => (StyleSheet.flatten(screen.getByText('Kaydedildi').parent!.props.style as never) as { bottom: number }).bottom;
  it('a footer on a screen kept underneath does not lift a toast; coming back restores it; the keyboard lift re-measures', async () => {
    reduce(false);
    const A = fakeNav(); const B = fakeNav();
    await render(<SafeAreaProvider initialMetrics={metrics}><ToastProvider><Trigger />
      <NavigationContext.Provider value={A.nav}><Screen scroll={false} footer={<RNText>Devam</RNText>}><RNText>A</RNText></Screen></NavigationContext.Provider>
      <NavigationContext.Provider value={B.nav}><Screen scroll={false}><RNText>B</RNText></Screen></NavigationContext.Provider>
    </ToastProvider></SafeAreaProvider>);
    await act(async () => {});
    await fireEvent(screen.getByText('Devam'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 200 } } });
    await act(async () => { A.set(false); });
    await fireEvent.press(screen.getByText('aç'));
    expect(bottomOf()).toBeLessThan(200); // B (no footer) is on top: nav inset only
    await act(async () => { A.set(true); });
    expect(bottomOf()).toBeGreaterThan(200);
  });
});

describe('skeleton easing', () => {
  it('CardSkeletonFrame pulses with EASE_IN_OUT from motion.ts, not an ad-hoc Easing', () => {
    const src = read('components/cards/CardBase.tsx');
    expect(src).toMatch(/EASE_IN_OUT/);
    expect(src).not.toMatch(/Easing\.inOut\(Easing\.sin\)/);
  });
});
