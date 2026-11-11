import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  BookmarkButton, MiniCard, Poster, PosterCard, PosterCardSkeleton, RowCard, RowCardSkeleton, cardMetrics, layout,
  type PosterCardProps, type RowCardProps,
} from '..';
import { worstCase, worstCaseTitles } from '../../dev/fixtures/worstCase';

const flat = (el: { props: { style?: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

const poster = (over: Partial<PosterCardProps> = {}): PosterCardProps => ({
  title: 'İyi Bir Gelecek Hackathonu', typeLabel: 'HACKATHON', dateLabel: '17 Ekim 2026', placeLabel: 'İstanbul · Yüz yüze',
  audienceLabel: 'Lise + üniversite', feeLabel: 'Ücretsiz', cover: worstCase.cover.none,
  fallback: { tone: 'iris', icon: 'code', line: 'Bir fikir. Bir hafta sonu.' }, onPress: jest.fn(), ...over,
});

describe('PosterCard', () => {
  it.each(worstCaseTitles)('renders %p and speaks the full title, type and date as one button', async (title) => {
    await render(<PosterCard {...poster({ title, availability: { label: 'KAYIT KAPANDI', tone: 'danger' } })} />);
    const card = screen.getByRole('button', { name: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`, 'u') });
    expect(card.props.accessibilityLabel).toBe(`${title}. Hackathon. 17 Ekim 2026. İstanbul · Yüz yüze. Kayıt kapandı`);
  });

  it('same geometry with no cover and with a broken cover URL', async () => {
    const { unmount } = await render(<PosterCard {...poster({ cover: worstCase.cover.none })} />);
    const a = { cover: flat(screen.getByTestId('poster-cover')), body: flat(screen.getByTestId('poster-body')) };
    await unmount();
    await render(<PosterCard {...poster({ cover: worstCase.cover.broken })} />);
    const b = { cover: flat(screen.getByTestId('poster-cover')), body: flat(screen.getByTestId('poster-body')) };
    expect(a.cover.aspectRatio).toBe(cardMetrics.poster.coverAspect);
    expect(b.cover.aspectRatio).toBe(cardMetrics.poster.coverAspect);
    expect(a.body.minHeight).toBe(cardMetrics.poster.bodyMinHeight);
    expect(b.body.minHeight).toBe(cardMetrics.poster.bodyMinHeight);
  });

  it('its skeleton has the same cover ratio, body height and body padding', async () => {
    await render(<><PosterCard {...poster()} /><PosterCardSkeleton /></>);
    const all = { includeHiddenElements: true }; // skeletons are hidden from screen readers (the list says "Yükleniyor")
    const [card, skel] = screen.getAllByTestId('poster-body', all);
    const [cardCover, skelCover] = screen.getAllByTestId('poster-cover', all);
    expect(flat(skelCover!).aspectRatio).toBe(flat(cardCover!).aspectRatio);
    for (const k of ['minHeight', 'padding', 'gap'] as const) expect(flat(skel!)[k]).toBe(flat(card!)[k]);
  });

  it('bookmark is its own 44×44 button and does not open the card', async () => {
    const open = jest.fn(); const save = jest.fn();
    await render(<PosterCard {...poster({ onPress: open, onToggleSave: save })} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));
    expect(save).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('İyi Bir Gelecek Hackathonu'));
    expect(open).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledTimes(1);
  });

  it('shows ÖRNEK only for demo content, and says so', async () => {
    const { unmount } = await render(<PosterCard {...poster()} />);
    expect(screen.queryByText('ÖRNEK')).toBeNull();
    await unmount();
    await render(<PosterCard {...poster({ isDemo: true })} />);
    expect(screen.getByText('ÖRNEK')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Örnek içerik$/ })).toBeTruthy();
  });
});

describe('RowCard', () => {
  it.each(worstCaseTitles)('renders %p with the full title in its label', async (title) => {
    await render(<RowCard leading={{ kind: 'icon', icon: 'robot' }} title={title} secondary={worstCase.description.long} footnote="12.000+ üye" onPress={jest.fn()} />);
    const label = screen.getByRole('button').props.accessibilityLabel as string;
    expect(label.startsWith(`${title}. `)).toBe(true);
    expect(label).toContain('12.000+ üye');
    expect(label.length).toBeLessThan(title.length + 200); // a 6000-character summary is clipped for speech
  });

  it('never upper-cases an organisation name', async () => {
    await render(<RowCard leading={{ kind: 'icon', icon: 'opportunity' }} title="Proje çağrısı" secondary={worstCase.organization} />);
    expect(screen.getByText(worstCase.organization)).toBeTruthy();
    expect(screen.queryByText(worstCase.organization.toLocaleUpperCase('tr'))).toBeNull();
  });

  it('its skeleton has the same minimum height and padding', async () => {
    await render(<><RowCard leading={{ kind: 'icon', icon: 'team' }} title="Orbit" onPress={jest.fn()} /><RowCardSkeleton /></>);
    const [card, skel] = screen.getAllByTestId('row-body', { includeHiddenElements: true });
    expect(flat(card!).minHeight).toBe(cardMetrics.row.minHeight);
    expect(flat(skel!).minHeight).toBe(cardMetrics.row.minHeight);
    expect(flat(skel!).padding).toBe(flat(card!).padding);
  });

  it('trailing bookmark presses do not reach the card; status reads in the label', async () => {
    const open = jest.fn(); const toggle = jest.fn();
    const { unmount } = await render(<RowCard leading={{ kind: 'icon', icon: 'opportunity' }} title="Genç Mucit Hibesi" trailing={{ kind: 'bookmark', saved: true, onToggle: toggle }} onPress={open} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydı kaldır' }));
    expect(toggle).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled();
    await unmount();
    await render(<RowCard leading={{ kind: 'image', path: null, fallbackIcon: 'team' }} title="Başvurum" trailing={{ kind: 'status', view: { label: 'İNCELEMEDE', tone: 'iris' } }} onPress={open} />);
    expect(screen.getByText('İNCELEMEDE')).toBeTruthy();
    expect(screen.getByRole('button').props.accessibilityLabel).toBe('Başvurum. İncelemede');
  });

  it('trailing is one choice at type level', () => {
    const toggle = () => {};
    // @ts-expect-error a chevron cannot also carry a bookmark
    const both: RowCardProps['trailing'] = { kind: 'chevron', saved: true, onToggle: toggle };
    // @ts-expect-error trailing is a single slot, not a list
    const many: RowCardProps['trailing'] = [{ kind: 'chevron' }, { kind: 'status', view: { label: 'A', tone: 'iris' } }];
    // @ts-expect-error a bookmark needs its toggle
    const half: RowCardProps['trailing'] = { kind: 'bookmark', saved: false };
    expect([both, many, half]).toHaveLength(3);
  });

  it('shows ÖRNEK only for demo rows', async () => {
    await render(<><RowCard leading={{ kind: 'icon', icon: 'team' }} title="Orbit" isDemo /><RowCard leading={{ kind: 'icon', icon: 'team' }} title="Nova" /></>);
    expect(screen.getAllByText('ÖRNEK')).toHaveLength(1);
  });
});

describe('MiniCard', () => {
  it.each(worstCaseTitles)('renders %p at the fixed minimum height', async (title) => {
    await render(<MiniCard icon="robot" title={title} body={worstCase.description.long} onPress={jest.fn()} />);
    const card = screen.getByRole('button');
    expect((card.props.accessibilityLabel as string).startsWith(title)).toBe(true);
    expect(flat(screen.getByTestId('mini-body')).minHeight).toBe(cardMetrics.mini.minHeight);
  });
});

describe('BookmarkButton', () => {
  it('names its state and keeps a 44×44 target', async () => {
    const { unmount } = await render(<BookmarkButton saved={false} onToggle={jest.fn()} />);
    const btn = screen.getByRole('button', { name: 'Kaydet' });
    expect(flat(btn).width).toBeGreaterThanOrEqual(layout.touchTarget);
    expect(flat(btn).height).toBeGreaterThanOrEqual(layout.touchTarget);
    await unmount();
    await render(<BookmarkButton saved onToggle={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Kaydı kaldır' })).toBeTruthy();
  });
  it('accepts domain wording (follow a deadline) without changing the control', async () => {
    await render(<BookmarkButton saved={false} onToggle={jest.fn()} labels={{ save: 'Son tarihi takip et', unsave: 'Takipten çıkar' }} />);
    expect(screen.getByRole('button', { name: 'Son tarihi takip et' })).toBeTruthy();
  });
});

describe('Poster (detail)', () => {
  it('keeps the organisation name as written inside the eyebrow', async () => {
    await render(<Poster large tone="moss" icon="code" brand={`${worstCase.organization} · HACKATHON`} line="Bir fikir." />);
    expect(screen.getByText(`${worstCase.organization} · HACKATHON`)).toBeTruthy();
  });
});

it('worst-case fixture covers the contract cases', () => {
  expect(worstCase.description.long).toHaveLength(6000);
  expect(worstCase.counts).toEqual([0, 1, 999, 12000]);
});
