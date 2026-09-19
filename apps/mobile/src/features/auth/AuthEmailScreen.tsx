import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Input, Notice, Screen, Text, space } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/types';
import { isValidEmail, signInWithEmailOtp } from './authService';
import { usePendingIntent } from './pendingIntent';

export function AuthEmailScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'AuthEmail'>) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const intent = usePendingIntent();
  const send = useMutation({ mutationFn: signInWithEmailOtp, onSuccess: () => navigation.navigate('AuthOtp', { email }) });
  const invalid = touched && !isValidEmail(email);
  const error = send.error ? toAppError(send.error) : null;

  return (
    <Screen
      header={<AppHeader onBack={() => { intent.clear(); navigation.goBack(); }} title="Giriş" />}
      footer={<Button label="Kodu gönder" loading={send.isPending} onPress={() => { setTouched(true); if (isValidEmail(email)) send.mutate(email); }} />}
    >
      <Text variant="eyebrow" color="textSecondary">HESABIN</Text>
      <Text variant="display" style={{ marginTop: space[2] }}>E-postanla{'\n'}devam et.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>
        Şifre yok. Adresine tek kullanımlık bir kod gönderiyoruz; hesabın yoksa aynı adımda oluşur.
      </Text>
      <View style={{ marginTop: space[6], gap: space[4] }}>
        <Input label="E-posta" value={email} onChangeText={setEmail} onBlur={() => setTouched(true)} autoCapitalize="none" autoComplete="email"
          keyboardType="email-address" textContentType="emailAddress" returnKeyType="send" placeholder="ornek@eposta.com"
          error={invalid ? 'Geçerli bir e-posta adresi yaz.' : undefined} onSubmitEditing={() => isValidEmail(email) && send.mutate(email)} />
        {error && <Notice tone="danger">{error.message}</Notice>}
      </View>
    </Screen>
  );
}
