import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import {
  BookmarkButton, MiniCard, Poster, PosterCard, PosterCardSkeleton, RowCard, RowCardSkeleton, cardLayout, cardMetrics, layout,
  rowCardHeight, type PosterCardProps, type RowCardProps, type RowLines,
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
    expect(card.props.accessibilityLabel).toBe(`${title}. Hackathon. 17 Ekim 2026. İstanbul · Yüz yüze. Lise + üniversite. Ücretsiz. Kayıt kapandı`);
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

describe('RowCard footnote tag', () => {
  it('leads the footnote row, is spoken after the secondary line, and leaves the trailing slot to the bookmark', async () => {
    const open = jest.fn(); const toggle = jest.fn();
    await render(<RowCard leading={{ kind: 'icon', icon: 'badge' }} title="Genç Mucit Yarışması" secondary="Yarışma · Çevrim içi"
      footnoteTag={{ label: 'SON 3 GÜN', tone: 'apricot', icon: 'clock' }} footnote="Son başvuru: 15 Kasım 2026"
      trailing={{ kind: 'bookmark', saved: false, onToggle: toggle }} onPress={open} />);
    const foot = screen.getByTestId('row-foot');
    expect(within(foot).getByText(/^SON\s3\sGÜN$/)).toBeTruthy();
    expect(within(foot).getByText(/^Son başvuru:\s15\sKasım\s2026$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Genç Mucit Yarışması\. Yarışma · Çevrim içi\. Son 3 gün\. Son başvuru: 15 Kasım 2026$/u })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Kaydet' }));
    expect(toggle).toHaveBeenCalledTimes(1); expect(open).not.toHaveBeenCalled();
  });

  it('puts ÖRNEK on its own line when there is no tag row, never beside the wrapping footnote', async () => {
    await render(<RowCard leading={{ kind: 'icon', icon: 'team' }} title="Orbit" footnote="Robotik · İstanbul · 12 üye" isDemo />);
    expect(within(screen.getByTestId('row-foot')).queryByText('ÖRNEK')).toBeNull();
    expect(screen.getByText('ÖRNEK')).toBeTruthy();
  });

  it('with a footnote tag, ÖRNEK joins the tag row and the footnote text sits below it', async () => {
    await render(<RowCard leading={{ kind: 'icon', icon: 'badge' }} title="X" footnoteTag={{ label: 'SON 3 GÜN', tone: 'apricot' }} footnote="Son başvuru: 15 Kasım 2026" isDemo />);
    const foot = screen.getByTestId('row-foot');
    expect(within(foot).getAllByText('ÖRNEK')).toHaveLength(1);
    expect(screen.getAllByText('ÖRNEK')).toHaveLength(1);
    expect(flat(foot).flexDirection ?? 'column').toBe('column'); // stacked: tag row, then the footnote line
  });
});

describe('numbers never break away from their unit', () => {
  const BREAKABLE_AROUND_DIGIT = /\d [^\s]|[^\s:] \d/u; // plain U+0020 next to a digit
  const text = (el: { props: { children?: unknown } }) => String(el.props.children);
  it('in row secondary, footnote and tags, poster meta and availability, mini body', async () => {
    await render(<>
      <RowCard leading={{ kind: 'icon', icon: 'badge' }} title="X" secondary="Ödül: 50.000 ₺ · 3 kişilik takımlar" footnote="Son başvuru: 20 Kasım 2026"
        footnoteTag={{ label: '8 GÜN KALDI', tone: 'moss', icon: 'clock' }} trailing={{ kind: 'status', view: { label: 'SON 2 YER', tone: 'apricot' } }} />
      <PosterCard {...poster({ dateLabel: '5 Aralık – 6 Aralık 2026', placeLabel: 'İstanbul', audienceLabel: '14–18 yaş', feeLabel: '250 ₺', availability: { label: 'SON 3 YER', tone: 'apricot' } })} />
      <MiniCard icon="team" title="Orbit" body="12 üye · 3 proje" />
    </>);
    const rendered = [
      screen.getByTestId('row-secondary'), screen.getByTestId('row-footnote'), ...screen.getAllByTestId('poster-meta'),
      screen.getByText(/^8\sGÜN\sKALDI$/), screen.getByText(/^SON\s2\sYER$/), screen.getByText(/^SON\s3\sYER$/), screen.getByText(/^12\süye/),
    ].map(text);
    expect(rendered).toHaveLength(8);
    for (const t of rendered) expect(t).not.toMatch(BREAKABLE_AROUND_DIGIT);
  });
});

describe('row height model (skeleton vs content)', () => {
  // No text layout in Jest: line counts are given, not measured. The test proves the skeleton, the content and
  // rowCardHeight() use the same line boxes and gaps, so a list whose rows wrap like `lines` does not jump.
  it.each<RowLines>([
    { title: 1, secondary: 1, footnote: 'text' },
    { title: 2, secondary: 2, footnote: 'tag' },
    { title: 1, secondary: 0, footnote: 'none' },
    { title: 1, secondary: 2, footnote: 'text', demo: true },
  ])('%p', async (lines) => {
    await render(<>
      <RowCard leading={{ kind: 'icon', icon: 'badge' }} title="Başlık" secondary="İkincil" footnote="Dipnot"
        footnoteTag={{ label: 'SON 3 GÜN', tone: 'apricot' }} />
      <RowCardSkeleton lines={lines} />
    </>);
    const all = { includeHiddenElements: true };
    const [body, skel] = screen.getAllByTestId('row-body', all);
    const title = flat(screen.getByText('Başlık')), secondary = flat(screen.getByTestId('row-secondary')), foot = flat(screen.getByTestId('row-foot'));
    const pad = flat(body!).padding as number;
    const textHeight = (title.lineHeight as number) * lines.title
      + (lines.secondary ? (secondary.marginTop as number) + (secondary.lineHeight as number) * lines.secondary : 0)
      + (lines.footnote === 'none' ? 0 : (foot.marginTop as number) + (flat(screen.getByTestId('row-footnote')).lineHeight as number)
        + (lines.footnote === 'tag' ? cardLayout.tag + (foot.gap as number) : 0))
      + (lines.demo && lines.footnote !== 'tag' ? (foot.marginTop as number) + cardLayout.demoTag : 0);
    const fromContent = pad * 2 + Math.max(cardLayout.leadingTile, textHeight);
    expect(rowCardHeight(lines)).toBe(fromContent);
    expect(flat(skel!).minHeight).toBe(fromContent);
    expect(flat(skel!).padding).toBe(pad);
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
