import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Checkbox, Chip, IconButton, Skeleton, Text, TextButton, colors, layout, radius, semantic, space } from '../../design-system';
import type { RootStackParamList } from '../../navigation/types';
import { eventKeys, fetchEventCities } from './api';
import { CLEARED_LIST_PARAMS, DEFAULT_LIST_FILTERS, FORMAT_FILTERS, WITHIN_FILTERS, findEventsList, readListFilters, toListParams, type EventListFilters } from './filters';
import { EVENT_TYPE_FILTERS } from './labels';

const sem = semantic.light;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label">{title}</Text>
      <View style={styles.chips}>{children}</View>
      {hint && <Text variant="caption" color="textSecondary">{hint}</Text>}
    </View>
  );
}

/**
 * Etkinlikler filters as a native form sheet (presentation 'formSheet', detents 0.6 / 1). It edits a draft that starts
 * from the list's filters. Each change is also applied to the list behind the sheet (setParams on that route), so at the
 * 60 % detent the results update in view and closing the sheet any way keeps them; "Sonuçları göster" applies the set and
 * closes. It is registered on the root stack so the sheet covers the tab bar. Android lays the sheet out at its largest
 * detent, so the footer is only in view at full height: Temizle and close live in the header, reachable at both detents.
 */
export function EventFiltersScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'EventFilters'>) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<EventListFilters>(() => readListFilters(route.params));
  // The sheet is a root-stack route; the list sits in the Events tab's stack. A SET_PARAMS action targeted at that stack
  // (source = the list route) is handed down to it by React Navigation, so the list behind the sheet updates in place.
  // The list passes its own keys when it opens the sheet: a nested stack that never changed has no state in the root
  // snapshot yet, so the lookup is only the fallback.
  const applyToList = (next: EventListFilters) => {
    const { listKey, stackKey } = route.params ?? {};
    const list = listKey && stackKey ? { listKey, stackKey } : findEventsList(navigation.getState());
    if (list) navigation.dispatch({ ...CommonActions.setParams({ ...CLEARED_LIST_PARAMS, ...toListParams(next) }), source: list.listKey, target: list.stackKey });
  };
  const update = (next: EventListFilters) => { setDraft(next); applyToList(next); };
  const set = (patch: Partial<EventListFilters>) => update({ ...draft, ...patch });
  const cities = useQuery({ queryKey: eventKeys.cities(), queryFn: fetchEventCities, staleTime: 5 * 60_000 });
  // A city chosen before (e.g. from a link) stays selectable even when the current list no longer has it.
  const cityOptions = [...new Set([...(draft.city ? [draft.city] : []), ...(cities.data ?? [])])].sort((a, b) => a.localeCompare(b, 'tr'));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="section" style={{ flex: 1 }}>Filtrele</Text>
        <TextButton label="Temizle" onPress={() => update(DEFAULT_LIST_FILTERS)} />
        <IconButton icon="close" accessibilityLabel="Kapat" onPress={navigation.goBack} style={{ marginRight: -space[2] }} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="Tür">
          {EVENT_TYPE_FILTERS.map((f) => <Chip key={f.value} label={f.label} selected={draft.type === f.value} onPress={() => set({ type: f.value })} />)}
        </Section>
        <Section title="Katılım biçimi" hint="Hibrit etkinlikler ikisinde de görünür.">
          {FORMAT_FILTERS.map((f) => <Chip key={f.value} label={f.label} selected={draft.format === f.value} onPress={() => set({ format: f.value })} />)}
        </Section>
        <Section title="Şehir">
          <Chip label="Tümü" selected={draft.city === null} onPress={() => set({ city: null })} />
          {cityOptions.map((c) => <Chip key={c} label={c} selected={draft.city === c} onPress={() => set({ city: c })} />)}
          {cities.isPending && [0, 1, 2].map((i) => <Skeleton key={i} width={88} height={40} rounded={radius.pill} />)}
          {cities.isError && <TextButton label="Şehirler yüklenemedi · Tekrar dene" color={colors.danger} onPress={() => void cities.refetch()} />}
        </Section>
        <Section title="Tarih">
          {WITHIN_FILTERS.map((f) => <Chip key={f.value} label={f.label} selected={draft.within === f.value} onPress={() => set({ within: f.value })} />)}
        </Section>
        <View style={styles.section}>
          <Checkbox label="Yalnız kaydı açık olanlar" description="Son kayıt tarihi geçmemiş etkinlikler" checked={draft.openOnly} onChange={(v) => set({ openOnly: v })} />
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        <Button label="Sonuçları göster" onPress={() => { applyToList(draft); navigation.goBack(); }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: sem.bg.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, paddingHorizontal: layout.gutter, paddingTop: space[2] },
  content: { paddingHorizontal: layout.gutter, paddingTop: space[2], paddingBottom: space[5], gap: space[6] },
  section: { gap: space[3] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space[3], borderTopWidth: 1, borderTopColor: sem.border.default, backgroundColor: sem.bg.surface },
});
