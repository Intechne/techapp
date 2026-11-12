import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { HeroCard, HeroOrbit, heroAccessibilityLabel } from '..';

describe('heroAccessibilityLabel', () => {
  it('does not double the full stop when the poster line already ends with one', () => {
    expect(heroAccessibilityLabel('Üretenler anlatıyor.', '21 Kasım 2026 · İzmir · Hibrit · Ücretsiz')).toBe('Üretenler anlatıyor. 21 Kasım 2026 · İzmir · Hibrit · Ücretsiz');
  });
  it('adds one when missing, drops empty meta, strips ?!…', () => {
    expect(heroAccessibilityLabel('Hazır mısın?', 'Ankara')).toBe('Hazır mısın. Ankara');
    expect(heroAccessibilityLabel('Pist hazır', undefined)).toBe('Pist hazır');
    expect(heroAccessibilityLabel('Başla…', '')).toBe('Başla');
  });
  it('is the button label of the card', async () => {
    await render(<HeroCard category="HACKATHON" title="Üretenler anlatıyor." meta="21 Kasım" cta="Detayları gör" />);
    expect(screen.getByRole('button', { name: 'Üretenler anlatıyor. 21 Kasım' })).toBeTruthy();
  });
});

describe('HeroOrbit', () => {
  it('is decorative: hidden from screen readers and transparent to touches, sized from the card width', async () => {
    const { toJSON } = await render(<HeroOrbit cardWidth={280} fontScale={1} />);
    const root = toJSON() as unknown as { props: Record<string, unknown>; children: { props: { style: unknown } }[] };
    expect(root.props.accessibilityElementsHidden).toBe(true);
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
    expect((StyleSheet.flatten(root.props.style as never) as { pointerEvents?: string }).pointerEvents).toBe('none');
    const ring = StyleSheet.flatten(root.children[0]!.props.style as never) as { width: number };
    expect(ring.width).toBe(78);
  });
  it('renders nothing before the card is measured, or when text is scaled up', async () => {
    expect((await render(<HeroOrbit cardWidth={0} fontScale={1} />)).toJSON()).toBeNull();
    expect((await render(<HeroOrbit cardWidth={280} fontScale={2} />)).toJSON()).toBeNull();
  });
});
