import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMutation } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, Input, Notice, Screen, Tag, Text, colors, radius, space } from '../../design-system';
import { formatTime } from '../../lib/dates';
import { parsePayload, toAppError } from '../../lib/errors';
import { getSupabase } from '../../lib/supabase';
import { checkInResultSchema, type CheckInResult } from '../../lib/database.types';
import type { ProfileStackParamList } from '../../navigation/types';

async function checkIn(token: string): Promise<CheckInResult> {
  const { data, error } = await getSupabase().rpc('check_in_participant', { p_token: token.trim() });
  if (error) throw toAppError(error);
  return parsePayload(checkInResultSchema, data);
}

/** Organizer check-in. The scan only reads an opaque token; validity and the staff member's permission are decided by the server. */
export function CheckInScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'CheckIn'>) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [scanning, setScanning] = useState(true);
  const last = useRef<string | null>(null);
  const mutation = useMutation({ mutationFn: checkIn, onSettled: () => setScanning(false) });

  const submit = (token: string) => {
    if (mutation.isPending || !token.trim()) return;
    last.current = token; mutation.mutate(token);
  };
  const next = () => { mutation.reset(); last.current = null; setManual(''); setScanning(true); };

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Giriş kontrolü" />}>
      <Text variant="display">Kodu okut.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[2], marginBottom: space[4] }}>Katılımcının katılım kartındaki QR kodunu kameraya göster.</Text>

      {mutation.data ? (
        <Card style={{ gap: space[2] }}>
          {mutation.data.result === 'checked_in' ? <Tag tone="moss" icon="check" label="GİRİŞ ONAYLANDI" /> : <Tag tone="apricot" icon="clock" label="DAHA ÖNCE GİRİŞ YAPILMIŞ" />}
          <Text variant="title">{mutation.data.holder_name ?? 'Katılımcı'}</Text>
          <Text variant="bodySmall" color="textSecondary">
            {mutation.data.result === 'checked_in' ? 'Hoş geldin diyebilirsin.' : `İlk giriş saati: ${formatTime(mutation.data.checked_in_at)}. Aynı kodla ikinci giriş kaydedilmedi.`}
          </Text>
        </Card>
      ) : mutation.error ? (
        <Notice tone="danger" title="Giriş onaylanmadı">{toAppError(mutation.error).message}</Notice>
      ) : !permission?.granted ? (
        <Card style={{ gap: space[3] }}>
          <Text variant="bodySmall" color="textSecondary">QR kodu okutmak için kamera izni gerekiyor. Görüntü kaydedilmez.</Text>
          <Button kind="secondary" label="Kameraya izin ver" onPress={() => void requestPermission()} />
        </Card>
      ) : (
        <View style={styles.camera}>
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanning ? ({ data }) => { if (data !== last.current) submit(data); } : undefined} />
        </View>
      )}

      {(mutation.data || mutation.error) ? <Button style={{ marginTop: space[4] }} label="Sıradaki katılımcı" onPress={next} /> : (
        <View style={{ marginTop: space[5], gap: space[3] }}>
          <Input label="Kodu elle gir" value={manual} onChangeText={setManual} autoCapitalize="none" autoCorrect={false} placeholder="TA1.…" help="Kamera okuyamazsa karttaki tam kodu yapıştırabilirsin." />
          <Button kind="secondary" label="Kodu doğrula" loading={mutation.isPending} disabled={!manual.trim()} onPress={() => submit(manual)} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: { height: 300, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.ink },
});
