import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Notice, SheetFrame, Tag, Text, TextArea, useToast } from '../../design-system';
import { toAppError } from '../../lib/errors';
import type { RootStackParamList } from '../../navigation/types';
import { closeSheet } from '../../navigation/sheets';
import { useSession } from '../auth/SessionProvider';
import { applyToRecruitment, teamKeys, type RecruitmentPost } from './api';

/**
 * Apply to an open role. The server decides everything (closed post, already a member, profile incomplete): its code is shown
 * with the app's own copy, inside the sheet, and the person stays where they are. No retry button for a refusal.
 */
export function RecruitmentApplySheet({ post, userId, onClose }: { post: Pick<RecruitmentPost, 'id' | 'title' | 'role_label'> | null; userId: string; onClose: () => void }) {
  const qc = useQueryClient(); const toast = useToast();
  const [message, setMessage] = useState('');
  const apply = useMutation({
    mutationFn: (v: { postId: string; message: string }) => applyToRecruitment(v.postId, v.message),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: teamKeys.myApplications(userId) }); setMessage(''); onClose(); toast.show('Başvurun takıma ulaştı.', 'success'); },
  });
  const error = apply.error ? toAppError(apply.error) : null;
  const close = () => { apply.reset(); onClose(); };

  return (
    <SheetFrame fit title="Role başvur" onClose={close}>
      {!!post && (
        <>
          {/* Free text written by the team: shown as typed. */}
          {!!post.role_label && <Tag label={post.role_label} />}
          <Text variant="cardTitle" breakStrategy="words">{post.title}</Text>
          <Text variant="bodySmall" color="textSecondary">Başvurun takımın kaptanına ve mentorlarına gider. Başvurduğunda takım yöneticileri adını ve notunu görür; iletişim bilgilerin paylaşılmaz.</Text>
          <TextArea label="Kısa bir not (isteğe bağlı)" value={message} onChangeText={setMessage} maxLength={1000} placeholder="Neye katkı verebilirsin?" />
          {error && <Notice tone="danger" title="Başvurun gönderilmedi">{error.code === 'profile_incomplete' ? 'Önce Profil sekmesinden profilini tamamlaman gerekiyor.' : error.message}</Notice>}
          <Button label="Başvuruyu gönder" loading={apply.isPending} onPress={() => apply.mutate({ postId: post.id, message })} />
        </>
      )}
    </SheetFrame>
  );
}

/** Root-stack form-sheet route (fit to contents). The role travels as params; the opener's "GÖNDERİLDİ" comes from the invalidated query. */
export function RecruitmentApplyScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'RecruitmentApply'>) {
  const { postId, title, roleLabel } = route.params; const { userId } = useSession();
  return <RecruitmentApplySheet post={{ id: postId, title, role_label: roleLabel }} userId={userId ?? ''} onClose={() => closeSheet(navigation)} />;
}
