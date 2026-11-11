import { normaliseEmail } from './authService';

/**
 * The e-mail being verified, kept in module memory only. Route params are serialised into the URL on web,
 * so the e-mail must never travel through navigation (CLAUDE.md rule 9). Not persisted, not in context.
 */
let pending: string | null = null;

export const otpFlow = {
  begin(email: string): void { pending = normaliseEmail(email); },
  email(): string | null { return pending; },
  clear(): void { pending = null; },
};
