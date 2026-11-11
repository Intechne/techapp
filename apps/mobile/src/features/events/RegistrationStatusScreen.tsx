import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, ErrorState, LoadingSkeleton, Skeleton, MetadataRow, Modal, Notice, RegistrationStatus, Screen, StatusBadge, StatusTimeline, TechIcon, Text, colors, radius, guardianStatusView, registrationSteps, space, useToast, type TechIconName } from '../../design-system';
import { formatDateRange, formatDateTime, isPast } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { RegistrationStatus as Status } from '../../lib/database.types';
import type { SharedEventParamList } from '../../navigation/types';
import { cancelRegistration, eventKeys, fetchEligibility, fetchGuardianRequest, fetchRegistration } from './api';
import { placeLabel } from './labels';
import { dropCard, dropCards } from './offlineCard';
import { useSession } from '../auth/SessionProvider';

const HEADLINE: Record<Status, { eyebrow: string; title: string; body: string; icon: TechIconName; good: boolean }> = {
  confirmed: { eyebrow: 'GÜZEL BİR BAŞLANGIÇ', title: 'Yerini ayırdık.', body: 'Katılım kartın hazır. Etkinlik günü girişte göstermen yeterli.', icon: 'check', good: true },
  waitlisted: { eyebrow: 'SIRADASIN', title: 'Bekleme listesindesin.', body: 'Yer açıldığında sıradaki kişi otomatik olarak kayda geçer. Durumun değişirse burada göreceksin.', icon: 'clock', good: false },
  pending_guardian: { eyebrow: 'BİR ADIM DAHA VAR', title: 'Veli onayı bekleniyor.', body: 'Yerin ayrıldı. Katılımın, velin onay verdiğinde kesinleşecek.', icon: 'shield', good: false },
  pending_review: { eyebrow: 'BAŞVURUN ALINDI', title: 'Değerlendirmede.', body: 'Düzenleyen ekip başvuruları inceliyor. Sonucu burada göreceksin.', icon: 'clock', good: false },
  cancelled: { eyebrow: 'KAYIT', title: 'Bu kayıt iptal edildi.', body: 'Fikrini değiştirirsen, kayıtlar açıkken yeniden katılabilirsin.', icon: 'close', good: false },
  rejected: { eyebrow: 'KAYIT', title: 'Bu sefer olmadı.', body: 'Başvurun bu etkinlik için uygun bulunmadı. Sana uyan başka etkinlikler var.', icon: 'close', good: false },
  expired: { eyebrow: 'KAYIT', title: 'Onay süresi doldu.', body: 'Veli onayı zamanında gelmediği için yerin serbest bırakıldı. Kayıtlar açıksa yeniden deneyebilirsin.', icon: 'clock', good: false },
};

export function RegistrationStatusScreen({ navigation, route }: NativeStackScreenProps<SharedEventParamList, 'RegistrationStatus'>) {
  const { registrationId } = route.params;
  const qc = useQueryClient(); const toast = useToast();
  const { userId } = useSession();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const reg = useQuery({ queryKey: eventKeys.registration(registrationId), queryFn: () => fetchRegistration(registrationId), refetchOnWindowFocus: 'always' });
  const needsGuardian = reg.data?.status === 'pending_guardian';
  // The server says whether this event needs a guardian for this user (age is never computed here).
  const eventId = reg.data?.event_id;
  const eligibility = useQuery({ queryKey: eventKeys.eligibility(eventId ?? '', userId), queryFn: () => fetchEligibility(eventId!), enabled: !!eventId });
  const guardianRequired = needsGuardian || eligibility.data?.guardian_required === true;
  // Also read for finished registrations of a minor: a guardian request on record is what puts the guardian step on the timeline.
  const guardian = useQuery({ queryKey: eventKeys.guardian(registrationId), queryFn: () => fetchGuardianRequest(registrationId), enabled: !!reg.data && guardianRequired });

  const cancel = useMutation({
    mutationFn: () => cancelRegistration(registrationId),
    onSuccess: async () => {
      setConfirmCancel(false);
      // The card is void now: an offline copy must not keep showing a valid-looking QR.
      if (userId) await dropCard(userId, registrationId).catch(() => {});
      await Promise.all([qc.invalidateQueries({ queryKey: ['registrations'] }), qc.invalidateQueries({ queryKey: ['events'] })]);
      toast.show('Kaydın iptal edildi.');
    },
  });

  // The server says this registration is not (or no longer) confirmed: drop any saved offline card for it.
  const status = reg.data?.status;
  useEffect(() => {
    if (userId && status && status !== 'confirmed') void dropCards(userId, [registrationId]).catch(() => {});
  }, [userId, status, registrationId]);

  if (reg.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (reg.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(reg.error)} onRetry={() => void reg.refetch()} /></Screen>;

  const r = reg.data; const h = HEADLINE[r.status];
  const live = (['confirmed', 'waitlisted', 'pending_guardian', 'pending_review'] as Status[]).includes(r.status);
  const guardianView = guardianStatusView[guardian.data?.status ?? 'not_sent'];
  const steps = registrationSteps(r.status, guardianRequired);
  // Until the server has said whether a guardian step belongs in the line, draw a 4-step skeleton so the card does not grow later.
  const stepsUnknown = !guardianRequired && eligibility.isPending && r.status !== 'cancelled';
  const canSendGuardian = needsGuardian && (!guardian.data || guardian.data.status !== 'pending');

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Kayıt durumu" />} refreshing={reg.isRefetching}
      onRefresh={() => { void reg.refetch(); void eligibility.refetch(); if (guardianRequired) void guardian.refetch(); }}
      footer={
        r.status === 'confirmed' ? <Button label="Katılım kartını göster" icon="ticket" onPress={() => navigation.navigate('ParticipationCard', { registrationId })} />
          : needsGuardian ? <Button label={canSendGuardian ? 'Veli onayı iste' : 'Bağlantıyı yeniden gönder'} icon="shield" onPress={() => navigation.navigate('GuardianRequest', { registrationId })} />
            : !live ? <Button kind="secondary" label="Etkinliğe dön" onPress={() => navigation.navigate('EventDetail', { eventId: r.event_id })} /> : undefined
      }>
      <View style={[styles.icon, { backgroundColor: h.good ? colors.mossSoft : colors.primarySoft }]}>
        <TechIcon name={h.icon} size={32} color={h.good ? colors.moss : colors.primary} />
      </View>
      <Text variant="eyebrow" color="textSecondary" center>{h.eyebrow}</Text>
      <Text variant="display" center style={{ marginTop: space[2] }}>{h.title}</Text>
      <Text variant="body" color="textSecondary" center style={{ marginTop: space[3] }}>{h.body}</Text>

      <Card style={{ marginTop: space[6], gap: space[2] }}>
        <RegistrationStatus status={r.status} />
        <Text variant="cardTitle">{r.event.title}</Text>
        <MetadataRow icon="event">{formatDateRange(r.event.starts_at, r.event.ends_at)}</MetadataRow>
        <MetadataRow icon="location">{placeLabel(r.event)}</MetadataRow>
      </Card>

      {(steps.length > 0 || stepsUnknown) && (
        <Card style={{ marginTop: space[3] }}>
          <Text variant="eyebrow" color="textSecondary" style={{ marginBottom: space[3] }}>SÜREÇ</Text>
          {stepsUnknown ? (
            <View testID="timeline-skeleton" style={{ gap: space[4] }}>
              {[0, 1, 2, 3].map((i) => <View key={i} testID="timeline-skeleton-step"><Skeleton width="60%" height={20} /></View>)}
            </View>
          ) : <StatusTimeline steps={steps} />}
          {guardianRequired && guardian.isError && (
            <Pressable accessibilityRole="button" onPress={() => void guardian.refetch()} style={styles.inlineRetry}>
              <Text variant="bodySmall" color="danger">Veli durumu alınamadı · Tekrar dene</Text>
            </Pressable>
          )}
        </Card>
      )}

      {needsGuardian && (
        <Card style={{ marginTop: space[3], gap: space[2] }}>
          <StatusBadge view={guardianView} />
          {guardian.data?.status === 'pending'
            ? <Text variant="bodySmall" color="textSecondary">{guardian.data.guardian_email_masked} adresine bir onay bağlantısı gönderdik. {isPast(guardian.data.expires_at)
              ? 'Bağlantının süresi doldu. Yeniden gönderebilirsin.' : `Son geçerlilik: ${formatDateTime(guardian.data.expires_at)}.`}</Text>
            : <Text variant="bodySmall" color="textSecondary">Velinin e-posta adresini yaz; ona süreli ve tek kullanımlık bir onay bağlantısı gönderelim.</Text>}
        </Card>
      )}

      {live && <Button kind="danger" label="Kaydımı iptal et" style={{ marginTop: space[6] }} onPress={() => setConfirmCancel(true)} />}

      <Modal visible={confirmCancel} title="Kaydını iptal edelim mi?" onClose={() => setConfirmCancel(false)}>
        <Text variant="bodySmall" color="textSecondary">Yerin bekleme listesindeki bir sonraki kişiye geçer. Kayıtlar açıkken yeniden katılabilirsin ama aynı yer garanti olmaz.</Text>
        {cancel.error && <Notice tone="danger">{toAppError(cancel.error).message}</Notice>}
        <Button kind="danger" label="Evet, iptal et" loading={cancel.isPending} onPress={() => cancel.mutate()} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmCancel(false)} />
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inlineRetry: { minHeight: 44, justifyContent: 'center', marginTop: space[2] },
  icon: { width: 76, height: 76, borderRadius: radius.hero, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: space[5], marginBottom: space[5] },
});
