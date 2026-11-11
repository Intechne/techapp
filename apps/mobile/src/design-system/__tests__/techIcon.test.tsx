import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { TechIcon } from '../TechIcon';

const root = async (el: React.ReactElement) => (await render(el)).toJSON() as unknown as { props: Record<string, unknown> };

describe('TechIcon accessibility', () => {
  afterEach(() => jest.restoreAllMocks());
  it('decorative icons are hidden from screen readers on native', async () => {
    const { props } = await root(<TechIcon name="event" />);
    expect(props.accessibilityElementsHidden).toBe(true);
    expect(props.importantForAccessibility).toBe('no-hide-descendants');
  });
  it('decorative icons get aria-hidden on web (and no native-only props)', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const { props } = await root(<TechIcon name="event" />);
    expect(props['aria-hidden']).toBe(true);
    expect(props.accessibilityElementsHidden).toBeUndefined();
  });
  it('labelled icons stay exposed as images', async () => {
    const { props } = await root(<TechIcon name="verified" accessibilityLabel="Doğrulanmış" />);
    expect(props.accessibilityRole).toBe('image');
    expect(props.accessibilityLabel).toBe('Doğrulanmış');
    expect(props.accessibilityElementsHidden).toBeUndefined();
  });
});
