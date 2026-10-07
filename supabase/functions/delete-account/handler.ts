// Account deletion — the logic, independent of the runtime (see guardian-dispatch/handler.ts). Erasable TS only.
// auth.users → profile, registrations, consents, guardian requests, experiences cascade in the database; records the
// person created as staff (events, check-ins, approvals) stay, unattributed. Audit rows carry ids, never e-mails.
export interface DeleteAccountDeps {
  authenticate(authorization: string): Promise<string | null>;
  audit(action: 'account.deletion_requested' | 'account.deleted' | 'account.deletion_blocked', userId: string): Promise<void>;
  /** Remove the user's own files (evidence, avatars) before the rows that point at them disappear. */
  removeFiles(userId: string): Promise<void>;
  deleteUser(userId: string): Promise<{ error: { status?: number } | null }>;
  /** Moderators' accounts are kept on purpose (moderation_actions.moderator_id is RESTRICT): support deletes them. */
  hasModerationHistory(userId: string): Promise<boolean>;
  log?: (...args: unknown[]) => void;
}

export async function deleteAccount(deps: DeleteAccountDeps, authorization: string, requestId: string) {
  const userId = await deps.authenticate(authorization);
  if (!userId) return { status: 401, body: { code: 'auth_required', message: 'auth_required', retryable: false, requestId } };

  if (await deps.hasModerationHistory(userId)) {
    await deps.audit('account.deletion_blocked', userId);
    return { status: 409, body: { code: 'account_deletion_requires_support', message: 'account_deletion_requires_support', retryable: false, requestId } };
  }
  await deps.audit('account.deletion_requested', userId);
  await deps.removeFiles(userId);
  const { error } = await deps.deleteUser(userId);
  if (error) {
    deps.log?.('delete-account failed', requestId, error.status);
    return { status: 500, body: { code: 'server_error', message: 'server_error', retryable: true, requestId } };
  }
  await deps.audit('account.deleted', userId);
  return { status: 200, body: { deleted: true } };
}
