import React from 'react';
import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { TechIcon } from '../TechIcon';

const root = async (el: React.ReactElement) => (await render(el)).toJSON() as unknown as { props: Record<string, unknown> };

const captured: string[] = [];
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  return { SvgXml: ({ xml, ...rest }: { xml: string }) => { captured.push(xml); return <View {...rest} />; } };
});

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

describe('TechIcon svg markup', () => {
  const xmlOf = async (el: React.ReactElement) => {
    captured.length = 0;
    await render(el);
    return captured[captured.length - 1];
  };
  it('decorative icons keep aria-hidden out of the markup (the wrapper hides them)', async () => {
    expect(await xmlOf(<TechIcon name="event" />)).not.toContain('aria-hidden');
  });
  it('labelled icons do NOT carry aria-hidden in the markup', async () => {
    expect(await xmlOf(<TechIcon name="verified" accessibilityLabel="Doğrulanmış" />)).not.toContain('aria-hidden');
  });
});
