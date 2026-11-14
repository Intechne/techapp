// Faz 6 Task 1 · legal gate. Until the legal texts are approved, nobody outside the allow-list can finish sign-up, and no
// consent is written against a draft policy text unless the environment explicitly allows drafts. Both switches live in the
// database (app.settings), default FALSE in the migration; global-setup turns them on for every other test file.
// Every test here sets the flags it needs and afterEach puts them back to true/true (files run one at a time).
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { admin, asAnon, asService, asUser, createEvent, createOrg, createUser, expectFail, register } from './helpers';

const PERMISSION_DENIED = /permission denied/;
const DRAFT = (purpose: string) => `${purpose}@2026-09-draft`;
const CONSENT_PURPOSES = ['event_participation', 'guardian_event_participation', 'application_data_sharing'];

async function setFlags(flags: { signup_open?: boolean; allow_draft_policies?: boolean }) {
  for (const [key, value] of Object.entries(flags)) {
    const r = await admin(`update app.settings set value = to_jsonb($2::boolean) where key = $1`, [key, value]);
    expect(r.rowCount).toBe(1);
  }
}

/** A brand-new account that has signed in (auth.users row exists) but has not completed the profile yet. */
async function newAccount(email = `${randomUUID()}@example.test`): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  await admin(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
  return { id, email };
}

const bootstrap = (userId: string) =>
  asUser(userId, (q) => q(`select (public.complete_profile_bootstrap('Pilot Kişi', 'university', (current_date - interval '20 years 30 days')::date, '{teknoloji}')).id`));

async function platformAdmin(): Promise<string> {
  const id = await createUser({ name: 'Platform Yöneticisi' });
  await admin(`insert into public.platform_admins (user_id) values ($1)`, [id]);
  return id;
}

const publish = (userId: string, purpose: string, version: string, url = 'https://techapp.intechne.com.tr/gizlilik') =>
  asUser(userId, (q) => q(`select * from public.publish_policy_version($1, $2, $3)`, [purpose, version, url]));

const published: Array<[string, string]> = [];

afterEach(async () => {
  await setFlags({ signup_open: true, allow_draft_policies: true });
});
afterAll(async () => {
  // published versions would otherwise become every later test file's consent version
  for (const [purpose, version] of published) await admin(`delete from public.policy_versions where purpose = $1 and version = $2`, [purpose, version]);
});

describe('legal gate · closed sign-up', () => {
  it('migration defaults: both switches exist and the migration itself sets them to false (global-setup turned them on)', async () => {
    const rows = (await admin(`select key, value from app.settings where key in ('signup_open', 'allow_draft_policies') order by key`)).rows;
    expect(rows.map((r) => r.key)).toEqual(['allow_draft_policies', 'signup_open']);
    const { readdirSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(__dirname, '..', 'migrations');
    const file = readdirSync(dir).find((f) => f.endsWith('_policy_versions_signup_gate.sql'));
    expect(file).toBeTruthy();
    const sql = readFileSync(join(dir, file!), 'utf8');
    expect(sql).toMatch(/\('signup_open', 'false'::jsonb\)/);
    expect(sql).toMatch(/\('allow_draft_policies', 'false'::jsonb\)/);
  });

  it('gate closed + not on the allow-list → 403 signup_closed, nothing of the profile is written, no e-mail in the error', async () => {
    await setFlags({ signup_open: false });
    const { id, email } = await newAccount(`Kapali.${randomUUID()}@Example.test`);
    let caught: { code?: string; message?: string; detail?: string } | null = null;
    await bootstrap(id).catch((e) => { caught = e; });
    expect(caught).not.toBeNull();
    expect([caught!.code, caught!.message]).toEqual(['PT403', 'signup_closed']);
    expect(`${caught!.message} ${caught!.detail ?? ''}`).not.toContain('@');
    expect(`${caught!.detail ?? ''}`.toLowerCase()).not.toContain(email.toLowerCase().split('@')[0]);
    const p = (await admin(`select display_name, onboarded_at, education_stage from public.profiles where id = $1`, [id])).rows[0];
    expect(p).toEqual({ display_name: null, onboarded_at: null, education_stage: null });
    expect((await admin(`select birth_date from public.profile_private where user_id = $1`, [id])).rows[0].birth_date).toBeNull();
    expect((await admin(`select count(*)::int n from public.profile_interests where user_id = $1`, [id])).rows[0].n).toBe(0);
    expect((await admin(`select count(*)::int n from public.audit_events where target_id = $1 and action = 'profile.bootstrap'`, [id])).rows[0].n).toBe(0);
    const state = (await asUser(id, (q) => q(`select public.my_account_state() s`))).rows[0].s;
    expect(state.profile_complete).toBe(false);
  });

  it('gate closed + on the allow-list (added by a platform admin, any case / spaces) → profile completes', async () => {
    const pa = await platformAdmin();
    await setFlags({ signup_open: false });
    const { id, email } = await newAccount(`pilot.${randomUUID()}@example.test`);
    const added = (await asUser(pa, (q) => q(`select public.add_signup_allowlist($1, $2) r`, [`  ${email.toUpperCase()} `, 'pilot görevlisi']))).rows[0].r;
    expect(added).toEqual({ added: true });
    await bootstrap(id);
    const p = (await admin(`select display_name, onboarded_at from public.profiles where id = $1`, [id])).rows[0];
    expect(p.display_name).toBe('Pilot Kişi');
    expect(p.onboarded_at).not.toBeNull();
  });

  it('gate open → anyone completes the profile, no allow-list needed', async () => {
    await setFlags({ signup_open: true });
    const { id } = await newAccount();
    await bootstrap(id);
    expect((await admin(`select onboarded_at from public.profiles where id = $1`, [id])).rows[0].onboarded_at).not.toBeNull();
  });

  it('an already onboarded account is not locked out when the gate closes (the gate guards the first completion only)', async () => {
    const { id } = await newAccount();
    await bootstrap(id); // gate open (afterEach default)
    await setFlags({ signup_open: false });
    await bootstrap(id);
  });

  it('a missing setting row fails closed', async () => {
    await admin(`delete from app.settings where key = 'signup_open'`);
    try {
      const { id } = await newAccount();
      await expectFail(bootstrap(id), 403, 'signup_closed');
    } finally {
      await admin(`insert into app.settings (key, value) values ('signup_open', 'true'::jsonb)`);
    }
  });
});

describe('legal gate · allow-list privacy and access', () => {
  it('the allow-list stores only sha256(lower(trim(email))): no plaintext e-mail in the table or the audit log', async () => {
    const pa = await platformAdmin();
    const email = `gizli.${randomUUID()}@example.test`;
    await asUser(pa, (q) => q(`select public.add_signup_allowlist($1, null)`, [` ${email} `]));
    const row = (await admin(`select * from public.signup_allowlist where email_hash = extensions.digest($1, 'sha256')`, [email])).rows[0];
    expect(row).toBeTruthy();
    expect(Buffer.from(row.email_hash).length).toBe(32);
    const everything = (await admin(`select coalesce(string_agg(row_to_json(s)::text, ' '), '') t from public.signup_allowlist s`)).rows[0].t as string;
    expect(everything).not.toContain('@');
    const audit = (await admin(`select coalesce(string_agg(row_to_json(a)::text, ' '), '') t from public.audit_events a where action like 'signup_allowlist.%'`)).rows[0].t as string;
    expect(audit).toContain('signup_allowlist.added');
    expect(audit).not.toContain('@');
    expect(audit).not.toContain(email.split('@')[0]);
  });

  it('adding the same address twice keeps one row and says added: false; remove takes it out', async () => {
    const pa = await platformAdmin();
    const email = `tekrar.${randomUUID()}@example.test`;
    expect((await asUser(pa, (q) => q(`select public.add_signup_allowlist($1) r`, [email]))).rows[0].r).toEqual({ added: true });
    expect((await asUser(pa, (q) => q(`select public.add_signup_allowlist($1) r`, [email.toUpperCase()]))).rows[0].r).toEqual({ added: false });
    expect((await admin(`select count(*)::int n from public.signup_allowlist where email_hash = extensions.digest($1, 'sha256')`, [email])).rows[0].n).toBe(1);
    expect((await asUser(pa, (q) => q(`select public.remove_signup_allowlist($1) r`, [` ${email} `]))).rows[0].r).toEqual({ removed: true });
    expect((await admin(`select count(*)::int n from public.signup_allowlist where email_hash = extensions.digest($1, 'sha256')`, [email])).rows[0].n).toBe(0);
    expect((await asUser(pa, (q) => q(`select public.remove_signup_allowlist($1) r`, [email]))).rows[0].r).toEqual({ removed: false });
  });

  it('input validation: a bad address → 422 email_invalid; a note with an @ (an address) → 422 allowlist_note_invalid', async () => {
    const pa = await platformAdmin();
    await expectFail(asUser(pa, (q) => q(`select public.add_signup_allowlist('not-an-email')`)), 422, 'email_invalid');
    await expectFail(asUser(pa, (q) => q(`select public.add_signup_allowlist(null)`)), 422, 'email_invalid');
    await expectFail(asUser(pa, (q) => q(`select public.add_signup_allowlist($1, 'ayse@example.test')`, [`n.${randomUUID()}@example.test`])), 422, 'allowlist_note_invalid');
    await expectFail(asUser(pa, (q) => q(`select public.add_signup_allowlist($1, $2)`, [`n.${randomUUID()}@example.test`, 'x'.repeat(121)])), 422, 'allowlist_note_invalid');
  });

  it('anon and authenticated cannot read or write signup_allowlist; only a platform admin may use the RPCs', async () => {
    const user = await createUser();
    await expect(asAnon((q) => q(`select * from public.signup_allowlist`))).rejects.toThrow(PERMISSION_DENIED);
    await expect(asUser(user, (q) => q(`select * from public.signup_allowlist`))).rejects.toThrow(PERMISSION_DENIED);
    await expect(asUser(user, (q) => q(`insert into public.signup_allowlist (email_hash) values (extensions.digest('x@y.z', 'sha256'))`))).rejects.toThrow(PERMISSION_DENIED);
    await expect(asUser(user, (q) => q(`delete from public.signup_allowlist`))).rejects.toThrow(PERMISSION_DENIED);
    await expectFail(asUser(user, (q) => q(`select public.add_signup_allowlist('a@example.test')`)), 403, 'forbidden');
    await expectFail(asUser(user, (q) => q(`select public.remove_signup_allowlist('a@example.test')`)), 403, 'forbidden');
    await expect(asAnon((q) => q(`select public.add_signup_allowlist('a@example.test')`))).rejects.toThrow(PERMISSION_DENIED);
    await expect(asAnon((q) => q(`select public.remove_signup_allowlist('a@example.test')`))).rejects.toThrow(PERMISSION_DENIED);
  });

  it('app.settings is not readable or writable by anon, authenticated or service_role', async () => {
    const user = await createUser();
    for (const run of [asAnon, (fn: Parameters<typeof asAnon>[0]) => asUser(user, fn), asService]) {
      await expect(run((q) => q(`select * from app.settings`))).rejects.toThrow(PERMISSION_DENIED);
      await expect(run((q) => q(`update app.settings set value = 'true'::jsonb where key = 'signup_open'`))).rejects.toThrow(PERMISSION_DENIED);
    }
  });
});

describe('legal gate · versioned policies', () => {
  it('the migration registers today’s three draft versions as is_draft rows; anon and authenticated can read them', async () => {
    const rows = (await asAnon((q) => q(`select purpose, version, is_draft, published_at, url from public.policy_versions where is_draft order by purpose`))).rows;
    expect(rows.filter((r) => CONSENT_PURPOSES.includes(r.purpose))).toEqual(
      [...CONSENT_PURPOSES].sort().map((p) => ({ purpose: p, version: DRAFT(p), is_draft: true, published_at: null, url: null })));
    const user = await createUser();
    expect((await asUser(user, (q) => q(`select count(*)::int n from public.policy_versions`))).rows[0].n).toBeGreaterThanOrEqual(3);
  });

  it('nobody writes policy_versions directly', async () => {
    const user = await createUser();
    await expect(asUser(user, (q) => q(`insert into public.policy_versions (purpose, version, is_draft) values ('privacy_policy', 'privacy_policy@2030-01-01', true)`)))
      .rejects.toThrow(PERMISSION_DENIED);
    await expect(asUser(user, (q) => q(`update public.policy_versions set is_draft = false`))).rejects.toThrow(PERMISSION_DENIED);
    await expect(asAnon((q) => q(`delete from public.policy_versions`))).rejects.toThrow(PERMISSION_DENIED);
  });

  it('no published version + drafts not allowed → registration fails 409 policy_not_published and leaves no row behind', async () => {
    await setFlags({ allow_draft_policies: false });
    const org = await createOrg();
    const event = await createEvent(org, { guardian_required_under: null });
    const user = await createUser();
    await expectFail(register(user, event), 409, 'policy_not_published');
    expect((await admin(`select count(*)::int n from public.event_registrations where user_id = $1`, [user])).rows[0].n).toBe(0);
    expect((await admin(`select count(*)::int n from public.consents where user_id = $1`, [user])).rows[0].n).toBe(0);
    for (const purpose of CONSENT_PURPOSES) {
      await expectFail(admin(`select app.current_policy_version($1)`, [purpose]), 409, 'policy_not_published');
    }
  });

  it('drafts allowed (local / test / staging) → the draft version is written, never silently without a version', async () => {
    await setFlags({ allow_draft_policies: true });
    const org = await createOrg();
    const event = await createEvent(org, { guardian_required_under: null });
    const user = await createUser();
    const reg = await register(user, event);
    const c = (await admin(`select policy_version from public.consents where subject_id = $1`, [reg.id])).rows;
    expect(c).toEqual([{ policy_version: DRAFT('event_participation') }]);
  });

  it('publishing a new version: old consents keep their version, new registrations write the new one (drafts on or off)', async () => {
    const pa = await platformAdmin();
    const org = await createOrg();
    const before = await createUser();
    const reg1 = await register(before, await createEvent(org, { guardian_required_under: null }));
    const version = 'event_participation@2030-01-15';
    const row = (await publish(pa, 'event_participation', version, 'https://techapp.intechne.com.tr/gizlilik')).rows[0];
    published.push(['event_participation', version]);
    expect(row).toMatchObject({ purpose: 'event_participation', version, is_draft: false, url: 'https://techapp.intechne.com.tr/gizlilik' });
    expect(row.published_at).not.toBeNull();

    expect((await admin(`select policy_version from public.consents where subject_id = $1`, [reg1.id])).rows[0].policy_version).toBe(DRAFT('event_participation'));
    const after = await createUser();
    const reg2 = await register(after, await createEvent(org, { guardian_required_under: null }));
    expect((await admin(`select policy_version from public.consents where subject_id = $1`, [reg2.id])).rows[0].policy_version).toBe(version);

    await setFlags({ allow_draft_policies: false });
    const third = await createUser();
    const reg3 = await register(third, await createEvent(org, { guardian_required_under: null }));
    expect((await admin(`select policy_version from public.consents where subject_id = $1`, [reg3.id])).rows[0].policy_version).toBe(version);
    // the other purposes are still unpublished: no silent fallback to the event text
    await expectFail(admin(`select app.current_policy_version('application_data_sharing')`), 409, 'policy_not_published');
    // the earlier consent is still on the old text: nobody is counted as having agreed to the new one
    expect((await admin(`select policy_version from public.consents where subject_id = $1`, [reg1.id])).rows[0].policy_version).toBe(DRAFT('event_participation'));
    const audit = (await admin(`select metadata from public.audit_events where action = 'policy.published' and actor_id = $1`, [pa])).rows;
    expect(audit).toEqual([{ metadata: { purpose: 'event_participation', version } }]);
  });

  it('publish_policy_version: platform admins only; version, url and duplicates are validated', async () => {
    const pa = await platformAdmin();
    const user = await createUser();
    await expectFail(publish(user, 'privacy_policy', 'privacy_policy@2030-02-01'), 403, 'forbidden');
    await expect(asAnon((q) => q(`select public.publish_policy_version('privacy_policy', 'privacy_policy@2030-02-01', 'https://x.test')`))).rejects.toThrow(PERMISSION_DENIED);
    await expectFail(publish(pa, 'privacy_policy', 'privacy_policy@2030-02-01', 'http://techapp.intechne.com.tr/gizlilik'), 422, 'policy_url_invalid');
    await expectFail(publish(pa, 'privacy_policy', 'privacy_policy@2030-02-01', ''), 422, 'policy_url_invalid');
    await expectFail(publish(pa, 'privacy_policy', 'terms_of_use@2030-02-01'), 422, 'policy_version_invalid');
    await expectFail(publish(pa, 'privacy_policy', 'privacy_policy@2026-09-draft'), 422, 'policy_version_invalid');
    await expectFail(publish(pa, 'made_up_purpose', 'made_up_purpose@2030-02-01'), 422, 'policy_version_invalid');
    await publish(pa, 'privacy_policy', 'privacy_policy@2030-02-01');
    published.push(['privacy_policy', 'privacy_policy@2030-02-01']);
    await expectFail(publish(pa, 'privacy_policy', 'privacy_policy@2030-02-01'), 409, 'policy_version_exists');
    expect((await asAnon((q) => q(`select version from public.policy_versions where purpose = 'privacy_policy' and not is_draft order by published_at desc limit 1`))).rows[0].version)
      .toBe('privacy_policy@2030-02-01');
  });
});

describe('legal gate · function hygiene', () => {
  it('new SECURITY DEFINER functions pin search_path to empty; internal helpers are not callable by API roles', async () => {
    const rows = (await admin(`
      select n.nspname || '.' || p.proname f, p.prosecdef d, p.proconfig c,
             has_function_privilege('anon', p.oid, 'execute') a, has_function_privilege('authenticated', p.oid, 'execute') u
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where (n.nspname = 'public' and p.proname in ('publish_policy_version', 'add_signup_allowlist', 'remove_signup_allowlist', 'complete_profile_bootstrap'))
          or (n.nspname = 'app' and p.proname in ('current_policy_version', 'setting_enabled', 'signup_allowed'))
       order by 1`)).rows;
    expect(rows.map((r) => r.f)).toEqual(['app.current_policy_version', 'app.setting_enabled', 'app.signup_allowed', 'public.add_signup_allowlist',
      'public.complete_profile_bootstrap', 'public.publish_policy_version', 'public.remove_signup_allowlist']);
    for (const r of rows) {
      expect([r.f, r.d, r.c]).toEqual([r.f, true, ['search_path=""']]);
      expect([r.f, r.a]).toEqual([r.f, false]);
      expect([r.f, r.u]).toEqual([r.f, r.f.startsWith('public.')]);
    }
  });
});
