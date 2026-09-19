import { Linking } from 'react-native';

/** A URL is safe to hand to the OS only when it is a real https:// address. Blocks javascript:, data:, file:, tel:, etc. */
export const isHttpsUrl = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^https:\/\/[^\s.]+\.[^\s]+$/.test(value.trim());

/**
 * Opens an external link, but only when it is https. The stored value is already constrained to ^https:// by a DB
 * CHECK, so this is defense-in-depth: a future weakening of that constraint can never turn a link into a scheme the
 * OS would act on. `onError` fires when the scheme is rejected or the OS cannot open the URL.
 */
export async function openExternalUrl(value: string | null | undefined, onError: () => void): Promise<void> {
  if (!isHttpsUrl(value)) { onError(); return; }
  try { await Linking.openURL(value.trim()); } catch { onError(); }
}
