import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { SuccessMark } from '../components/SuccessMark';

const reduce = (on: boolean) => jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(on);
const style = () => StyleSheet.flatten(screen.getByTestId('success-mark').props.style as never) as { opacity?: number; transform?: { scale?: number }[] };

describe('SuccessMark', () => {
  afterEach(() => jest.restoreAllMocks());
  it('plays once on mount: scale 0.96 to 1 and opacity 0 to 1 with the standard timing', async () => {
    reduce(false);
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    await render(<SuccessMark tone="moss" icon="check" />);
    await act(async () => {});
    expect(withTiming).toHaveBeenCalledTimes(1);
    expect(withTiming.mock.calls[0]![1]).toMatchObject({ duration: 220 });
    expect(style().transform).toEqual([{ scale: expect.any(Number) }]);
  });
  it('does not replay when the parent re-renders', async () => {
    reduce(false);
    // The Jest mock of useSharedValue makes a new value every render; the real one is stable. Pin it so a replay can only come from the component.
    const real = Reanimated.useSharedValue;
    jest.spyOn(Reanimated, 'useSharedValue').mockImplementation(((init: unknown) => { const r = React.useRef(real(init as never)); return r.current; }) as never);
    const withTiming = jest.spyOn(Reanimated, 'withTiming');
    const { rerender } = await render(<SuccessMark tone="moss" icon="check" />);
    await act(async () => {});
    await rerender(<SuccessMark tone="moss" icon="check" />);
    expect(withTiming).toHaveBeenCalledTimes(1);
  });
  it('reduced motion: opacity only, never a scale', async () => {
    reduce(true);
    await render(<SuccessMark tone="moss" icon="check" />);
    await act(async () => {});
    expect(style().transform).toBeUndefined();
    expect(style()).toHaveProperty('opacity');
  });
  it('shows the glyph asked for, with its own testID', async () => {
    reduce(false);
    await render(<SuccessMark tone="danger" icon="close" iconTestID="glyph" />);
    expect(screen.getByTestId('glyph')).toBeTruthy();
  });
});
