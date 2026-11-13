import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CoverBanner, Tag, TechIcon, Text, radius, space, tones, type TechIconName } from '../../design-system';

/**
 * Dark moss block with a lime headline: the team/community identity surface from the Open Circuit prototype.
 * With a cover the photo sits on top (16:10) and the moss text panel below it: the headline never sits on a photo.
 */
export function TeamCover({ label, name, tagline, icon, cover }: { label: string; name: string; tagline?: string | null; icon: TechIconName; cover?: { path: string | null; blurhash: string | null } }) {
  return (
    <View style={styles.cover}>
      {cover && <CoverBanner path={cover.path} blurhash={cover.blurhash} />}
      <View style={styles.panel}>
        <View style={styles.art}><TechIcon name={icon} size={120} color={tones.ink.fg} /></View>
        <Tag label={label} tone="onDark" />
        <Text variant="title" breakStrategy="words" style={{ color: tones.ink.fg, marginTop: space[4] }}>{name}</Text>
        {!!tagline && <Text variant="bodySmall" style={{ color: tones.ink.fg, opacity: 0.85, marginTop: space[2], maxWidth: '85%' }}>{tagline}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: tones.ink.bg, borderRadius: radius.hero, overflow: 'hidden' },
  panel: { padding: space[5], overflow: 'hidden', minHeight: 180, justifyContent: 'flex-end' },
  art: { position: 'absolute', right: -18, top: -10, opacity: 0.14 },
});
