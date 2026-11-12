import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, EmptyState, ErrorState, LoadingSkeleton, ResponsiveGrid, RowCard, Screen, SegmentedControl, TechIcon, Text, TextButton, cardLayout, formatCount, metaJoin, radius, semantic, space, type RowLines } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { CommunityStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchMyTeams, fetchTeams, teamKeys } from '../teams/api';
import { ROLE_NAME, teamIcon } from '../teams/labels';

const SEGMENTS = ['Takımlar', 'Topluluklar'] as const;
const MEMBER = { one: 'üye', other: 'üye' };
/** Typical team row on a phone: one-line name, two-line tagline, üye · kategori · şehir footnote (skeleton shape). The count leads so a long category or city is what the 2-line clip cuts, never the number. */
const TEAM_ROW_LINES: RowLines = { title: 1, secondary: 2, footnote: 'text' };

export function CommunityScreen({ navigation }: NativeStackScreenProps<CommunityStackParamList, 'CommunityHome'>) {
  const { userId } = useSession();
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('Takımlar');
  const kind = segment === 'Takımlar' ? 'team' : 'community';
  const list = useQuery({ queryKey: teamKeys.list(kind), queryFn: () => fetchTeams(kind) });
  const mine = useQuery({ queryKey: teamKeys.mine(userId), queryFn: () => fetchMyTeams(userId!), enabled: !!userId });

  // "Takımım" is a shortcut into the Takım alanı, which only members can open: an active membership is the only thing that
  // qualifies. A pending request is not shown here; it lives on the team's profile and in Profil > Takımlar > "Bekleyen istekler" (Q15).
  // `active[0]` is the most recently joined team (fetchMyTeams orders by created_at desc).
  const active = userId ? (mine.data ?? []).filter((m) => m.status === 'active') : [];
  const myTeam = active[0];

  const createTeam = () => {
    if (!userId) { navigation.getParent()?.getParent()?.navigate('AuthEmail'); return; }
    navigation.navigate('CreateTeam');
  };

  return (
    <Screen wide header={<AppHeader brand />} refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); if (userId) void mine.refetch(); }}>
      <Text variant="display" style={{ marginBottom: space[5] }}>Senin gibi{'\n'}merak edenler.</Text>

      {!!myTeam && (
        <View style={styles.shortcut}>
          <RowCard leading={{ kind: 'icon', icon: teamIcon(myTeam.team) }} title={myTeam.team.name}
            secondary={metaJoin(['Takımım', ROLE_NAME[myTeam.role], active.length > 1 ? `+${active.length - 1} takım daha` : null])}
            trailing={{ kind: 'chevron' }} onPress={() => navigation.navigate('TeamWorkspace', { teamId: myTeam.team_id })} />
          {active.length > 1 && (
            <View style={styles.allTeams}>
              <TextButton label={`Tüm takımların (${active.length})`} iconRight="arrow"
                onPress={() => navigation.getParent()?.navigate('ProfileTab', { screen: 'ProfileHome', params: { segment: 'Takımlar' } })} />
            </View>
          )}
        </View>
      )}

      <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
      <View style={{ marginTop: space[4] }}>
        {list.isPending ? <LoadingSkeleton variant="row" rowLines={TEAM_ROW_LINES} /> : list.isError ? <ErrorState error={toAppError(list.error)} onRetry={() => void list.refetch()} />
          : list.data.length === 0 ? <EmptyState icon="community" title="Burası yakında dolacak" body="İlk sen kur: takımını ya da topluluğunu oluştur, arkadaşlarını davet et." actionLabel="Takım kur" onAction={createTeam} />
            : (
              <ResponsiveGrid>
                {list.data.map((t) => (
                  <RowCard key={t.id} leading={{ kind: 'icon', icon: teamIcon(t) }} title={t.name} secondary={t.tagline ?? undefined}
                    footnote={metaJoin([formatCount(t.member_count, MEMBER), t.category, t.city])} isDemo={t.is_demo}
                    trailing={{ kind: 'chevron' }} onPress={() => navigation.navigate('TeamDetail', { teamId: t.id })} />
                ))}
              </ResponsiveGrid>
            )}
      </View>

      <Card style={styles.create}>
        <View style={styles.createTile}><TechIcon name="plus" color={semantic.light.action.primary} /></View>
        <View style={styles.createText}>
          <Text variant="cardTitle" breakStrategy="words">Bir fikrin ve iki arkadaşın mı var?</Text>
          <Text variant="bodySmall" color="textSecondary">Takımını kur; görevleri paylaş, katılma isteklerini buradan yönet.</Text>
          <Button kind="secondary" label="Takım kur" onPress={createTeam} style={styles.createButton} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcut: { marginBottom: space[5] },
  allTeams: { alignSelf: 'flex-start', marginTop: space[2] },
  create: { marginTop: space[6], flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  createTile: { width: cardLayout.leadingTile, height: cardLayout.leadingTile, borderRadius: radius.control, backgroundColor: semantic.light.action.primarySoft, alignItems: 'center', justifyContent: 'center' },
  createText: { flex: 1, minWidth: 0, gap: space[1] },
  createButton: { marginTop: space[3], alignSelf: 'flex-start' },
});
