import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { admin, asAnon, asService, asUser, createEvent, createOrg, createUser, expectFail, register } from './helpers';

describe('event registration', () => {
  it('confirms an eligible adult and is idempotent on double tap', async () => {
    const org = await createOrg(); const event = await createEvent(org, { capacity: 10 });
    const user = await createUser({ age: 22 });
    const key = randomUUID();
    const [a, b] = await Promise.all([register(user, event, key), register(user, event, key)]);
    const c = await register(user, event); // new key, same live registration
    expect(a.status).toBe('confirmed');
    expect(new Set([a.id, b.id, c.id]).size).toBe(1);
    const { rows } = await admin(`select count(*)::int n from public.event_registrations where event_id = $1`, [event]);
    expect(rows[0].n).toBe(1);
    const ev = await admin(`select seats_taken from public.events where id = $1`, [event]);
    expect(ev.rows[0].seats_taken).toBe(1);
  });

  it('never oversells the last seats under concurrent registrations', async () => {
    const org = await createOrg(); const event = await createEvent(org, { capacity: 3, waitlist_enabled: true });
    const users = await Promise.all(Array.from({ length: 12 }, () => createUser({ age: 19 })));
    const results = await Promise.all(users.map((u) => register(u, event)));
    expect(results.filter((r) => r.status === 'confirmed')).toHaveLength(3);
    expect(results.filter((r) => r.status === 'waitlisted')).toHaveLength(9);
  });

  it('rejects with 409 event_full when the waitlist is disabled', async () => {
    const org = await createOrg(); const event = await createEvent(org, { capacity: 1, waitlist_enabled: false });
    await register(await createUser(), event);
    await expectFail(register(await createUser(), event), 409, 'event_full');
  });

  it('enforces auth, profile completeness, age limits and the registration window on the server', async () => {
    const org = await createOrg();
    const adultsOnly = await createEvent(org, { min_age: 18 });
    const closed = await createEvent(org, { registration_closes_at: new Date(Date.now() - 1000) });
    const draft = await createEvent(org, { status: 'draft' });
    // anon has no EXECUTE grant: PostgREST answers 401 for an anonymous caller
    await expect(asAnon((q) => q(`select public.register_for_event($1, $2)`, [adultsOnly, randomUUID()]))).rejects.toThrow(/permission denied/);
    await expectFail(register(await createUser({ age: null }), adultsOnly), 409, 'profile_incomplete');
    await expectFail(register(await createUser({ age: 16 }), adultsOnly), 403, 'below_min_age');
    await expectFail(register(await createUser(), closed), 409, 'registration_closed');
    await expectFail(register(await createUser(), draft), 404, 'event_not_found');
  });

  it('promotes the waitlist when a confirmed participant cancels', async () => {
    const org = await createOrg(); const event = await createEvent(org, { capacity: 1 });
    const first = await createUser(); const second = await createUser();
    const r1 = await register(first, event); const r2 = await register(second, event);
    expect(r2.status).toBe('waitlisted');
    await asUser(first, (q) => q(`select public.cancel_event_registration($1)`, [r1.id]));
    const { rows } = await admin(`select status, status_reason from public.event_registrations where id = $1`, [r2.id]);
    expect(rows[0]).toEqual({ status: 'confirmed', status_reason: 'promoted_from_waitlist' });
    // and the first user can register again later (history row stays cancelled)
    expect((await register(first, event)).status).toBe('waitlisted');
  });

  it('clients cannot write registrations or event counters directly', async () => {
    const org = await createOrg(); const event = await createEvent(org); const user = await createUser();
    await expect(asUser(user, (q) => q(
      `insert into public.event_registrations (event_id, user_id, status, idempotency_key) values ($1, $2, 'confirmed', gen_random_uuid())`,
      [event, user]))).rejects.toThrow(/row-level security/);
    const reg = await register(user, event);
    const upd = await asUser(user, (q) => q(`update public.event_registrations set status = 'confirmed' where id = $1`, [reg.id]));
    expect(upd.rowCount).toBe(0);
  });
});

describe('eligibility preview', () => {
  it('reports every blocking reason without failing, for guests and members', async () => {
    const org = await createOrg();
    const event = await createEvent(org, { min_age: 18, capacity: 1, registration_closes_at: new Date(Date.now() - 1000) });
    const guest = (await asAnon((q) => q(`select public.event_eligibility($1) j`, [event]))).rows[0].j;
    expect(guest).toMatchObject({ authenticated: false, eligible: false, reasons: ['registration_closed'] });
    const incomplete = await createUser({ age: null });
    expect((await asUser(incomplete, (q) => q(`select public.event_eligibility($1) j`, [event]))).rows[0].j.reasons).toEqual(['registration_closed', 'profile_incomplete']);
    const minor = await createUser({ age: 16 });
    expect((await asUser(minor, (q) => q(`select public.event_eligibility($1) j`, [event]))).rows[0].j.reasons).toEqual(['registration_closed', 'below_min_age']);
    const open = await createEvent(org);
    const ok = (await asUser(minor, (q) => q(`select public.event_eligibility($1) j`, [open]))).rows[0].j;
    expect(ok).toMatchObject({ eligible: true, guardian_required: true, registration_id: null });
    const reg = await register(minor, open);
    expect((await asUser(minor, (q) => q(`select public.event_eligibility($1) j`, [open]))).rows[0].j).toMatchObject({ registration_id: reg.id, registration_status: 'pending_guardian' });
  });
});

describe('guardian consent', () => {
  async function minorPending() {
    const org = await createOrg(); const event = await createEvent(org, { capacity: 5 });
    const minor = await createUser({ age: 16, name: 'Elif Demir' });
    const reg = await register(minor, event);
    return { org, event, minor, reg };
  }

  it('holds a minor in pending_guardian and never issues a card before approval', async () => {
    const { minor, reg } = await minorPending();
    expect(reg.status).toBe('pending_guardian');
    await expectFail(asUser(minor, (q) => q(`select public.get_participation_card($1)`, [reg.id])), 409, 'registration_not_confirmed');
  });

  it('the minor can neither mint nor read the guardian token', async () => {
    const { minor, reg } = await minorPending();
    const reqId = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, 'veli@example.test', 'Ayşe Demir') id`, [reg.id]))).rows[0].id;
    await expect(asUser(minor, (q) => q(`select public.issue_guardian_token($1)`, [reqId]))).rejects.toThrow(/permission denied/);
    await expect(asUser(minor, (q) => q(`select * from public.guardian_requests`))).resolves.toMatchObject({ rowCount: 0 });
    const view = await asUser(minor, (q) => q(`select * from public.my_guardian_requests`));
    expect(view.rows[0].status).toBe('pending');
    expect(view.rows[0].guardian_email_masked).toBe('v•••@example.test');
    expect(Object.keys(view.rows[0])).not.toContain('token_hash');
  });

  it('refuses the minor own e-mail address as guardian', async () => {
    const { minor, reg } = await minorPending();
    await expectFail(asUser(minor, (q) => q(`select public.create_guardian_request($1, $2)`, [reg.id, `${minor}@example.test`])), 422, 'guardian_email_same_as_user');
  });

  it('approval by single-use token confirms; reuse fails; revoke cancels and frees the seat', async () => {
    const { minor, reg, event } = await minorPending();
    const reqId = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, 'veli@example.test') id`, [reg.id]))).rows[0].id;
    const issued = (await asService((q) => q(`select public.issue_guardian_token($1) j`, [reqId]))).rows[0].j;
    await expectFail(asService((q) => q(`select public.issue_guardian_token($1)`, [reqId])), 429, 'guardian_send_too_soon');

    const preview = (await asAnon((q) => q(`select public.guardian_request_preview($1) j`, [issued.token]))).rows[0].j;
    expect(preview.participant_first_name).toBe('Elif');
    expect(JSON.stringify(preview)).not.toContain('example.test'); // no contact data

    await expectFail(asAnon((q) => q(`select public.guardian_decide($1, true, 'Ayşe Demir', 'wrong')`, [issued.token])), 409, 'policy_version_mismatch');
    const decided = (await asAnon((q) => q(`select public.guardian_decide($1, true, 'Ayşe Demir', $2) j`, [issued.token, preview.policy_version]))).rows[0].j;
    expect(decided.status).toBe('approved');
    await expectFail(asAnon((q) => q(`select public.guardian_decide($1, true, 'Ayşe Demir', $2)`, [issued.token, preview.policy_version])), 404);

    const card = (await asUser(minor, (q) => q(`select public.get_participation_card($1) j`, [reg.id]))).rows[0].j;
    expect(card.qr_payload).toMatch(/^TA1\.[0-9a-f-]{36}\.[0-9a-f]{32}$/);

    await asAnon((q) => q(`select public.guardian_revoke($1)`, [decided.revoke_token]));
    const after = await admin(`select r.status, e.seats_taken from public.event_registrations r join public.events e on e.id = r.event_id where r.id = $1`, [reg.id]);
    expect(after.rows[0]).toEqual({ status: 'cancelled', seats_taken: 0 });
    const live = await admin(`select count(*)::int n from public.consents where subject_id = $1 and withdrawn_at is null`, [reg.id]);
    expect(live.rows[0].n).toBe(0); // neither the guardian's nor the participant's consent outlives the registration
    expect(event).toBeTruthy();
  });

  it('denial cancels the registration; expiry releases the held seat', async () => {
    const a = await minorPending();
    const reqA = (await asUser(a.minor, (q) => q(`select public.create_guardian_request($1, 'veli@example.test') id`, [a.reg.id]))).rows[0].id;
    const tokA = (await asService((q) => q(`select public.issue_guardian_token($1) j`, [reqA]))).rows[0].j;
    const prev = (await asAnon((q) => q(`select public.guardian_request_preview($1) j`, [tokA.token]))).rows[0].j;
    await asAnon((q) => q(`select public.guardian_decide($1, false, 'Ayşe Demir', $2)`, [tokA.token, prev.policy_version]));
    expect((await admin(`select status, status_reason from public.event_registrations where id = $1`, [a.reg.id])).rows[0])
      .toEqual({ status: 'cancelled', status_reason: 'guardian_denied' });

    const b = await minorPending();
    const reqB = (await asUser(b.minor, (q) => q(`select public.create_guardian_request($1, 'veli@example.test') id`, [b.reg.id]))).rows[0].id;
    await admin(`update public.guardian_requests set expires_at = now() - interval '1 minute' where id = $1`, [reqB]);
    await register(await createUser(), b.event); // any new registration lazily expires stale holds
    expect((await admin(`select status from public.event_registrations where id = $1`, [b.reg.id])).rows[0].status).toBe('expired');
  });

  it('an adult needs no guardian; the rule is per event, not a global flag', async () => {
    const org = await createOrg();
    const noGuardianEvent = await createEvent(org, { guardian_required_under: null });
    expect((await register(await createUser({ age: 16 }), noGuardianEvent)).status).toBe('confirmed');
  });
});

describe('participation card and check-in', () => {
  it('lets authorised staff check in once; repeats and outsiders are handled', async () => {
    const staff = await createUser(); const outsider = await createUser(); const otherStaff = await createUser();
    const org = await createOrg({ [staff]: 'checkin_staff' }); await createOrg({ [otherStaff]: 'owner' });
    const event = await createEvent(org, {
      starts_at: new Date(Date.now() + 36e5), ends_at: new Date(Date.now() + 5 * 36e5),
      registration_closes_at: new Date(Date.now() + 30 * 6e4) });
    const user = await createUser({ name: 'Deniz Yılmaz' }); const reg = await register(user, event);
    const card = (await asUser(user, (q) => q(`select public.get_participation_card($1) j`, [reg.id]))).rows[0].j;
    expect(card.qr_payload).not.toContain('Deniz');

    await expectFail(asUser(outsider, (q) => q(`select public.check_in_participant($1)`, [card.qr_payload])), 403, 'checkin_forbidden');
    await expectFail(asUser(otherStaff, (q) => q(`select public.check_in_participant($1)`, [card.qr_payload])), 403, 'checkin_forbidden');
    await expectFail(asUser(user, (q) => q(`select public.check_in_participant($1)`, [card.qr_payload])), 403, 'checkin_forbidden');
    const forged = card.qr_payload.slice(0, -4) + '0000';
    await expectFail(asUser(staff, (q) => q(`select public.check_in_participant($1)`, [forged])), 422, 'ticket_invalid');

    const first = (await asUser(staff, (q) => q(`select public.check_in_participant($1) j`, [card.qr_payload]))).rows[0].j;
    const again = (await asUser(staff, (q) => q(`select public.check_in_participant($1) j`, [card.qr_payload]))).rows[0].j;
    expect(first.result).toBe('checked_in');
    expect(again.result).toBe('already_checked_in');
    expect((await admin(`select count(*)::int n from public.event_check_ins where registration_id = $1`, [reg.id])).rows[0].n).toBe(1);

    // same registration state from "another device": a fresh session reads identical data
    const seen = await asUser(user, (q) => q(`select id, status from public.event_registrations where event_id = $1`, [event]));
    expect(seen.rows).toEqual([{ id: reg.id, status: 'confirmed' }]);
  });

  it('a cancelled registration invalidates its QR', async () => {
    const staff = await createUser(); const org = await createOrg({ [staff]: 'owner' });
    const event = await createEvent(org, { starts_at: new Date(Date.now() + 2 * 36e5), ends_at: new Date(Date.now() + 5 * 36e5), registration_closes_at: new Date(Date.now() + 36e5) });
    const user = await createUser(); const reg = await register(user, event);
    const card = (await asUser(user, (q) => q(`select public.get_participation_card($1) j`, [reg.id]))).rows[0].j;
    await asUser(user, (q) => q(`select public.cancel_event_registration($1)`, [reg.id]));
    await expectFail(asUser(staff, (q) => q(`select public.check_in_participant($1)`, [card.qr_payload])), 422, 'ticket_invalid');
  });
});

describe('row level security', () => {
  it('isolates registrations, private profile data and tenants', async () => {
    const ownerA = await createUser(); const ownerB = await createUser();
    const orgA = await createOrg({ [ownerA]: 'owner' }); const orgB = await createOrg({ [ownerB]: 'owner' });
    const eventA = await createEvent(orgA); await createEvent(orgB);
    const alice = await createUser(); const bob = await createUser();
    await register(alice, eventA);

    expect((await asUser(bob, (q) => q(`select * from public.event_registrations`))).rowCount).toBe(0);
    expect((await asUser(ownerA, (q) => q(`select * from public.event_registrations`))).rowCount).toBe(1);
    expect((await asUser(ownerB, (q) => q(`select * from public.event_registrations`))).rowCount).toBe(0);
    expect((await asUser(bob, (q) => q(`select * from public.profile_private`))).rowCount).toBe(1);
    expect((await asUser(ownerA, (q) => q(`select * from public.profile_private where user_id = $1`, [alice]))).rowCount).toBe(0);
    expect((await asAnon((q) => q(`select * from public.profiles`))).rowCount).toBe(0);
    expect((await asUser(bob, (q) => q(`select * from public.consents`))).rowCount).toBe(0);
  });

  it('anonymous visitors see only published events of any organisation', async () => {
    const org = await createOrg(); const pub = await createEvent(org); const draft = await createEvent(org, { status: 'draft' });
    const { rows } = await asAnon((q) => q(`select id from public.events where id = any($1)`, [[pub, draft]]));
    expect(rows.map((r) => r.id)).toEqual([pub]);
  });

  it('organisers cannot self-publish, self-verify, or touch another tenant', async () => {
    const editor = await createUser(); const org = await createOrg({ [editor]: 'editor' }, false);
    const other = await createOrg(); const foreign = await createEvent(other);
    const draft = await createEvent(org, { status: 'draft' });
    await expectFail(asUser(editor, (q) => q(`update public.events set status = 'published' where id = $1`, [draft])), 403, 'publish_requires_platform_approval');
    await expectFail(asUser(editor, (q) => q(`update public.events set seats_taken = 0, capacity = 1 where id = $1`, [draft])).then(() => asUser(editor, (q) => q(`update public.events set seats_taken = 99 where id = $1`, [draft]))), 403, 'event_counters_locked');
    expect((await asUser(editor, (q) => q(`update public.events set title = 'Ele geçirildi' where id = $1`, [foreign]))).rowCount).toBe(0);
    expect((await asUser(editor, (q) => q(`update public.organizations set verification = 'verified' where id = $1`, [org]))).rowCount).toBe(0);

    const platformAdmin = await createUser();
    await admin(`insert into public.platform_admins (user_id) values ($1)`, [platformAdmin]);
    await asUser(editor, (q) => q(`update public.events set status = 'in_review' where id = $1`, [draft]));
    await asUser(platformAdmin, (q) => q(`update public.events set status = 'published' where id = $1`, [draft]));
    expect((await admin(`select status, approved_by from public.events where id = $1`, [draft])).rows[0]).toEqual({ status: 'published', approved_by: platformAdmin });
  });

  it('birth date is write-once and minors cannot become discoverable', async () => {
    const minor = await createUser({ age: 15 });
    await expectFail(asUser(minor, (q) => q(`update public.profile_private set birth_date = '1990-01-01' where user_id = $1`, [minor])), 403, 'birth_date_locked');
    await expectFail(asUser(minor, (q) => q(`select public.complete_profile_bootstrap('Yeni Ad', 'high_school', '1990-01-01', '{}')`)), 409, 'birth_date_locked');
    await expectFail(asUser(minor, (q) => q(`update public.profiles set discoverable = true where id = $1`, [minor])), 403, 'discoverable_requires_adult');
    const fresh = await createUser({ age: null });
    await expectFail(asUser(fresh, (q) => q(`select public.complete_profile_bootstrap('Ad Soyad', 'high_school', (current_date + 1)::date, '{}')`)), 422, 'birth_date_invalid');
    await expectFail(asUser(fresh, (q) => q(`select public.complete_profile_bootstrap('Ad Soyad', 'high_school', (current_date - interval '9 years')::date, '{}')`)), 422, 'below_min_age');
  });
});
