import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, Checkbox, Input, Notice, Screen, StatusBadge, Text, guardianStatusView, space, useToast } from '../../design-system';
import { formatDateTime, isPast } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import type { SharedEventParamList } from '../../navigation/types';
import { isValidEmail } from '../auth/authService';
import { eventKeys, fetchGuardianRequest, sendGuardianRequest } from '../events/api';

/**
 * The minor only supplies the guardian's address. The token is minted by the server and e-mailed by an Edge Function;
 * approval happens on a separate web page. There is no in-app way to mark consent as given.
 */
export function GuardianRequestScreen({ navigation, route }: NativeStackScreenProps<SharedEventParamList, 'GuardianRequest'>) {
  const { registrationId } = route.params;
  const qc = useQueryClient(); const toast = useToast();
  const current = useQuery({ queryKey: eventKeys.guardian(registrationId), queryFn: () => fetchGuardianRequest(registrationId) });
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [informed, setInformed] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; informed?: string }>({});

  const send = useMutation({
    mutationFn: () => sendGuardianRequest(registrationId, email, name),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: eventKeys.guardian(registrationId) });
      toast.show('Onay bağlantısı velinin e-postasına gönderildi.', 'success');
      navigation.goBack();
    },
  });

  const pending = current.data?.status === 'pending';
  const submit = () => {
    const next = {
      name: name.trim().length < 5 ? 'Velinin adını ve soyadını yaz.' : undefined,
      email: isValidEmail(email) ? undefined : 'Geçerli bir e-posta adresi yaz.',
      informed: informed ? undefined : 'Devam etmek için bu kutuyu işaretle.',
    };
    setErrors(next);
    if (!next.name && !next.email && !next.informed) send.mutate();
  };

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Veli onayı" />} footer={<Button label={pending ? 'Bağlantıyı yeniden gönder' : 'Onay bağlantısını gönder'} loading={send.isPending} onPress={submit} />}>
      <Text variant="title">Velinden onay isteyelim.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>
        Velin; etkinliği, tarihini ve düzenleyeni görecek ve tek dokunuşla onaylayıp reddedebilecek. Bağlantı süreli ve tek kullanımlıktır; gönderdiğinde son geçerlilik tarihini burada göreceksin.
      </Text>
      <View style={{ gap: space[5], marginTop: space[6] }}>
        {current.data && <StatusBadge view={guardianStatusView[current.data.status]} />}
        {pending && current.data && (
          <Card style={{ gap: space[2] }}>
            <Text variant="cardTitle">Velinin cevabını bekliyoruz.</Text>
            <Text variant="bodySmall" color="textSecondary">
              {current.data.guardian_email_masked} adresine onay bağlantısı gitti ({formatDateTime(current.data.last_sent_at ?? current.data.requested_at)}).{' '}
              {isPast(current.data.expires_at) ? 'Bağlantının süresi doldu. Yeniden gönderebilirsin.' : `Son geçerlilik: ${formatDateTime(current.data.expires_at)}.`}
            </Text>
            <Text variant="bodySmall" color="textSecondary">Velin onaylayınca kaydın otomatik kesinleşir; bu ekranı açık tutman gerekmez. Mail ulaşmadıysa spam klasörüne bak ya da aşağıdan yeniden gönder: önceki bağlantı geçersiz olur.</Text>
          </Card>
        )}
        <Input label="Velinin adı soyadı" value={name} onChangeText={setName} autoComplete="off" error={errors.name} />
        <Input label="Velinin e-posta adresi" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="off" error={errors.email}
          help={pending ? 'Aynı adresi yazarsan bağlantı yeniden gönderilir. Farklı bir adres yazarsan önceki istek iptal olur.' : 'Kendi adresinden farklı olmalı.'} />
        <Checkbox checked={informed} onChange={setInformed} label="Velimin bu istekten haberi var; bağlantı onun adresine gönderilsin." error={errors.informed} />
        {send.error && <Notice tone="danger" title="Bağlantı gönderilemedi">{toAppError(send.error).message}</Notice>}
      </View>
    </Screen>
  );
}
