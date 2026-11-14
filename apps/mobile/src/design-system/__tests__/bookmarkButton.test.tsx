import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { BookmarkButton } from '../components/cards/BookmarkButton';

jest.mock('../../lib/haptics', () => ({ haptics: { success: jest.fn(), warning: jest.fn(), error: jest.fn(), selection: jest.fn() } }));
const mockH = (jest.requireMock('../../lib/haptics').haptics) as Record<'success' | 'warning' | 'error' | 'selection', jest.Mock>;

describe('BookmarkButton motion + haptic', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());
  it('4 rapid presses: 4 selection haptics, each press and release is a spring from the current scale (no reset)', async () => {
    const writes: unknown[] = [];
    // Plain stand-in shared value that records every write; springs become tagged animation objects so a bare number would stand out.
    jest.spyOn(Reanimated, 'useSharedValue').mockImplementation(((init: unknown) => {
      const r = React.useRef({ value: init, get() { return this.value; }, set(v: unknown) { writes.push(v); this.value = v; } });
      return r.current;
    }) as never);
    jest.spyOn(Reanimated, 'withSpring').mockImplementation(((to: number) => ({ spring: to })) as never);
    const onToggle = jest.fn();
    await render(<BookmarkButton saved={false} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: 'Kaydet' });
    for (let i = 0; i < 4; i += 1) { await fireEvent(btn, 'pressIn'); await fireEvent.press(btn); await fireEvent(btn, 'pressOut'); }
    expect(mockH.selection).toHaveBeenCalledTimes(4);
    expect(onToggle).toHaveBeenCalledTimes(4);
    // Each press dips to 0.9 and each release springs back to 1: always a spring from wherever the glyph is, never a reset write.
    expect(writes).toEqual(Array.from({ length: 4 }, () => [{ spring: 0.9 }, { spring: 1 }]).flat());
  });
  it('the final look follows the saved prop, not the number of taps', async () => {
    const { rerender } = await render(<BookmarkButton saved={false} onToggle={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));
    await rerender(<BookmarkButton saved onToggle={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Kaydedildi' }).props.accessibilityState).toMatchObject({ selected: true });
    await rerender(<BookmarkButton saved={false} onToggle={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Kaydet' }).props.accessibilityState).toMatchObject({ selected: false });
  });
  it('reduced motion: no scale write at all, the haptic and onToggle still happen', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const writes: unknown[] = [];
    jest.spyOn(Reanimated, 'useSharedValue').mockImplementation(((init: unknown) => {
      const r = React.useRef({ value: init, get() { return this.value; }, set(v: unknown) { writes.push(v); this.value = v; } });
      return r.current;
    }) as never);
    const onToggle = jest.fn();
    await render(<BookmarkButton saved={false} onToggle={onToggle} />);
    await act(async () => {});
    const btn = screen.getByRole('button', { name: 'Kaydet' });
    await fireEvent(btn, 'pressIn'); await fireEvent.press(btn); await fireEvent(btn, 'pressOut');
    expect(writes).toEqual([]);
    expect(mockH.selection).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
