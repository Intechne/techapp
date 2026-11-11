import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AppHeader, Chip, ChipRail, EmptyState, ErrorState, HeroCard, LoadingSkeleton, MiniCard, OfflineBanner, PosterCard, RowCard,
  Screen, SectionHeader, SegmentedControl, space, Text, useLayout,
} from '../design-system';
import { makeError } from '../lib/errors';
import type { RootStackParamList } from '../navigation/types';
import { previewData, type PreviewData } from './fixtures/previewData';

/** Marker the release check (`npm run check:no-dev-preview`) looks for in an exported bundle: it must never be there. */
export const DESIGN_PREVIEW_MARKER = 'techapp-design-preview-screen';

const DATA_LABELS = { demo: 'Demo veri', worst: 'En kötü durum' } as const;
const STATES = [
  { key: 'data', label: 'Veri' }, { key: 'loading', label: 'Yükleniyor' }, { key: 'empty', label: 'Boş' },
  { key: 'filtered', label: 'Filtre boş' }, { key: 'error', label: 'Hata' }, { key: 'offline', label: 'Çevrimdışı' },
] as const;
type StateKey = (typeof STATES)[number]['key'];

const isData = (v: unknown): v is PreviewData => v === 'demo' || v === 'worst';
const isState = (v: unknown): v is StateKey => STATES.some((s) => s.key === v);

/**
 * Developer-only design preview: every card variant against polite and hostile content, plus the list states.
 * Registered only on `__DEV__ && env.appEnv === 'local'`. Both switches live in the route params, so the URL on web
 * (`/design-preview?data=worst&state=error`) survives a reload and can be shared with a designer.
 */
export function DesignPreviewScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'DesignPreview'>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'DesignPreview'>>();
  const data: PreviewData = isData(params?.data) ? params.data : 'demo';
  const state: StateKey = isState(params?.state) ? params.state : 'data';
  const set = previewData[data];
  const { gutter } = useLayout();
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const toggle = useCallback((id: string) => setSaved((s) => ({ ...s, [id]: !s[id] })), []);
  const noop = useCallback(() => {}, []);
  const retryable = useMemo(() => makeError('server_error', 503), []);
  const fatal = useMemo(() => makeError('not_found', 404), []);
  const offline = useMemo(() => makeError('network_unreachable', 0), []);

  const cards = (
    <>
      <SectionHeader title="Poster kartı" />
      <View style={styles.list}>
        {set.posters.map((p) => (
          <PosterCard key={p.id} {...p} saved={!!saved[p.id]} onToggleSave={p.bookmark ? () => toggle(p.id) : undefined} onPress={noop} />
        ))}
      </View>
      <SectionHeader title="Satır kartı" />
      <View style={styles.list}>
        {set.rows.map((r) => {
          const { trailing, ...rest } = r;
          return (
            <RowCard key={r.id} {...rest} onPress={noop}
              trailing={trailing?.kind === 'bookmark' ? { kind: 'bookmark', saved: !!saved[r.id], onToggle: () => toggle(r.id) } : trailing} />
          );
        })}
      </View>
      <SectionHeader title="Mini kart" />
      <View style={styles.list}>
        {Array.from({ length: Math.ceil(set.minis.length / 2) }, (_, i) => set.minis.slice(i * 2, i * 2 + 2)).map((pair) => (
          <View key={pair[0]!.id} style={styles.pair}>
            {pair.map((m) => <View key={m.id} style={styles.cell}><MiniCard icon={m.icon} title={m.title} body={m.body} onPress={noop} /></View>)}
            {pair.length === 1 && <View style={styles.cell} />}
          </View>
        ))}
      </View>
      <SectionHeader title="Vitrin kartı" />
      <HeroCard {...set.hero} onPress={noop} />
    </>
  );

  let body: React.ReactNode;
  if (state === 'loading') {
    body = (
      <>
        <SectionHeader title="Poster iskeleti" /><LoadingSkeleton variant="poster" cards={2} />
        <SectionHeader title="Satır iskeleti" /><LoadingSkeleton variant="row" cards={3} rowLines={{ title: 2, secondary: 2, footnote: 'tag', demo: true }} />
      </>
    );
  } else if (state === 'empty') {
    body = <EmptyState icon="event" title="Henüz etkinlik yok" body="Yeni etkinlikler eklendiğinde burada görünecek." actionLabel="Fırsatlara göz at" onAction={noop} />;
  } else if (state === 'filtered') {
    body = <EmptyState icon="discover" title="Bu filtrelerle sonuç yok" body="Filtreleri değiştirmeyi ya da temizlemeyi dene." actionLabel="Filtreleri temizle" onAction={noop} />;
  } else if (state === 'error') {
    body = <><ErrorState error={retryable} onRetry={noop} /><ErrorState error={fatal} onRetry={noop} /></>;
  } else if (state === 'offline') {
    body = (
      <>
        <View style={styles.bleed}><OfflineBanner /></View>
        <Text variant="caption" color="textSecondary">Önbellekteki veri, bağlantı yokken.</Text>
        {cards}
        <SectionHeader title="Önbellek yok" />
        <ErrorState error={offline} onRetry={noop} />
      </>
    );
  } else {
    body = cards;
  }

  return (
    <Screen
      header={(
        <View>
          <AppHeader title="Tasarım önizleme" onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))} />
          <View style={[styles.controls, { paddingHorizontal: gutter }]}>
            <SegmentedControl options={[DATA_LABELS.demo, DATA_LABELS.worst]} value={DATA_LABELS[data]}
              onChange={(label) => navigation.setParams({ data: label === DATA_LABELS.worst ? 'worst' : 'demo' })} />
            <ChipRail>
              {STATES.map((s) => <Chip key={s.key} label={s.label} selected={s.key === state} onPress={() => navigation.setParams({ state: s.key })} />)}
            </ChipRail>
          </View>
        </View>
      )}
    >
      <View testID={DESIGN_PREVIEW_MARKER} style={styles.body}>{body}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { gap: space[2], paddingBottom: space[2] },
  body: { gap: space[3], paddingBottom: space[9] },
  list: { gap: space[3] },
  pair: { flexDirection: 'row', gap: space[3], alignItems: 'stretch' },
  cell: { flex: 1, minWidth: 0 },
  bleed: { marginHorizontal: -space[5] },
});
