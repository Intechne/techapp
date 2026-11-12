import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SectionHeader } from '../components/Surface';

let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 2, fontScale: mockFontScale }),
}));

const direction = async () => {
  await render(<SectionHeader title="Yaklaşan etkinlikler" actionLabel="Tümünü gör" onAction={() => {}} />);
  return StyleSheet.flatten(screen.getByTestId('section-header').props.style).flexDirection;
};

describe('SectionHeader (approved D1)', () => {
  beforeEach(() => { mockWidth = 390; mockFontScale = 1; });
  it('keeps title and action on one row on a normal phone', async () => { expect(await direction()).toBe('row'); });
  it('puts the action under the title below 360 dp', async () => { mockWidth = 320; expect(await direction()).toBe('column'); });
  it('puts the action under the title at font scale 1.5 and up', async () => { mockFontScale = 2; expect(await direction()).toBe('column'); });
});
