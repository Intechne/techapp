import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Card, ErrorState, Input, Notice, Screen, Select, Skeleton, SuccessMark, Text, checkInOutcomeView, checkInResultView, colors, radius, space } from '../../design-system';
import { formatDateRange, formatTimeRange, formatTime } from '../../lib/dates';
import { haptics } from '../../lib/haptics';
import { toAppError } from '../../lib/errors';
import type { ProfileStackParamList } from '../../navigation/types';
import { useAccountState } from '../auth/SessionProvider';
import { CHECKIN_ROLES, checkIn, fetchCheckInEvents, isFullToken } from './api';

/** Organizer check-in. The scan only reads an opaque token; validity and the staff member's permission are decided by the server. */
export function CheckInScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'CheckIn'>) {
  const [permission, requestPermission] = useCameraPermissions();
  const account = useAccountState();
  const orgIds = [...new Set((account.data?.organization_roles ?? []).filter((r) => CHECKIN_ROLES.includes(r.role)).map((r) => r.organization_id))].sort();
  const events = useQuery({
    queryKey: ['checkin-events', orgIds],
    enabled: account.isSuccess,
    queryFn: () => fetchCheckInEvents(orgIds),
  });
  // The staff member's choice lives in this screen only. A single qualifying event is preselected.
  const [chosen, setChosen] = useState<string | null>(null);
  const list = events.data ?? [];
  const eventId = (chosen && list.some((e) => e.id === chosen) ? chosen : null) ?? (list.length === 1 ? list[0]!.id : null);
  const [manual, setManual] = useState('');
  const [scanning, setScanning] = useState(true);
  const [resets, setResets] = useState(0);
  // Synchronous lock: the camera fires onBarcodeScanned many times per second, faster than state can flip `scanning`.
  // One scan = one mutation until "Sıradaki katılımcı" releases it.
  const locked = useRef(false);
  const input = useRef<TextInput>(null);
  const mutation = useMutation({
    mutationFn: checkIn,
    // Feedback fires here (once per settled mutation), never from render or an effect that can re-run.
    // Feedback is decoration: if it throws, the displayed outcome must not change.
    onSuccess: (r) => {
      try {
        if (r.result === 'checked_in') {
          haptics.success();
          AccessibilityInfo.announceForAccessibility(`${checkInOutcomeView.checked_in.spoken}, ${r.holder_name ?? 'Katılımcı'}`);
        } else {
          haptics.warning();
          AccessibilityInfo.announceForAccessibility(`${checkInOutcomeView.already_checked_in.spoken}, ilk giriş ${formatTime(r.checked_in_at)}`);
        }
      } catch { /* ignore */ }
    },
    onError: (e) => {
      try {
        haptics.error();
        AccessibilityInfo.announceForAccessibility(`${checkInOutcomeView.failed.spoken}, ${toAppError(e).message}`);
      } catch { /* ignore */ }
    },
    onSettled: () => setScanning(false),
  });

  const submit = (value: string, source: 'camera' | 'manual') => {
    if (locked.current || !value.trim()) return;
    locked.current = true;
    mutation.mutate({ value, eventId, source });
  };
  // The picker is convenience: when it cannot load, QR scans and full tokens still work.
  const pickerError = account.isError ? account.error : events.isError ? events.error : null;
  const pickerLoading = !pickerError && (account.isPending || events.isPending);
  const retryPicker = () => { if (account.isError) void account.refetch(); else void events.refetch(); };
  const needsEvent = !eventId && !isFullToken(manual);
  const next = () => {
    mutation.reset(); locked.current = false; setManual(''); setScanning(true);
    setResets((n) => n + 1);
  };
  // Focus the manual field only when there is no camera (a soft keyboard would cover the camera view).
  useEffect(() => {
    if (resets === 0 || permission?.granted) return;
    const id = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [resets, permission?.granted]);

  const outcome = mutation.data
    ? checkInResultView(mutation.data)
    : mutation.error
      ? { ...checkInOutcomeView.failed, detail: toAppError(mutation.error).message, name: null }
      : null;
  const palette = outcome && (outcome.tone === 'moss' ? { bg: colors.mossSoft, fg: colors.moss } : outcome.tone === 'apricot' ? { bg: colors.apricot, fg: colors.ink } : { bg: colors.dangerSoft, fg: colors.danger });

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Giriş kontrolü" />}>
      {!outcome && (
        <>
          <Text variant="title">Kodu okut.</Text>
          <Text variant="body" color="textSecondary" style={{ marginTop: space[2], marginBottom: space[4] }}>Katılımcının katılım kartındaki QR kodunu kameraya göster ya da kartın altındaki 8 karakterlik kodu yaz.</Text>
          <View style={{ marginBottom: space[4] }}>
            {pickerError ? <ErrorState error={toAppError(pickerError)} onRetry={retryPicker} />
              : pickerLoading ? <Skeleton height={64} rounded={radius.card} />
              : list.length === 0 ? <Notice title="Bugün giriş kontrolü açılan bir etkinlik yok">{"Kısa kodla giriş için etkinlik gerekiyor. Katılımcının QR'ını okutarak giriş yapabilirsin."}</Notice>
              : <Select label="Etkinlik" value={eventId} onChange={setChosen}
                  options={list.map((e) => ({ value: e.id, label: e.title, description: `${formatDateRange(e.starts_at, e.ends_at)} · ${formatTimeRange(e.starts_at, e.ends_at)}` }))} />}
          </View>
        </>
      )}

      {outcome && palette ? (
        <View style={[styles.result, { backgroundColor: palette.bg }]} accessible accessibilityLabel={`${outcome.spoken}. ${outcome.name ?? ''} ${outcome.detail}`.replace(/\s+/g, ' ').trim()}>
          <SuccessMark testID="checkin-result-badge" tone={outcome.tone} icon={outcome.icon} size={RESULT_BADGE} glyph={RESULT_GLYPH} iconTestID={`checkin-result-icon-${outcome.icon}`} />
          <Text variant="title" style={{ color: palette.fg, textAlign: 'center' }}>{outcome.title}</Text>
          {outcome.name && <Text variant="section" breakStrategy="words" style={{ color: palette.fg, textAlign: 'center' }}>{outcome.name}</Text>}
          <Text variant="body" style={{ color: palette.fg, textAlign: 'center' }}>{outcome.detail}</Text>
        </View>
      ) : !permission?.granted ? (
        <Card style={{ gap: space[3] }}>
          <Text variant="bodySmall" color="textSecondary">QR kodu okutmak için kamera izni gerekiyor. Görüntü kaydedilmez. İstersen aşağıdaki alana kodu elle gir.</Text>
          <Button kind="secondary" label="Kameraya izin ver" onPress={() => void requestPermission()} />
        </Card>
      ) : (
        <View style={styles.camera}>
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanning ? ({ data }) => submit(data, 'camera') : undefined} />
        </View>
      )}

      {outcome ? <Button style={{ marginTop: space[4] }} label="Sıradaki katılımcı" onPress={next} /> : (
        <View style={{ marginTop: space[5], gap: space[3] }}>
          <Input ref={input} label="Kodu elle gir" value={manual} onChangeText={setManual} autoCapitalize="none" autoCorrect={false} autoComplete="off" placeholder="ör. 0B8E1BD1" help="Kartta QR'ın altında yazan 8 karakterlik kod." />
          <Button kind="secondary" label="Kodu doğrula" loading={mutation.isPending} disabled={!manual.trim() || needsEvent} onPress={() => submit(manual, 'manual')} />
          {needsEvent && !pickerLoading && <Text variant="caption" color="textSecondary">Önce etkinliği seç.</Text>}
        </View>
      )}
    </Screen>
  );
}

/** Result glyph in a round badge (icon table: 24 px glyph in a 40 px badge, so outlined and filled glyphs weigh the same). */
const RESULT_BADGE = 40;
const RESULT_GLYPH = 24;

const styles = StyleSheet.create({
  result: { borderRadius: radius.card, padding: space[6], alignItems: 'center', gap: space[3], minHeight: 300, justifyContent: 'center' },
  camera: { height: 300, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.ink },
});
