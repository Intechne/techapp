import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader, Button, Input, Notice, Screen, Text, TextButton, codeField, colors, fonts, space } from '../../design-system';
import { makeError, parsePayload, toAppError } from '../../lib/errors';
import { accountStateSchema } from '../../lib/database.types';
import { getSupabase } from '../../lib/supabase';
import type { RootStackParamList } from '../../navigation/types';
import { signInWithEmailOtp, verifyOtp } from './authService';
import { otpFlow } from './otpFlow';
import { accountStateKey, useAccountState, useSession } from './SessionProvider';

const RESEND_SECONDS = 60;

/** Fallback only: the field is focused on the native-stack `transitionEnd`; this covers a platform that never emits it. */
export const FOCUS_FALLBACK_MS = 700;

export function AuthOtpScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'AuthOtp'>) {
  // Snapshot once per mount: clearing the module memory (success, back-out) must not re-trigger the redirect below.
  const [email] = useState(() => otpFlow.email());
  const lastSubmitted = useRef<string | null>(null);
  const field = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(RESEND_SECONDS);
  const qc = useQueryClient();

  // The e-mail does not outlive this screen (success clears it too).
  useEffect(() => () => otpFlow.clear(), []);

  // Nothing to verify without an e-mail in memory (cold start, reload, deep link): start over at the e-mail step.
  useEffect(() => { if (!email) navigation.replace('AuthEmail'); }, [email, navigation]);

  // Opens the keyboard on arrival, like `autoFocus`, but not for screen-reader users: moving their focus into a field before
  // they have heard the heading and the e-mail it was sent to is disorienting (the HIG Doctor "autoFocus" finding).
  // Waits for the native-stack push to finish (`transitionEnd`, not a guess at its length); a timer is only the fallback for
  // platforms that never emit it. A failed screen-reader query counts as "off". InteractionManager is deprecated in RN 0.86.
  useEffect(() => {
    let live = true;
    let done = false;
    let ended = false;
    let readerOff = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const focusOnce = () => {
      if (!live || done) return;
      done = true;
      clearTimeout(timer);
      field.current?.focus();
    };
    const unsubscribe = navigation.addListener('transitionEnd', (e) => {
      if (e.data.closing) return;
      ended = true;
      if (readerOff) focusOnce();
    });
    AccessibilityInfo.isScreenReaderEnabled().catch(() => false).then((on) => {
      if (!live || on) return;
      readerOff = true;
      if (ended) focusOnce(); else timer = setTimeout(focusOnce, FOCUS_FALLBACK_MS);
    });
    return () => { live = false; clearTimeout(timer); unsubscribe(); };
  }, [navigation]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = useMutation({
    mutationFn: async (token: string) => {
      if (!email) throw makeError('otp_invalid', 422);
      const session = await verifyOtp(email, token);
      // Decide the next step from the server's view of the account, not from local assumptions.
      const { data, error } = await getSupabase().rpc('my_account_state');
      if (error) throw toAppError(error);
      const state = data === null ? null : parsePayload(accountStateSchema, data);
      qc.setQueryData(accountStateKey(session.user.id), state);
      return state;
    },
    onError: () => { lastSubmitted.current = null; },
    onSuccess: (state) => {
      otpFlow.clear();
      if (state?.profile_complete) navigation.popTo('Main');
      else navigation.replace('ProfileBootstrap');
    },
  });
  const submit = (token: string) => {
    // A pasted code fills the field and verifies once: never twice for the same code, never while one is in flight.
    if (verify.isPending || lastSubmitted.current === token) return;
    lastSubmitted.current = token;
    verify.mutate(token);
  };
  const resend = useMutation({
    mutationFn: () => signInWithEmailOtp(email ?? ''),
    onSuccess: () => { setWait(RESEND_SECONDS); setCode(''); lastSubmitted.current = null; verify.reset(); },
  });
  // A failed verify does not lift the cooldown: Supabase reports a wrong code as `otp_expired` too, and a resend inside 60 s
  // would only earn a 429. (A real code lives far longer than 60 s, so a genuinely expired one never waits here.)
  const waiting = wait > 0;
  const onChangeCode = (t: string) => {
    const digits = t.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length < 6) lastSubmitted.current = null;
    else submit(digits);
  };
  const error = verify.error ?? resend.error;

  // Signed in through the e-mailed link while this screen was open: continue exactly like a verified code.
  const { userId } = useSession();
  const account = useAccountState();
  useEffect(() => {
    if (!userId || verify.isPending || verify.isSuccess || !account.data) return;
    if (account.data.profile_complete) navigation.popTo('Main'); else navigation.replace('ProfileBootstrap');
  }, [userId, account.data, verify.isPending, verify.isSuccess, navigation]);

  return (
    <Screen header={<AppHeader onBack={navigation.goBack} title="Doğrulama" />}
      footer={<Button label="Doğrula" loading={verify.isPending} disabled={code.length < 6} onPress={() => submit(code)} />}>
      <Text variant="display" style={{ marginTop: space[3] }}>Kodunu gir.</Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space[3] }}>
        <Text variant="body" color="ink" style={{ fontFamily: fonts.bodySemibold }}>{email}</Text> adresine bir e-posta gönderdik. İçindeki 6 haneli kodu buraya yaz.
      </Text>
      <View style={{ marginTop: space[6], gap: space[4] }}>
        <Input ref={field} label="Doğrulama kodu" value={code} onChangeText={onChangeCode} keyboardType="number-pad"
          textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} style={codeField} />
        {error && <Notice tone="danger">{toAppError(error).message}</Notice>}
        <TextButton label={waiting ? `Yeni kod iste (${wait} sn)` : 'Yeni kod iste'} disabled={waiting || resend.isPending || verify.isPending}
          color={waiting ? colors.textSecondary : undefined} onPress={() => resend.mutate()} />
      </View>
    </Screen>
  );
}
