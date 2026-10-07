// Integration tests for the Edge Functions' logic (supabase/functions/*/handler.ts) against the real schema.
// The Deno entry points only wire these handlers to supabase-js and Resend; here they are wired to the embedded
// Postgres with the same roles (the user's RLS view, the service-role RPC) and a recording mailer.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { guardianDispatch, type GuardianDispatchDeps, type Mail } from '../functions/guardian-dispatch/handler';
import { deleteAccount, type DeleteAccountDeps } from '../functions/delete-account/handler';
import { admin, asService, asUser, createEvent, createOrg, createUser, register } from './helpers';

/** Test stand-in for JWT verification: "Bearer <user id>" of an existing user. */
const authenticate = async (authorization: string) => {
  const id = /^Bearer ([0-9a-f-]{36})$/.exec(authorization)?.[1];
  if (!id) return null;
  return (await admin(`select 1 from auth.users where id = $1`, [id])).rowCount ? id : null;
};
const bearer = (userId: string) => `Bearer ${userId}`;

function guardianDeps(overrides: Partial<GuardianDispatchDeps> = {}) {
  const sent: Mail[] = [];
  const deps: GuardianDispatchDeps = {
    authenticate,
    ownsRequest: async (authorization, id) => {
      const userId = await authenticate(authorization);
      return !!userId && !!(await asUser(userId, (q) => q(`select id from public.my_guardian_requests where id = $1`, [id]))).rowCount;
    },
    issueToken: async (id) => {
      try {
        return { data: (await asService((q) => q(`select public.issue_guardian_token($1) j`, [id]))).rows[0].j, error: null };
      } catch (e) {
        return { data: null, error: { code: (e as { code?: string }).code, message: (e as Error).message } };
      }
    },
    sendMail: async (mail) => { sent.push(mail); return { ok: true, status: 200 }; },
    guardianPageUrl: 'https://techapp.test/veli',
    ...overrides,
  };
  return { deps, sent };
}

const uniqueEmail = (prefix = 'veli') => `${prefix}-${randomUUID().slice(0, 8)}@example.test`;

async function minorWithRequest(email = uniqueEmail()) {
  const org = await createOrg(); const event = await createEvent(org, { guardian_required_under: 18 });
  const minor = await createUser({ age: 15, name: 'Ece Yılmaz' });
  const reg = await register(minor, event);
  const reqId = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, $2, 'Ayşe Yılmaz') id`, [reg.id, email]))).rows[0].id as string;
  return { minor, reg, reqId };
}

describe('guardian-dispatch', () => {
  it('authorization: no or invalid token → 401, nothing sent', async () => {
    const { reqId } = await minorWithRequest();
    const { deps, sent } = guardianDeps();
    for (const auth of ['', 'Bearer nope', bearer(randomUUID())]) {
      expect((await guardianDispatch(deps, auth, { request_id: reqId }, 'r')).status).toBe(401);
    }
    expect(sent).toHaveLength(0);
  });

  it('ownership: another user (or a malformed id) gets 404 and no e-mail goes out', async () => {
    const { reqId } = await minorWithRequest();
    const other = await createUser({ age: 15 });
    const { deps, sent } = guardianDeps();
    expect((await guardianDispatch(deps, bearer(other), { request_id: reqId }, 'r')).body.code).toBe('guardian_request_not_found');
    expect((await guardianDispatch(deps, bearer(other), { request_id: 'x; drop table' }, 'r')).status).toBe(404);
    expect((await guardianDispatch(deps, bearer(other), null, 'r')).status).toBe(404);
    expect(sent).toHaveLength(0);
  });

  it('happy path: the e-mail carries a working single-use link; the token never goes back to the app', async () => {
    const email = uniqueEmail('Veli');
    const { minor, reqId } = await minorWithRequest(email.toUpperCase());
    const { deps, sent } = guardianDeps();
    const res = await guardianDispatch(deps, bearer(minor), { request_id: reqId }, 'r');
    expect(res).toEqual({ status: 200, body: { sent: true } });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(email.toLowerCase()); // normalised
    expect(sent[0]!.subject).toBe('TechApp · Ece için veli onayı');
    const token = /#([A-Za-z0-9_-]{32,})/.exec(sent[0]!.text)?.[1];
    expect(token).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain(token!);
    // what is stored is the hash of exactly the mailed token (previewing/deciding with it is covered in events.test.ts)
    expect((await admin(`select token_hash = extensions.digest($2, 'sha256') ok from public.guardian_requests where id = $1`, [reqId, token])).rows[0].ok).toBe(true);
  });

  it('rate limit: a resend inside the cooldown → 429 with retry-after, no second e-mail, audited', async () => {
    const { minor, reqId } = await minorWithRequest();
    const { deps, sent } = guardianDeps();
    await guardianDispatch(deps, bearer(minor), { request_id: reqId }, 'r');
    const again = await guardianDispatch(deps, bearer(minor), { request_id: reqId }, 'r');
    expect(again.status).toBe(429);
    expect(again.body).toMatchObject({ code: 'guardian_send_too_soon', retryable: true });
    expect(Number(again.body.retryAfterSeconds)).toBeGreaterThan(0);
    expect(sent).toHaveLength(1);
    const actions = (await admin(`select action from public.audit_events where target_id = $1 order by id`, [reqId])).rows.map((r) => r.action);
    expect(actions).toEqual(['guardian_request.created', 'guardian_request.sent', 'guardian_request.throttled']);
  });

  it('duplicate requests: asking again for the same address reuses the request and stays throttled', async () => {
    const email = uniqueEmail();
    const { minor, reg, reqId } = await minorWithRequest(email);
    const { deps, sent } = guardianDeps();
    await guardianDispatch(deps, bearer(minor), { request_id: reqId }, 'r');
    const again = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, $2) id`, [reg.id, email]))).rows[0].id;
    expect(again).toBe(reqId);
    expect((await guardianDispatch(deps, bearer(minor), { request_id: again }, 'r')).status).toBe(429);
    expect(sent).toHaveLength(1);
  });

  it('a request that is no longer pending is refused (409), and a mailer failure is reported as 502', async () => {
    const { minor, reqId } = await minorWithRequest();
    const failing = guardianDeps({ sendMail: async () => ({ ok: false, status: 500 }) });
    expect((await guardianDispatch(failing.deps, bearer(minor), { request_id: reqId }, 'r')).body.code).toBe('mail_delivery_failed');
    await admin(`update public.guardian_requests set status = 'revoked' where id = $1`, [reqId]);
    const { deps } = guardianDeps();
    expect((await guardianDispatch(deps, bearer(minor), { request_id: reqId }, 'r')).body).toMatchObject({ code: 'guardian_request_not_pending' });
  });

  it('the guardian name is escaped in the HTML e-mail', async () => {
    const org = await createOrg(); const event = await createEvent(org, { guardian_required_under: 18, title: 'Robot <b>Günü</b>' });
    const minor = await createUser({ age: 15 }); const reg = await register(minor, event);
    const reqId = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, $2, '<script>x</script>') id`, [reg.id, uniqueEmail()]))).rows[0].id;
    const { deps, sent } = guardianDeps();
    await guardianDispatch(deps, bearer(minor), { request_id: reqId }, 'r');
    expect(sent[0]!.html).not.toContain('<script>');
    expect(sent[0]!.html).not.toContain('<b>Günü</b>');
  });
});

function deleteDeps(overrides: Partial<DeleteAccountDeps> = {}) {
  const removed: string[] = [];
  const deps: DeleteAccountDeps = {
    authenticate,
    audit: async (action, userId) => {
      await admin(`insert into public.audit_events (actor_id, actor_kind, action, target_type, target_id) values ($1, $2, $3, 'user', $4)`,
        [action === 'account.deleted' ? null : userId, action === 'account.deleted' ? 'service' : 'user', action, userId]);
    },
    removeFiles: async (userId) => { removed.push(userId); },
    deleteUser: async (userId) => {
      try { await admin(`delete from auth.users where id = $1`, [userId]); return { error: null }; } catch { return { error: { status: 500 } }; }
    },
    hasModerationHistory: async (userId) => !!(await admin(`select 1 from public.moderation_actions where moderator_id = $1`, [userId])).rowCount,
    ...overrides,
  };
  return { deps, removed };
}
const auditTrail = async (userId: string) =>
  (await admin(`select action, actor_id from public.audit_events where target_type = 'user' and target_id = $1 order by id`, [userId])).rows;

describe('delete-account', () => {
  it('requires a signed-in user', async () => {
    const { deps } = deleteDeps();
    expect((await deleteAccount(deps, '', 'r')).status).toBe(401);
  });

  it('normal user: files first, then the account and its personal data; audit keeps only ids', async () => {
    const org = await createOrg(); const event = await createEvent(org);
    const user = await createUser(); const reg = await register(user, event);
    const { deps, removed } = deleteDeps();
    expect(await deleteAccount(deps, bearer(user), 'r')).toEqual({ status: 200, body: { deleted: true } });
    expect(removed).toEqual([user]);
    expect((await admin(`select count(*)::int n from public.profiles where id = $1`, [user])).rows[0].n).toBe(0);
    expect((await admin(`select count(*)::int n from public.event_registrations where id = $1`, [reg.id])).rows[0].n).toBe(0);
    expect((await auditTrail(user)).map((r) => r.action)).toEqual(['account.deletion_requested', 'account.deleted']);
    // the event's seat is released by the cascade
    expect((await admin(`select seats_taken from public.events where id = $1`, [event])).rows[0].seats_taken).toBe(0);
  });

  it('organisation staff: deletion succeeds; events and check-ins they made stay, unattributed', async () => {
    const staff = await createUser(); const org = await createOrg({ [staff]: 'owner' });
    const event = await createEvent(org, {
      created_by: staff,
      starts_at: new Date(Date.now() + 2 * 36e5), ends_at: new Date(Date.now() + 6 * 36e5), registration_closes_at: new Date(Date.now() + 36e5),
    });
    const user = await createUser(); const reg = await register(user, event);
    const token = (await asUser(user, (q) => q(`select public.get_participation_card($1) j`, [reg.id]))).rows[0].j.qr_payload;
    await asUser(staff, (q) => q(`select public.check_in_participant($1, null, $2)`, [token, event]));

    const { deps } = deleteDeps();
    expect((await deleteAccount(deps, bearer(staff), 'r')).status).toBe(200);
    expect((await admin(`select created_by from public.events where id = $1`, [event])).rows[0].created_by).toBeNull();
    expect((await admin(`select checked_in_by from public.event_check_ins where registration_id = $1`, [reg.id])).rows[0].checked_in_by).toBeNull();
    expect((await admin(`select count(*)::int n from public.organization_members where user_id = $1`, [staff])).rows[0].n).toBe(0);
  });

  it('moderators: refused with a support code before anything is removed', async () => {
    const moderator = await createUser();
    await admin(`insert into public.moderation_actions (moderator_id, action, target_type, target_id, reason) values ($1, 'dismiss', 'team', $2, 'Test kaydı')`, [moderator, randomUUID()]);
    const { deps, removed } = deleteDeps();
    expect((await deleteAccount(deps, bearer(moderator), 'r')).body.code).toBe('account_deletion_requires_support');
    expect(removed).toHaveLength(0);
    expect((await admin(`select count(*)::int n from auth.users where id = $1`, [moderator])).rows[0].n).toBe(1);
    expect((await auditTrail(moderator)).map((r) => r.action)).toEqual(['account.deletion_blocked']);
  });

  it('a failed deletion is reported as retryable and not audited as deleted', async () => {
    const user = await createUser();
    const { deps } = deleteDeps({ deleteUser: async () => ({ error: { status: 500 } }) });
    expect((await deleteAccount(deps, bearer(user), 'r')).body).toMatchObject({ code: 'server_error', retryable: true });
    expect((await auditTrail(user)).map((r) => r.action)).toEqual(['account.deletion_requested']);
  });
});
