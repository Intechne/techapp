import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Input, Notice, Screen, Text, TextButton, space } from '../../design-system';
import { parsePayload, toAppError } from '../../lib/errors';
import { accountStateSchema } from '../../lib/database.types';
import { getSupabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { signInWithEmailOtp, verifyOtp } from './authService';
import { accountStateKey } from './SessionProvider';

const RESEND_SECONDS = 60;

export function AuthOtpScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'AuthOtp'>) {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(RESEND_SECONDS);
  const qc = useQueryClient();

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = useMutation({
    mutationFn: async () => {
      const session = await verifyOtp(email, code);
      // Decide the next step from the server's view of the account, not from local assumptions.
      const { data, error } = await getSupabase().rpc('my_account_state');
      if (error) throw toAppError(error);
      const state = data === null ? null : parsePayload(accountStateSchema, data);
      qc.setQueryData(accountStateKey(session.user.id), state);
      return state;
    },
    onSuccess: (state) => {
      if (state?.profile_complete) navigation.popTo('Main');
      else navigation.replace('ProfileBootstrap');
    },
  });
  const resend = useMutation({ mutationFn: () => signInWithEmailOtp(email), onSuccess: () => setWait(RESEND_SECONDS) });
  const error = verify.error ?? resend.error;

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Doğrulama" />}
      footer={<Button label="Doğrula" loading={verify.isPending} disabled={code.length < 6} onPress={() => verify.mutate()} />}>
      <Text variant="eyebrow" color="textSecondary">SON ADIM</Text>
      <Text variant="display" style={{ marginTop: space[2] }}>Kodunu gir.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>{email} adresine gönderdiğimiz 6 haneli kodu yaz.</Text>
      <View style={{ marginTop: space[6], gap: space[4] }}>
        <Input label="Doğrulama kodu" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
          textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} autoFocus style={{ letterSpacing: 8, fontSize: 22 }} />
        {error && <Notice tone="danger">{toAppError(error).message}</Notice>}
        <TextButton label={wait > 0 ? `Yeni kod iste (${wait} sn)` : 'Yeni kod iste'} disabled={wait > 0 || resend.isPending}
          color={wait > 0 ? '#666D66' : undefined} onPress={() => resend.mutate()} />
      </View>
    </Screen>
  );
}
