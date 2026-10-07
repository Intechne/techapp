// Regression tests for the 7 Ekim 2026 audit findings (migration 20261007000100_stabilization_security).
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { admin, asAnon, asService, asUser, createEvent, createOrg, createUser, expectFail, register } from './helpers';

const audits = async (targetId: string) =>
  (await admin(`select action, metadata from public.audit_events where target_id = $1 order by id`, [targetId])).rows as { action: string; metadata: Record<string, unknown> }[];

// ---------------------------------------------------------------- CV share token
describe('CV share token can only be set by set_cv_sharing()', () => {
  it('1. adult → RPC → success, and the public link works', async () => {
    const adult = await createUser({ name: 'Elif Yetişkin' });
    const token = (await asUser(adult, (q) => q(`select public.set_cv_sharing(true) t`))).rows[0].t as string;
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect((await asAnon((q) => q(`select public.public_cv($1) j`, [token]))).rows[0].j.profile.display_name).toBe('Elif Yetişkin');
  });

  it('2. minor → RPC → rejected', async () => {
    const minor = await createUser({ age: 16 });
    await expectFail(asUser(minor, (q) => q(`select public.set_cv_sharing(true)`)), 403, 'cv_sharing_adults_only');
    expect((await admin(`select cv_share_token from public.profile_private where user_id = $1`, [minor])).rows[0].cv_share_token).toBeNull();
  });

  it('3. adult → direct column update → rejected (the audit exploit)', async () => {
    const adult = await createUser();
    const chosen = 'a'.repeat(40);
    await expect(asUser(adult, (q) => q(`update public.profile_private set cv_share_token = $2 where user_id = $1`, [adult, chosen]))).rejects.toThrow(/permission denied/);
    await expect(asUser(adult, (q) => q(`insert into public.profile_private (user_id, cv_share_token) values ($1, $2) on conflict (user_id) do update set cv_share_token = excluded.cv_share_token`, [adult, chosen]))).rejects.toThrow(/permission denied/);
    await expectFail(asAnon((q) => q(`select public.public_cv($1)`, [chosen])), 404, 'cv_not_found');
    // defence in depth: even a role that may update the table cannot touch the token outside the RPC
    await expectFail(admin(`update public.profile_private set cv_share_token = $2 where user_id = $1`, [adult, chosen]), 403, 'cv_token_locked');
    // contact fields stay editable by the owner
    expect((await asUser(adult, (q) => q(`update public.profile_private set phone = '05550000000' where user_id = $1`, [adult]))).rowCount).toBe(1);
  });

  it('4. minor → direct column update → rejected; a minor link that exists anyway is not served', async () => {
    const minor = await createUser({ age: 15 });
    const chosen = 'b'.repeat(40);
    await expect(asUser(minor, (q) => q(`update public.profile_private set cv_share_token = $2 where user_id = $1`, [minor, chosen]))).rejects.toThrow(/permission denied/);
    // simulate a token planted before this fix: public_cv still refuses to serve a minor's profile
    await admin(`select set_config('app.allow_cv_token_write', 'on', false)`);
    await admin(`update public.profile_private set cv_share_token = $2 where user_id = $1`, [minor, chosen]);
    await admin(`select set_config('app.allow_cv_token_write', '', false)`);
    await expectFail(asAnon((q) => q(`select public.public_cv($1)`, [chosen])), 404, 'cv_not_found');
  });

  it('5. anonymous token guessing → rejected, same answer for every miss', async () => {
    const adult = await createUser();
    const real = (await asUser(adult, (q) => q(`select public.set_cv_sharing(true) t`))).rows[0].t as string;
    for (const guess of ['', 'short', real.slice(0, 31), real.slice(0, -1) + (real.endsWith('A') ? 'B' : 'A'), 'x'.repeat(64)]) {
      await expectFail(asAnon((q) => q(`select public.public_cv($1)`, [guess])), 404, 'cv_not_found');
    }
    expect((await asAnon((q) => q(`select cv_share_token from public.profile_private`))).rowCount).toBe(0); // RLS: anon sees no rows
  });

  it('6. disabled sharing → public CV inaccessible; re-enabling issues a new link', async () => {
    const adult = await createUser();
    const first = (await asUser(adult, (q) => q(`select public.set_cv_sharing(true) t`))).rows[0].t as string;
    expect((await asUser(adult, (q) => q(`select public.set_cv_sharing(false) t`))).rows[0].t).toBeNull();
    await expectFail(asAnon((q) => q(`select public.public_cv($1)`, [first])), 404, 'cv_not_found');
    const second = (await asUser(adult, (q) => q(`select public.set_cv_sharing(true) t`))).rows[0].t as string;
    expect(second).not.toBe(first);
    await expectFail(asAnon((q) => q(`select public.public_cv($1)`, [first])), 404, 'cv_not_found');
  });
});

// ---------------------------------------------------------------- guardian e-mail abuse
async function minorPending() {
  const org = await createOrg(); const event = await createEvent(org, { guardian_required_under: 18 });
  const minor = await createUser({ age: 15 });
  const reg = await register(minor, event);
  expect(reg.status).toBe('pending_guardian');
  return { minor, reg, event };
}
const createReq = (user: string, regId: string, email: string) =>
  asUser(user, async (q) => (await q(`select public.create_guardian_request($1, $2, 'Veli Adı') id`, [regId, email])).rows[0].id as string);
const issue = (reqId: string) => asService(async (q) => (await q(`select public.issue_guardian_token($1) j`, [reqId])).rows[0].j);
/** Make the previous send look older than the resend cooldown. */
const ageLastSend = (reqId: string, seconds = 600) =>
  admin(`update public.guardian_requests set last_sent_at = now() - make_interval(secs => $2) where id = $1`, [reqId, seconds]);

describe('guardian e-mails are abuse-resistant (server-enforced)', () => {
  it('re-asking for the same address reuses the request instead of resetting its limits; e-mail is normalised', async () => {
    const { minor, reg } = await minorPending();
    const local = `veli-${randomUUID().slice(0, 8)}`;
    const a = await createReq(minor, reg.id, `${local.toUpperCase()}@Example.TEST`);
    const b = await createReq(minor, reg.id, `  ${local}@example.test `);
    expect(b).toBe(a);
    expect((await admin(`select count(*)::int n from public.guardian_requests where subject_id = $1`, [reg.id])).rows[0].n).toBe(1);
    expect((await admin(`select guardian_email from public.guardian_requests where id = $1`, [a])).rows[0].guardian_email).toBe(`${local}@example.test`);
    expect((await audits(a)).map((r) => r.action)).toEqual(['guardian_request.created', 'guardian_request.reused']);
  });

  it('per request: cooldown, then at most 5 sends — and re-creating does not reset it', async () => {
    const { minor, reg } = await minorPending();
    const email = `veli-${randomUUID().slice(0, 8)}@example.test`;
    const reqId = await createReq(minor, reg.id, email);
    expect(await issue(reqId)).toMatchObject({ throttled: false });
    expect(await issue(reqId)).toMatchObject({ throttled: true, code: 'guardian_send_too_soon' });
    for (let i = 0; i < 4; i += 1) { await ageLastSend(reqId); expect(await issue(reqId)).toMatchObject({ throttled: false }); }
    await ageLastSend(reqId);
    expect(await issue(reqId)).toMatchObject({ throttled: true, code: 'guardian_send_limit' });
    // the audit exploit: asking again for the same address returns the same (exhausted) request
    expect(await createReq(minor, reg.id, email)).toBe(reqId);
    expect(await issue(reqId)).toMatchObject({ throttled: true });
    const actions = (await audits(reqId)).map((r) => r.action);
    expect(actions.filter((a) => a === 'guardian_request.sent')).toHaveLength(1);
    expect(actions.filter((a) => a === 'guardian_request.resent')).toHaveLength(4);
    expect(actions.filter((a) => a === 'guardian_request.throttled').length).toBeGreaterThanOrEqual(3);
  });

  it('per registration: changing the address is limited', async () => {
    const { minor, reg } = await minorPending();
    await createReq(minor, reg.id, 'a1@example.test');
    await createReq(minor, reg.id, 'a2@example.test');
    await createReq(minor, reg.id, 'a3@example.test');
    await expectFail(createReq(minor, reg.id, 'a4@example.test'), 429, 'guardian_request_limit');
  });

  it('per user: hourly send limit across registrations, and a daily cap on new requests', async () => {
    const org = await createOrg(); const minor = await createUser({ age: 15 });
    const results: { throttled: boolean; code?: string }[] = [];
    for (let i = 0; i < 6; i += 1) {
      const reg = await register(minor, await createEvent(org, { guardian_required_under: 18 }));
      results.push(await issue(await createReq(minor, reg.id, `u${i}@example.test`)));
    }
    expect(results.slice(0, 5).every((r) => !r.throttled)).toBe(true);
    expect(results[5]).toMatchObject({ throttled: true, code: 'guardian_send_limit_user' });
    const seventh = await register(minor, await createEvent(org, { guardian_required_under: 18 }));
    await expectFail(createReq(minor, seventh.id, 'u7@example.test'), 429, 'guardian_request_limit');
  });

  it('per recipient: one address cannot be flooded by many accounts', async () => {
    const target = `hedef-${randomUUID().slice(0, 8)}@example.test`;
    const results: { throttled: boolean; code?: string }[] = [];
    for (let i = 0; i < 6; i += 1) {
      const { minor, reg } = await minorPending();
      results.push(await issue(await createReq(minor, reg.id, target)));
    }
    expect(results.slice(0, 5).every((r) => !r.throttled)).toBe(true);
    expect(results[5]).toMatchObject({ throttled: true, code: 'guardian_send_limit_recipient' });
    // the log keeps only a hash of the address
    const log = (await admin(`select * from public.guardian_send_log order by id desc limit 1`)).rows[0];
    expect(JSON.stringify(log)).not.toContain('hedef');
  });

  it('invalid recipients are refused before anything is stored; clients cannot read the send log', async () => {
    const { minor, reg } = await minorPending();
    for (const bad of ['', 'veli', 'veli@', '@example.test', 'veli@example', `${'x'.repeat(250)}@example.test`]) {
      await expectFail(createReq(minor, reg.id, bad), 422, 'guardian_email_invalid');
    }
    expect((await admin(`select count(*)::int n from public.guardian_requests where subject_id = $1`, [reg.id])).rows[0].n).toBe(0);
    await expect(asUser(minor, (q) => q(`select * from public.guardian_send_log`))).rejects.toThrow(/permission denied/);
  });

  it('ownership: a user cannot create a request for someone else’s registration', async () => {
    const { reg } = await minorPending();
    const other = await createUser({ age: 15 });
    await expectFail(createReq(other, reg.id, `veli-${randomUUID().slice(0, 8)}@example.test`), 404, 'registration_not_found');
  });
});

// ---------------------------------------------------------------- approved content re-review
describe('critical edits to approved content go back to review', () => {
  async function setup() {
    const editor = await createUser(); const platformAdmin = await createUser();
    await admin(`insert into public.platform_admins (user_id) values ($1)`, [platformAdmin]);
    const org = await createOrg({ [editor]: 'editor' });
    const event = await createEvent(org, { min_age: 14, capacity: 50 });
    return { editor, platformAdmin, org, event };
  }

  it('changing the age limit unpublishes the event, keeps the approved version and audits it', async () => {
    const { editor, event } = await setup();
    expect((await asUser(editor, (q) => q(`update public.events set min_age = 10 where id = $1`, [event]))).rowCount).toBe(1);
    const row = (await admin(`select status, min_age from public.events where id = $1`, [event])).rows[0];
    expect(row).toEqual({ status: 'in_review', min_age: 10 });
    const rev = (await admin(`select * from public.content_revisions where entity_id = $1`, [event])).rows[0];
    expect(rev.changed_fields).toEqual(['min_age']);
    expect(rev.approved_snapshot.min_age).toBe(14);
    expect(rev.approved_snapshot.status).toBe('published');
    expect((await audits(event)).map((a) => a.action)).toContain('event.rereview_required');
    // hidden from the public until re-approved; new registrations are refused
    expect((await asAnon((q) => q(`select id from public.events where id = $1`, [event]))).rowCount).toBe(0);
  });

  it.each([
    ['guardian requirement', `guardian_required_under = null`],
    ['date', `starts_at = starts_at + interval '1 day', ends_at = ends_at + interval '1 day'`],
    ['location', `city = 'Ankara'`],
    ['fewer seats', `capacity = 10`],
    ['registration window', `registration_closes_at = registration_closes_at + interval '1 hour'`],
  ])('%s is critical', async (_label, set) => {
    const { editor, event } = await setup();
    await asUser(editor, (q) => q(`update public.events set ${set} where id = $1`, [event]));
    expect((await admin(`select status from public.events where id = $1`, [event])).rows[0].status).toBe('in_review');
  });

  it('wording and more seats stay live, but the edit is logged', async () => {
    const { editor, event } = await setup();
    await asUser(editor, (q) => q(`update public.events set title = 'Yazım hatası düzeltildi', description = 'Yeni metin', capacity = 80 where id = $1`, [event]));
    expect((await admin(`select status from public.events where id = $1`, [event])).rows[0].status).toBe('published');
    const logged = (await audits(event)).find((a) => a.action === 'event.edited_after_approval');
    expect(logged?.metadata.changed_fields).toEqual(['capacity', 'description', 'title']);
    expect((await admin(`select count(*)::int n from public.content_revisions where entity_id = $1`, [event])).rows[0].n).toBe(0);
  });

  it('platform approvers edit without a second review; re-approval publishes again', async () => {
    const { editor, platformAdmin, event } = await setup();
    await asUser(platformAdmin, (q) => q(`update public.events set min_age = 12 where id = $1`, [event]));
    expect((await admin(`select status from public.events where id = $1`, [event])).rows[0].status).toBe('published');
    await asUser(editor, (q) => q(`update public.events set max_age = 17 where id = $1`, [event]));
    await asUser(platformAdmin, (q) => q(`update public.events set status = 'published' where id = $1`, [event]));
    expect((await admin(`select status from public.events where id = $1`, [event])).rows[0].status).toBe('published');
  });

  it('existing registrations are kept when the event goes back to review', async () => {
    const { editor, event } = await setup();
    const user = await createUser(); const reg = await register(user, event);
    await asUser(editor, (q) => q(`update public.events set venue = 'Başka salon' where id = $1`, [event]));
    expect((await admin(`select status from public.event_registrations where id = $1`, [reg.id])).rows[0].status).toBe(reg.status);
    // new registrations wait for re-approval
    const late = await createUser();
    await expectFail(register(late, event), 404);
  });

  it('opportunities: changing shared fields re-reviews; a stale preview cannot be submitted', async () => {
    const editor = await createUser(); const org = await createOrg({ [editor]: 'editor' });
    const id = randomUUID();
    await admin(`insert into public.opportunities (id, organization_id, slug, title, summary, type, status, is_demo, closes_at, shared_fields)
                 values ($1, $2, $3, 'Staj Programı', 'Özet', 'internship', 'published', true, now() + interval '7 days', array['display_name','education_stage'])`,
      [id, org, `opp-${id.slice(0, 8)}`]);
    const applicant = await createUser();
    const previewed = ['display_name', 'education_stage'];

    // TOCTOU: the organisation widens the shared fields between preview and submit → refused, nothing stored
    await admin(`update public.opportunities set shared_fields = array['display_name','education_stage','phone'] where id = $1`, [id]);
    await expectFail(asUser(applicant, (q) => q(`select * from public.submit_application($1, $2, null, $3)`, [id, randomUUID(), previewed])), 409, 'shared_fields_changed');
    expect((await admin(`select count(*)::int n from public.applications where opportunity_id = $1`, [id])).rows[0].n).toBe(0);
    // the same set in another order is fine
    const ok = (await asUser(applicant, (q) => q(`select * from public.submit_application($1, $2, null, $3)`, [id, randomUUID(), ['phone', 'education_stage', 'display_name']]))).rows[0];
    expect(ok.status).toBe('submitted');

    await asUser(editor, (q) => q(`update public.opportunities set shared_fields = array['display_name','email'] where id = $1`, [id]));
    expect((await admin(`select status from public.opportunities where id = $1`, [id])).rows[0].status).toBe('in_review');
    expect((await admin(`select changed_fields from public.content_revisions where entity_id = $1`, [id])).rows[0].changed_fields).toEqual(['shared_fields']);
  });

  it('content history is visible to the organisation and the platform only', async () => {
    const { editor, event } = await setup();
    await asUser(editor, (q) => q(`update public.events set min_age = 16 where id = $1`, [event]));
    const outsider = await createUser();
    expect((await asUser(editor, (q) => q(`select id from public.content_revisions where entity_id = $1`, [event]))).rowCount).toBe(1);
    expect((await asUser(outsider, (q) => q(`select id from public.content_revisions where entity_id = $1`, [event]))).rowCount).toBe(0);
    await expect(asUser(editor, (q) => q(`delete from public.content_revisions where entity_id = $1`, [event]))).rejects.toThrow(/permission denied/);
  });
});

// ---------------------------------------------------------------- verified experience integrity
describe('verified experiences', () => {
  it('swapping the link drops the verification; the verified data is snapshotted', async () => {
    const reviewer = await createUser(); const org = await createOrg({ [reviewer]: 'reviewer' });
    const user = await createUser();
    const exp = (await asUser(user, (q) => q(`insert into public.experiences (user_id, kind, title, status, visibility, link_url)
      values ($1, 'project', 'Robot projesi', 'published', 'profile', 'https://github.com/ornek/robot') returning id`, [user]))).rows[0].id;
    const att = (await asUser(user, (q) => q(`select * from public.request_attestation($1, $2)`, [exp, org]))).rows[0];
    await asUser(reviewer, (q) => q(`select public.decide_attestation($1, 'verified', 'Takımda görev aldı', null)`, [att.id]));
    const verified = (await admin(`select status, verified_snapshot from public.attestations where id = $1`, [att.id])).rows[0];
    expect(verified.status).toBe('verified');
    expect(verified.verified_snapshot).toMatchObject({ title: 'Robot projesi', link_url: 'https://github.com/ornek/robot' });

    await asUser(user, (q) => q(`update public.experiences set link_url = 'https://kotu-site.example/' where id = $1`, [exp]));
    const after = (await admin(`select status, revoke_reason, verified_snapshot from public.attestations where id = $1`, [att.id])).rows[0];
    expect(after).toMatchObject({ status: 'revoked', revoke_reason: 'experience_edited' });
    expect(after.verified_snapshot.link_url).toBe('https://github.com/ornek/robot');
  });
});

// ---------------------------------------------------------------- account deletion
describe('account deletion', () => {
  it('staff who approved, created and checked in can delete their account; the records stay unattributed', async () => {
    const staff = await createUser(); const approver = await createUser();
    await admin(`insert into public.platform_admins (user_id) values ($1)`, [approver]);
    const org = await createOrg({ [staff]: 'owner' });
    const event = await createEvent(org, {
      created_by: staff, approved_by: approver,
      starts_at: new Date(Date.now() + 2 * 36e5), ends_at: new Date(Date.now() + 6 * 36e5), registration_closes_at: new Date(Date.now() + 36e5),
    });
    await admin(`update public.organizations set verified_by = $2 where id = $1`, [org, approver]);
    const user = await createUser(); const reg = await register(user, event);
    const token = (await asUser(user, (q) => q(`select public.get_participation_card($1) j`, [reg.id]))).rows[0].j.qr_payload;
    await asUser(staff, (q) => q(`select public.check_in_participant($1, null, $2)`, [token, event]));

    await admin(`delete from auth.users where id = $1`, [staff]);
    await admin(`delete from auth.users where id = $1`, [approver]);
    expect((await admin(`select created_by, approved_by from public.events where id = $1`, [event])).rows[0]).toEqual({ created_by: null, approved_by: null });
    expect((await admin(`select checked_in_by from public.event_check_ins where registration_id = $1`, [reg.id])).rows[0].checked_in_by).toBeNull();
    expect((await admin(`select verified_by from public.organizations where id = $1`, [org])).rows[0].verified_by).toBeNull();
  });

  it('a normal user’s deletion cascades their personal data', async () => {
    const org = await createOrg(); const event = await createEvent(org);
    const user = await createUser(); const reg = await register(user, event);
    await admin(`delete from auth.users where id = $1`, [user]);
    for (const [table, col] of [['profiles', 'id'], ['profile_private', 'user_id'], ['event_registrations', 'user_id'], ['consents', 'user_id']]) {
      expect((await admin(`select count(*)::int n from public.${table} where ${col} = $1`, [user])).rows[0].n).toBe(0);
    }
    expect((await admin(`select count(*)::int n from public.event_registrations where id = $1`, [reg.id])).rows[0].n).toBe(0);
  });
});

// ---------------------------------------------------------------- user-delete constraints sweep
describe('schema: no user reference can block an account deletion', () => {
  it('every foreign key to auth.users has an ON DELETE action', async () => {
    const rows = (await admin(`
      select c.conrelid::regclass::text as tbl, c.conname, c.confdeltype
        from pg_constraint c where c.contype = 'f' and c.confrelid = 'auth.users'::regclass`)).rows;
    expect(rows.length).toBeGreaterThan(10);
    // moderation_actions.moderator_id is RESTRICT on purpose (moderation accountability): such accounts are deleted via support.
    const blocking = rows.filter((r) => (r.confdeltype === 'a' || r.confdeltype === 'r') && r.conname !== 'moderation_actions_moderator_id_fkey');
    expect(blocking).toEqual([]);
  });
});
