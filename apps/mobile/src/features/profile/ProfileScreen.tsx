import React, { useState } from 'react';
import { View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Divider, EmptyState, ErrorState, ListCard, LoadingSkeleton, Modal, Notice, ProfileCard, Screen, Text, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { ProfileStackParamList } from '../../navigation/types';
import { deleteAccount, signOut } from '../auth/authService';
import { useAccountState, useSession } from '../auth/SessionProvider';
import { usePrefs } from '../onboarding/PrefsProvider';
import { useMyProfile } from './api';

const CHECKIN_ROLES = ['owner', 'admin', 'checkin_staff'];

export function ProfileScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>) {
  const { userId, session } = useSession();
  const account = useAccountState();
  const toast = useToast();
  const { update } = usePrefs();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const profile = useMyProfile();
  const out = useMutation({ mutationFn: signOut, onSuccess: () => toast.show('Çıkış yapıldı.'), onError: (e) => toast.show(toAppError(e).message, 'danger') });
  const del = useMutation({ mutationFn: deleteAccount, onSuccess: () => { setConfirmDelete(false); update({ onboarded: true }); toast.show('Hesabın silindi.'); } });

  if (!userId) {
    return (
      <Screen header={<AppHeader brand />}>
        <EmptyState icon="profile" title="Yaptıkların seni anlatsın" body="Giriş yaptığında katılımların, başvuruların ve deneyimlerin burada toplanır."
          actionLabel="Giriş yap veya hesap oluştur" onAction={() => navigation.getParent()?.getParent()?.navigate('AuthEmail')} />
      </Screen>
    );
  }
  // Staff tools are shown from server-reported roles; the server re-checks the role on every check-in anyway.
  const canCheckIn = account.data?.organization_roles.some((r) => CHECKIN_ROLES.includes(r.role)) ?? false;

  return (
    <Screen header={<AppHeader brand />} refreshing={profile.isRefetching} onRefresh={() => { void profile.refetch(); void account.refetch(); }}>
      {profile.isPending ? <LoadingSkeleton cards={1} /> : profile.isError ? <ErrorState error={toAppError(profile.error)} onRetry={() => void profile.refetch()} /> : (
        <>
          <ProfileCard name={profile.data.display_name} headline={profile.data.headline ?? session?.user.email} />
          {account.data && !account.data.profile_complete && (
            <View style={{ marginTop: space[3] }}><Notice tone="warning" title="Profilin yarım kaldı">Etkinliklere katılmak için adını ve doğum tarihini tamamla.</Notice>
              <Button style={{ marginTop: space[3] }} label="Profilimi tamamla" onPress={() => navigation.getParent()?.getParent()?.navigate('ProfileBootstrap')} /></View>
          )}
          <View style={{ gap: space[3], marginTop: space[5] }}>
            <ListCard icon="ticket" title="Katılımlarım" body="Kayıt durumların ve katılım kartların" onPress={() => navigation.navigate('MyRegistrations')} />
            {canCheckIn && <ListCard icon="verified" title="Giriş kontrolü" body="Düzenleyen ekip için katılımcı girişi" onPress={() => navigation.navigate('CheckIn')} />}
          </View>
          <View style={{ marginTop: space[5] }}><Notice tone="info">Deneyimler, projeler ve doğrulamalar profilin bir sonraki sürümünde açılıyor.</Notice></View>
          <Divider />
          <Text variant="section">Hesap</Text>
          <View style={{ gap: space[3], marginTop: space[3] }}>
            <Button kind="secondary" label="Çıkış yap" loading={out.isPending} onPress={() => out.mutate()} />
            <Button kind="danger" label="Hesabımı sil" onPress={() => setConfirmDelete(true)} />
          </View>
        </>
      )}
      <Modal visible={confirmDelete} title="Hesabını silelim mi?" onClose={() => setConfirmDelete(false)}>
        <Text variant="bodySmall" color="textSecondary">Profilin, kayıtların ve başvuruların sunucudan silinir. Bu işlem geri alınamaz.</Text>
        {del.error && <Notice tone="danger" title="Hesabın silinmedi">{toAppError(del.error).message}</Notice>}
        <Button kind="danger" label="Evet, hesabımı sil" loading={del.isPending} onPress={() => del.mutate()} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmDelete(false)} />
      </Modal>
    </Screen>
  );
}
