import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Notice, SheetFrame, Text, TextArea, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/types';
import { closeSheet } from '../../navigation/sheets';
import { requestJoin } from './api';

/** "Katılma isteği": a short note to the team's captain and mentors. Content of the `TeamJoinRequest` form-sheet route. */
export function TeamJoinSheet({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast();
  const [message, setMessage] = useState('');
  const join = useMutation({
    mutationFn: () => requestJoin(teamId, message),
    // The sheet closes first; the team page behind it re-reads through the invalidated queries (no callback through route params).
    onSuccess: async () => { onClose(); toast.show('İsteğin gönderildi.', 'success'); await qc.invalidateQueries({ queryKey: ['teams'] }); },
  });
  return (
    <SheetFrame fit title="Katılma isteği" onClose={onClose}>
      <Text variant="bodySmall" color="textSecondary">İsteğin takımın kaptanına ve mentorlarına gider. Adın ve yazdığın not görünür; iletişim bilgilerin paylaşılmaz.</Text>
      <TextArea label="Kısa bir not (isteğe bağlı)" value={message} onChangeText={setMessage} maxLength={500} placeholder="Neden katılmak istiyorsun, neye katkı verebilirsin?" />
      {join.error && <Notice tone="danger" title="İsteğin gönderilmedi">{toAppError(join.error).message}</Notice>}
      <Button label="İsteği gönder" loading={join.isPending} onPress={() => join.mutate()} />
    </SheetFrame>
  );
}

export function TeamJoinRequestScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'TeamJoinRequest'>) {
  return <TeamJoinSheet teamId={route.params.teamId} onClose={() => closeSheet(navigation)} />;
}
