import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { LARGE_TEXT_FONT_SCALE, SegmentedControl, segmentsShouldStack } from '..';

let mockWidth = 390;
let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 844, scale: 2, fontScale: mockFontScale }),
}));

const PROFILE = ['Deneyimler', 'Katılımlar', 'Takımlar'] as const;
const COMMUNITY = ['Takımlar', 'Topluluklar'] as const;
const WORKSPACE = ['Görevler', 'Üyeler'] as const;
const WORKSPACE_MANAGER = ['Görevler', 'Üyeler', 'İstekler'] as const;
const DEADLINES = ['Tüm son tarihler', 'Takip ettiklerim'] as const;

describe('segmentsShouldStack', () => {
  it('shares one large-text threshold', () => {
    expect(LARGE_TEXT_FONT_SCALE).toBe(1.5);
  });

  it('never stacks below the threshold', () => {
    for (const o of [PROFILE, COMMUNITY, WORKSPACE, DEADLINES]) expect(segmentsShouldStack(o, 390, 1.4)).toBe(false);
    expect(segmentsShouldStack(PROFILE, 320, 1)).toBe(false);
  });

  it('Profil segments (three long words) stack at 1.5 and 2.0 on 390 dp', () => {
    expect(segmentsShouldStack(PROFILE, 390, 1.5)).toBe(true);
    expect(segmentsShouldStack(PROFILE, 390, 2)).toBe(true);
  });

  it('two short labels stay side by side at 1.5 on 390 dp (Topluluk, workspace, Son tarihler)', () => {
    expect(segmentsShouldStack(COMMUNITY, 390, 1.5)).toBe(false);
    expect(segmentsShouldStack(WORKSPACE, 390, 1.5)).toBe(false);
    expect(segmentsShouldStack(WORKSPACE_MANAGER, 390, 1.5)).toBe(false);
    expect(segmentsShouldStack(DEADLINES, 390, 1.5)).toBe(false);
  });

  it('a narrow window stacks even two labels, a tablet stacks nothing', () => {
    expect(segmentsShouldStack(COMMUNITY, 320, 1.5)).toBe(true);
    expect(segmentsShouldStack(PROFILE, 768, 2)).toBe(false);
  });
});

describe('SegmentedControl layout', () => {
  const dir = () => StyleSheet.flatten(screen.getByTestId('segmented').props.style).flexDirection;
  beforeEach(() => { mockWidth = 390; mockFontScale = 1; });

  it('renders the stacked column only when the rule says so', async () => {
    mockFontScale = 1.5;
    await render(<SegmentedControl options={COMMUNITY} value="Takımlar" onChange={jest.fn()} />);
    expect(dir()).toBe('row');
    await screen.unmount();
    await render(<SegmentedControl options={PROFILE} value="Takımlar" onChange={jest.fn()} />);
    expect(dir()).toBe('column');
  });
});

describe('SegmentedControl label contrast', () => {
  it('both selected and unselected labels are Ink: secondary text on the sunken track is 4.45:1, below AA', async () => {
    await render(<SegmentedControl options={COMMUNITY} value="Takımlar" onChange={() => {}} />);
    for (const name of COMMUNITY) {
      expect(StyleSheet.flatten(screen.getByText(name).props.style).color).toBe('#20241F');
    }
  });
});
