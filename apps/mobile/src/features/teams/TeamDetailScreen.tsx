import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, BottomSheet, Button, Card, Divider, ErrorState, LoadingSkeleton, MetadataRow, Notice, Screen, Tag, Text, TextArea, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { CommunityStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchMyMembership, fetchOpenPosts, fetchTeam, requestJoin, teamKeys, withdrawJoin } from './api';
import { KIND_LABEL, kindIcon } from './labels';
import { permissionsFor } from './logic';
import { TeamCover } from './TeamCover';

export function TeamDetailScreen({ navigation, route }: NativeStackScreenProps<CommunityStackParamList, 'TeamDetail'>) {
  const { teamId } = route.params;
  const { userId } = useSession();
  const qc = useQueryClient(); const toast = useToast();
  const [sheet, setSheet] = useState(false); const [message, setMessage] = useState('');

  const team = useQuery({ queryKey: teamKeys.detail(teamId), queryFn: () => fetchTeam(teamId) });
  const posts = useQuery({ queryKey: teamKeys.posts(teamId), queryFn: () => fetchOpenPosts(teamId) });
  const membership = useQuery({ queryKey: teamKeys.membership(teamId, userId), queryFn: () => fetchMyMembership(teamId, userId!), enabled: !!userId });

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['teams'] })]);
  const join = useMutation({ mutationFn: () => requestJoin(teamId, message), onSuccess: async () => { setSheet(false); setMessage(''); await refresh(); toast.show('İsteğin gönderildi.', 'success'); } });
  const withdraw = useMutation({ mutationFn: (id: string) => withdrawJoin(id), onSuccess: async () => { await refresh(); toast.show('İsteğin geri çekildi.'); } });

  if (team.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (team.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(team.error)} onRetry={() => void team.refetch()} /></Screen>;

  const t = team.data; const m = membership.data ?? null; const perms = permissionsFor(m);
  const openJoin = () => { if (!userId) { navigation.getParent()?.getParent()?.navigate('AuthEmail'); return; } setSheet(true); };

  const footer = perms.isMember ? <Button label="Takım alanına git" iconRight="arrow" onPress={() => navigation.navigate('TeamWorkspace', { teamId })} />
    : m?.status === 'pending' ? <Button kind="secondary" label="İsteği geri çek" loading={withdraw.isPending} onPress={() => withdraw.mutate(m.id)} />
      : !t.accepts_join_requests ? <Button label="Şu an yeni üye almıyor" disabled />
        : <Button label="Katılma isteği gönder" loading={!!userId && membership.isPending} onPress={openJoin} />;

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title={t.kind === 'team' ? 'Takım' : 'Topluluk'} />} footer={footer}
      refreshing={team.isRefetching} onRefresh={() => { void team.refetch(); void posts.refetch(); if (userId) void membership.refetch(); }}>
      <TeamCover label={[KIND_LABEL[t.kind], t.category?.toLocaleUpperCase('tr')].filter(Boolean).join(' · ')} name={t.name} tagline={t.tagline} icon={kindIcon(t.kind)} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[4] }}>
        {m?.status === 'pending' && <Tag label="İSTEĞİN BEKLİYOR" tone="apricot" icon="clock" />}
        {perms.isMember && <Tag label="ÜYESİN" tone="moss" icon="check" />}
        {t.is_demo && <Tag label="ÖRNEK İÇERİK" tone="neutral" />}
      </View>
      <View style={{ gap: space[3], marginTop: space[4] }}>
        <MetadataRow icon="community" strong>{t.member_count} üye</MetadataRow>
        {!!t.city && <MetadataRow icon="location" strong>{t.city}</MetadataRow>}
      </View>
      {withdraw.error && <View style={{ marginTop: space[4] }}><Notice tone="danger">{toAppError(withdraw.error).message}</Notice></View>}
      {m?.status === 'pending' && <View style={{ marginTop: space[4] }}><Notice tone="info">İsteğin kaptana ulaştı. Kabul edildiğinde takım alanı burada açılır.</Notice></View>}

      {!!t.about && (<><Divider /><Text variant="section">Birlikte ne yapıyoruz?</Text><Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>{t.about}</Text></>)}

      <Divider />
      <Text variant="section">Açık roller</Text>
      <View style={{ gap: space[3], marginTop: space[3] }}>
        {posts.isPending ? <LoadingSkeleton cards={1} /> : posts.isError ? <ErrorState error={toAppError(posts.error)} onRetry={() => void posts.refetch()} />
          : posts.data.length === 0 ? <Text variant="bodySmall" color="textSecondary">Şu an ilan edilmiş açık rol yok. Yine de katılma isteği gönderebilirsin.</Text>
            : posts.data.map((p) => (
              <Card key={p.id} style={{ gap: space[2] }}>
                {!!p.role_label && <Tag label={p.role_label.toLocaleUpperCase('tr')} />}
                <Text variant="cardTitle">{p.title}</Text>
                {!!p.description && <Text variant="bodySmall" color="textSecondary" numberOfLines={4}>{p.description}</Text>}
                {p.skills.length > 0 && <Text variant="caption" color="textSecondary">{p.skills.join(' · ')}</Text>}
              </Card>
            ))}
      </View>

      <BottomSheet visible={sheet} title="Katılma isteği" onClose={() => setSheet(false)}>
        <Text variant="bodySmall" color="textSecondary">İsteğin takımın kaptanına ve mentorlarına gider. Adın ve yazdığın not görünür; iletişim bilgilerin paylaşılmaz.</Text>
        <TextArea label="Kısa bir not (isteğe bağlı)" value={message} onChangeText={setMessage} maxLength={500} placeholder="Neden katılmak istiyorsun, neye katkı verebilirsin?" />
        {join.error && <Notice tone="danger" title="İsteğin gönderilmedi">{toAppError(join.error).message}</Notice>}
        <Button label="İsteği gönder" loading={join.isPending} onPress={() => join.mutate()} />
      </BottomSheet>
    </Screen>
  );
}
