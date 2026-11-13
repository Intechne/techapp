import React, { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppHeader, Avatar, Button, Card, Divider, EmptyState, ErrorState, IconButton, LoadingSkeleton, MetadataRow, Modal, Notice, ResponsiveGrid, RowCard, Screen,
  SegmentedControl, SectionHeader, TextButton, checkedInRegistrationView, formatCount, membershipStatusView, metaJoin, registrationStatusView,
  LARGE_TEXT_FONT_SCALE, Tag, TechIcon, Text, colors, radius, space, useToast, type RowLines, type TechIconName,
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
import { fetchMyTeams, teamKeys } from '../teams/api';
import { categoryIcon, myTeamIcon } from '../teams/categoryIcon';

const SEGMENTS = ['Deneyimler', 'Katılımlar', 'Takımlar'] as const;
/** A Yaklaşan row: two-line title, date, status under the text on phones (approved Q6). */
export const UPCOMING_ROW_LINES: RowLines = { title: 2, secondary: 1, footnote: 'none', status: true };
/** From this font scale the three counters stack (approved Q14): three columns of large text cut their own labels. */
const COUNTERS_STACK_FONT_SCALE = LARGE_TEXT_FONT_SCALE;
/** Android keeps "Karaosmanoğlu-Çağlayan" as one unbreakable token and splits inside the second part; a zero-width space after the hyphen gives the line a break point at it. */
export const breakAfterHyphen = (name: string) => name.replace(/-(?=\p{L})/gu, '-\u200B');
const EXPERIENCE_NOUN = { one: 'deneyim', other: 'deneyim' };
const VERIFIED_NOUN = { one: 'doğrulanmış', other: 'doğrulanmış' };
const ATTENDED_NOUN = { one: 'katılım', other: 'katılım' };
const BENEFITS: readonly { icon: TechIconName; text: string }[] = [
  { icon: 'event', text: 'Etkinliklere katıl' },
  { icon: 'verified', text: 'Deneyimlerini doğrulat' },
  { icon: 'share', text: 'Profilini paylaş' },
];

function Counter({ n, label, tone = 'ink' }: { n: number; label: string; tone?: 'ink' | 'moss' }) {
  return (
    <View style={styles.counter}>
      <Text variant="section" color={tone}>{n}</Text>
      <Text variant="caption" color="textSecondary" breakStrategy="words">{label}</Text>
    </View>
  );
}

function ExperienceCard({ item, onPress }: { item: CvExperience; onPress: () => void }) {
  const range = formatRange(item.started_on, item.ended_on);
  return (
    <Card onPress={onPress} style={{ gap: space[2] }} accessibilityLabel={`${item.title}, ${KIND_LABEL[item.kind]}. Ayrıntıları aç`}>
      <View style={styles.tagRow}>
        <ProvenanceBadge attestation={item.attestation} />
        {item.status === 'draft' ? <Tag tone="neutral" label="TASLAK" /> : item.visibility === 'private' ? <Tag tone="neutral" label="GİZLİ" /> : null}
      </View>
      <Text variant="cardTitle" breakStrategy="words">{item.title}</Text>
      <MetadataRow icon={KIND_ICON[item.kind]}>{[KIND_LABEL[item.kind], item.role, item.organization_name].filter(Boolean).join(' · ')}</MetadataRow>
      {!!range && <MetadataRow icon="clock">{range}</MetadataRow>}
    </Card>
  );
}

export function ProfileScreen({ navigation, route }: NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>) {
  const { userId, session } = useSession();
  const { fontScale } = useWindowDimensions();
  const account = useAccountState();
  const toast = useToast();
  const { update } = usePrefs();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]>(route.params?.segment ?? 'Deneyimler');
  // "Tüm takımların" on Topluluk lands here with the Takımlar segment selected. The param is applied once and cleared, so the
  // same request works again after the user switched segments by hand.
  const wanted = route.params?.segment;
  const [seenWanted, setSeenWanted] = useState(wanted);
  if (wanted !== seenWanted) { setSeenWanted(wanted); if (wanted) setSegment(wanted); }
  useEffect(() => { if (wanted) navigation.setParams({ segment: undefined }); }, [wanted, navigation]);
  // The CV lists active teams only; the viewer's own pending requests come from the same query Topluluk uses (filtered by user_id).
  const mine = useQuery({ queryKey: teamKeys.mine(userId), queryFn: () => fetchMyTeams(userId!), enabled: !!userId });
  const pendingTeams = (mine.data ?? []).filter((m) => m.status === 'pending');

  const cv = useMyCv();
  // Same key as Katılımlarım, so the cache is shared and nothing extra is fetched when both are visited.
  const regs = useQuery({ queryKey: eventKeys.myRegistrations(userId), queryFn: () => fetchMyRegistrations(userId!), enabled: !!userId });
  const intent = usePendingIntent();
  const out = useMutation({ mutationFn: signOut, onSuccess: () => { intent.clear(); toast.show('Çıkış yapıldı.'); }, onError: (e) => toast.show(toAppError(e).message, 'danger') });
  const del = useMutation({ mutationFn: deleteAccount, onSuccess: () => { setConfirmDelete(false); intent.clear(); update(PERSONAL_PREFS_RESET); toast.show('Hesabın silindi.'); } });

  if (!userId) {
    return (
      <Screen header={<AppHeader brand />}>
        <Text variant="display" style={{ marginTop: space[4], marginBottom: space[6] }}>Yaptıkların{'\n'}seni anlatsın.</Text>
        <Text variant="body" color="textSecondary" style={{ marginBottom: space[7] }}>Giriş yaptığında deneyimlerin, doğrulamaların ve katılımların tek bir profilde toplanır.</Text>
        <Card testID="guest-benefits" style={{ gap: space[5], paddingVertical: space[6] }}>
          {BENEFITS.map((b) => (
            <View key={b.text} style={styles.benefit}>
              <View style={styles.benefitIcon}><TechIcon name={b.icon} color={colors.primary} /></View>
              <Text variant="cardTitle" breakStrategy="words" style={{ flex: 1 }}>{b.text}</Text>
            </View>
          ))}
        </Card>
        <Button style={{ marginTop: space[7] }} label="Giriş yap veya hesap oluştur" onPress={() => navigation.getParent()?.getParent()?.navigate('AuthEmail')} />
      </Screen>
    );
  }
  // Staff tools are shown from server-reported roles; the server re-checks the role on every check-in anyway.
  const canCheckIn = account.data?.organization_roles.some((r) => CHECKIN_ROLES.includes(r.role)) ?? false;
  const incomplete = account.data && !account.data.profile_complete;

  return (
    <Screen wide header={<AppHeader brand right={<IconButton icon="edit" accessibilityLabel="Profili düzenle" onPress={() => navigation.navigate('EditProfile')} />} />} refreshing={cv.isRefetching} onRefresh={() => { void cv.refetch(); void account.refetch(); void regs.refetch(); }}>
      {cv.isPending ? <LoadingSkeleton cards={2} variant="row" rowLines={UPCOMING_ROW_LINES} /> : cv.isError ? <ErrorState error={toAppError(cv.error)} onRetry={() => void cv.refetch()} /> : (() => {
        const { profile, experiences, participations, volunteering, teams, share_token: shareToken } = cv.data;
        const stats = profileStats(cv.data, regs.data ?? [], new Date());
        const verifiedCount = stats.verified;
        const subtitle = [profile.city, profile.education_stage ? EDUCATION_LABEL[profile.education_stage] : null].filter(Boolean).join(' · ');
        return (
          <>
            <Text variant="display" style={{ marginBottom: space[5] }}>Yaptıkların{'\n'}seni anlatsın.</Text>
            {/* One card: the avatar never overlaps a cover. The edit action lives in the header bar, so the name gets the full width. */}
            <Card testID="identity-card" style={styles.identity}>
              <Avatar name={profile.display_name} size={56} />
              <View style={styles.identityText}>
                <Text variant="section" breakStrategy="words" accessibilityRole="header" accessibilityLabel={profile.display_name ?? undefined}>{breakAfterHyphen(profile.display_name ?? 'Adını ekle')}</Text>
                {!!(profile.headline || subtitle) && <Text variant="bodySmall" color="textSecondary" breakStrategy="words">{metaJoin([profile.headline, subtitle])}</Text>}
              </View>
            </Card>
            {!!profile.bio && <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>{profile.bio}</Text>}

            {incomplete && (
              <View style={{ marginTop: space[4] }}><Notice tone="warning" title="Profilin yarım kaldı">Etkinliklere katılmak için adını ve doğum tarihini tamamla.</Notice>
                <Button style={{ marginTop: space[3] }} label="Profilimi tamamla" onPress={() => navigation.getParent()?.getParent()?.navigate('ProfileBootstrap')} /></View>
            )}

            <View testID="counters" style={[styles.stats, fontScale >= COUNTERS_STACK_FONT_SCALE && styles.statsStacked]} accessible
              accessibilityLabel={`${formatCount(experiences.length, EXPERIENCE_NOUN)}, ${formatCount(verifiedCount, VERIFIED_NOUN)}, ${formatCount(stats.attended, ATTENDED_NOUN)}`.replace(/\u00A0/g, ' ')}>
              <Counter n={experiences.length} label="Deneyim" />
              <Counter n={verifiedCount} label="Doğrulanmış" tone="moss" />
              <Counter n={stats.attended} label="Katılım" />
            </View>

            {stats.upcoming.length > 0 && (
              <View style={{ marginBottom: space[5], gap: space[3] }}>
                <View style={styles.upcomingHead}>
                  <Text variant="section">Yaklaşan</Text>
                  {stats.upcoming.length > 3 && <TextButton label="Tümünü gör" iconRight="arrow" onPress={() => navigation.navigate('MyRegistrations')} />}
                </View>
                {/* The user's own registrations (user_id filter). A checked-in registration reads "GİRİŞ YAPILDI" when the CV already holds the check-in. */}
                <ResponsiveGrid>{stats.upcoming.slice(0, 3).map((r) => (
                  <RowCard key={r.id} leading={{ kind: 'icon', icon: 'ticket' }} title={r.event.title} secondary={formatDateTime(r.event.starts_at)}
                    trailing={{ kind: 'status', view: r.checkedIn ? checkedInRegistrationView : registrationStatusView[r.status] }} isDemo={r.event.is_demo}
                    onPress={() => navigation.navigate('RegistrationStatus', { registrationId: r.id })} />
                ))}</ResponsiveGrid>
              </View>
            )}

            <View style={{ marginBottom: space[4] }}><SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} /></View>

            {segment === 'Deneyimler' && (experiences.length === 0
              ? <EmptyState icon="spark" title="İlk deneyimini ekle" body="Bir proje, yarışma ya da gönüllü katkı. Önce kendi beyanın olarak görünür; istersen bir kurumdan doğrulama isteyebilirsin." actionLabel="Deneyim ekle" onAction={() => navigation.navigate('ExperienceEditor', {})} />
              : (
                <View style={{ gap: space[3] }}>
                  <ResponsiveGrid>{experiences.map((x) => <ExperienceCard key={x.id} item={x} onPress={() => navigation.navigate('ExperienceDetail', { experienceId: x.id })} />)}</ResponsiveGrid>
                  <Button kind="secondary" icon="plus" label="Deneyim ekle" onPress={() => navigation.navigate('ExperienceEditor', {})} />
                </View>
              ))}

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

            {segment === 'Takımlar' && (
              <>
                {/* Own group above the active list: a request is waiting on someone else, so it reads as a to-do, not as membership. */}
                {pendingTeams.length > 0 && (
                  <View style={{ marginBottom: space[5] }}>
                    <SectionHeader title="Bekleyen istekler" />
                    <ResponsiveGrid>{pendingTeams.map((m) => (
                      <RowCard key={m.id} leading={{ kind: 'icon', icon: categoryIcon(m.team.category_key, m.team.kind) }} title={m.team.name}
                        trailing={{ kind: 'status', view: membershipStatusView.pending }} isDemo={m.team.is_demo}
                        onPress={() => navigation.getParent()?.navigate('CommunityTab', { screen: 'TeamDetail', params: { teamId: m.team_id } })} />
                    ))}</ResponsiveGrid>
                  </View>
                )}
                {teams.length === 0
                  ? pendingTeams.length === 0 && <EmptyState icon="community" title="Henüz bir takımda değilsin" body="Topluluk sekmesinden bir takıma katılma isteği gönderebilir ya da kendi takımını kurabilirsin." actionLabel="Takımlara göz at" onAction={() => navigation.getParent()?.navigate('CommunityTab')} />
                  : <ResponsiveGrid>{teams.map((t) => (
                    <Card key={t.team_id} style={styles.teamRow}>
                      <View style={styles.teamIcon}><TechIcon name={myTeamIcon(mine.data, t)} color={colors.primary} /></View>
                      <View style={{ flex: 1 }}><Text variant="cardTitle" breakStrategy="words">{t.name}</Text><Text variant="caption" color="textSecondary">{[t.title, TEAM_ROLE_LABEL[t.role], t.since ? `${formatDate(t.since)} tarihinden beri` : null].filter(Boolean).join(' · ')}</Text></View>
                    </Card>))}</ResponsiveGrid>}
              </>
            )}

            <View style={{ marginTop: space[7], gap: space[2] }}>
              <Text variant="section">Beceriler</Text>
              {profile.skills.length === 0 ? <Text variant="bodySmall" color="textSecondary">Henüz beceri eklemedin. Profili düzenle’den ekleyebilirsin.</Text> : (
                <View style={styles.tagRow}>{profile.skills.map((s) => <Tag key={s} tone="neutral" label={s} />)}</View>
              )}
              <Text variant="caption" color="textSecondary">Beceriler kendi beyanındır; bir kurum tarafından ölçülmüş ya da doğrulanmış değildir.</Text>
            </View>

            <View style={{ marginTop: space[5], maxWidth: 560 }}><CvShareCard token={shareToken} name={profile.display_name} /></View>

            <View style={{ marginTop: space[7] }}>
            <ResponsiveGrid maxColumns={2}>
              <RowCard leading={{ kind: 'icon', icon: 'ticket' }} title="Katılımlarım" secondary="Kayıt durumların ve katılım kartların" trailing={{ kind: 'chevron' }} onPress={() => navigation.navigate('MyRegistrations')} />
              {canCheckIn && <RowCard leading={{ kind: 'icon', icon: 'verified' }} title="Giriş kontrolü" secondary="Düzenleyen ekip için katılımcı girişi" trailing={{ kind: 'chevron' }} onPress={() => navigation.navigate('CheckIn')} />}
            </ResponsiveGrid>
            </View>
          </>
        );
      })()}

      <Divider />
      <View testID="account-section">
      <Text variant="section">Hesap</Text>
      {!!session?.user.email && <Text variant="caption" color="textSecondary" style={{ marginTop: space[1] }}>{`${session.user.email} ile giriş yaptın`}</Text>}
      <View style={{ gap: space[3], marginTop: space[3], maxWidth: 480 }}>
        <Button kind="secondary" label="Çıkış yap" loading={out.isPending} onPress={() => out.mutate()} />
        <Button kind="danger" label="Hesabımı sil" onPress={() => setConfirmDelete(true)} />
      </View>
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
  identity: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  identityText: { flex: 1, minWidth: 0 },
  stats: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, paddingVertical: space[4], marginVertical: space[5] },
  statsStacked: { flexDirection: 'column', gap: space[3], paddingHorizontal: space[4] },
  counter: { flex: 1, alignItems: 'center' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  benefitIcon: { width: 46, height: 46, borderRadius: radius.control, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  upcomingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  teamIcon: { width: 46, height: 46, borderRadius: radius.control, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
