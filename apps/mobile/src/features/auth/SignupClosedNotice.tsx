import React from 'react';
import { View } from 'react-native';
import { Button, Notice, space, useToast } from '../../design-system';
import { WEB_ORIGIN, WEB_PATHS } from '../../lib/domain';
import { makeError } from '../../lib/errors';
import { openExternalUrl } from '../../lib/links';

/**
 * Closed sign-up (legal gate): the server refused a new account (Before User Created hook on the OTP request) or its
 * first profile (complete_profile_bootstrap 403 signup_closed). Not a failure of the form: say so honestly and offer the
 * way in for pilot staff. The sentence is the `signup_closed` COPY entry.
 */
export function SignupClosedNotice() {
  const toast = useToast();
  return (
    <View style={{ gap: space[3] }}>
      <Notice tone="warning" alert>{makeError('signup_closed', 403).message}</Notice>
      <Button kind="secondary" label="Bize yaz" icon="link"
        onPress={() => { void openExternalUrl(WEB_ORIGIN + WEB_PATHS.support, () => toast.show('Bağlantı açılamadı.', 'danger')); }} />
    </View>
  );
}
