import React from 'react';
import { AccessibilityInfo, StyleSheet, TextInput } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { ShakeOnError } from '../components/ShakeOnError';
import { Input } from '../components/Form';

jest.mock('../../lib/haptics', () => ({ haptics: { success: jest.fn(), warning: jest.fn(), error: jest.fn(), selection: jest.fn() } }));
const mockError = (jest.requireMock('../../lib/haptics').haptics as { error: jest.Mock }).error;
const reduce = (on: boolean) => jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(on);
const style = () => StyleSheet.flatten(screen.getByTestId('shake').props.style as never) as { transform?: unknown[] };
const Probe = ({ trigger }: { trigger: string | null }) => <ShakeOnError trigger={trigger}><TextInput testID="field" /></ShakeOnError>;

describe('ShakeOnError', () => {
  beforeEach(() => mockError.mockClear());
  afterEach(() => jest.restoreAllMocks());
  it('plays when the error key changes, not on mount and not for the same value', async () => {
    reduce(false);
    const seq = jest.spyOn(Reanimated, 'withSequence');
    const { rerender } = await render(<Probe trigger="Geçerli bir e-posta yaz." />);
    await act(async () => {});
    expect(seq).not.toHaveBeenCalled();
    await rerender(<Probe trigger="Geçerli bir e-posta yaz." />);
    expect(seq).not.toHaveBeenCalled();
    await rerender(<Probe trigger="E-posta boş olamaz." />);
    expect(seq).toHaveBeenCalledTimes(1);
    await rerender(<Probe trigger="E-posta boş olamaz." />);
    expect(seq).toHaveBeenCalledTimes(1);
    expect(mockError).toHaveBeenCalledTimes(1);
  });
  it('clearing the error does not shake', async () => {
    reduce(false);
    const seq = jest.spyOn(Reanimated, 'withSequence');
    const { rerender } = await render(<Probe trigger="x" />);
    await rerender(<Probe trigger={null} />);
    expect(seq).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });
  it('reduced motion: no transform and no shake, the haptic still tells', async () => {
    reduce(true);
    const seq = jest.spyOn(Reanimated, 'withSequence');
    const { rerender } = await render(<Probe trigger={null} />);
    await act(async () => {});
    await rerender(<Probe trigger="Hata" />);
    expect(style().transform).toBeUndefined();
    expect(seq).not.toHaveBeenCalled();
    expect(mockError).toHaveBeenCalledTimes(1);
  });
  it('an Input with an error announces the message in a polite live region, with or without reduced motion', async () => {
    reduce(true);
    await render(<Input label="E-posta" error="Geçerli bir e-posta yaz." />);
    await act(async () => {});
    expect(screen.getByText('Geçerli bir e-posta yaz.').props.accessibilityLiveRegion).toBe('polite');
  });
});
