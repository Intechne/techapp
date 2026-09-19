import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Checkbox, Input, Notice, Screen, StatusBadge, Text, guardianStatusView, space, useToast } from '../../design-system';
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
    <Screen header={<AppHeader onBack={navigation.goBack} title="Veli onayı" />} footer={<Button label="Onay bağlantısını gönder" loading={send.isPending} onPress={submit} />}>
      <Text variant="eyebrow" color="textSecondary">BİR ADIM DAHA</Text>
      <Text variant="display" style={{ marginTop: space[2] }}>Velinden{'\n'}onay isteyelim.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>
        Velin; etkinliği, tarihini ve düzenleyeni görecek ve tek dokunuşla onaylayıp reddedebilecek. Bağlantı 72 saat geçerli ve tek kullanımlık.
      </Text>
      <View style={{ gap: space[5], marginTop: space[6] }}>
        {current.data && <StatusBadge view={guardianStatusView[current.data.status]} />}
        {current.data?.status === 'pending' && <Notice tone="info">Daha önce {current.data.guardian_email_masked} adresine gönderdik. Yeniden gönderirsen önceki bağlantı geçersiz olur.</Notice>}
        <Input label="Velinin adı soyadı" value={name} onChangeText={setName} autoComplete="off" error={errors.name} />
        <Input label="Velinin e-posta adresi" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="off" error={errors.email}
          help="Kendi adresinden farklı olmalı." />
        <Checkbox checked={informed} onChange={setInformed} label="Velimin bu istekten haberi var; bağlantı onun adresine gönderilsin." error={errors.informed} />
        {send.error && <Notice tone="danger" title="Bağlantı gönderilemedi">{toAppError(send.error).message}</Notice>}
      </View>
    </Screen>
  );
}
