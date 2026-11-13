import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { coverUrl, type CoverSize } from '../../lib/covers';
import { motion, radius, space, tones, type Tone } from '../tokens';
import { Text } from '../Text';
import type { TechIconName } from '../TechIcon';
import { useReducedMotion } from '../useReducedMotion';
import { CircuitArt, circuitArtHeight } from './cards/CircuitArt';
import { cardLayout } from './cards/metrics';

/** What is drawn when there is no cover, or it does not load: the approved Open Circuit poster (type pad + one trace on the tone ground). */
export interface CoverFallback { tone: Tone; icon: TechIconName; line: string; /** Detail layout only: the type label above the line. */ eyebrow?: string }

/** Shared by the image layers: the URL to load, whether it already failed (reset by a new URL), and the fade (none under reduced motion). */
function useCover(path: string | null, size: CoverSize) {
  const url = coverUrl(path, size);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const reduced = useReducedMotion();
  return { url: url !== null && failedUrl !== url ? url : null, fail: () => setFailedUrl(url), transition: reduced ? 0 : motion.fast };
}

function Picture({ url, blurhash, transition, onError }: { url: string; blurhash: string | null; transition: number; onError: () => void }) {
  return (
    <Image testID="cover-image" source={{ uri: url }} placeholder={blurhash ? { blurhash } : undefined} cachePolicy="memory-disk" contentFit="cover"
      transition={transition} accessible={false} recyclingKey={url} onError={onError} style={StyleSheet.absoluteFill} />
  );
}

/**
 * A cover with its fallback. The image is decoration (the title is always text next to it), so it is not an accessibility element.
 * Card layout (default): a box of `aspect` that is the same size whether it shows the photo or the poster, so a missing or
 * broken cover never changes a card's height. Detail layout: the poster keeps its content-sized layout (eyebrow + line, up to
 * three lines); a loaded photo takes the `aspect` box.
 */
export function CoverImage({ path, blurhash, size, aspect, fallback, detail, large, testID }: {
  path: string | null; blurhash: string | null; size: CoverSize; aspect: number; fallback: CoverFallback; detail?: boolean; large?: boolean; testID?: string;
}) {
  const { url, fail, transition } = useCover(path, size);
  const t = tones[fallback.tone];
  if (url) {
    return (
      <View testID={testID ?? 'cover-box'} style={[styles.box, { aspectRatio: aspect, backgroundColor: t.bg }, detail && large && { borderRadius: radius.card }]}>
        <Picture url={url} blurhash={blurhash} transition={transition} onError={fail} />
      </View>
    );
  }
  if (detail) {
    const inset = large ? space[5] : space[4];
    return (
      <View testID="cover-fallback" style={[styles.poster, { backgroundColor: t.bg, minHeight: large ? 196 : 148, padding: inset, paddingTop: inset + circuitArtHeight + space[3] }, large && { borderRadius: radius.card }]}>
        <CircuitArt tone={fallback.tone} icon={fallback.icon} seed={fallback.line} inset={inset} />
        {!!fallback.eyebrow && <Text variant="eyebrow" style={{ color: t.fg }} numberOfLines={1}>{fallback.eyebrow}</Text>}
        <Text variant={large ? 'title' : 'section'} style={{ color: t.fg, maxWidth: '86%', marginTop: space[2] }} numberOfLines={3}>{fallback.line}</Text>
      </View>
    );
  }
  return (
    <View testID={testID ?? 'cover-box'} style={[styles.box, { aspectRatio: aspect, backgroundColor: t.bg }]}>
      <View testID="cover-fallback" style={StyleSheet.absoluteFill}>
        <CircuitArt tone={fallback.tone} icon={fallback.icon} seed={fallback.line} />
        <Text variant="section" numberOfLines={3} style={[styles.line, { color: t.fg }]}>{fallback.line}</Text>
      </View>
    </View>
  );
}

/**
 * Image layer for a surface that brings its own background (row-card tile): fills the parent, draws nothing when there is
 * no cover or it fails (the surface underneath stays as it was). Never carries text: text on a photo is not allowed.
 */
export function CoverFill({ path, blurhash, size }: { path: string | null; blurhash: string | null; size: CoverSize }) {
  const { url, fail, transition } = useCover(path, size);
  if (!url) return null;
  return (
    <View testID="cover-fill" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Picture url={url} blurhash={blurhash} transition={transition} onError={fail} />
    </View>
  );
}

/**
 * Photo block for split layouts (vitrin hero, team cover): the full-size photo at `aspect`, with the text panel BELOW it,
 * on its own brand-colour ground, so text never sits on a photo. No cover or a failed load = renders nothing and the
 * panel alone is the card, exactly as without a cover.
 */
export function CoverBanner({ path, blurhash, aspect = 16 / 10 }: { path: string | null; blurhash: string | null; aspect?: number }) {
  const { url, fail, transition } = useCover(path, 'full');
  if (!url) return null;
  return (
    <View testID="cover-banner" style={{ width: '100%', aspectRatio: aspect, overflow: 'hidden' }}>
      <Picture url={url} blurhash={blurhash} transition={transition} onError={fail} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', overflow: 'hidden' },
  line: { position: 'absolute', left: cardLayout.pad, bottom: cardLayout.pad, maxWidth: '82%' },
  poster: { justifyContent: 'flex-end', overflow: 'hidden' },
});
