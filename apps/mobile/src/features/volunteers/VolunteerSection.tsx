import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Modal, Notice, Text, TextArea, TextButton, VolunteerStatus, colors, space, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import { useSession } from '../auth/SessionProvider';
import { usePendingIntent } from '../auth/pendingIntent';
import { applyAsVolunteer, fetchMyVolunteering, volunteerKeys, withdrawVolunteer } from './api';

interface Props { eventId: string; accepts: boolean; ended: boolean; onSignIn: () => void; onOpenHub: () => void }

/** "Gönüllü ol" on the event page. What it shows comes from my own server row; approval is the organiser's decision. */
export function VolunteerSection({ eventId, accepts, ended, onSignIn, onOpenHub }: Props) {
  const { userId } = useSession();
  const intent = usePendingIntent();
  const qc = useQueryClient(); const toast = useToast();
  const [open, setOpen] = useState(false); const [note, setNote] = useState(''); const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const mine = useQuery({ queryKey: volunteerKeys.mine(eventId, userId), queryFn: () => fetchMyVolunteering(eventId, userId!), enabled: !!userId });
  const refresh = () => qc.invalidateQueries({ queryKey: ['volunteers', eventId] });
  const apply = useMutation({ mutationFn: () => applyAsVolunteer(eventId, note), onSuccess: async () => { setOpen(false); setNote(''); await refresh(); toast.show('Gönüllülük başvurun alındı.', 'success'); } });
  const withdraw = useMutation({ mutationFn: () => withdrawVolunteer(eventId), onSuccess: async () => { setConfirmWithdraw(false); await refresh(); toast.show('Gönüllülükten çekildin.'); } });

  // Coming back from sign-in: reopen the form the guest asked for.
  useFocusEffect(useCallback(() => { if (userId && intent.consume('volunteer_event')) setOpen(true); }, [userId, intent]));

  const status = mine.data?.status;
  const live = status === 'pending' || status === 'approved';
  if (!live && (!accepts || ended)) return null; // nothing to offer, nothing of mine to show

  const start = () => { if (!userId) { intent.set({ type: 'volunteer_event', eventId }); onSignIn(); return; } apply.reset(); setOpen(true); };
  const applyError = apply.error ? toAppError(apply.error) : null;

  return (
    <Card style={{ gap: space[3] }}>
      <Text variant="cardTitle">Gönüllü ekip</Text>
      {status && <View style={{ flexDirection: 'row' }}><VolunteerStatus status={status} /></View>}
      {status === 'approved' ? (
        <>
          <Text variant="bodySmall" color="textSecondary">{mine.data?.duty ? `Görevin: ${mine.data.duty}. ` : ''}Program, gönüllü duyuruları ve katılan takımlar gönüllü alanında.</Text>
          <Button icon="leaf" label="Gönüllü alanını aç" onPress={onOpenHub} />
        </>
      ) : status === 'pending' ? (
        <Text variant="bodySmall" color="textSecondary">Düzenleyen ekip başvurunu değerlendiriyor. Onaylandığında gönüllü alanı burada açılır.</Text>
      ) : (
        <>
          <Text variant="bodySmall" color="textSecondary">Bu etkinlik gönüllü arıyor. Başvurun onaylanırsa görevin ve gönüllülere özel duyurular uygulamada açılır; gönüllülüğün CV’ne düzenleyen onayıyla işlenir.</Text>
          <Button kind="secondary" icon="leaf" label={status ? 'Yeniden başvur' : 'Gönüllü ol'} onPress={start} />
        </>
      )}
      {live && <TextButton label="Gönüllülükten çekil" color={colors.textSecondary} onPress={() => { withdraw.reset(); setConfirmWithdraw(true); }} />}

      <Modal visible={open} title="Gönüllü başvurusu" onClose={() => setOpen(false)}>
        <TextArea label="Düzenleyen ekibe not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={500} placeholder="Hangi işte yardımcı olabilirsin? Örn. kayıt masası, saha yönlendirme." />
        <Text variant="caption" color="textSecondary">Düzenleyen ekip yalnızca adını ve bu notu görür. Gönüllülük başvurusu şimdilik 18 yaş ve üzeri için açık.</Text>
        {applyError && <Notice tone={applyError.code === 'volunteer_adults_only' ? 'info' : 'danger'} title="Başvurun gönderilmedi">{applyError.message}</Notice>}
        <Button label="Başvuruyu gönder" loading={apply.isPending} onPress={() => apply.mutate()} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setOpen(false)} />
      </Modal>

      <Modal visible={confirmWithdraw} title="Gönüllülükten çekilelim mi?" onClose={() => setConfirmWithdraw(false)}>
        <Text variant="bodySmall" color="textSecondary">Gönüllü alanına erişimin kapanır. Etkinlik gönüllü almaya devam ediyorsa sonra yeniden başvurabilirsin.</Text>
        {withdraw.error && <Notice tone="danger">{toAppError(withdraw.error).message}</Notice>}
        <Button kind="danger" label="Evet, çekil" loading={withdraw.isPending} onPress={() => withdraw.mutate()} />
        <Button kind="secondary" label="Vazgeç" onPress={() => setConfirmWithdraw(false)} />
      </Modal>
    </Card>
  );
}
