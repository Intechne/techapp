import { describe, expect, it } from 'vitest';
import { admin, asAnon, asUser, createEvent, createOrg, createUser, expectFail, pool, register } from './helpers';

// D1 (pilot journey step 7): staff check a participant in by the 8-character code printed on the participation card,
// bound to the event they are working. Every check-in rule is the one of check_in_participant (delegation).

const openWindow = () => ({
  starts_at: new Date(Date.now() + 36e5), ends_at: new Date(Date.now() + 5 * 36e5),
  registration_closes_at: new Date(Date.now() + 30 * 6e4),
});

/**
 * Calls check_in_by_short_code like PostgREST does. The "no match" answer is not raised (a raise would roll back the
 * failed-attempt row that feeds the throttle); it sets `response.status` and returns a PostgREST-shaped error body, which
 * supabase-js surfaces as `error`. This helper turns that back into a thrown PT<status> error so expectFail applies.
 */
const byShortCode = async (userId: string, eventId: string, code: string | null, sessionId: string | null = null) => {
  // The transaction commits first (as PostgREST does with a custom status); only then is the error body thrown.
  const { j, status } = await asUser(userId, async (q) => {
    const j = (await q(`select public.check_in_by_short_code($1, $2, $3) j`, [eventId, code, sessionId])).rows[0].j;
    const status = (await q(`select nullif(current_setting('response.status', true), '') s`)).rows[0].s as string | null;
    return { j, status };
  });
  if (status && Number(status) >= 400) throw Object.assign(new Error(j.message), { code: j.code, message: j.message, status: Number(status) });
  return j as { result: string; registration_id: string; event_id: string; holder_name: string | null };
};

async function setup() {
  const staff = await createUser(); const editor = await createUser(); const otherStaff = await createUser();
  const org = await createOrg({ [staff]: 'checkin_staff', [editor]: 'editor' });
  await createOrg({ [otherStaff]: 'owner' });
  const event = await createEvent(org, openWindow());
  const participant = await createUser({ name: 'Deniz Yılmaz' });
  const reg = await register(participant, event);
  const card = (await asUser(participant, (q) => q(`select public.get_participation_card($1) j`, [reg.id]))).rows[0].j;
  return { staff, editor, otherStaff, org, event, participant, reg, card };
}

const failures = async (userId: string, eventId: string) =>
  (await admin(`select count(*)::int n from app.checkin_short_code_attempts where user_id = $1 and event_id = $2`, [userId, eventId])).rows[0].n as number;

describe('check-in by short code', () => {
  it('authorised staff check in by the card code; the same code again is already_checked_in', async () => {
    const { staff, event, reg, card } = await setup();
    expect(card.short_code).toMatch(/^[0-9A-F]{8}$/);
    const first = await byShortCode(staff, event, card.short_code);
    expect(first).toMatchObject({ result: 'checked_in', registration_id: reg.id, event_id: event, holder_name: 'Deniz Yılmaz' });
    const again = await byShortCode(staff, event, card.short_code);
    expect(again.result).toBe('already_checked_in');
    expect((await admin(`select count(*)::int n from public.event_check_ins where registration_id = $1`, [reg.id])).rows[0].n).toBe(1);
    // the existing check-in audit is written by the delegated function; it carries no personal data
    const audit = await admin(`select metadata from public.audit_events where action = 'registration.checked_in' and target_id = $1`, [reg.id]);
    expect(audit.rows).toEqual([{ metadata: { event_id: event } }]);
  });

  it('normalises lowercase, spaces and hyphens', async () => {
    const { staff, event, card } = await setup();
    const code = card.short_code.toLowerCase();
    const messy = `  ${code.slice(0, 4)} - ${code.slice(4)}  `;
    expect((await byShortCode(staff, event, messy)).result).toBe('checked_in');
  });

  it('rejects malformed input with 422 without counting it as a lookup', async () => {
    const { staff, event } = await setup();
    for (const bad of ['', '1234567', '123456789', 'GHIJKLMN', 'TA1.abc', null]) {
      await expectFail(byShortCode(staff, event, bad), 422, 'short_code_malformed');
    }
    expect(await failures(staff, event)).toBe(0);
  });

  it('a code from another event is not found here (404) and the failure is recorded', async () => {
    const { staff, org, event } = await setup();
    const sibling = await createEvent(org, openWindow());
    const other = await createUser(); const otherReg = await register(other, sibling);
    const otherCard = (await asUser(other, (q) => q(`select public.get_participation_card($1) j`, [otherReg.id]))).rows[0].j;
    await expectFail(byShortCode(staff, event, otherCard.short_code), 404, 'ticket_unknown');
    expect(await failures(staff, event)).toBe(1);
    // ...and it works on its own event
    expect((await byShortCode(staff, sibling, otherCard.short_code)).result).toBe('checked_in');
  });

  it('only owner/admin/checkin_staff of the event organisation may use it (403); anon cannot execute it', async () => {
    const { editor, otherStaff, participant, event, card } = await setup();
    await expectFail(byShortCode(editor, event, card.short_code), 403, 'checkin_forbidden');
    await expectFail(byShortCode(otherStaff, event, card.short_code), 403, 'checkin_forbidden');
    await expectFail(byShortCode(participant, event, card.short_code), 403, 'checkin_forbidden');
    // an unknown event id answers exactly like a foreign one: nothing is learned about its existence
    await expectFail(byShortCode(otherStaff, '00000000-0000-4000-8000-000000000000', card.short_code), 403, 'checkin_forbidden');
    await expect(asAnon((q) => q(`select public.check_in_by_short_code($1, $2)`, [event, card.short_code]))).rejects.toThrow(/permission denied/);
    expect((await admin(`select count(*)::int n from public.event_check_ins c join public.event_registrations r on r.id = c.registration_id where r.event_id = $1`, [event])).rows[0].n).toBe(0);
  });

  it('after 20 failed lookups in 10 minutes the 21st attempt is 429, even with a valid code, until the window passes', async () => {
    const { staff, event, card } = await setup();
    const wrong = card.short_code === '00000000' ? '00000001' : '00000000';
    for (let i = 0; i < 20; i += 1) await expectFail(byShortCode(staff, event, wrong), 404, 'ticket_unknown');
    await expectFail(byShortCode(staff, event, wrong), 429, 'short_code_rate_limited');
    await expectFail(byShortCode(staff, event, card.short_code), 429, 'short_code_rate_limited');
    expect(await failures(staff, event)).toBe(20);
    // reaching the limit is audited, without personal data
    const audit = await admin(`select metadata from public.audit_events where action = 'checkin.short_code_locked' and target_id = $1`, [event]);
    expect(audit.rows).toEqual([{ metadata: { window_minutes: 10 } }]);
    // the limit is per caller and event: another staff member of the same organisation is not blocked
    const colleague = await createUser();
    const { rows } = await admin(`select organization_id from public.events where id = $1`, [event]);
    await admin(`insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'checkin_staff')`, [rows[0].organization_id, colleague]);
    await expectFail(byShortCode(colleague, event, wrong), 404, 'ticket_unknown');
    // the window passes
    await admin(`update app.checkin_short_code_attempts set created_at = now() - interval '11 minutes' where user_id = $1 and event_id = $2`, [staff, event]);
    expect((await byShortCode(staff, event, card.short_code)).result).toBe('checked_in');
  });

  it('prunes attempt rows older than a day when a new failure is recorded', async () => {
    const { staff, event } = await setup();
    await admin(`insert into app.checkin_short_code_attempts (user_id, event_id, created_at) values ($1, $2, now() - interval '2 days')`, [staff, event]);
    await expectFail(byShortCode(staff, event, 'ABCDEF01'), 404, 'ticket_unknown');
    expect((await admin(`select count(*)::int n from app.checkin_short_code_attempts where created_at < now() - interval '1 day'`)).rows[0].n).toBe(0);
  });

  it('a cancelled card no longer matches (404); a non-confirmed registration gets registration_not_confirmed via delegation', async () => {
    const { staff, org, event, participant, reg, card } = await setup();
    await asUser(participant, (q) => q(`select public.cancel_event_registration($1)`, [reg.id]));
    // cancelling re-signs the ticket (ticket_version + 1), so the printed code is dead — like the QR (ticket_invalid)
    await expectFail(byShortCode(staff, event, card.short_code), 404, 'ticket_unknown');
    // a registration that exists but is not confirmed (here: waitlisted) reaches check_in_participant's own rule
    const full = await createEvent(org, { ...openWindow(), capacity: 1, waitlist_enabled: true });
    await register(await createUser(), full);
    const waiting = await register(await createUser(), full);
    expect(waiting.status).toBe('waitlisted');
    const code = (await admin(`select upper(substr(split_part(app.ticket_token(r), '.', 3), 1, 8)) c from public.event_registrations r where id = $1`, [waiting.id])).rows[0].c;
    await expectFail(byShortCode(staff, full, code), 409, 'registration_not_confirmed');
  });

  it('keeps check_in_participant rules: outside the window and session mismatch', async () => {
    const { staff, org, card, event } = await setup();
    const later = await createEvent(org); // starts in a week
    const u = await createUser(); const r = await register(u, later);
    const laterCard = (await asUser(u, (q) => q(`select public.get_participation_card($1) j`, [r.id]))).rows[0].j;
    await expectFail(byShortCode(staff, later, laterCard.short_code), 409, 'outside_checkin_window');
    await expectFail(byShortCode(staff, event, card.short_code, '00000000-0000-4000-8000-000000000000'), 422, 'session_mismatch');
  });

  it('two registrations with the same code (theoretical 32-bit collision) answer 409 short_code_ambiguous', async () => {
    const { staff, org } = await setup();
    const event = await createEvent(org, openWindow());
    const a = await register(await createUser(), event); const b = await register(await createUser(), event);
    // Force a collision inside one transaction: a stand-in ticket_token whose signature starts with DEADBEEF for every
    // registration. DDL is transactional, so the rollback restores the real function for every other test.
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`create or replace function app.ticket_token(p_registration public.event_registrations) returns text
        language sql stable security definer set search_path = '' as $f$
          select 'TA1.' || p_registration.id::text || '.deadbeef' || repeat('0', 24) $f$`);
      await client.query(`set local role authenticated`);
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: staff, role: 'authenticated' })]);
      await expectFail(client.query(`select public.check_in_by_short_code($1, 'DEADBEEF')`, [event]), 409, 'short_code_ambiguous');
    } finally {
      await client.query('rollback').catch(() => {});
      client.release();
    }
    expect((await admin(`select count(*)::int n from public.event_check_ins where registration_id in ($1, $2)`, [a.id, b.id])).rows[0].n).toBe(0);
    expect((await admin(`select app.ticket_token(r) t from public.event_registrations r where id = $1`, [a.id])).rows[0].t).not.toContain('deadbeef');
  });

  it('the attempts table is closed to API roles', async () => {
    const { staff } = await setup();
    await expect(asUser(staff, (q) => q(`select count(*) from app.checkin_short_code_attempts`))).rejects.toThrow(/permission denied/);
    await expect(asUser(staff, (q) => q(`delete from app.checkin_short_code_attempts`))).rejects.toThrow(/permission denied/);
    const { rows } = await admin(`select c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'app' and c.relname = 'checkin_short_code_attempts'`);
    expect(rows).toEqual([{ relrowsecurity: true }]);
  });
});
