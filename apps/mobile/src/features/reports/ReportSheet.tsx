import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BottomSheet, Button, Notice, Select, Text, TextArea, TextButton, useToast, colors } from '../../design-system';
import { toAppError } from '../../lib/errors';
import { REPORT_DETAILS_MAX, REPORT_REASONS, submitReport, type ReportReason, type ReportTarget } from './api';

/** What is being reported. `label` is the content's own name, shown as written (free text from a team or organiser, never re-cased). */
export interface ReportSubject { targetType: ReportTarget; targetId: string; label: string }

/** The entry point on a detail screen or a row: small, quiet, never a second primary action. */
export function ReportLink({ label = 'Bildir', accessibilityLabel, onPress }: { label?: string; accessibilityLabel: string; onPress: () => void }) {
  return <TextButton icon="warning" label={label} accessibilityLabel={accessibilityLabel} color={colors.textSecondary} onPress={onPress} />;
}

/**
 * "Bildir": pick a reason, optionally say more, send. The server decides everything else; its answer is shown here with the app's own
 * copy. A guest only gets a sign-in prompt: nothing is remembered and nothing is sent after sign-in. The person comes back to the same
 * screen and opens the sheet again, so a report is always filed from a sheet they are looking at.
 */
export function ReportSheet({ subject, userId, onClose, onSignIn }: { subject: ReportSubject | null; userId: string | null; onClose: () => void; onSignIn: () => void }) {
  return (
    <BottomSheet visible={!!subject} title="İçeriği bildir" onClose={onClose}>
      {/* Mounted only while a subject is set, and keyed by it: every opening starts clean (no reason or text carried over). */}
      {!!subject && <ReportForm key={`${subject.targetType}:${subject.targetId}`} subject={subject} userId={userId} onClose={onClose} onSignIn={onSignIn} />}
    </BottomSheet>
  );
}

function ReportForm({ subject, userId, onClose, onSignIn }: { subject: ReportSubject; userId: string | null; onClose: () => void; onSignIn: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [missing, setMissing] = useState(false);
  const send = useMutation({
    mutationFn: (v: { reason: ReportReason; details: string }) => submitReport({ targetType: subject.targetType, targetId: subject.targetId, reason: v.reason, details: v.details }),
    onSuccess: () => { toast.show('Bildirimin alındı. Teşekkürler.', 'success'); onClose(); },
  });
  const error = send.error ? toAppError(send.error) : null;
  const already = error?.code === 'already_reported';
  const submit = () => {
    if (!reason) { setMissing(true); return; }
    send.mutate({ reason, details });
  };

  return (
    <>
      <Text variant="cardTitle" breakStrategy="words">{subject.label}</Text>
      {!userId ? (
        <>
          <Text variant="body">Bildirmek için giriş yapman gerekiyor.</Text>
          <Text variant="bodySmall" color="textSecondary">Girişten sonra bu sayfaya dönüp tekrar “Bildir”e dokunabilirsin. Giriş yapman bildirimi kendiliğinden göndermez.</Text>
          <Button label="Giriş yap" iconRight="arrow" onPress={() => { onClose(); onSignIn(); }} />
        </>
      ) : (
        <>
          <Text variant="bodySmall" color="textSecondary">Neden bildirdiğini seç. Bildirimi yalnızca sen ve platform yöneticileri görebilir; içeriğin sahibi bildireni göremez.</Text>
          <Select label="Neden bildiriyorsun?" options={REPORT_REASONS} value={reason} onChange={(r) => { setReason(r); setMissing(false); }} />
          {missing && <Notice tone="warning">Bir neden seç.</Notice>}
          <TextArea label="Eklemek istediğin bir şey var mı? (isteğe bağlı)" value={details} onChangeText={setDetails} maxLength={REPORT_DETAILS_MAX} placeholder="Ne gördün? Kısaca yazabilirsin." style={{ minHeight: 96 }} />
          {error && <Notice tone={already ? 'info' : 'danger'} title={already ? undefined : 'Bildirimin gönderilmedi'}>{error.message}</Notice>}
          {already ? <Button kind="secondary" label="Tamam" onPress={onClose} />
            : <Button label="Bildirimi gönder" loading={send.isPending} onPress={submit} />}
        </>
      )}
    </>
  );
}
