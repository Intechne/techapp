import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, EmptyState, ErrorState, LoadingSkeleton, ResponsiveGrid, RowCard, Screen, Text, TextButton, space, useToast, type TechIconName } from '../../design-system';
import { toAppError } from '../../lib/errors';
import { formatLastUpdated } from '../../lib/dates';
import type { DiscoverStackParamList, ProfileStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchNotifications, markRead, notificationKeys, targetAvailable, useUnreadCount, type NotificationRow } from './api';
import { groupNotifications } from './groups';
import { notificationProbe, notificationRoute } from './route';

const GONE_TOAST = 'Bu içerik artık yok';

/** Kind family → glyph. Only the glyph is client-side: title and body are the server's own words. */
function iconFor(kind: string): TechIconName {
  if (kind.startsWith('guardian.')) return 'shield';
  if (kind.startsWith('registration.')) return 'ticket';
  if (kind.startsWith('application.')) return 'application';
  if (kind.startsWith('team_join.')) return 'team';
  if (kind.startsWith('event.')) return 'event';
  return 'bell';
}

type Props = NativeStackScreenProps<DiscoverStackParamList, 'Notifications'> | NativeStackScreenProps<ProfileStackParamList, 'Notifications'>;

/**
 * Keşfet / Profil > Bildirimler. Tapping a row marks it read first, then opens its destination. A destination that is
 * gone (unpublished event, unknown kind) still marks the row read and says so in a toast: nothing here opens a 404.
 * A failed mark never blocks opening; the badge corrects itself on the next refresh.
 */
export function NotificationsScreen({ navigation }: Props) {
  const { userId } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const unread = useUnreadCount();
  const q = useQuery({ queryKey: notificationKeys.list(userId), queryFn: () => fetchNotifications(userId!), enabled: !!userId, staleTime: 0 });
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: notificationKeys.list(userId) }),
    qc.invalidateQueries({ queryKey: notificationKeys.unread(userId) }),
  ]);
  const markAll = useMutation({ mutationFn: () => markRead(), onSuccess: refresh, onError: (e) => toast.show(toAppError(e).message, 'danger') });
  const groups = useMemo(() => groupNotifications(q.data ?? []), [q.data]);
  const tabs = (navigation as { getParent: () => { navigate: (...a: unknown[]) => void } | undefined }).getParent();

  const open = async (n: NotificationRow) => {
    if (!n.read_at) { try { await markRead([n.id]); } catch { /* opening does not depend on the bookkeeping */ } void refresh(); }
    const route = notificationRoute(n);
    const probe = notificationProbe(n);
    if (!route || (probe && !(await targetAvailable(probe, n.target_id)))) { toast.show(GONE_TOAST); return; }
    tabs?.navigate(route.tab, { screen: route.screen, params: route.params, initial: false });
  };

  const rows = q.data ?? [];
  return (
    <Screen wide header={<AppHeader onBack={navigation.goBack} title="Bildirimler" />} refreshing={q.isRefetching} onRefresh={() => void refresh()}>
      {!userId ? <EmptyState icon="bell" title="Bildirimlerini görmek için giriş yap" />
        : q.isPending ? <LoadingSkeleton variant="row" rowLines={{ title: 1, secondary: 2, footnote: 'text' }} />
          : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} />
            : rows.length === 0 ? <EmptyState icon="bell" title="Henüz bildirim yok." body="Kayıt ve başvuru güncellemelerin burada görünür." />
              : (
                <>
                  {unread > 0 && (
                    <View style={{ alignItems: 'flex-start', marginBottom: space[2] }}>
                      <TextButton icon="check" label="Tümünü okundu say" onPress={() => markAll.mutate()} />
                    </View>
                  )}
                  {groups.map((g, i) => (
                    <View key={g.label} style={{ marginTop: i === 0 ? 0 : space[6] }}>
                      <Text variant="eyebrow" color="textSecondary" accessibilityRole="header" style={{ marginBottom: space[3] }}>{g.label.toLocaleUpperCase('tr')}</Text>
                      <ResponsiveGrid>
                        {g.items.map((n) => (
                          <RowCard key={n.id} leading={{ kind: 'icon', icon: iconFor(n.kind) }} title={n.title} secondary={n.body ?? undefined}
                            footnote={formatLastUpdated(n.created_at)} unread={!n.read_at} onPress={() => void open(n)} />
                        ))}
                      </ResponsiveGrid>
                    </View>
                  ))}
                </>
              )}
    </Screen>
  );
}
