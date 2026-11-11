import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, EmptyState, ErrorState, LoadingSkeleton, ResponsiveGrid, RowCard, Screen, SectionHeader, SegmentedControl, Tag, Text, formatCount, metaJoin, space } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { CommunityStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchMyTeams, fetchTeams, teamKeys } from '../teams/api';
import { MEMBERSHIP_LABEL, ROLE_LABEL, ROLE_TONE, kindIcon } from '../teams/labels';

const SEGMENTS = ['Topluluklar', 'Takımlar'] as const;
const MEMBER = { one: 'üye', other: 'üye' };

export function CommunityScreen({ navigation }: NativeStackScreenProps<CommunityStackParamList, 'CommunityHome'>) {
  const { userId } = useSession();
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('Takımlar');
  const kind = segment === 'Takımlar' ? 'team' : 'community';
  const list = useQuery({ queryKey: teamKeys.list(kind), queryFn: () => fetchTeams(kind) });
  const mine = useQuery({ queryKey: teamKeys.mine(userId), queryFn: () => fetchMyTeams(userId!), enabled: !!userId });

  const createTeam = () => {
    if (!userId) { navigation.getParent()?.getParent()?.navigate('AuthEmail'); return; }
    navigation.navigate('CreateTeam');
  };

  return (
    <Screen wide header={<AppHeader brand />} refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); if (userId) void mine.refetch(); }}>
      <Text variant="eyebrow" color="textSecondary">BİRLİKTE DAHA FAZLASI</Text>
      <Text variant="display" style={{ marginTop: space[2], marginBottom: space[4] }}>Senin gibi{'\n'}merak edenler.</Text>

      {!!userId && !!mine.data?.length && (
        <View style={{ marginBottom: space[5] }}>
          <SectionHeader title="Takımlarım" />
          <ResponsiveGrid>
            {mine.data.map((m) => (
              <RowCard key={m.id} leading={{ kind: 'icon', icon: kindIcon(m.team.kind) }} title={m.team.name}
                secondary={m.status === 'active' ? 'Görevler, üyeler ve istekler' : 'Kaptanın isteğini değerlendirmesi bekleniyor.'}
                trailing={{ kind: 'status', view: m.status === 'active' ? { label: ROLE_LABEL[m.role], tone: ROLE_TONE[m.role] } : { label: MEMBERSHIP_LABEL.pending ?? '', tone: 'apricot' } }}
                onPress={() => (m.status === 'active' ? navigation.navigate('TeamWorkspace', { teamId: m.team_id }) : navigation.navigate('TeamDetail', { teamId: m.team_id }))} />
            ))}
          </ResponsiveGrid>
        </View>
      )}

      <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
      <View style={{ marginTop: space[4] }}>
        {list.isPending ? <LoadingSkeleton variant="row" /> : list.isError ? <ErrorState error={toAppError(list.error)} onRetry={() => void list.refetch()} />
          : list.data.length === 0 ? <EmptyState icon="community" title="Burası yakında dolacak" body="İlk sen kur: takımını ya da topluluğunu oluştur, arkadaşlarını davet et." actionLabel="Takım kur" onAction={createTeam} />
            : (
              <ResponsiveGrid>
                {list.data.map((t) => (
                  <RowCard key={t.id} leading={{ kind: 'icon', icon: kindIcon(t.kind) }} title={t.name} secondary={t.tagline ?? undefined}
                    footnote={metaJoin([t.category, t.city, formatCount(t.member_count, MEMBER)])} isDemo={t.is_demo}
                    trailing={{ kind: 'chevron' }} onPress={() => navigation.navigate('TeamDetail', { teamId: t.id })} />
                ))}
              </ResponsiveGrid>
            )}
      </View>

      <View style={{ marginTop: space[6], gap: space[2] }}>
        <Tag label="KENDİ EKİBİN" tone="moss" />
        <Text variant="section">Bir fikrin ve iki arkadaşın mı var?</Text>
        <Text variant="bodySmall" color="textSecondary">Takımını kur; görevleri paylaş, katılma isteklerini buradan yönet.</Text>
        <Button kind="secondary" icon="plus" label="Takım kur" onPress={createTeam} style={{ marginTop: space[2] }} />
      </View>
    </Screen>
  );
}
