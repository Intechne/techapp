import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, ErrorState, LoadingSkeleton, Notice, ResponsiveGrid, RowCard, Screen, SectionHeader, SwitchRow, Text, space } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { ProfileStackParamList } from '../../navigation/types';
import { accountStateKey, useAccountState, useSession } from '../auth/SessionProvider';
import { myProfileKey, useMyCv, useMyProfile } from '../profile/api';
import { CvShareCard } from '../profile/CvShareCard';
import { setDiscoverable } from './api';
import { DISCOVERABLE_HELP, MINOR_DISCOVERABLE_EXPLAIN, MINOR_DISCOVERABLE_TEXT } from './labels';

/** Ayarlar > Gizlilik. Minor status comes from my_account_state (server), never from the client; the server trigger enforces it again. */
export function PrivacyScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'Privacy'>) {
  const { userId } = useSession();
  const account = useAccountState();
  const profile = useMyProfile();
  const cv = useMyCv();
  const qc = useQueryClient();
  const [pending, setPending] = useState<boolean | null>(null);
  const save = useMutation({
    mutationFn: (enabled: boolean) => setDiscoverable(userId!, enabled),
    onMutate: (enabled) => setPending(enabled),
    onSettled: async () => { await Promise.all([qc.invalidateQueries({ queryKey: myProfileKey(userId) }), qc.invalidateQueries({ queryKey: accountStateKey(userId) })]); setPending(null); },
  });
  const ready = !account.isPending && !profile.isPending;
  const failure = account.isError ? account.error : profile.isError ? profile.error : null;
  const isMinor = account.data?.is_minor;
  const error = save.error ? toAppError(save.error) : null;

  return (
    <Screen wide header={<AppHeader onBack={navigation.goBack} title="Gizlilik" />}>
      <View testID="privacy-screen" style={{ gap: space[5], maxWidth: 560 }}>
        <SectionHeader title="Keşfedilebilirlik" />
        {!ready ? <LoadingSkeleton cards={1} variant="row" /> : failure ? <ErrorState error={toAppError(failure)} onRetry={() => { void account.refetch(); void profile.refetch(); }} /> : isMinor === false ? (
          <>
            <SwitchRow label="Profilimi keşfe aç" description={DISCOVERABLE_HELP} value={pending ?? profile.data?.discoverable ?? false} onValueChange={(v) => save.mutate(v)} />
            {error && <Notice tone={error.code === 'discoverable_requires_adult' ? 'info' : 'danger'}>{error.message}</Notice>}
          </>
        ) : (
          <View style={{ gap: space[2] }}>
            <Text variant="label">{isMinor === true ? MINOR_DISCOVERABLE_TEXT : 'Önce profilini tamamla.'}</Text>
            <Text variant="bodySmall" color="textSecondary">{isMinor === true ? MINOR_DISCOVERABLE_EXPLAIN : 'Bu ayar yaş bilgisine bağlı olduğu için doğum tarihin tamamlanınca açılır.'}</Text>
          </View>
        )}

        <SectionHeader title="Dijital CV" />
        {cv.isPending ? <LoadingSkeleton cards={1} variant="row" /> : cv.isError ? <ErrorState error={toAppError(cv.error)} onRetry={() => void cv.refetch()} />
          : <CvShareCard token={cv.data.share_token} name={cv.data.profile.display_name} />}

        <SectionHeader title="İzinler" />
        <ResponsiveGrid maxColumns={1}>
          <RowCard leading={{ kind: 'icon', icon: 'verified' }} title="Rıza merkezi" secondary="Verdiğin izinler ve nasıl geri alınacağı" trailing={{ kind: 'chevron' }} onPress={() => navigation.navigate('ConsentCenter')} />
        </ResponsiveGrid>
      </View>
    </Screen>
  );
}
