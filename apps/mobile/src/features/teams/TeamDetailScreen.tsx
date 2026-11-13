import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, ApplicationStatus, Avatar, BottomSheet, Button, Card, DemoTag, Divider, ErrorState, LoadingSkeleton, MetadataRow, Notice, Screen, StatusBadge, Tag, Text, TextArea, TextButton, colors, formatCount, membershipStatusView, radius, space, useToast } from '../../design-system';
import { formatDate } from '../../lib/dates';
import { openExternalUrl } from '../../lib/links';
import { toAppError } from '../../lib/errors';
import type { CommunityStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { usePendingIntent } from '../auth/pendingIntent';
import { fetchMyMembership, fetchMyRecruitmentApplications, fetchOpenPosts, fetchTeam, fetchTeamProfile, fetchTeamProjects, requestJoin, teamKeys, withdrawJoin, type RecruitmentPost } from './api';
import { categoryIcon } from './categoryIcon';
import { KIND_LABEL, RECRUITMENT_STATUS, ROLE_LABEL, ROLE_NAME, ROLE_TONE } from './labels';
import { permissionsFor } from './logic';
import { RecruitmentApplySheet } from './RecruitmentApplySheet';
import { TeamCover } from './TeamCover';

const MEMBER = { one: 'üye', other: 'üye' };
/** A number on a role tile: plain below 1000, an order of magnitude from there ("12.000+"), same rule as every member count. */
const tileCount = (n: number) => (n < 1000 ? String(n) : formatCount(n, { one: '', other: '' }).trim());

export function TeamDetailScreen({ navigation, route }: NativeStackScreenProps<CommunityStackParamList, 'TeamDetail'>) {
  const { teamId } = route.params;
  const { userId } = useSession();
  const qc = useQueryClient(); const toast = useToast();
  const intent = usePendingIntent();
  const [sheet, setSheet] = useState(false); const [message, setMessage] = useState(''); const [applyTo, setApplyTo] = useState<RecruitmentPost | null>(null);

  const team = useQuery({ queryKey: teamKeys.detail(teamId), queryFn: () => fetchTeam(teamId) });
  const posts = useQuery({ queryKey: teamKeys.posts(teamId), queryFn: () => fetchOpenPosts(teamId) });
  const profile = useQuery({ queryKey: teamKeys.profile(teamId), queryFn: () => fetchTeamProfile(teamId), retry: false });
  const projects = useQuery({ queryKey: teamKeys.projects(teamId), queryFn: () => fetchTeamProjects(teamId) });
  const myApps = useQuery({ queryKey: teamKeys.myApplications(userId), queryFn: () => fetchMyRecruitmentApplications(userId!), enabled: !!userId });
  const membership = useQuery({ queryKey: teamKeys.membership(teamId, userId), queryFn: () => fetchMyMembership(teamId, userId!), enabled: !!userId });

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['teams'] })]);
  const join = useMutation({ mutationFn: () => requestJoin(teamId, message), onSuccess: async () => { setSheet(false); setMessage(''); await refresh(); toast.show('İsteğin gönderildi.', 'success'); } });
  const withdraw = useMutation({ mutationFn: (id: string) => withdrawJoin(id), onSuccess: async () => { await refresh(); toast.show('İsteğin geri çekildi.'); } });

  // A guest who tapped "Başvur" was sent to sign in: once the session exists, the sheet for that role opens.
  useFocusEffect(useCallback(() => {
    if (!userId || !posts.data) return;
    const resumed = intent.consume('apply_recruitment');
    const post = resumed && resumed.teamId === teamId ? posts.data.find((p) => p.id === resumed.postId) : undefined;
    if (post) setApplyTo(post);
  }, [userId, posts.data, intent, teamId]));

  if (team.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (team.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(team.error)} onRetry={() => void team.refetch()} /></Screen>;

  const t = team.data; const m = membership.data ?? null; const perms = permissionsFor(m);
  const openApply = (p: RecruitmentPost) => {
    if (!userId) { intent.set({ type: 'apply_recruitment', teamId, postId: p.id }); navigation.getParent()?.getParent()?.navigate('AuthEmail'); return; }
    setApplyTo(p);
  };
  const appliedPosts = new Map((myApps.data ?? []).filter((a) => a.status === 'submitted' || a.status === 'accepted').map((a) => [a.post_id, a.status]));
  const counts = profile.data?.role_counts; const hasRoles = !!counts && counts.captain + counts.mentor + counts.member > 0;
  const openJoin = () => { if (!userId) { navigation.getParent()?.getParent()?.navigate('AuthEmail'); return; } setSheet(true); };

  const footer = perms.isMember ? <Button label="Takım alanına git" iconRight="arrow" onPress={() => navigation.navigate('TeamWorkspace', { teamId })} />
    : m?.status === 'pending' ? <Button kind="secondary" label="İsteği geri çek" loading={withdraw.isPending} onPress={() => withdraw.mutate(m.id)} />
      : !t.accepts_join_requests ? <Text variant="bodySmall" color="textSecondary" center>Şu an yeni üye almıyor.</Text>
        : <Button label="Katılma isteği gönder" loading={!!userId && membership.isPending} onPress={openJoin} />;

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} />} footer={footer}
      refreshing={team.isRefetching} onRefresh={() => { void team.refetch(); void posts.refetch(); void profile.refetch(); void projects.refetch(); if (userId) void membership.refetch(); }}>
      <TeamCover label={[KIND_LABEL[t.kind], t.category?.toLocaleUpperCase('tr')].filter(Boolean).join(' · ')} name={t.name} tagline={t.tagline} icon={categoryIcon(t.category_key, t.kind)} cover={{ path: t.cover_path, blurhash: t.cover_blurhash }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[4] }}>
        {m?.status === 'pending' && <StatusBadge view={membershipStatusView.pending} />}
        {perms.isMember && <StatusBadge view={membershipStatusView.active} />}
        {t.is_demo && <DemoTag />}
      </View>
      <View style={{ gap: space[3], marginTop: space[4] }}>
        <MetadataRow icon="community" strong>{formatCount(t.member_count, MEMBER)}</MetadataRow>
        {!!t.city && <MetadataRow icon="location" strong>{t.city}</MetadataRow>}
      </View>
      {withdraw.error && <View style={{ marginTop: space[4] }}><Notice tone="danger">{toAppError(withdraw.error).message}</Notice></View>}
      {m?.status === 'pending' && <View style={{ marginTop: space[4] }}><Notice tone="info">İsteğin kaptana ulaştı. Kabul edildiğinde takım alanı burada açılır.</Notice></View>}

      {!!t.about && (<><Divider /><Text variant="section">Hakkında</Text><Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>{t.about}</Text></>)}

      {hasRoles && counts && (
        <>
          <Divider />
          <Text variant="section">Rol dağılımı</Text>
          <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[3] }}>
            {(['captain', 'mentor', 'member'] as const).map((role) => (
              <View key={role} accessible accessibilityLabel={`${ROLE_NAME[role]}: ${counts[role]}`} style={styles.roleTile}>
                <Text variant="title" style={{ color: colors.ink }} numberOfLines={1} adjustsFontSizeToFit>{tileCount(counts[role])}</Text>
                <Text variant="caption" color="textSecondary">{ROLE_NAME[role]}</Text>
              </View>
            ))}
          </View>
          {/* Only what team_public_profile returned: adult, discoverable captains and mentors. Nobody else is ever named here. */}
          {!!profile.data?.leaders.length && (
            <View style={{ marginTop: space[4], gap: space[3] }}>
              <Text variant="label" color="textSecondary">Takımın liderleri</Text>
              {profile.data.leaders.map((l, i) => (
                <View key={`${l.role}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <Avatar name={l.display_name} size={36} tone={l.role === 'captain' ? 'iris' : 'moss'} />
                  <Text variant="label" breakStrategy="words" style={{ flex: 1 }}>{l.display_name}</Text>
                  <Tag label={ROLE_LABEL[l.role]} tone={ROLE_TONE[l.role]} />
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <Divider />
      <Text variant="section">Açık roller</Text>
      <View style={{ gap: space[3], marginTop: space[3] }}>
        {posts.isError ? <ErrorState error={toAppError(posts.error)} onRetry={() => void posts.refetch()} />
          : !posts.data?.length ? (posts.isPending ? <LoadingSkeleton cards={1} variant="row" /> : <Text variant="bodySmall" color="textSecondary">Şu an açık rol yok. Takım yeni bir ilan açtığında burada görünür.</Text>)
            : posts.data.map((p) => {
              const applied = appliedPosts.get(p.id);
              return (
                <Card key={p.id} style={{ gap: space[2] }}>
                  {/* Free text written by the team: shown as typed (Q2), unlike a category it is never capitalised. */}
                  {!!p.role_label && <View style={{ flexDirection: 'row' }}><Tag label={p.role_label} /></View>}
                  <Text variant="cardTitle" breakStrategy="words">{p.title}</Text>
                  {!!p.description && <Text variant="bodySmall" color="textSecondary" numberOfLines={4}>{p.description}</Text>}
                  {p.skills.length > 0 && <Text variant="caption" color="textSecondary">{p.skills.join(' · ')}</Text>}
                  {!!p.closes_at && <Text variant="caption" color="textSecondary">Son başvuru: {formatDate(p.closes_at)}</Text>}
                  {applied ? <View style={{ flexDirection: 'row', marginTop: space[1] }}><ApplicationStatus status={RECRUITMENT_STATUS[applied]} /></View>
                    : !perms.isMember && <Button kind="secondary" label="Başvur" accessibilityLabel={`${p.title}: başvur`} onPress={() => openApply(p)} style={{ marginTop: space[2] }} />}
                </Card>
              );
            })}
      </View>

      {(!!projects.data?.length || projects.isError || perms.canManage) && (
        <>
          <Divider />
          <Text variant="section">Projeler</Text>
          <View style={{ gap: space[3], marginTop: space[3] }}>
            {projects.isError ? <ErrorState error={toAppError(projects.error)} onRetry={() => void projects.refetch()} />
              : projects.data?.map((pr) => (
                <Card key={pr.id} style={{ gap: space[2] }}>
                  {/* Year on its own line: beside a long unbreakable title it would be squeezed to one digit. */}
                  {pr.year != null && <Text variant="label" color="textSecondary">{pr.year}</Text>}
                  <Text variant="cardTitle" breakStrategy="words">{pr.title}</Text>
                  {!!pr.summary && <Text variant="bodySmall" color="textSecondary">{pr.summary}</Text>}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
                    {!!pr.url && <TextButton label="Bağlantıyı aç" iconRight="arrow" accessibilityRole="link" accessibilityLabel={`${pr.title}: bağlantıyı aç`} onPress={() => void openExternalUrl(pr.url, () => toast.show('Bağlantı açılamadı.', 'danger'))} />}
                    {perms.canManage && <TextButton label="Düzenle" accessibilityLabel={`${pr.title}: düzenle`} onPress={() => navigation.navigate('TeamProjectEditor', { teamId, projectId: pr.id })} />}
                  </View>
                </Card>
              ))}
            {perms.canManage && <Button kind="secondary" icon="plus" label="Proje ekle" onPress={() => navigation.navigate('TeamProjectEditor', { teamId })} />}
          </View>
        </>
      )}

      {!!profile.data?.events.length && (
        <>
          <Divider />
          <Text variant="section">Etkinlikler</Text>
          <View style={{ gap: space[3], marginTop: space[3] }}>
            {profile.data.events.map((e) => (
              <Card key={e.id} style={{ gap: space[1] }}>
                <Text variant="cardTitle" breakStrategy="words">{e.title}</Text>
                {!!e.starts_at && <Text variant="caption" color="textSecondary">{formatDate(e.starts_at)}</Text>}
              </Card>
            ))}
          </View>
        </>
      )}

      <RecruitmentApplySheet post={applyTo} userId={userId ?? ''} onClose={() => setApplyTo(null)} />
      <BottomSheet visible={sheet} title="Katılma isteği" onClose={() => setSheet(false)}>
        <Text variant="bodySmall" color="textSecondary">İsteğin takımın kaptanına ve mentorlarına gider. Adın ve yazdığın not görünür; iletişim bilgilerin paylaşılmaz.</Text>
        <TextArea label="Kısa bir not (isteğe bağlı)" value={message} onChangeText={setMessage} maxLength={500} placeholder="Neden katılmak istiyorsun, neye katkı verebilirsin?" />
        {join.error && <Notice tone="danger" title="İsteğin gönderilmedi">{toAppError(join.error).message}</Notice>}
        <Button label="İsteği gönder" loading={join.isPending} onPress={() => join.mutate()} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  roleTile: { flex: 1, minWidth: 0, backgroundColor: colors.surface, borderRadius: radius.control, borderWidth: 1, borderColor: colors.border, paddingVertical: space[3], paddingHorizontal: space[3], gap: space[1] },
});
