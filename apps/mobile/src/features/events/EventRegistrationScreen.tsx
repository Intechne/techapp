import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, Checkbox, ErrorState, LoadingSkeleton, MetadataRow, Notice, Screen, Text, space } from '../../design-system';
import { track } from '../../lib/analytics';
import { formatDateRange } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList } from '../../navigation/types';
import { useAccountState, useSession } from '../auth/SessionProvider';
import { eventKeys, fetchEligibility, fetchEvent, registerForEvent } from './api';
import { placeLabel } from './labels';

export function EventRegistrationScreen({ navigation, route }: NativeStackScreenProps<SharedEventParamList, 'EventRegistration'>) {
  const { eventId } = route.params;
  const { userId } = useSession();
  const qc = useQueryClient();
  const account = useAccountState();
  const event = useQuery({ queryKey: eventKeys.detail(eventId), queryFn: () => fetchEvent(eventId) });
  const eligibility = useQuery({ queryKey: eventKeys.eligibility(eventId, userId), queryFn: () => fetchEligibility(eventId) });
  const [accepted, setAccepted] = useState(false);
  const [showError, setShowError] = useState(false);
  // One key per attempt: a retry after a dropped connection can never create a second registration.
  const idempotencyKey = useRef(Crypto.randomUUID());

  const submit = useMutation({
    mutationFn: () => registerForEvent(eventId, idempotencyKey.current),
    onSuccess: async (reg) => {
      track('registration_submitted', { event_id: eventId, status: reg.status });
      if (reg.status === 'pending_guardian') track('guardian_required', { event_id: eventId });
      if (reg.status === 'confirmed') track('registration_confirmed', { event_id: eventId });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['events'] }),
        qc.invalidateQueries({ queryKey: ['registrations'] }),
      ]);
      navigation.replace('RegistrationStatus', { registrationId: reg.id, fresh: true });
    },
  });

  if (event.isPending || eligibility.isPending || account.isPending) return <Screen header={<AppHeader onBack={navigation.goBack} />}><LoadingSkeleton cards={1} /></Screen>;
  const loadError = event.error ?? eligibility.error ?? account.error;
  if (loadError || !event.data || !eligibility.data) {
    return <Screen header={<AppHeader onBack={navigation.goBack} />}><ErrorState error={toAppError(loadError)} onRetry={() => { void event.refetch(); void eligibility.refetch(); void account.refetch(); }} /></Screen>;
  }
  const e = event.data; const el = eligibility.data;

  if (account.data && !account.data.profile_complete) {
    return (
      <Screen header={<AppHeader onBack={navigation.goBack} title="Katılım" />}
        footer={<Button label="Profilimi tamamla" onPress={() => navigation.getParent()?.getParent()?.navigate('ProfileBootstrap')} />}>
        <Notice tone="info" title="Önce kısa bir adım">Katılım için adına ve doğum tarihine ihtiyacımız var. Bir dakikanı alır.</Notice>
      </Screen>
    );
  }

  const waitlist = el.is_full && el.waitlist_enabled;
  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Katılım" />}
      footer={<Button label={waitlist ? 'Bekleme listesine katıl' : 'Katılımı tamamla'} loading={submit.isPending}
        onPress={() => { if (!accepted) { setShowError(true); return; } submit.mutate(); }} />}>
      <Text variant="eyebrow" color="textSecondary">KATILIMINI TAMAMLA</Text>
      <Text variant="display" style={{ marginTop: space[2] }}>İlk adım,{'\n'}burada.</Text>
      <Card style={{ marginTop: space[5], gap: space[2] }}>
        <Text variant="cardTitle">{e.title}</Text>
        <MetadataRow icon="event">{formatDateRange(e.starts_at, e.ends_at)}</MetadataRow>
        <MetadataRow icon="location">{placeLabel(e)}</MetadataRow>
      </Card>

      <View style={{ gap: space[3], marginTop: space[5] }}>
        {waitlist && <Notice tone="warning" title="Kontenjan şu an dolu">Bekleme listesine ekleneceksin. Yer açılırsa sıradaki kişi otomatik olarak kayda geçer ve haber veririz.</Notice>}
        {el.guardian_required && <Notice tone="info" title="Veli onayı gerekecek">Yerini ayıracağız; katılımın, velin e-postayla gelen bağlantıdan onay verdiğinde kesinleşecek. Bağlantı 72 saat geçerli.</Notice>}
        {e.requires_review && <Notice tone="info">Bu etkinlikte başvurular düzenleyen ekip tarafından değerlendiriliyor.</Notice>}
        <Notice tone="success" title="Düzenleyenle paylaşılacaklar">Adın ve kayıt durumun. İletişim bilgilerin ve doğum tarihin paylaşılmaz.</Notice>
        <Checkbox checked={accepted} onChange={(v) => { setAccepted(v); setShowError(false); }}
          label="Katılım bilgilerimin bu etkinliğin düzenleyicisiyle paylaşılmasını kabul ediyorum."
          error={showError ? 'Devam etmek için bu kutuyu işaretlemen gerekiyor.' : undefined} />
        {submit.error && <Notice tone="danger" title="Kaydın tamamlanmadı">{toAppError(submit.error).message}</Notice>}
      </View>
    </Screen>
  );
}
