import React from 'react';
import { Platform, Share, View, useWindowDimensions } from 'react-native';
import { Button, Card, Notice, Tag, Text, TextButton, colors, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import { useSetCvSharing } from './api';
import { cvShareUrl } from './logic';

/** Link sharing for the verified CV. The token lives on the server; this card only reflects and toggles it. */
export function CvShareCard({ token, name }: { token: string | null; name: string | null }) {
  const { fontScale } = useWindowDimensions();
  const toast = useToast();
  const sharing = useSetCvSharing();
  const url = token ? cvShareUrl(token) : null;
  const error = sharing.error ? toAppError(sharing.error) : null;

  const share = async () => {
    if (!url) return;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) { await navigator.clipboard.writeText(url); toast.show('Bağlantı kopyalandı.', 'success'); return; }
      await Share.share(Platform.OS === 'ios' ? { url } : { message: `${name ?? 'TechApp'} · doğrulanmış CV: ${url}` });
    } catch { toast.show('Bağlantı paylaşılamadı. Aşağıdan seçip kopyalayabilirsin.', 'danger'); }
  };

  return (
    <Card style={{ gap: space[3] }}>
      {/* At large text the status tag drops under the title: a half-width title column splits "bağlantın" mid-word. */}
      <View style={fontScale >= 1.5 ? { gap: space[2], alignItems: 'flex-start' } : { flexDirection: 'row', alignItems: 'center', gap: space[2], flexWrap: 'wrap' }}>
        <Text variant="cardTitle" breakStrategy="words" style={fontScale >= 1.5 ? undefined : { flex: 1 }}>Dijital CV bağlantın</Text>
        <Tag tone={url ? 'moss' : 'neutral'} label={url ? 'PAYLAŞIM AÇIK' : 'PAYLAŞIM KAPALI'} />
      </View>
      {url ? (
        <>
          <Text variant="bodySmall" color="textSecondary">Bağlantıyı açan herkes yayında ve profilde görünür deneyimlerini, doğrulamaları yapan kurumlarla birlikte görür. Taslaklar, gizli kayıtlar, e-postan ve doğum tarihin paylaşılmaz.</Text>
          <Text variant="caption" selectable style={{ color: colors.primary }}>{url}</Text>
          <Button icon="arrow" label={Platform.OS === 'web' ? 'Bağlantıyı kopyala' : 'Bağlantıyı paylaş'} onPress={() => void share()} />
          <TextButton label="Paylaşımı kapat" color={colors.danger} disabled={sharing.isPending} onPress={() => sharing.mutate(false)} accessibilityHint="Mevcut bağlantı anında geçersiz olur" />
          <Text variant="caption" color="textSecondary">Kapatırsan bu bağlantı bir daha çalışmaz; yeniden açtığında yeni bir bağlantı oluşur.</Text>
        </>
      ) : (
        <>
          <Text variant="bodySmall" color="textSecondary">Başvurularda ve tanışmalarda tek bir bağlantıyla kendini anlat: hangi deneyimin kendi beyanın, hangisinin bir kurum tarafından doğrulandığı açıkça görünür.</Text>
          <Button kind="secondary" label="Paylaşım bağlantısı oluştur" loading={sharing.isPending} onPress={() => sharing.mutate(true)} />
        </>
      )}
      {error && <Notice tone={error.code === 'cv_sharing_adults_only' ? 'info' : 'danger'}>{error.message}</Notice>}
    </Card>
  );
}
