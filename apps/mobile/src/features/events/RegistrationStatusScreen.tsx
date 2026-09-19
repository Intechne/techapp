import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, ErrorState, LoadingSkeleton, MetadataRow, Modal, Notice, RegistrationStatus, Screen, StatusBadge, TechIcon, Text, colors, guardianStatusView, space, useToast, type TechIconName } from '../../design-system';
import { formatDate, formatDateRange } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { RegistrationStatus as Status } from '../../lib/database.types';
import type { SharedEventParamList } from '../../navigation/types';
import { cancelRegistration, eventKeys, fetchGuardianRequest, fetchRegistration } from './api';
import { placeLabel } from './labels';

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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const reg = useQuery({ queryKey: eventKeys.registration(registrationId), queryFn: () => fetchRegistration(registrationId) });
  const needsGuardian = reg.data?.status === 'pending_guardian';
  const guardian = useQuery({ queryKey: eventKeys.guardian(registrationId), queryFn: () => fetchGuardianRequest(registrationId), enabled: needsGuardian });

  const cancel = useMutation({
    mutationFn: () => cancelRegistration(registrationId),
    onSuccess: async () => {
      setConfirmCancel(false);
      await Promise.all([qc.invalidateQueries({ queryKey: ['registrations'] }), qc.invalidateQueries({ queryKey: ['events'] })]);
      toast.show('Kaydın iptal edildi.');
    },
  });

  if (reg.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  if (reg.isError) return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(reg.error)} onRetry={() => void reg.refetch()} /></Screen>;

  const r = reg.data; const h = HEADLINE[r.status];
  const live = (['confirmed', 'waitlisted', 'pending_guardian', 'pending_review'] as Status[]).includes(r.status);
  const guardianView = guardianStatusView[guardian.data?.status ?? 'not_sent'];
  const canSendGuardian = needsGuardian && (!guardian.data || guardian.data.status !== 'pending');

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Kayıt durumu" />} refreshing={reg.isRefetching}
      onRefresh={() => { void reg.refetch(); if (needsGuardian) void guardian.refetch(); }}
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

      {needsGuardian && (
        <Card style={{ marginTop: space[3], gap: space[2] }}>
          <StatusBadge view={guardianView} />
          {guardian.data?.status === 'pending'
            ? <Text variant="bodySmall" color="textSecondary">{guardian.data.guardian_email_masked} adresine bir onay bağlantısı gönderdik. Bağlantı {formatDate(guardian.data.expires_at)} tarihine kadar geçerli.</Text>
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
  icon: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: space[5], marginBottom: space[5] },
});
