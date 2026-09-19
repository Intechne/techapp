import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, BottomSheet, Button, Card, Divider, EmptyState, ErrorState, LoadingSkeleton, MetadataRow, Modal, Notice, Radio, Screen, Tag, Text, TextButton, space, useToast } from '../../design-system';
import { formatDate } from '../../lib/dates';
import { toAppError } from '../../lib/errors';
import { openExternalUrl } from '../../lib/links';
import type { ProfileStackParamList } from '../../navigation/types';
import { useAttestingOrganizations, useDeleteExperience, useMyCv, useRequestAttestation, useSetExperiencePublication } from './api';
import { KIND_ICON, KIND_LABEL, PROVENANCE_VIEW } from './labels';
import { canRequestAttestation, formatRange, provenanceOf } from './logic';
import { ProvenanceBadge } from './ProvenanceBadge';

export function ExperienceDetailScreen({ navigation, route }: NativeStackScreenProps<ProfileStackParamList, 'ExperienceDetail'>) {
  const { experienceId } = route.params;
  const cv = useMyCv(); const toast = useToast();
  const item = useMemo(() => cv.data?.experiences.find((x) => x.id === experienceId) ?? null, [cv.data, experienceId]);
  const [sheet, setSheet] = useState(false); const [orgId, setOrgId] = useState<string | null>(null); const [confirmDelete, setConfirmDelete] = useState(false);
  const orgs = useAttestingOrganizations(sheet);
  const request = useRequestAttestation(experienceId); const remove = useDeleteExperience(); const publication = useSetExperiencePublication(experienceId);

  const header = <AppHeader onBack={navigation.goBack} title="Deneyim" />;
  if (cv.isPending) return <Screen header={header}><LoadingSkeleton cards={1} /></Screen>;
  if (cv.isError) return <Screen header={header}><ErrorState error={toAppError(cv.error)} onRetry={() => void cv.refetch()} /></Screen>;
  if (!item) return <Screen header={header}><EmptyState icon="spark" title="Bu deneyim bulunamadı" body="Silinmiş olabilir." actionLabel="Profile dön" onAction={navigation.goBack} /></Screen>;

  const provenance = provenanceOf(item.attestation); const view = PROVENANCE_VIEW[provenance]; const a = item.attestation;
  const range = formatRange(item.started_on, item.ended_on);
  const requestable = canRequestAttestation(item);
  const onProfile = item.status === 'published' && item.visibility === 'profile';

  return (
    <Screen header={header} refreshing={cv.isRefetching} onRefresh={() => void cv.refetch()}
      footer={requestable ? <Button icon="verified" label={provenance === 'self' ? 'Doğrulama iste' : 'Yeniden doğrulama iste'} onPress={() => { request.reset(); setSheet(true); }} /> : undefined}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        <ProvenanceBadge attestation={a} />
        {item.status === 'draft' ? <Tag tone="neutral" label="TASLAK" /> : !onProfile ? <Tag tone="neutral" label="GİZLİ" /> : null}
      </View>
      <Text variant="title" style={{ marginTop: space[3] }}>{item.title}</Text>
      <View style={{ gap: space[2], marginTop: space[3] }}>
        <MetadataRow icon={KIND_ICON[item.kind]} strong>{[KIND_LABEL[item.kind], item.role].filter(Boolean).join(' · ')}</MetadataRow>
        {!!item.organization_name && <MetadataRow icon="community" strong>{item.organization_name}</MetadataRow>}
        {!!range && <MetadataRow icon="clock" strong>{range}</MetadataRow>}
      </View>
      {!!item.contribution && (<><Divider /><Text variant="section">Katkım</Text><Text variant="body" color="textSecondary" style={{ marginTop: space[2] }}>{item.contribution}</Text></>)}
      {!!item.link_url && <View style={{ marginTop: space[3] }}><TextButton icon="link" label="Çıktıyı aç" onPress={() => { void openExternalUrl(item.link_url, () => toast.show('Bağlantı açılamadı.', 'danger')); }} /></View>}

      <Divider />
      <Text variant="section">Bu bilginin kaynağı</Text>
      <Card style={{ marginTop: space[3], gap: space[2] }}>
        <ProvenanceBadge attestation={a} />
        <Text variant="bodySmall" color="textSecondary">{view.explain}</Text>
        {a && provenance !== 'self' && (
          <View style={{ gap: space[2], marginTop: space[1] }}>
            {!!a.organization && <MetadataRow icon="shield">{provenance === 'verified' ? 'Doğrulayan' : 'Kurum'}: {a.organization}</MetadataRow>}
            {!!a.scope && <MetadataRow icon="check">Kapsam: {a.scope}</MetadataRow>}
            {!!a.source && <MetadataRow icon="link">Kaynak: {a.source}</MetadataRow>}
            {!!a.decided_at && <MetadataRow icon="event">Karar tarihi: {formatDate(a.decided_at)}</MetadataRow>}
            {!!a.valid_until && <MetadataRow icon="clock">Geçerlilik: {formatDate(a.valid_until)} tarihine kadar</MetadataRow>}
            {!!a.decision_note && <MetadataRow icon="spark">Kurumun notu: {a.decision_note}</MetadataRow>}
          </View>
        )}
      </Card>
      {item.status === 'draft' && <View style={{ marginTop: space[3] }}><Notice tone="info">Taslaklar için doğrulama istenemez. Önce deneyimini kaydedip yayınla.</Notice></View>}

      <View style={{ gap: space[3], marginTop: space[6] }}>
        <Button kind="secondary" label="Düzenle" onPress={() => navigation.navigate('ExperienceEditor', { experienceId })} />
        {item.status === 'published' && <Button kind="secondary" loading={publication.isPending} label={onProfile ? 'Profilimden gizle' : 'Profilimde göster'}
          onPress={() => publication.mutate(!onProfile, { onSuccess: () => toast.show(onProfile ? 'Artık yalnızca sen görüyorsun.' : 'Profilinde görünüyor.'), onError: (e) => toast.show(toAppError(e).message, 'danger') })} />}
        <Button kind="danger" label="Deneyimi sil" onPress={() => { remove.reset(); setConfirmDelete(true); }} />
      </View>

      <BottomSheet visible={sheet} title="Doğrulama iste" onClose={() => setSheet(false)}>
        <Text variant="bodySmall" color="textSecondary">Doğrulama, bir kurumun bu deneyimin belirli bir kapsamını (“etkinliğe katıldı”, “yazılım ekibinde görev aldı” gibi) onaylamasıdır. Seçtiğin kurumun yetkilileri bu deneyimin içeriğini görür; iletişim bilgilerin ve doğum tarihin paylaşılmaz.</Text>
        {orgs.isPending ? <LoadingSkeleton cards={1} /> : orgs.isError ? <ErrorState error={toAppError(orgs.error)} onRetry={() => void orgs.refetch()} />
          : orgs.data.length === 0 ? <Notice tone="warning">Şu an doğrulama yapabilecek bir kurum yok.</Notice>
            : <View accessibilityRole="radiogroup" style={{ gap: space[2] }}>{orgs.data.map((o) => <Radio key={o.id} label={o.name} checked={orgId === o.id} onChange={() => setOrgId(o.id)} />)}</View>}
        {request.error && <Notice tone="danger" title="İstek gönderilmedi">{toAppError(request.error).message}</Notice>}
        <Button label="İsteği gönder" disabled={!orgId} loading={request.isPending}
          onPress={() => orgId && request.mutate(orgId, { onSuccess: () => { setSheet(false); toast.show('Doğrulama isteğin kuruma iletildi.', 'success'); } })} />
      </BottomSheet>

      <Modal visible={confirmDelete} title="Deneyimi silelim mi?" onClose={() => setConfirmDelete(false)}>
        <Text variant="bodySmall" color="textSecondary">Deneyim ve varsa doğrulama kaydı kalıcı olarak silinir. Bu işlem geri alınamaz.</Text>
        {remove.error && <Notice tone="danger" title="Deneyim silinmedi">{toAppError(remove.error).message}</Notice>}
        <Button kind="danger" label="Evet, sil" loading={remove.isPending} onPress={() => remove.mutate(experienceId, { onSuccess: () => { setConfirmDelete(false); toast.show('Deneyim silindi.'); navigation.goBack(); } })} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmDelete(false)} />
      </Modal>
    </Screen>
  );
}
