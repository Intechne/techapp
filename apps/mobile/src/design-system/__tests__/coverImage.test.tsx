import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, render, screen, within } from '@testing-library/react-native';
import { CoverImage, HeroCard, Poster, PosterCard, RowCard, radius, semantic, space } from '..';
import { toEventPoster, type EventWithOrg } from '../../features/events/labels';
import { toOpportunityRow } from '../../features/opportunities/labels';

jest.mock('../../lib/env', () => ({ env: { supabaseUrl: 'https://abc.supabase.co' } }));

const OWNER = '11111111-2222-4333-8444-555555555555';
const FILE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const PATH = `events/${OWNER}/${FILE}.webp`;
const BASE = 'https://abc.supabase.co/storage/v1/object/public/covers';
const fallback = { tone: 'iris' as const, icon: 'code' as const, line: 'Bir fikir. Gerçek bir etki.' };
const uri = (el: { props: { source?: unknown } }) => { const s = el.props.source as { uri?: string } | { uri?: string }[]; return (Array.isArray(s) ? s[0] : s)?.uri; };

describe('CoverImage', () => {
  it('without a path draws the Open Circuit fallback and no image', async () => {
    await render(<CoverImage path={null} blurhash={null} size="thumb" aspect={16 / 10} fallback={fallback} />);
    expect(screen.getByTestId('cover-fallback')).toBeTruthy();
    expect(screen.queryByTestId('cover-image')).toBeNull();
    expect(screen.getByText('Bir fikir. Gerçek bir etki.')).toBeTruthy();
    expect(screen.getByTestId('circuit-art', { includeHiddenElements: true })).toBeTruthy(); // type icon pad + one trace
  });

  it('the fallback has no decorative rounded square', async () => {
    await render(<CoverImage path={null} blurhash={null} size="thumb" aspect={16 / 10} fallback={fallback} />);
    type J = { props?: { style?: unknown; testID?: string }; children?: (J | string)[] | null };
    const walk = (n: J | string | null | undefined, out: J[] = []): J[] => { if (n && typeof n !== 'string') { out.push(n); (n.children ?? []).forEach((c) => walk(c, out)); } return out; };
    const root = walk(screen.toJSON() as unknown as J).find((n) => n.props?.testID === 'cover-fallback')!;
    for (const n of walk(root)) {
      const st = StyleSheet.flatten(n.props?.style as never) as { width?: number; height?: number; borderRadius?: number } | undefined;
      if (st?.borderRadius && typeof st.width === 'number' && typeof st.height === 'number') {
        expect(st.borderRadius).toBeGreaterThanOrEqual(Math.min(st.width, st.height) / 2); // circles only
      }
    }
    expect(StyleSheet.flatten(screen.getByTestId('cover-box').props.style as never)).not.toMatchObject({ borderRadius: radius.card });
  });

  it('with a path renders the image (accessible=false, memory-disk cache, blurhash placeholder) and no fallback', async () => {
    await render(<CoverImage path={PATH} blurhash="LEHV6nWB2yk8pyo0adR*.7kCMdnj" size="full" aspect={16 / 10} fallback={fallback} />);
    const img = screen.getByTestId('cover-image');
    expect(img.props.accessible).toBe(false);
    expect(img.props.cachePolicy).toBe('memory-disk');
    expect(JSON.stringify(img.props.placeholder)).toContain('blurhash:/LEHV6nWB2yk8pyo0adR*.7kCMdnj');
    expect(uri(img)).toBe(`${BASE}/${PATH}`);
    expect(screen.queryByTestId('cover-fallback')).toBeNull();
  });

  it('uses the 640 px copy for thumb and the main file for full', async () => {
    const { rerender } = await render(<CoverImage path={PATH} blurhash={null} size="thumb" aspect={16 / 10} fallback={fallback} />);
    expect(uri(screen.getByTestId('cover-image'))).toBe(`${BASE}/events/${OWNER}/${FILE}-640.webp`);
    await rerender(<CoverImage path={PATH} blurhash={null} size="full" aspect={16 / 10} fallback={fallback} />);
    expect(uri(screen.getByTestId('cover-image'))).toBe(`${BASE}/${PATH}`);
  });

  it('onError drops back to the fallback; a new path tries again', async () => {
    const { rerender } = await render(<CoverImage path={PATH} blurhash={null} size="thumb" aspect={16 / 10} fallback={fallback} />);
    await act(async () => { screen.getByTestId('cover-image').props.onError({ nativeEvent: { error: 'x' } }); });
    expect(screen.getByTestId('cover-fallback')).toBeTruthy();
    expect(screen.queryByTestId('cover-image')).toBeNull();
    await rerender(<CoverImage path={`events/${OWNER}/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`} blurhash={null} size="thumb" aspect={16 / 10} fallback={fallback} />);
    expect(screen.getByTestId('cover-image')).toBeTruthy();
  });

  it('fades in over 160 ms, and not at all with reduced motion', async () => {
    await render(<CoverImage path={PATH} blurhash={null} size="thumb" aspect={16 / 10} fallback={fallback} />);
    expect(screen.getByTestId('cover-image').props.transition).toEqual({ duration: 160 });
  });
  it('reduced motion: no transition', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<CoverImage path={PATH} blurhash={null} size="thumb" aspect={16 / 10} fallback={fallback} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('cover-image').props.transition).toEqual({ duration: 0 });
    jest.restoreAllMocks();
  });
});

describe('where covers are used', () => {
  const event = {
    id: 'e1', title: 'Robot Yarışı', type: 'competition', format: 'in_person', city: 'İstanbul', starts_at: '2027-01-10T10:00:00Z', ends_at: '2027-01-10T14:00:00Z',
    registration_closes_at: '2099-01-01T00:00:00Z', capacity: null, seats_taken: 0, waitlist_enabled: false, fee_minor_units: 0, min_age: null, max_age: null,
    audience_note: null, poster_line: null, tone: 'moss', is_demo: false, cover_path: PATH, cover_blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
  } as unknown as EventWithOrg;

  it('event list card (PosterCard) shows the thumb', async () => {
    await render(<PosterCard {...toEventPoster(event)} onPress={() => {}} />);
    expect(uri(screen.getByTestId('cover-image'))).toBe(`${BASE}/events/${OWNER}/${FILE}-640.webp`);
    expect(screen.getByTestId('poster-cover')).toBeTruthy(); // same box as before
  });
  it('event card without a cover keeps the fallback', async () => {
    await render(<PosterCard {...toEventPoster({ ...event, cover_path: null, cover_blurhash: null })} onPress={() => {}} />);
    expect(screen.getByTestId('cover-fallback')).toBeTruthy();
  });
  it('detail poster shows the full image', async () => {
    await render(<Poster large tone="moss" icon="badge" typeLabel="YARIŞMA" line="Robot Yarışı" cover={{ path: PATH, blurhash: null }} />);
    expect(uri(screen.getByTestId('cover-image'))).toBe(`${BASE}/${PATH}`);
  });
  it('detail poster without a cover is the unchanged fallback with eyebrow and line', async () => {
    await render(<Poster large tone="moss" icon="badge" typeLabel="YARIŞMA" line="Robot Yarışı" cover={{ path: null, blurhash: null }} />);
    expect(screen.getByText('YARIŞMA')).toBeTruthy();
    expect(screen.getByText('Robot Yarışı')).toBeTruthy();
    expect(screen.queryByTestId('cover-image')).toBeNull();
  });
  it('opportunity rows carry the cover into the row leading (thumb is chosen by the tile)', () => {
    const row = toOpportunityRow({ type: 'internship', title: 'Staj', closes_at: '2099-01-01T00:00:00Z', is_remote: true, city: null, audience_note: null, reward_note: null, is_demo: false,
      cover_path: PATH, cover_blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' });
    expect(row.leading).toMatchObject({ kind: 'image', path: PATH, blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' });
    expect(toOpportunityRow({ type: 'internship', title: 'Staj', closes_at: '2099-01-01T00:00:00Z', is_remote: true, city: null, audience_note: null, reward_note: null, is_demo: false,
      cover_path: null, cover_blurhash: null }).leading.kind).toBe('icon');
  });
  it('opportunity row tile draws the thumb over the icon', async () => {
    await render(<RowCard leading={{ kind: 'image', path: PATH, blurhash: null, fallbackIcon: 'opportunity' }} title="Staj" />);
    expect(uri(screen.getByTestId('cover-image'))).toBe(`${BASE}/events/${OWNER}/${FILE}-640.webp`);
  });
  it('vitrin hero with a cover: photo block on top, Iris text panel below, no scrim', async () => {
    await render(<HeroCard category="HACKATHON" title="Üretenler anlatıyor." meta="21 Kasım" cta="Detayları gör" cover={{ path: PATH, blurhash: null }} />);
    expect(uri(screen.getByTestId('cover-image'))).toBe(`${BASE}/${PATH}`);
    const banner = screen.getByTestId('cover-banner'), panel = screen.getByTestId('hero-panel');
    expect(banner).toBeTruthy();
    expect(banner.parent).toBe(panel.parent); // siblings: two separate blocks
    expect(within(banner).queryByText('HACKATHON')).toBeNull(); // no text on the photo
    expect(within(panel).getByText('HACKATHON')).toBeTruthy();
    expect(screen.queryByTestId('cover-fill')).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toContain('"opacity":0.72');
    expect(StyleSheet.flatten(screen.getByRole('button').props.style as never)).toMatchObject({ backgroundColor: semantic.light.action.primary });
  });
  it('vitrin hero without a cover (or a failed one) is the plain Iris block', async () => {
    const { unmount } = await render(<HeroCard category="HACKATHON" title="Üretenler anlatıyor." cover={{ path: null, blurhash: null }} />);
    expect(screen.queryByTestId('cover-image')).toBeNull();
    expect(screen.queryByTestId('cover-banner')).toBeNull();
    await unmount();
    await render(<HeroCard category="HACKATHON" title="Üretenler anlatıyor." cover={{ path: PATH, blurhash: null }} />);
    await act(async () => { screen.getByTestId('cover-image').props.onError({ nativeEvent: { error: 'x' } }); });
    expect(screen.queryByTestId('cover-banner')).toBeNull();
    expect(screen.getByTestId('hero-panel')).toBeTruthy();
  });
  it('space token sanity (tokens only)', () => { expect(space[4]).toBeGreaterThan(0); });
});
