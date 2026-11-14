import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { PressableScale } from '../components/PressableScale';
import { motion } from '../tokens';

const reduce = (on: boolean) => jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(on);

describe('PressableScale', () => {
  afterEach(() => jest.restoreAllMocks());

  it('springs to pressScale on press-in and back to 1 on press-out (snappy spring)', async () => {
    reduce(false);
    const spring = jest.spyOn(Reanimated, 'withSpring');
    await render(<PressableScale accessibilityLabel="Katıl"><Text>Katıl</Text></PressableScale>);
    const el = screen.getByLabelText('Katıl');
    await fireEvent(el, 'pressIn');
    expect(spring).toHaveBeenLastCalledWith(motion.pressScale, { ...motion.spring.snappy, reduceMotion: 'system' });
    await fireEvent(el, 'pressOut');
    expect(spring).toHaveBeenLastCalledWith(1, { ...motion.spring.snappy, reduceMotion: 'system' });
  });

  it('honours a custom scaleTo', async () => {
    reduce(false);
    const spring = jest.spyOn(Reanimated, 'withSpring');
    await render(<PressableScale scaleTo={0.9} accessibilityLabel="x"><Text>x</Text></PressableScale>);
    await fireEvent(screen.getByLabelText('x'), 'pressIn');
    expect(spring).toHaveBeenLastCalledWith(0.9, expect.objectContaining(motion.spring.snappy));
  });

  it('reduced motion: no scale animation starts, onPress still fires', async () => {
    reduce(true);
    const spring = jest.spyOn(Reanimated, 'withSpring');
    const onPress = jest.fn();
    await render(<PressableScale accessibilityLabel="Katıl" onPress={onPress}><Text>Katıl</Text></PressableScale>);
    await act(async () => {});
    const el = screen.getByLabelText('Katıl');
    await fireEvent(el, 'pressIn');
    await fireEvent.press(el);
    await fireEvent(el, 'pressOut');
    expect(spring).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled: no scale, no onPress', async () => {
    reduce(false);
    const spring = jest.spyOn(Reanimated, 'withSpring');
    const onPress = jest.fn();
    await render(<PressableScale disabled accessibilityLabel="Katıl" onPress={onPress}><Text>Katıl</Text></PressableScale>);
    const el = screen.getByLabelText('Katıl');
    await fireEvent(el, 'pressIn');
    await fireEvent.press(el);
    expect(spring).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('passes accessibility props through and supports function styles', async () => {
    reduce(false);
    await render(
      <PressableScale accessibilityRole="button" accessibilityLabel="Kaydet" accessibilityState={{ selected: true }} hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
        <Text>Kaydet</Text>
      </PressableScale>,
    );
    const el = screen.getByRole('button', { name: 'Kaydet' });
    expect(el.props.accessibilityState).toMatchObject({ selected: true });
  });

  it('forwards the original press-in/out handlers', async () => {
    reduce(false);
    const onPressIn = jest.fn(); const onPressOut = jest.fn();
    await render(<PressableScale accessibilityLabel="x" onPressIn={onPressIn} onPressOut={onPressOut}><Text>x</Text></PressableScale>);
    const el = screen.getByLabelText('x');
    await fireEvent(el, 'pressIn'); await fireEvent(el, 'pressOut');
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });
});
