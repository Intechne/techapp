#!/usr/bin/env node
/**
 * End-to-end check of the Event Pilot slice against a REAL Supabase project (development/staging only!).
 * Uses the same supabase-js calls as the app. Sign-in goes through real Supabase Auth OTP verification: the code is
 * obtained with the admin API instead of a mailbox. Creates clearly-marked e2e users/org/events and removes them.
 *
 *   SUPABASE_URL=… SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… node scripts/remote-e2e.mjs
 * The secret key is read from the environment only. Never store it in a file inside this repo.
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: pk, SUPABASE_SECRET_KEY: sk } = process.env;
if (!url || !pk || !sk) { console.error('Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY'); process.exit(2); }
const admin = createClient(url, sk, { auth: { persistSession: false, autoRefreshToken: false } });
const run = `e2e-${Date.now()}`; const results = []; const users = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass }); console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`); };
const code = (e) => (e ? `${e.code ?? e.status ?? ''}/${e.message}` : 'no error');

async function signIn(label) {
  const email = `${run}-${label}@techapp.test`;
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;
  const client = createClient(url, pk, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' });
  if (verified.error) throw verified.error;
  users.push(verified.data.user.id);
  return { client, id: verified.data.user.id, email, session: verified.data.session };
}
const bootstrap = (u, name, birth) => u.client.rpc('complete_profile_bootstrap', { p_display_name: name, p_education_stage: 'university', p_birth_date: birth, p_interest_slugs: ['robotik'] });
const yearsAgo = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); d.setMonth(0, 15); return d.toISOString().slice(0, 10); };

let orgId, eventIds = [];
try {
  // ---------- auth
  const bad = createClient(url, pk, { auth: { persistSession: false } });
  const probe = `${run}-probe@techapp.test`;
  const probeLink = await admin.auth.admin.generateLink({ type: 'magiclink', email: probe });
  users.push(probeLink.data.user.id);
  const wrong = await bad.auth.verifyOtp({ email: probe, token: '000000', type: 'email' });
  ok('invalid OTP is rejected by Supabase Auth', !!wrong.error, code(wrong.error));

  const [a, b, minor, staff, outsider] = await Promise.all(['adult-a', 'adult-b', 'minor', 'staff', 'outsider'].map(signIn));
  ok('real OTP verification returns a session', !!a.session?.access_token);
  const restored = createClient(url, pk, { auth: { persistSession: false } });
  const rs = await restored.auth.setSession({ access_token: a.session.access_token, refresh_token: a.session.refresh_token });
  const rf = await restored.auth.refreshSession();
  ok('session restore + refresh works', !rs.error && !rf.error && rf.data.user?.id === a.id, code(rs.error ?? rf.error));
  a.client = restored; // continue with the rotated session

  const state0 = await a.client.rpc('my_account_state');
  ok('new account starts with an incomplete profile (server-reported)', state0.data?.profile_complete === false);
  for (const [u, n, y] of [[a, 'E2E Yetişkin A', 22], [b, 'E2E Yetişkin B', 23], [minor, 'E2E Genç', 16], [staff, 'E2E Görevli', 30], [outsider, 'E2E Yabancı', 25]]) {
    const r = await bootstrap(u, n, yearsAgo(y)); if (r.error) throw r.error;
  }
  const future = await bootstrap(outsider, 'E2E Yabancı', yearsAgo(40));
  ok('birth date is write-once', future.error?.message === 'birth_date_locked', code(future.error));

  // ---------- fixtures (service side)
  orgId = randomUUID();
  let r = await admin.from('organizations').insert({ id: orgId, slug: run, name: 'E2E Test Kurumu', type: 'ngo', verification: 'verified', is_demo: true }); if (r.error) throw r.error;
  r = await admin.from('organization_members').insert({ organization_id: orgId, user_id: staff.id, role: 'checkin_staff' }); if (r.error) throw r.error;
  const soon = (h) => new Date(Date.now() + h * 36e5).toISOString();
  const mk = (suffix, extra) => ({ id: randomUUID(), organization_id: orgId, slug: `${run}-${suffix}`, title: `E2E ${suffix}`, summary: 'Otomatik uçtan uca test', type: 'workshop', format: 'online',
    status: 'published', is_demo: true, starts_at: soon(1), ends_at: soon(4), registration_closes_at: soon(0.5), ...extra });
  const oneSeat = mk('tek-yer', { capacity: 1 }); const open = mk('acik', { capacity: 5 });
  r = await admin.from('events').insert([oneSeat, open]); if (r.error) throw r.error; eventIds = [oneSeat.id, open.id];

  // ---------- discovery as a guest
  const guest = createClient(url, pk, { auth: { persistSession: false } });
  const feed = await guest.from('events').select('id').eq('id', open.id);
  ok('guest sees the published event', feed.data?.length === 1);
  const guestReg = await guest.rpc('register_for_event', { p_event_id: open.id, p_idempotency_key: randomUUID() });
  ok('guest cannot register', !!guestReg.error, code(guestReg.error));

  // ---------- eligibility + capacity race + duplicates
  const el = await minor.client.rpc('event_eligibility', { p_event_id: open.id });
  ok('server eligibility: minor → guardian_required', el.data?.eligible === true && el.data?.guardian_required === true);
  const [ra, rb] = await Promise.all([a, b].map((u) => u.client.rpc('register_for_event', { p_event_id: oneSeat.id, p_idempotency_key: randomUUID() })));
  const statuses = [ra.data?.status, rb.data?.status].sort().join(',');
  ok('last seat, two parallel registrations → capacity not exceeded', statuses === 'confirmed,waitlisted', statuses || code(ra.error ?? rb.error));
  const winner = ra.data?.status === 'confirmed' ? a : b; const winnerReg = ra.data?.status === 'confirmed' ? ra.data : rb.data; const loser = winner === a ? b : a;
  const key = randomUUID();
  const dup = await Promise.all([1, 2, 3].map((i) => winner.client.rpc('register_for_event', { p_event_id: oneSeat.id, p_idempotency_key: i === 3 ? randomUUID() : key })));
  const count = await admin.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', oneSeat.id).eq('user_id', winner.id);
  ok('repeated registration returns the same row, no duplicate', dup.every((d) => d.data?.id === winnerReg.id) && count.count === 1, `rows=${count.count}`);

  // ---------- state from "another device" + isolation
  const device2 = createClient(url, pk, { auth: { persistSession: false } });
  await device2.auth.setSession({ access_token: (await winner.client.auth.getSession()).data.session.access_token, refresh_token: 'unused' }).catch(() => {});
  const again = await winner.client.from('event_registrations').select('id,status').eq('event_id', oneSeat.id);
  ok('registration state is read back from the server', again.data?.[0]?.status === 'confirmed');
  const peek = await loser.client.from('event_registrations').select('id').eq('id', winnerReg.id);
  const tamper = await loser.client.from('event_registrations').update({ status: 'cancelled' }).eq('id', winnerReg.id).select('id');
  ok('another user can neither read nor modify the registration', peek.data?.length === 0 && (tamper.data?.length ?? 0) === 0);
  const priv = await loser.client.from('profile_private').select('user_id');
  ok('private profile rows: only your own', priv.data?.length === 1 && priv.data[0].user_id === loser.id);

  // ---------- guardian
  const mreg = await minor.client.rpc('register_for_event', { p_event_id: open.id, p_idempotency_key: randomUUID() });
  ok('minor registration is persisted as pending_guardian', mreg.data?.status === 'pending_guardian', code(mreg.error));
  const mcard = await minor.client.rpc('get_participation_card', { p_registration_id: mreg.data.id });
  ok('no participation card before guardian approval', mcard.error?.message === 'registration_not_confirmed');
  const own = await minor.client.rpc('create_guardian_request', { p_registration_id: mreg.data.id, p_guardian_email: minor.email });
  ok('own e-mail refused as guardian', own.error?.message === 'guardian_email_same_as_user');
  const greq = await minor.client.rpc('create_guardian_request', { p_registration_id: mreg.data.id, p_guardian_email: `${run}-veli@techapp.test`, p_guardian_name: 'E2E Veli' });
  const mint = await minor.client.rpc('issue_guardian_token', { p_request_id: greq.data });
  ok('minor cannot mint the guardian token', !!mint.error, code(mint.error));
  const fn = await minor.client.functions.invoke('guardian-dispatch', { body: { request_id: greq.data } });
  const fnStatus = fn.error?.context?.status ?? 200;
  ok('Edge Function guardian-dispatch accepts the user JWT (mail provider may be unset)', [200, 502].includes(fnStatus), `HTTP ${fnStatus}`);
  // guardian decision with a token minted by the service role (what the e-mail would carry)
  await admin.from('guardian_requests').update({ last_sent_at: null }).eq('id', greq.data);
  const issued = await admin.rpc('issue_guardian_token', { p_request_id: greq.data });
  const preview = await guest.rpc('guardian_request_preview', { p_token: issued.data.token });
  const decide = await guest.rpc('guardian_decide', { p_token: issued.data.token, p_approve: true, p_guardian_full_name: 'E2E Veli', p_policy_version: preview.data.policy_version });
  const reuse = await guest.rpc('guardian_decide', { p_token: issued.data.token, p_approve: true, p_guardian_full_name: 'E2E Veli', p_policy_version: preview.data.policy_version });
  const after = await minor.client.from('event_registrations').select('status').eq('id', mreg.data.id).single();
  ok('guardian approval (single-use token) confirms the registration', decide.data?.status === 'approved' && !!reuse.error && after.data?.status === 'confirmed', after.data?.status);

  // ---------- participation card + check-in
  const card = await winner.client.rpc('get_participation_card', { p_registration_id: winnerReg.id });
  ok('participation card: signed opaque token, no demo constant, no PII', /^TA1\.[0-9a-f-]{36}\.[0-9a-f]{32}$/.test(card.data?.qr_payload ?? '') && !card.data.qr_payload.includes('E2E'));
  const c1 = await outsider.client.rpc('check_in_participant', { p_token: card.data.qr_payload });
  const c2 = await winner.client.rpc('check_in_participant', { p_token: card.data.qr_payload });
  ok('unauthorised check-in is refused (outsider + participant)', c1.error?.message === 'checkin_forbidden' && c2.error?.message === 'checkin_forbidden');
  const wrongEvent = await staff.client.rpc('check_in_participant', { p_token: card.data.qr_payload, p_expected_event_id: open.id });
  ok('ticket for another event is told apart', wrongEvent.error?.message === 'ticket_wrong_event');
  const scans = await Promise.all([1, 2].map(() => staff.client.rpc('check_in_participant', { p_token: card.data.qr_payload, p_expected_event_id: oneSeat.id })));
  const kinds = scans.map((s) => s.data?.result).sort().join(',');
  ok('authorised staff check in once; duplicate scan creates nothing', kinds === 'already_checked_in,checked_in', kinds || code(scans[0].error));
  const list = await staff.client.rpc('admin_event_registrations', { p_event_id: oneSeat.id });
  const foreign = await outsider.client.rpc('admin_event_registrations', { p_event_id: oneSeat.id });
  ok('organiser list: staff yes, outsider 403', list.data?.length === 2 && foreign.error?.message === 'forbidden');

  // ---------- cancellation → waitlist promotion, account deletion
  const cancel = await loser.client.rpc('cancel_event_registration', { p_registration_id: (winner === a ? rb : ra).data.id });
  ok('user can cancel own registration', cancel.data?.status === 'cancelled', code(cancel.error));
  const del = await outsider.client.functions.invoke('delete-account', { method: 'POST' });
  const gone = await admin.auth.admin.getUserById(outsider.id);
  ok('Edge Function delete-account removes the user server-side', !del.error && !!gone.error, code(del.error));
} catch (e) {
  ok('script completed without unexpected error', false, e?.message ?? String(e));
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id).catch(() => {});
  if (eventIds.length) { await admin.from('event_registrations').delete().in('event_id', eventIds); await admin.from('events').delete().in('id', eventIds); }
  if (orgId) await admin.from('organizations').delete().eq('id', orgId);
  const left = await admin.from('organizations').select('id', { count: 'exact', head: true }).eq('slug', run);
  console.log(`cleanup: e2e fixtures remaining = ${left.count ?? '?'}`);
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
