import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { RowCard, SegmentedControl, Tag, Text } from '..';
import { worstCase } from '../../dev/fixtures/worstCase';

const OS = Platform.OS;
afterEach(() => { Object.defineProperty(Platform, 'OS', { value: OS, configurable: true }); });
const setOS = (os: string) => Object.defineProperty(Platform, 'OS', { value: os, configurable: true });

describe('Text breakStrategy="words"', () => {
  it('on Android: simple line breaking and no hyphenation (names do not split mid-word)', async () => {
    setOS('android');
    await render(<Text breakStrategy="words">Orbit Robotik</Text>);
    const t = screen.getByText('Orbit Robotik');
    expect(t.props.textBreakStrategy).toBe('simple');
    expect(t.props.android_hyphenationFrequency).toBe('none');
  });
  it('is a no-op on iOS and web, and absent by default', async () => {
    setOS('ios');
    await render(<><Text breakStrategy="words">A</Text><Text>B</Text></>);
    expect(screen.getByText('A').props.textBreakStrategy).toBeUndefined();
    setOS('android');
    await render(<Text>Düz metin</Text>);
    expect(screen.getByText('Düz metin').props.textBreakStrategy).toBeUndefined();
  });
  it('card titles, tags and segment labels use it', async () => {
    setOS('android');
    await render(<>
      <RowCard leading={{ kind: 'icon', icon: 'team' }} title={worstCase.names.long} />
      <Tag label="DOĞRULANMIŞ" />
      <SegmentedControl options={['Deneyimler', 'Takımlar'] as const} value="Takımlar" onChange={jest.fn()} />
    </>);
    for (const label of [worstCase.names.long, 'DOĞRULANMIŞ', 'Deneyimler']) expect(screen.getByText(label).props.textBreakStrategy).toBe('simple');
  });
});

describe('SegmentedControl labels', () => {
  it('may wrap to a second line: no line limit, centred, segments grow with their label', async () => {
    await render(<SegmentedControl options={['Deneyimler ve projeler', 'Takımlar']} value="Takımlar" onChange={jest.fn()} />);
    const label = screen.getByText('Deneyimler ve projeler');
    expect(label.props.numberOfLines).toBeUndefined();
    expect((StyleSheet.flatten(label.props.style) as { textAlign?: string }).textAlign).toBe('center');
    const seg = StyleSheet.flatten(screen.getAllByRole('tab')[0]!.props.style) as { minHeight: number; height?: number; minWidth: number };
    expect(seg.height).toBeUndefined();
    expect(seg.minWidth).toBe(0);
  });
});

describe('Tag', () => {
  it('keeps a number with its unit', async () => {
    await render(<Tag label="1 dk" />);
    expect(screen.getByText('1 dk')).toBeTruthy();
  });
});
