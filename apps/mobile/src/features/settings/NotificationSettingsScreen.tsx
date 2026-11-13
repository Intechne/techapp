import React from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, ErrorState, LoadingSkeleton, Notice, Screen, SwitchRow, Text, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { ProfileStackParamList } from '../../navigation/types';
import { useSession } from '../auth/SessionProvider';
import { fetchNotificationPrefs, setEventReminders, settingsKeys } from './api';
import { RETENTION_FACT } from './labels';

/** Ayarlar > Bildirimler. Only event reminders can be switched off; the rest are updates about the person's own records. */
export function NotificationSettingsScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'NotificationSettings'>) {
  const { userId } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const key = settingsKeys.notificationPrefs(userId);
  const q = useQuery({ queryKey: key, queryFn: () => fetchNotificationPrefs(userId!), enabled: !!userId });
  const save = useMutation({
    mutationFn: setEventReminders,
    onSuccess: (_d, enabled) => qc.setQueryData(key, { event_reminders: enabled }),
    onError: (e) => toast.show(toAppError(e).message, 'danger'),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  // While a save is in flight the switch shows the value being saved; a failure snaps back to the server's value.
  const value = save.isPending ? save.variables : q.data?.event_reminders;

  return (
    <Screen wide header={<AppHeader onBack={navigation.goBack} title="Bildirim ayarları" />}>
      {q.isPending ? <LoadingSkeleton cards={1} variant="row" /> : q.isError ? <ErrorState error={toAppError(q.error)} onRetry={() => void q.refetch()} /> : (
        <View style={{ gap: space[5], maxWidth: 560 }}>
          <SwitchRow label="Etkinlik hatırlatmaları" description="Kayıtlı olduğun bir etkinlikten yaklaşık 24 saat önce haber verir." value={value ?? true} onValueChange={(v) => save.mutate(v)} />
          <Notice tone="info">Kayıt, başvuru ve veli onayı gibi kendi kayıtlarındaki gelişmeler her zaman bildirilir; bunlar kapatılamaz. Bildirimler şimdilik yalnızca uygulamanın içinde görünür.</Notice>
          <Text variant="bodySmall" color="textSecondary">{RETENTION_FACT}</Text>
        </View>
      )}
    </Screen>
  );
}
