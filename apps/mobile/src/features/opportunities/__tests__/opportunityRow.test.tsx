import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, within } from '@testing-library/react-native';
import { RowCard, colors, tones } from '../../../design-system';
import { deadlineTag, toOpportunityRow } from '../labels';

const NOW = new Date('2026-11-12T09:00:00Z'); // 12:00 in Istanbul
const opp = (closes_at: string, over: Partial<Parameters<typeof toOpportunityRow>[0]> = {}) => ({
  type: 'competition' as const, title: 'Genç Mucit Yarışması', closes_at, is_remote: true, city: null,
  audience_note: 'Lise + üniversite', reward_note: 'Birinciye 50.000 ₺', is_demo: false, ...over,
});

describe('deadlineTag (existing deadlineView + urgencyTone thresholds)', () => {
  it.each([
    ['2026-11-12T20:00:00Z', 'SON GÜN BUGÜN', 'danger'],
    ['2026-11-13T20:00:00Z', 'SON 1 GÜN', 'apricot'],
    ['2026-11-19T20:00:00Z', 'SON 7 GÜN', 'apricot'],
    ['2026-11-20T20:00:00Z', '8 GÜN KALDI', 'moss'],
  ])('%s → %s (%s)', (closes, label, tone) => {
    expect(deadlineTag(closes, NOW)).toEqual({ label, tone, icon: 'clock' });
  });
});

describe('opportunity row on the card', () => {
  const fg = { danger: colors.danger, apricot: tones.apricot.fg, moss: colors.moss };
  it.each([
    ['2026-11-12T20:00:00Z', /^SON\sGÜN\sBUGÜN$/, 'danger'],
    ['2026-11-15T20:00:00Z', /^SON\s3\sGÜN$/, 'apricot'],
    ['2026-11-30T20:00:00Z', /^18\sGÜN\sKALDI$/, 'moss'],
  ] as const)('closing %s shows a %s tag in its tone, plus the absolute date', async (closes, tag, tone) => {
    await render(<RowCard {...toOpportunityRow(opp(closes), NOW)} trailing={{ kind: 'chevron' }} onPress={jest.fn()} />);
    const foot = within(screen.getByTestId('row-foot'));
    expect(StyleSheet.flatten(foot.getByText(tag).props.style).color).toBe(fg[tone]);
    expect(foot.getByText(/^Son başvuru:\s\d{1,2}\s\p{L}+\s2026$/u)).toBeTruthy();
  });

  it('brings back type, place, audience and reward as the secondary line, all spoken', async () => {
    await render(<RowCard {...toOpportunityRow(opp('2026-11-30T20:00:00Z'), NOW)} onPress={jest.fn()} />);
    expect(screen.getByTestId('row-secondary').props.children).toBe('Yarışma · Çevrim içi · Lise + üniversite · Birinciye 50.000 ₺');
    expect(screen.getByRole('button').props.accessibilityLabel).toMatch(/^Genç Mucit Yarışması\. Yarışma · Çevrim içi · Lise \+ üniversite · Birinciye 50\.000 ₺\. 18 gün kaldı\. Son başvuru: 30 Kasım 2026$/u);
  });
});
