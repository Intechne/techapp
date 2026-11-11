import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppHeader, Avatar, Button, Card, Divider, EmptyState, ErrorState, ListCard, LoadingSkeleton, MetadataRow, Modal, Notice, ResponsiveGrid, Screen,
  RegistrationStatus, SegmentedControl, Tag, TechIcon, Text, colors, radius, space, tones, useToast,
} from '../../design-system';
import { formatDate, formatDateTime } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { ProfileStackParamList } from '../../navigation/types';
import { deleteAccount, signOut } from '../auth/authService';
import { useAccountState, useSession } from '../auth/SessionProvider';
import { usePrefs } from '../onboarding/PrefsProvider';
import { PERSONAL_PREFS_RESET } from '../../lib/localPrefs';
import { usePendingIntent } from '../auth/pendingIntent';
import { eventKeys, fetchMyRegistrations } from '../events/api';
import { useMyCv } from './api';
import { profileStats } from './profileStats';
import type { CvExperience } from './cvSchema';
import { EDUCATION_LABEL, KIND_ICON, KIND_LABEL, TEAM_ROLE_LABEL } from './labels';
import { formatRange } from './logic';
import { CvShareCard } from './CvShareCard';
import { ProvenanceBadge } from './ProvenanceBadge';
import { CHECKIN_ROLES } from '../checkin/api';

const SEGMENTS = ['Deneyimler', 'Katılımlar', 'Takımlar'] as const;

function ExperienceCard({ item, onPress }: { item: CvExperience; onPress: () => void }) {
  const range = formatRange(item.started_on, item.ended_on);
  return (
    <Card onPress={onPress} style={{ gap: space[2] }} accessibilityLabel={`${item.title}, ${KIND_LABEL[item.kind]}. Ayrıntıları aç`}>
      <View style={styles.tagRow}>
        <ProvenanceBadge attestation={item.attestation} />
        {item.status === 'draft' ? <Tag tone="neutral" label="TASLAK" /> : item.visibility === 'private' ? <Tag tone="neutral" label="GİZLİ" /> : null}
      </View>
      <Text variant="cardTitle">{item.title}</Text>
      <MetadataRow icon={KIND_ICON[item.kind]}>{[KIND_LABEL[item.kind], item.role, item.organization_name].filter(Boolean).join(' · ')}</MetadataRow>
      {!!range && <MetadataRow icon="clock">{range}</MetadataRow>}
    </Card>
  );
}

export function ProfileScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>) {
  const { userId, session } = useSession();
  const account = useAccountState();
  const toast = useToast();
  const { update } = usePrefs();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>('Deneyimler');

  const cv = useMyCv();
  // Same key as Katılımlarım, so the cache is shared and nothing extra is fetched when both are visited.
  const regs = useQuery({ queryKey: eventKeys.myRegistrations(userId), queryFn: () => fetchMyRegistrations(userId!), enabled: !!userId });
  const intent = usePendingIntent();
  const out = useMutation({ mutationFn: signOut, onSuccess: () => { intent.clear(); toast.show('Çıkış yapıldı.'); }, onError: (e) => toast.show(toAppError(e).message, 'danger') });
  const del = useMutation({ mutationFn: deleteAccount, onSuccess: () => { setConfirmDelete(false); intent.clear(); update(PERSONAL_PREFS_RESET); toast.show('Hesabın silindi.'); } });

  if (!userId) {
    return (
      <Screen header={<AppHeader brand />}>
        <EmptyState icon="profile" title="Yaptıkların seni anlatsın" body="Giriş yaptığında deneyimlerin, doğrulamaların ve katılımların burada tek bir profilde toplanır."
          actionLabel="Giriş yap veya hesap oluştur" onAction={() => navigation.getParent()?.getParent()?.navigate('AuthEmail')} />
      </Screen>
    );
  }
  // Staff tools are shown from server-reported roles; the server re-checks the role on every check-in anyway.
  const canCheckIn = account.data?.organization_roles.some((r) => CHECKIN_ROLES.includes(r.role)) ?? false;
  const incomplete = account.data && !account.data.profile_complete;

  return (
    <Screen wide header={<AppHeader brand />} refreshing={cv.isRefetching} onRefresh={() => { void cv.refetch(); void account.refetch(); void regs.refetch(); }}>
      {cv.isPending ? <LoadingSkeleton cards={2} /> : cv.isError ? <ErrorState error={toAppError(cv.error)} onRetry={() => void cv.refetch()} /> : (() => {
        const { profile, experiences, participations, volunteering, teams, share_token: shareToken } = cv.data;
        const stats = profileStats(cv.data, regs.data ?? [], new Date());
        const verifiedCount = stats.verified;
        const subtitle = [profile.city, profile.education_stage ? EDUCATION_LABEL[profile.education_stage] : null].filter(Boolean).join(' · ');
        return (
          <>
            <View style={styles.cover}>
              <View style={styles.coverArt} />
              <Text variant="title" style={{ color: tones.iris.fg, maxWidth: '80%' }}>Yaptıkların{'\n'}seni anlatsın.</Text>
            </View>
            <View style={styles.identity}>
              <View style={styles.avatarRing}><Avatar name={profile.display_name} size={72} /></View>
              {/* The row is pulled up by space[7] so the avatar overlaps the cover; the text starts clear below the cover edge. */}
              <View style={{ flex: 1, paddingTop: space[7] + space[2] }}>
                <Text variant="section" accessibilityRole="header">{profile.display_name ?? 'Adını ekle'}</Text>
                <Text variant="bodySmall" color="textSecondary">{profile.headline ?? session?.user.email ?? ''}</Text>
                {!!subtitle && <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>{subtitle}</Text>}
              </View>
            </View>
            {!!profile.bio && <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>{profile.bio}</Text>}

            {incomplete && (
              <View style={{ marginTop: space[4] }}><Notice tone="warning" title="Profilin yarım kaldı">Etkinliklere katılmak için adını ve doğum tarihini tamamla.</Notice>
                <Button style={{ marginTop: space[3] }} label="Profilimi tamamla" onPress={() => navigation.getParent()?.getParent()?.navigate('ProfileBootstrap')} /></View>
            )}

            <View style={styles.stats} accessible accessibilityLabel={`${experiences.length} deneyim, ${verifiedCount} doğrulanmış, ${stats.attended} katıldığı etkinlik`}>
              {([['Deneyim', experiences.length], ['Doğrulanmış', verifiedCount], ['Katılım', stats.attended]] as const).map(([label, n]) => (
                <View key={label} style={{ flex: 1, alignItems: 'center' }}><Text variant="section" color={label === 'Doğrulanmış' ? 'moss' : 'ink'}>{n}</Text><Text variant="caption" color="textSecondary">{label}</Text></View>
              ))}
            </View>

            {stats.upcoming.length > 0 && (
              <View style={{ marginBottom: space[5], gap: space[2] }}>
                <View style={styles.upcomingHead}>
                  <Text variant="label">Yaklaşan</Text>
                  {stats.upcoming.length > 3 && <Button kind="secondary" label="Tümünü gör" onPress={() => navigation.navigate('MyRegistrations')} />}
                </View>
                {stats.upcoming.slice(0, 3).map((r) => {
                  return (
                    <Card key={r.id} onPress={() => navigation.navigate('RegistrationStatus', { registrationId: r.id })} style={{ gap: space[2] }}
                      accessibilityLabel={`${r.event.title}, yaklaşan kayıt. Durumu aç`}>
                      <RegistrationStatus status={r.status} />
                      <Text variant="cardTitle">{r.event.title}</Text>
                      <MetadataRow icon="event">{formatDateTime(r.event.starts_at)}</MetadataRow>
                    </Card>
                  );
                })}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
              <Button style={{ flex: 1, minWidth: 140 }} icon="plus" label="Deneyim ekle" onPress={() => navigation.navigate('ExperienceEditor', {})} />
              <Button style={{ flex: 1, minWidth: 140 }} kind="secondary" label="Profili düzenle" onPress={() => navigation.navigate('EditProfile')} />
            </View>

            <View style={{ marginTop: space[6], gap: space[2] }}>
              <Text variant="label">Beceriler</Text>
              {profile.skills.length === 0 ? <Text variant="bodySmall" color="textSecondary">Henüz beceri eklemedin. Profili düzenle’den ekleyebilirsin.</Text> : (
                <View style={styles.tagRow}>{profile.skills.map((s) => <Tag key={s} tone="neutral" label={s} />)}</View>
              )}
              <Text variant="caption" color="textSecondary">Beceriler kendi beyanındır; bir kurum tarafından ölçülmüş ya da doğrulanmış değildir.</Text>
            </View>

            <View style={{ marginTop: space[5], maxWidth: 560 }}><CvShareCard token={shareToken} name={profile.display_name} /></View>

            <View style={{ marginVertical: space[5] }}><SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} /></View>

            {segment === 'Deneyimler' && (experiences.length === 0
              ? <EmptyState icon="spark" title="İlk deneyimini ekle" body="Bir proje, yarışma ya da gönüllü katkı. Önce kendi beyanın olarak görünür; istersen bir kurumdan doğrulama isteyebilirsin." actionLabel="Deneyim ekle" onAction={() => navigation.navigate('ExperienceEditor', {})} />
              : <ResponsiveGrid>{experiences.map((x) => <ExperienceCard key={x.id} item={x} onPress={() => navigation.navigate('ExperienceDetail', { experienceId: x.id })} />)}</ResponsiveGrid>)}

            {segment === 'Katılımlar' && (participations.length + volunteering.length === 0
              ? <EmptyState icon="ticket" title="Henüz doğrulanmış bir katılımın yok" body="Bir etkinlikte girişte katılım kartın okutulduğunda katılımın burada kendiliğinden görünür." />
              : (
                <View style={{ gap: space[3] }}>
                  <Notice tone="info">Bu kayıtlar düzenleyenin giriş kaydına dayanır. Etkinliğe katıldığını gösterir; bir beceri ya da başarı ölçümü değildir.</Notice>
                  <ResponsiveGrid>
                    {participations.map((p) => (
                      <Card key={p.event_id} style={{ gap: space[2] }}>
                        <Tag tone="moss" icon="verified" label="KATILIM DOĞRULANDI · GİRİŞ KAYDI" />
                        <Text variant="cardTitle">{p.title}</Text>
                        <MetadataRow icon="event">{[formatDate(p.starts_at), p.organizer].filter(Boolean).join(' · ')}</MetadataRow>
                      </Card>
                    ))}
                    {volunteering.map((v) => (
                      <Card key={`v-${v.event_id}`} style={{ gap: space[2] }}>
                        <Tag tone="moss" icon="verified" label="GÖNÜLLÜ · DÜZENLEYEN ONAYI" />
                        <Text variant="cardTitle">{v.title}</Text>
                        <MetadataRow icon="leaf">{[v.duty, formatDate(v.starts_at), v.organizer].filter(Boolean).join(' · ')}</MetadataRow>
                      </Card>
                    ))}
                  </ResponsiveGrid>
                </View>
              ))}

            {segment === 'Takımlar' && (teams.length === 0
              ? <EmptyState icon="community" title="Henüz bir takımda değilsin" body="Topluluk sekmesinden bir takıma katılma isteği gönderebilir ya da kendi takımını kurabilirsin." actionLabel="Takımlara göz at" onAction={() => navigation.getParent()?.navigate('CommunityTab')} />
              : <ResponsiveGrid>{teams.map((t) => (
                <Card key={t.team_id} style={styles.teamRow}>
                  <View style={styles.teamIcon}><TechIcon name={t.kind === 'team' ? 'team' : 'community'} color={colors.primary} /></View>
                  <View style={{ flex: 1 }}><Text variant="cardTitle">{t.name}</Text><Text variant="caption" color="textSecondary">{[t.title, TEAM_ROLE_LABEL[t.role], t.since ? `${formatDate(t.since)} tarihinden beri` : null].filter(Boolean).join(' · ')}</Text></View>
                </Card>))}</ResponsiveGrid>)}

            <Divider />
            <ResponsiveGrid maxColumns={2}>
              <ListCard icon="ticket" title="Katılımlarım" body="Kayıt durumların ve katılım kartların" onPress={() => navigation.navigate('MyRegistrations')} />
              {canCheckIn && <ListCard icon="verified" title="Giriş kontrolü" body="Düzenleyen ekip için katılımcı girişi" onPress={() => navigation.navigate('CheckIn')} />}
            </ResponsiveGrid>
          </>
        );
      })()}

      <Divider />
      <Text variant="section">Hesap</Text>
      <View style={{ gap: space[3], marginTop: space[3], maxWidth: 480 }}>
        <Button kind="secondary" label="Çıkış yap" loading={out.isPending} onPress={() => out.mutate()} />
        <Button kind="danger" label="Hesabımı sil" onPress={() => setConfirmDelete(true)} />
      </View>

      <Modal visible={confirmDelete} title="Hesabını silelim mi?" onClose={() => setConfirmDelete(false)}>
        <Text variant="bodySmall" color="textSecondary">Profilin, deneyimlerin, kayıtların ve başvuruların sunucudan silinir. Bu işlem geri alınamaz.</Text>
        {del.error && <Notice tone="danger" title="Hesabın silinmedi">{toAppError(del.error).message}</Notice>}
        <Button kind="danger" label="Evet, hesabımı sil" loading={del.isPending} onPress={() => del.mutate()} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmDelete(false)} />
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: tones.iris.bg, borderRadius: radius.hero, minHeight: 132, padding: space[5], justifyContent: 'flex-start', overflow: 'hidden' },
  coverArt: { position: 'absolute', right: -18, top: 18, width: 120, height: 120, borderWidth: 20, borderRadius: 32, borderColor: tones.iris.fg, opacity: 0.16, transform: [{ rotate: '-25deg' }] },
  identity: { flexDirection: 'row', gap: space[3], marginTop: -space[7], paddingHorizontal: space[3] },
  avatarRing: { borderRadius: radius.pill, borderWidth: 4, borderColor: colors.canvas, backgroundColor: colors.canvas },
  stats: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, paddingVertical: space[4], marginVertical: space[5] },
  upcomingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  teamIcon: { width: 46, height: 46, borderRadius: radius.control, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
