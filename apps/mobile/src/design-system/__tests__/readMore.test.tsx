import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { READ_MORE_LINES, ReadMoreText, needsReadMore } from '../components/Content';

const lines = (n: number) => ({ nativeEvent: { lines: Array.from({ length: n }, () => ({ text: 'x' })) } });

describe('read more (approved Q12): long description clamps at 8 lines and expands in place', () => {
  it('the decision: only more than 8 lines get the button', () => {
    expect(READ_MORE_LINES).toBe(8);
    expect(needsReadMore(null)).toBe(false);
    expect(needsReadMore(1)).toBe(false);
    expect(needsReadMore(8)).toBe(false);
    expect(needsReadMore(9)).toBe(true);
    expect(needsReadMore(120)).toBe(true);
  });

  it('short text: no button and no clamp', async () => {
    await render(<ReadMoreText>Kısa açıklama.</ReadMoreText>);
    await fireEvent(screen.getByTestId('read-more-measure', { includeHiddenElements: true }), 'textLayout', lines(3));
    expect(screen.queryByText('Devamını oku')).toBeNull();
    expect(screen.getByTestId('read-more-text').props.numberOfLines).toBeUndefined();
  });

  it('exactly 8 lines: still no button', async () => {
    await render(<ReadMoreText>Sekiz satır.</ReadMoreText>);
    await fireEvent(screen.getByTestId('read-more-measure', { includeHiddenElements: true }), 'textLayout', lines(8));
    expect(screen.queryByText('Devamını oku')).toBeNull();
  });

  it('long text: clamped to 8 lines with "Devamını oku"; pressing it shows the full text in place', async () => {
    await render(<ReadMoreText>Uzun açıklama.</ReadMoreText>);
    await fireEvent(screen.getByTestId('read-more-measure', { includeHiddenElements: true }), 'textLayout', lines(40));
    expect(screen.getByTestId('read-more-text').props.numberOfLines).toBe(8);
    await fireEvent.press(screen.getByRole('button', { name: 'Devamını oku' }));
    expect(screen.getByTestId('read-more-text').props.numberOfLines).toBeUndefined();
    expect(screen.queryByText('Devamını oku')).toBeNull();
  });
});
