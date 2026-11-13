import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Divider, Modal, Notice, ResponsiveGrid, RowCard, Screen, SectionHeader, SwitchRow, Text, space, useToast } from '../../design-system';
import { WEB_ORIGIN, WEB_PATHS } from '../../lib/domain';
import { toAppError } from '../../lib/errors';
import { openExternalUrl } from '../../lib/links';
import { PERSONAL_PREFS_RESET } from '../../lib/localPrefs';
import type { ProfileStackParamList } from '../../navigation/types';
import { deleteAccount, signOut } from '../auth/authService';
import { usePendingIntent } from '../auth/pendingIntent';
import { useSession } from '../auth/SessionProvider';
import { usePrefs } from '../onboarding/PrefsProvider';

/** Profil > Ayarlar. Hesap, bildirimler, dokunsal geri bildirim, gizlilik, rıza merkezi, yardım ve yasal bağlantılar. No legal text lives here. */
export function SettingsScreen({ navigation }: NativeStackScreenProps<ProfileStackParamList, 'Settings'>) {
  const { userId, session } = useSession();
  const toast = useToast();
  const { prefs, update } = usePrefs();
  const intent = usePendingIntent();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const out = useMutation({ mutationFn: signOut, onSuccess: () => { intent.clear(); toast.show('Çıkış yapıldı.'); }, onError: (e) => toast.show(toAppError(e).message, 'danger') });
  const del = useMutation({ mutationFn: deleteAccount, onSuccess: () => { setConfirmDelete(false); intent.clear(); update(PERSONAL_PREFS_RESET); toast.show('Hesabın silindi.'); } });

  // Signing out or deleting the account ends the session; this screen has nothing to show without one.
  useEffect(() => { if (!userId && navigation.canGoBack()) navigation.popToTop(); }, [userId, navigation]);
  if (!userId) return <Screen header={<AppHeader onBack={navigation.goBack} title="Ayarlar" />}>{null}</Screen>;

  const openWeb = (path: string) => { void openExternalUrl(WEB_ORIGIN + path, () => toast.show('Bağlantı açılamadı.', 'danger')); };
  const version = Constants.expoConfig?.version;

  return (
    <Screen wide header={<AppHeader onBack={navigation.goBack} title="Ayarlar" />}>
      <SectionHeader title="Hesap" />
      <View testID="account-section" style={{ gap: space[3] }}>
        {!!session?.user.email && (
          <View>
            <Text variant="caption" color="textSecondary">E-POSTA</Text>
            <Text variant="label" selectable breakStrategy="words">{`${session.user.email} ile giriş yaptın`}</Text>
          </View>
        )}
        <View style={{ gap: space[3], maxWidth: 480 }}>
          <Button kind="secondary" label="Çıkış yap" loading={out.isPending} onPress={() => out.mutate()} />
          <Button kind="danger" label="Hesabımı sil" onPress={() => setConfirmDelete(true)} />
        </View>
      </View>

      <Divider />
      <SectionHeader title="Tercihler" />
      <ResponsiveGrid maxColumns={2}>
        <RowCard leading={{ kind: 'icon', icon: 'bell' }} title="Bildirimler" secondary="Hatırlatmalar ve saklama süresi" trailing={{ kind: 'chevron' }} onPress={() => navigation.navigate('NotificationSettings')} />
      </ResponsiveGrid>
      <View style={{ marginTop: space[3], maxWidth: 560 }}>
        <SwitchRow label="Dokunsal geri bildirim" description="Dokunduğunda ve işlemler bittiğinde hafif titreşim. Yalnızca bu cihazı etkiler." value={prefs.haptics} onValueChange={(haptics) => update({ haptics })} />
      </View>

      <Divider />
      <SectionHeader title="Gizlilik ve izinler" />
      <ResponsiveGrid maxColumns={2}>
        <RowCard leading={{ kind: 'icon', icon: 'shield' }} title="Gizlilik" secondary="Keşfedilebilirlik ve CV paylaşımı" trailing={{ kind: 'chevron' }} onPress={() => navigation.navigate('Privacy')} />
        <RowCard leading={{ kind: 'icon', icon: 'verified' }} title="Rıza merkezi" secondary="Verdiğin izinler ve nasıl geri alınacağı" trailing={{ kind: 'chevron' }} onPress={() => navigation.navigate('ConsentCenter')} />
      </ResponsiveGrid>

      <Divider />
      <SectionHeader title="Yardım" />
      <ResponsiveGrid maxColumns={2}>
        <RowCard leading={{ kind: 'icon', icon: 'info' }} title="Destek" secondary="Sorular ve iletişim" trailing={{ kind: 'chevron' }} onPress={() => openWeb(WEB_PATHS.support)} />
      </ResponsiveGrid>

      <View style={{ height: space[5] }} />
      <SectionHeader title="Yasal" />
      <ResponsiveGrid maxColumns={2}>
        <RowCard leading={{ kind: 'icon', icon: 'link' }} title="Gizlilik politikası" secondary="Web sayfasında açılır" trailing={{ kind: 'chevron' }} onPress={() => openWeb(WEB_PATHS.privacy)} />
        <RowCard leading={{ kind: 'icon', icon: 'link' }} title="Kullanım koşulları" secondary="Web sayfasında açılır" trailing={{ kind: 'chevron' }} onPress={() => openWeb(WEB_PATHS.terms)} />
        <RowCard leading={{ kind: 'icon', icon: 'link' }} title="Hesap silme" secondary="Web sayfasında açılır" trailing={{ kind: 'chevron' }} onPress={() => openWeb(WEB_PATHS.deleteAccount)} />
      </ResponsiveGrid>

      <Text variant="caption" color="textSecondary" style={{ marginTop: space[6] }}>{`Sürüm ${version ?? '—'}`}</Text>

      <Modal visible={confirmDelete} title="Hesabını silelim mi?" onClose={() => setConfirmDelete(false)}>
        <Text variant="bodySmall" color="textSecondary">Profilin, deneyimlerin, kayıtların ve başvuruların sunucudan silinir. Bu işlem geri alınamaz.</Text>
        {del.error && <Notice tone="danger" title="Hesabın silinmedi">{toAppError(del.error).message}</Notice>}
        <Button kind="danger" label="Evet, hesabımı sil" loading={del.isPending} onPress={() => del.mutate()} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmDelete(false)} />
      </Modal>
    </Screen>
  );
}
