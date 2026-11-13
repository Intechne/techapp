// Faz 3a Task 1 + 2 — team event registration: schema, RLS, counters (Task 1 fixtures are superuser inserts) and submit_team_registration (Task 2).
// Rules under test: the team pool (team_capacity / teams_taken / team_waitlist_count) and the individual pool (capacity /
// seats_taken / waitlist_count) never touch each other; team rows are readable only by the registered team's active members,
// the event organisation's owner|admin|reviewer|checkin_staff and platform admins (members of the team include minors);
// clients have no write path to either table; the counters are server-owned.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { admin, asAnon, asService, asUser, createOrg, createTeam, createTeamEvent, createUser, expectFail, pool, register } from './helpers';

const PERMISSION_DENIED = /permission denied/;
const LIVE_REG = `status in ('pending_guardian', 'pending_review', 'confirmed', 'waitlisted')`;

type TeamRegStatus = 'pending_members' | 'pending_review' | 'confirmed' | 'waitlisted' | 'cancelled' | 'rejected' | 'expired';

/** Superuser fixture: one team registration row + one roster row per member (all 'invited'). */
async function teamRegistration(eventId: string, teamId: string, submittedBy: string, memberIds: string[], status: TeamRegStatus = 'pending_members') {
  const id = randomUUID();
  await admin(`insert into public.team_event_registrations (id, event_id, team_id, status, submitted_by, idempotency_key, hold_expires_at)
               values ($1, $2, $3, $4, $5, $6, now() + interval '7 days')`, [id, eventId, teamId, status, submittedBy, randomUUID()]);
  const members: string[] = [];
  for (const userId of memberIds) {
    const m = await admin(`insert into public.team_event_registration_members (team_registration_id, user_id, role_at_submit, roster_version, state)
                           values ($1, $2, (select role from public.team_memberships where team_id = $3 and user_id = $2 and status = 'active'), 1, 'invited')
                           returning id`, [id, userId, teamId]);
    members.push(m.rows[0].id);
  }
  return { id, members };
}

/** Superuser fixture: a member's own event_registrations row that belongs to a team registration (accepted invite). */
async function memberRegistration(eventId: string, teamRegId: string, memberRowId: string, userId: string, status = 'confirmed') {
  const r = await admin(`insert into public.event_registrations (event_id, user_id, status, idempotency_key, team_registration_id, confirmed_at)
                         values ($1, $2, $3::public.registration_status, $4, $5, case when $3::public.registration_status = 'confirmed' then now() end) returning id`,
    [eventId, userId, status, randomUUID(), teamRegId]);
  await admin(`update public.team_event_registration_members set state = 'accepted', registration_id = $2, responded_at = now() where id = $1`,
    [memberRowId, r.rows[0].id]);
  return r.rows[0].id as string;
}

const counters = async (eventId: string) =>
  (await admin(`select seats_taken, waitlist_count, teams_taken, team_waitlist_count from public.events where id = $1`, [eventId])).rows[0];

const count = (rows: { rowCount: number | null }) => rows.rowCount ?? 0;

describe('team registration · schema', () => {
  it('anon and a signed-in non-member read zero rows from both tables', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org);
    const captain = await createUser(); const member = await createUser({ age: 16 }); const outsider = await createUser();
    const team = await createTeam(captain, [member]);
    await teamRegistration(event, team, captain, [captain, member]);
    for (const table of ['team_event_registrations', 'team_event_registration_members']) {
      // anon holds no grant at all: denied, which reads as zero rows (same convention as the RLS audit)
      await expect(asAnon((q) => q(`select * from public.${table}`))).rejects.toThrow(PERMISSION_DENIED);
      expect([table, count(await asUser(outsider, (q) => q(`select * from public.${table}`)))]).toEqual([table, 0]);
    }
  });

  it('a team member reads only their own team’s registration and member rows', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org);
    const capA = await createUser(); const minorA = await createUser({ age: 15 }); const benchA = await createUser();
    const capB = await createUser(); const memberB = await createUser({ age: 16 });
    const teamA = await createTeam(capA, [minorA, benchA]); const teamB = await createTeam(capB, [memberB]);
    const regA = await teamRegistration(event, teamA, capA, [capA, minorA]);
    const regB = await teamRegistration(event, teamB, capB, [capB, memberB]);

    for (const user of [capA, minorA, benchA]) { // benchA: active in the team, not on the roster → still the team
      const regs = await asUser(user, (q) => q(`select id from public.team_event_registrations`));
      expect(regs.rows.map((r) => r.id)).toEqual([regA.id]);
      const members = await asUser(user, (q) => q(`select id, team_registration_id from public.team_event_registration_members order by id`));
      expect(members.rows.map((r) => r.id).sort()).toEqual([...regA.members].sort());
      expect(members.rows.every((r) => r.team_registration_id === regA.id)).toBe(true);
    }
    expect((await asUser(memberB, (q) => q(`select id from public.team_event_registrations`))).rows.map((r) => r.id)).toEqual([regB.id]);

    // someone who left the team loses the team's rows but still sees their own roster row
    await admin(`update public.team_memberships set status = 'left' where team_id = $1 and user_id = $2`, [teamA, minorA]);
    expect(count(await asUser(minorA, (q) => q(`select id from public.team_event_registrations`)))).toBe(0);
    expect((await asUser(minorA, (q) => q(`select id from public.team_event_registration_members`))).rows.map((r) => r.id))
      .toEqual([regA.members[1]]);
    // a pending join request is not membership
    const applicant = await createUser();
    await admin(`insert into public.team_memberships (team_id, user_id, role, status) values ($1, $2, 'member', 'pending')`, [teamA, applicant]);
    expect(count(await asUser(applicant, (q) => q(`select id from public.team_event_registration_members`)))).toBe(0);
  });

  it('teammates see only the live roster (invited/accepted); a declined or removed member still sees their own row; staff and platform admins see every state', async () => {
    const reviewer = await createUser(); const pa = await createUser();
    const org = await createOrg({ [reviewer]: 'reviewer' }); const event = await createTeamEvent(org);
    await admin(`insert into public.platform_admins (user_id) values ($1)`, [pa]);
    const captain = await createUser(); const decliner = await createUser({ age: 16 }); const removed = await createUser(); const bench = await createUser();
    const team = await createTeam(captain, [decliner, removed, bench]);
    const reg = await teamRegistration(event, team, captain, [captain, decliner, removed]);
    const [capRow, declinedRow, removedRow] = reg.members;
    await admin(`update public.team_event_registration_members set state = 'declined', responded_at = now() where id = $1`, [declinedRow]);
    await admin(`update public.team_event_registration_members set state = 'removed' where id = $1`, [removedRow]);
    const visible = async (user: string) =>
      (await asUser(user, (q) => q(`select id from public.team_event_registration_members where team_registration_id = $1`, [reg.id]))).rows.map((r) => r.id).sort();

    for (const teammate of [captain, bench]) expect(await visible(teammate)).toEqual([capRow]);
    expect(await visible(decliner)).toEqual([capRow, declinedRow].sort());
    expect(await visible(removed)).toEqual([capRow, removedRow].sort());
    for (const full of [reviewer, pa]) expect(await visible(full)).toEqual([...reg.members].sort());
  });

  it('an API caller inserting an event gets zero counters (cannot create a "full" event); the service role keeps its values', async () => {
    const editor = await createUser(); const org = await createOrg({ [editor]: 'editor' });
    const cols = `(id, organization_id, slug, title, summary, type, format, status, starts_at, ends_at, registration_closes_at,
                   registration_mode, capacity, team_capacity, seats_taken, waitlist_count, teams_taken, team_waitlist_count)`;
    const vals = `($1, $2, $3, 'Sahte Dolu Etkinlik', 'Özet', 'workshop', 'in_person', $4, now() + interval '7 days',
                   now() + interval '7 days 6 hours', now() + interval '6 days', 'both', 5, 3, 5, 2, 3, 1)`;
    const byEditor = randomUUID();
    await asUser(editor, (q) => q(`insert into public.events ${cols} values ${vals}`, [byEditor, org, `ev-${byEditor.slice(0, 8)}`, 'draft']));
    expect(await counters(byEditor)).toEqual({ seats_taken: 0, waitlist_count: 0, teams_taken: 0, team_waitlist_count: 0 });
    const byService = randomUUID();
    await asService((q) => q(`insert into public.events ${cols} values ${vals}`, [byService, org, `ev-${byService.slice(0, 8)}`, 'published']));
    expect(await counters(byService)).toEqual({ seats_taken: 5, waitlist_count: 2, teams_taken: 3, team_waitlist_count: 1 });
  });

  it('the event organisation’s owner|admin|reviewer|checkin_staff and platform admins read; editors and other organisations do not', async () => {
    const [owner, orgAdmin, reviewer, staff, editor, otherOwner, pa, captain] = await Promise.all(
      [createUser(), createUser(), createUser(), createUser(), createUser(), createUser(), createUser(), createUser()]);
    const org = await createOrg({ [owner]: 'owner', [orgAdmin]: 'admin', [reviewer]: 'reviewer', [staff]: 'checkin_staff', [editor]: 'editor' });
    await createOrg({ [otherOwner]: 'owner' });
    await admin(`insert into public.platform_admins (user_id) values ($1)`, [pa]);
    const event = await createTeamEvent(org); const team = await createTeam(captain);
    const reg = await teamRegistration(event, team, captain, [captain]);
    for (const user of [owner, orgAdmin, reviewer, staff, pa]) {
      expect((await asUser(user, (q) => q(`select id from public.team_event_registrations where id = $1`, [reg.id]))).rowCount).toBe(1);
      expect((await asUser(user, (q) => q(`select id from public.team_event_registration_members where team_registration_id = $1`, [reg.id]))).rowCount).toBe(1);
    }
    for (const user of [editor, otherOwner]) {
      expect(count(await asUser(user, (q) => q(`select id from public.team_event_registrations`)))).toBe(0);
      expect(count(await asUser(user, (q) => q(`select id from public.team_event_registration_members`)))).toBe(0);
    }
  });

  it('authenticated cannot insert/update/delete either table directly (permission denied)', async () => {
    const owner = await createUser(); const captain = await createUser();
    const org = await createOrg({ [owner]: 'owner' }); const event = await createTeamEvent(org);
    const team = await createTeam(captain); const reg = await teamRegistration(event, team, captain, [captain]);
    const attempts: Array<[string, string, unknown[]]> = [
      [captain, `insert into public.team_event_registrations (event_id, team_id, status, submitted_by, idempotency_key, hold_expires_at)
                 values ($1, $2, 'confirmed', $3, gen_random_uuid(), now())`, [event, team, captain]],
      [captain, `update public.team_event_registrations set status = 'confirmed' where id = $1`, [reg.id]],
      [owner, `update public.team_event_registrations set status = 'confirmed' where id = $1`, [reg.id]],
      [captain, `delete from public.team_event_registrations where id = $1`, [reg.id]],
      [captain, `insert into public.team_event_registration_members (team_registration_id, user_id, role_at_submit, roster_version, state)
                 values ($1, $2, 'captain', 1, 'invited')`, [reg.id, owner]],
      [captain, `update public.team_event_registration_members set state = 'accepted' where id = $1`, [reg.members[0]]],
      [owner, `delete from public.team_event_registration_members where id = $1`, [reg.members[0]]],
    ];
    for (const [user, sql, params] of attempts) {
      await expect(asUser(user, (q) => q(sql, params)), sql).rejects.toThrow(PERMISSION_DENIED);
    }
    // and the member registration link on event_registrations cannot be set by a client either (no write policy)
    const solo = await createUser(); const both = await createTeamEvent(org, { registration_mode: 'both' });
    const own = await register(solo, both);
    expect(count(await asUser(solo, (q) => q(`update public.event_registrations set team_registration_id = $2 where id = $1`, [own.id, reg.id])))).toBe(0);
    expect((await admin(`select status from public.team_event_registrations where id = $1`, [reg.id])).rows[0].status).toBe('pending_members');
  });

  it('recount_team_event: teams_taken counts pending_members+pending_review+confirmed; waitlisted goes to team_waitlist_count', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_capacity: 3 });
    const statuses: TeamRegStatus[] = ['pending_members', 'pending_review', 'confirmed', 'waitlisted', 'waitlisted', 'cancelled', 'rejected', 'expired'];
    const regs: string[] = [];
    for (const status of statuses) {
      const captain = await createUser(); const team = await createTeam(captain);
      regs.push((await teamRegistration(event, team, captain, [captain], status)).id);
    }
    expect(await counters(event)).toEqual({ seats_taken: 0, waitlist_count: 0, teams_taken: 3, team_waitlist_count: 2 });

    // the trigger follows status changes: a confirmed team cancels, a waitlisted one moves up
    await admin(`update public.team_event_registrations set status = 'cancelled', cancelled_at = now() where id = $1`, [regs[2]]);
    expect(await counters(event)).toMatchObject({ teams_taken: 2, team_waitlist_count: 2 });
    await admin(`update public.team_event_registrations set status = 'pending_members' where id = $1`, [regs[3]]);
    expect(await counters(event)).toMatchObject({ teams_taken: 3, team_waitlist_count: 1 });

    // a drifted counter is rebuilt from the rows, never incremented
    await admin(`update public.events set teams_taken = 99, team_waitlist_count = 99 where id = $1`, [event]);
    await admin(`select app.recount_team_event($1)`, [event]);
    expect(await counters(event)).toEqual({ seats_taken: 0, waitlist_count: 0, teams_taken: 3, team_waitlist_count: 1 });
    // the write flag is not left on for the rest of the transaction
    const flag = await admin(`select app.recount_team_event($1), coalesce(current_setting('app.counter_write', true), '') v`, [event]);
    expect(flag.rows[0].v).toBe('off');
  });

  it('recount_event ignores event_registrations with team_registration_id: seats_taken unchanged', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { registration_mode: 'both', capacity: 2, team_capacity: 1 });
    const captain = await createUser(); const m1 = await createUser(); const m2 = await createUser({ age: 16 });
    const team = await createTeam(captain, [m1, m2]);
    const reg = await teamRegistration(event, team, captain, [captain, m1, m2]);
    await memberRegistration(event, reg.id, reg.members[0], captain, 'confirmed');
    await memberRegistration(event, reg.id, reg.members[1], m1, 'confirmed');
    await memberRegistration(event, reg.id, reg.members[2], m2, 'pending_guardian');
    expect(await counters(event)).toEqual({ seats_taken: 0, waitlist_count: 0, teams_taken: 1, team_waitlist_count: 0 });
    await admin(`select app.recount_event($1)`, [event]);
    expect((await counters(event)).seats_taken).toBe(0);

    // register_for_event: three team members hold no individual seat → two individuals fit, the third waits
    const [a, b, c] = await Promise.all([createUser(), createUser(), createUser()]);
    expect((await register(a, event)).status).toBe('confirmed');
    expect((await register(b, event)).status).toBe('confirmed');
    const third = await register(c, event);
    expect(third.status).toBe('waitlisted');
    expect(await counters(event)).toEqual({ seats_taken: 2, waitlist_count: 1, teams_taken: 1, team_waitlist_count: 0 });

    // promote_waitlist: the freed individual seat goes to the waitlist (team member rows do not make the event look full)
    const aReg = (await admin(`select id from public.event_registrations where user_id = $1 and event_id = $2 and ${LIVE_REG}`, [a, event])).rows[0].id;
    await asUser(a, (q) => q(`select public.cancel_event_registration($1)`, [aReg]));
    expect((await admin(`select status from public.event_registrations where id = $1`, [third.id])).rows[0].status).toBe('confirmed');
    expect(await counters(event)).toEqual({ seats_taken: 2, waitlist_count: 0, teams_taken: 1, team_waitlist_count: 0 });
    // and the team pool never moved
    expect((await admin(`select count(*)::int n from public.event_registrations where team_registration_id = $1 and ${LIVE_REG}`, [reg.id])).rows[0].n).toBe(3);
  });

  it('teams_taken cannot be written by an org editor (counter guard, 403/permission)', async () => {
    const editor = await createUser(); const org = await createOrg({ [editor]: 'editor' });
    const event = await createTeamEvent(org, { status: 'draft' });
    await expectFail(asUser(editor, (q) => q(`update public.events set teams_taken = 5 where id = $1`, [event])), 403, 'event_counters_locked');
    await expectFail(asUser(editor, (q) => q(`update public.events set team_waitlist_count = 1 where id = $1`, [event])), 403, 'event_counters_locked');
    // the editor still edits the team settings themselves
    expect(count(await asUser(editor, (q) => q(`update public.events set team_capacity = 4, team_min_size = 2, team_max_size = 6 where id = $1`, [event])))).toBe(1);
    expect(await counters(event)).toMatchObject({ teams_taken: 0, team_waitlist_count: 0 });
  });
});

describe('team registration · schema constraints', () => {
  it('events: team sizes and team capacity are checked', async () => {
    const org = await createOrg();
    await expect(createTeamEvent(org, { team_min_size: 0 })).rejects.toThrow(/check constraint/);
    await expect(createTeamEvent(org, { team_min_size: 4, team_max_size: 3 })).rejects.toThrow(/check constraint/);
    await expect(createTeamEvent(org, { team_capacity: 0 })).rejects.toThrow(/check constraint/);
    await expect(createTeamEvent(org, { team_max_size: 101 })).rejects.toThrow(/check constraint/);
    const open = await createTeamEvent(org, { team_capacity: null, team_max_size: null }); // no limits is allowed
    expect((await admin(`select team_min_size, team_max_size, team_capacity from public.events where id = $1`, [open])).rows[0])
      .toEqual({ team_min_size: 1, team_max_size: null, team_capacity: null });
    await expect(admin(`update public.events set teams_taken = -1 where id = $1`, [open])).rejects.toThrow(/check constraint/);
  });

  it('one live registration per team per event; one live roster row per person; accepted rows carry their registration', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org);
    const captain = await createUser(); const team = await createTeam(captain);
    const reg = await teamRegistration(event, team, captain, [captain]);
    await expect(teamRegistration(event, team, captain, [], 'waitlisted')).rejects.toThrow(/team_event_registrations_one_live/);
    await expect(admin(`insert into public.team_event_registration_members (team_registration_id, user_id, role_at_submit, roster_version, state)
                        values ($1, $2, 'captain', 1, 'invited')`, [reg.id, captain])).rejects.toThrow(/team_event_registration_members_one_live/);
    await expect(admin(`update public.team_event_registration_members set state = 'accepted' where id = $1`, [reg.members[0]]))
      .rejects.toThrow(/check constraint/);
    // history does not block: once cancelled, the team may register again
    await admin(`update public.team_event_registrations set status = 'cancelled', cancelled_at = now() where id = $1`, [reg.id]);
    await teamRegistration(event, team, captain, [captain]);
    // a seat is never held without an expiry
    const other = await createTeam(await createUser());
    await expect(admin(`insert into public.team_event_registrations (event_id, team_id, status, submitted_by, idempotency_key)
                        values ($1, $2, 'pending_members', $3, gen_random_uuid())`, [event, other, captain])).rejects.toThrow(/check constraint/);
  });

  it('a member registration belongs to the same event as its team registration and is never waitlisted', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org); const otherEvent = await createTeamEvent(org);
    const captain = await createUser(); const team = await createTeam(captain);
    const reg = await teamRegistration(event, team, captain, [captain]);
    await expect(admin(`insert into public.event_registrations (event_id, user_id, status, idempotency_key, team_registration_id)
                        values ($1, $2, 'confirmed', gen_random_uuid(), $3)`, [otherEvent, captain, reg.id])).rejects.toThrow(/foreign key/);
    await expect(admin(`insert into public.event_registrations (event_id, user_id, status, idempotency_key, team_registration_id)
                        values ($1, $2, 'waitlisted', gen_random_uuid(), $3)`, [event, captain, reg.id])).rejects.toThrow(/check constraint/);
  });
});

describe('team registration · critical fields', () => {
  async function published() {
    const editor = await createUser(); const org = await createOrg({ [editor]: 'editor' });
    const event = await createTeamEvent(org, { team_capacity: 8, team_min_size: 2, team_max_size: 5 });
    const status = async () => (await admin(`select status from public.events where id = $1`, [event])).rows[0].status;
    const revision = async () => (await admin(`select changed_fields from public.content_revisions where entity_id = $1`, [event])).rows[0]?.changed_fields;
    return { editor, event, status, revision };
  }

  it.each([
    ['team_min_size', `team_min_size = 3`],
    ['team_max_size', `team_max_size = 4`],
    ['team_capacity', `team_capacity = 6`],
  ])('%s change (team_capacity: fewer seats) sends a published event back to review', async (field, set) => {
    const { editor, event, status, revision } = await published();
    await asUser(editor, (q) => q(`update public.events set ${set} where id = $1`, [event]));
    expect(await status()).toBe('in_review');
    expect(await revision()).toEqual([field]);
  });

  it('more team seats or no team limit stays live and is logged', async () => {
    const { editor, event, status } = await published();
    await asUser(editor, (q) => q(`update public.events set team_capacity = 12 where id = $1`, [event]));
    expect(await status()).toBe('published');
    await asUser(editor, (q) => q(`update public.events set team_capacity = null where id = $1`, [event]));
    expect(await status()).toBe('published');
    const logged = (await admin(`select metadata from public.audit_events where target_id = $1 and action = 'event.edited_after_approval' order by id`, [event])).rows;
    expect(logged.map((r) => r.metadata.changed_fields)).toEqual([['team_capacity'], ['team_capacity']]);
  });
});

// ---------------------------------------------------------------- Task 2: submit_team_registration
// The submitter is the team's ACTIVE captain or ACTIVE mentor (user decision 13 Nov 2026). Capacity is decided from the rows
// under the event row lock; errors and the audit row carry ids / codes only — never a member's name or age.

type Submitted = { id: string; status: TeamRegStatus; roster_version: number; hold_expires_at: Date | null; submitted_by: string; team_id: string };

const submit = (userId: string, eventId: string, teamId: string, memberIds: string[], key: string = randomUUID()) =>
  asUser(userId, async (q) => (await q(`select * from public.submit_team_registration($1, $2, $3::uuid[], $4)`,
    [eventId, teamId, memberIds, key])).rows[0] as Submitted);

const addMember = (teamId: string, userId: string, role: 'captain' | 'mentor' | 'member' = 'member', status = 'active') =>
  admin(`insert into public.team_memberships (team_id, user_id, role, status) values ($1, $2, $3, $4)`, [teamId, userId, role, status]);

const roster = async (teamRegId: string) =>
  (await admin(`select user_id, role_at_submit, state, roster_version from public.team_event_registration_members
                where team_registration_id = $1 order by role_at_submit, user_id`, [teamRegId])).rows;

/** Capture a PostgREST-style failure so its whole payload can be inspected (privacy: no name / age). */
async function failure(promise: Promise<unknown>) {
  try { await promise; } catch (error) { return error as { code: string; message: string; detail?: string; hint?: string; where?: string }; }
  throw new Error('expected the call to fail');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The per-member failures name the offending member ids (JSON array in detail) — never a name, age or birth date. */
async function failsWithIds(promise: Promise<unknown>, status: number, code: string) {
  const err = await failure(promise);
  expect([err.code, err.message]).toEqual([`PT${status}`, code]);
  return JSON.parse(err.detail ?? 'null') as string[];
}

/**
 * A real race: a gate connection holds the event row lock while the submits start on their own connections; only when
 * pg_stat_activity shows every one of them blocked on a lock does the gate commit and let them go at once.
 */
async function race<T>(eventId: string, calls: (() => Promise<T>)[]) {
  const gate = await pool.connect();
  let blocked = 0;
  try {
    await gate.query('begin');
    await gate.query(`select 1 from public.events where id = $1 for update`, [eventId]);
    const runs = calls.map((call) => call().then((value) => ({ ok: true as const, value }), (error) => ({ ok: false as const, error })));
    for (let i = 0; i < 500 && blocked < calls.length; i += 1) {
      blocked = (await admin(`select count(*)::int as n from pg_stat_activity
                              where wait_event_type = 'Lock' and query like '%submit_team_registration%' and pid <> pg_backend_pid()`)).rows[0].n;
      if (blocked < calls.length) await sleep(10);
    }
    await gate.query('commit');
    return { blocked, results: await Promise.all(runs) };
  } finally {
    gate.release();
  }
}

describe('team registration · submit', () => {
  it('captain submits 3 active members → pending_members, 3 invited rows, roster_version 1, teams_taken 1', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org); // closes in 6 days
    const captain = await createUser(); const m1 = await createUser({ age: 16, name: 'Gizli Reşit Olmayan' }); const m2 = await createUser();
    const team = await createTeam(captain, [m1, m2]);
    const reg = await submit(captain, event, team, [captain, m1, m2]);
    expect(reg).toMatchObject({ status: 'pending_members', roster_version: 1, submitted_by: captain, team_id: team });
    expect((await roster(reg.id)).map((r) => [r.role_at_submit, r.state, r.roster_version]))
      .toEqual([['captain', 'invited', 1], ['member', 'invited', 1], ['member', 'invited', 1]]);
    expect(await counters(event)).toEqual({ seats_taken: 0, waitlist_count: 0, teams_taken: 1, team_waitlist_count: 0 });
    // hold = least(registration_closes_at, submitted_at + 7 days): here the close (6 days) comes first
    const closes = (await admin(`select registration_closes_at from public.events where id = $1`, [event])).rows[0].registration_closes_at;
    expect(reg.hold_expires_at).toEqual(closes);
    // no member registration yet: each member accepts for themselves (Task 3)
    expect(count(await admin(`select 1 from public.event_registrations where event_id = $1`, [event]))).toBe(0);
    // audit: ids + roster size only
    const audit = (await admin(`select actor_id, metadata from public.audit_events where target_id = $1 and action = 'team_registration.submitted'`, [reg.id])).rows;
    expect(audit).toEqual([{ actor_id: captain, metadata: { event_id: event, team_id: team, status: 'pending_members', roster_size: 3 } }]);
  });

  it('hold_expires_at is submitted_at + 7 days when the registration closes later', async () => {
    const org = await createOrg();
    const event = await createTeamEvent(org, {
      starts_at: new Date(Date.now() + 30 * 864e5), ends_at: new Date(Date.now() + 30 * 864e5 + 36e5),
      registration_closes_at: new Date(Date.now() + 20 * 864e5) });
    const captain = await createUser(); const team = await createTeam(captain);
    const reg = await submit(captain, event, team, [captain]);
    const { diff } = (await admin(`select extract(epoch from (hold_expires_at - (created_at + interval '7 days')))::float as diff
                                   from public.team_event_registrations where id = $1`, [reg.id])).rows[0];
    expect(Math.abs(diff)).toBeLessThan(1);
  });

  it('same idempotency key twice → same row; another key while live → same live row', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org); const otherEvent = await createTeamEvent(org);
    const captain = await createUser(); const mentor = await createUser(); const member = await createUser();
    const team = await createTeam(captain, [member]); await addMember(team, mentor, 'mentor');
    const key = randomUUID();
    const first = await submit(captain, event, team, [captain, member], key);
    expect((await submit(captain, event, team, [captain, member], key)).id).toBe(first.id);
    // another key (or another manager) while the registration is live → the same row, no second roster
    expect((await submit(captain, event, team, [member], randomUUID())).id).toBe(first.id);
    expect((await submit(mentor, event, team, [mentor], randomUUID())).id).toBe(first.id);
    expect(count(await admin(`select 1 from public.team_event_registrations where team_id = $1`, [team]))).toBe(1);
    expect(await roster(first.id)).toHaveLength(2);
    // the same key for another event → 409
    await expectFail(submit(captain, otherEvent, team, [captain], key), 409, 'idempotency_key_reused');
  });

  it('active captain or active mentor may submit; a plain member → 403 not_team_manager', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org);
    const captain = await createUser(); const mentor = await createUser(); const member = await createUser();
    const exMentor = await createUser(); const pendingMentor = await createUser(); const outsider = await createUser();
    const team = await createTeam(captain, [member]);
    await addMember(team, mentor, 'mentor');
    await addMember(team, exMentor, 'mentor', 'left');
    await addMember(team, pendingMentor, 'mentor', 'pending');
    for (const user of [member, exMentor, pendingMentor, outsider]) {
      await expectFail(submit(user, event, team, [captain, member]), 403, 'not_team_manager');
    }
    expect(count(await admin(`select 1 from public.team_event_registrations where team_id = $1`, [team]))).toBe(0);
    // a mentor submits (they need not be on the roster)
    const byMentor = await submit(mentor, event, team, [captain, member]);
    expect(byMentor).toMatchObject({ status: 'pending_members', submitted_by: mentor });
    expect((await roster(byMentor.id)).map((r) => r.user_id).sort()).toEqual([captain, member].sort());
    // and a captain of another team on another event
    const event2 = await createTeamEvent(org); const cap2 = await createUser(); const team2 = await createTeam(cap2);
    expect((await submit(cap2, event2, team2, [cap2])).status).toBe('pending_members');
    // anon cannot call at all; missing team → 404
    await expect(asAnon((q) => q(`select public.submit_team_registration($1, $2, $3::uuid[], $4)`, [event, team, [captain], randomUUID()])))
      .rejects.toThrow(PERMISSION_DENIED);
    await expectFail(submit(captain, event, randomUUID(), [captain]), 404, 'team_not_found');
    await expectFail(submit(captain, randomUUID(), team, [captain]), 404, 'event_not_found');
  });

  it('roster size outside team_min_size..team_max_size → 422 team_size_out_of_range', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_min_size: 2, team_max_size: 3 });
    const captain = await createUser(); const m = await Promise.all([createUser(), createUser(), createUser()]);
    const team = await createTeam(captain, m);
    await expectFail(submit(captain, event, team, [captain]), 422, 'team_size_out_of_range');
    await expectFail(submit(captain, event, team, [captain, ...m]), 422, 'team_size_out_of_range');
    await expectFail(submit(captain, event, team, []), 422, 'team_size_out_of_range');
    // duplicates count once
    await expectFail(submit(captain, event, team, [captain, captain]), 422, 'team_size_out_of_range');
    expect((await submit(captain, event, team, [captain, m[0]!, m[0]!])).status).toBe('pending_members');
  });

  it('pending/left/removed member in roster → 422 member_not_active', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org);
    const captain = await createUser(); const active = await createUser(); const team = await createTeam(captain, [active]);
    const inactive: string[] = [];
    for (const status of ['pending', 'left', 'removed', null] as const) {
      const user = await createUser();
      if (status) await addMember(team, user, 'member', status);
      expect(await failsWithIds(submit(captain, event, team, [captain, active, user]), 422, 'member_not_active')).toEqual([user]);
      inactive.push(user);
    }
    // every offending id, ascending; active members are not named
    expect(await failsWithIds(submit(captain, event, team, [captain, ...inactive]), 422, 'member_not_active')).toEqual([...inactive].sort()); // 5 = team_max_size
    expect(await counters(event)).toMatchObject({ teams_taken: 0 });
  });

  it('member with a live individual registration, or in another team’s live registration for this event → 409 member_already_registered', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { registration_mode: 'both', capacity: 10 });
    const capA = await createUser(); const capB = await createUser(); const solo = await createUser(); const shared = await createUser();
    const teamA = await createTeam(capA, [solo, shared]); const teamB = await createTeam(capB, [shared]);
    await register(solo, event);
    expect(await failsWithIds(submit(capA, event, teamA, [capA, solo]), 409, 'member_already_registered')).toEqual([solo]);
    const regB = await submit(capB, event, teamB, [capB, shared]);
    expect(await failsWithIds(submit(capA, event, teamA, [capA, shared, solo]), 409, 'member_already_registered')).toEqual([shared, solo].sort());
    // a waitlisted team's roster is live too
    await admin(`update public.team_event_registrations set status = 'waitlisted', hold_expires_at = null where id = $1`, [regB.id]);
    await expectFail(submit(capA, event, teamA, [capA, shared]), 409, 'member_already_registered');
    // once team B's registration is over, the member is free again
    await admin(`update public.team_event_registrations set status = 'cancelled', cancelled_at = now() where id = $1`, [regB.id]);
    expect((await submit(capA, event, teamA, [capA, shared])).status).toBe('pending_members');
    // the individual pool did not move
    expect(await counters(event)).toEqual({ seats_taken: 1, waitlist_count: 0, teams_taken: 1, team_waitlist_count: 0 });
  });

  it('individual-mode event → 409 individual_registration_only; team-mode event still rejects register_for_event with team_registration_only', async () => {
    const org = await createOrg(); const captain = await createUser(); const team = await createTeam(captain);
    const individual = await createTeamEvent(org, { registration_mode: 'individual' });
    await expectFail(submit(captain, individual, team, [captain]), 409, 'individual_registration_only');
    const teamOnly = await createTeamEvent(org);
    await expectFail(register(captain, teamOnly), 409, 'team_registration_only');
    // dates
    const closed = await createTeamEvent(org, { registration_closes_at: new Date(Date.now() - 36e5) });
    await expectFail(submit(captain, closed, team, [captain]), 409, 'registration_closed');
    const notOpen = await createTeamEvent(org, { registration_opens_at: new Date(Date.now() + 864e5) });
    await expectFail(submit(captain, notOpen, team, [captain]), 409, 'registration_not_open');
  });

  it('member outside min_age/max_age → 403 member_age_not_eligible (member ids only: no name, age or birth date in the error payload)', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { min_age: 16, max_age: 20 });
    const captain = await createUser({ age: 19 }); const young = await createUser({ age: 14, name: 'Gizli Küçük Üye' });
    const old = await createUser({ age: 23, name: 'Gizli Büyük Üye' }); const noBirth = await createUser({ age: null });
    const team = await createTeam(captain, [young, old, noBirth]);
    for (const [user, age] of [[young, '14'], [old, '23']] as const) {
      const err = await failure(submit(captain, event, team, [captain, user]));
      expect([err.code, err.message]).toEqual(['PT403', 'member_age_not_eligible']);
      expect(JSON.parse(err.detail!)).toEqual([user]); // the manager sent this id: it may come back
      const birth = (await admin(`select birth_date::text as d from public.profile_private where user_id = $1`, [user])).rows[0].d as string;
      const payload = JSON.stringify({ message: err.message, detail: err.detail, hint: err.hint, where: err.where });
      const withoutIds = payload.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>');
      expect(withoutIds).not.toMatch(/Gizli|Küçük|Büyük/);
      expect(withoutIds).not.toContain(age);
      expect(payload).not.toContain(birth);
      expect(payload).not.toMatch(/birth|age_years|\d{4}-\d{2}-\d{2}/);
    }
    expect(await failsWithIds(submit(captain, event, team, [captain, noBirth, young, old]), 403, 'member_age_not_eligible'))
      .toEqual([noBirth, young, old].sort());
    expect((await submit(captain, event, team, [captain])).status).toBe('pending_members');
  });

  it('team_capacity 2: third team → waitlisted when waitlist_enabled, 409 team_event_full otherwise; seats_taken unchanged', async () => {
    const org = await createOrg();
    for (const waitlist of [true, false]) {
      const event = await createTeamEvent(org, { team_capacity: 2, waitlist_enabled: waitlist, registration_mode: 'both', capacity: 5 });
      const caps = await Promise.all([createUser(), createUser(), createUser()]);
      const teams = await Promise.all(caps.map((c) => createTeam(c)));
      expect((await submit(caps[0]!, event, teams[0]!, [caps[0]!])).status).toBe('pending_members');
      expect((await submit(caps[1]!, event, teams[1]!, [caps[1]!])).status).toBe('pending_members');
      if (waitlist) {
        const third = await submit(caps[2]!, event, teams[2]!, [caps[2]!]);
        expect(third).toMatchObject({ status: 'waitlisted', hold_expires_at: null });
        expect(await roster(third.id)).toHaveLength(1); // the snapshot is kept for promotion
        expect(await counters(event)).toEqual({ seats_taken: 0, waitlist_count: 0, teams_taken: 2, team_waitlist_count: 1 });
      } else {
        await expectFail(submit(caps[2]!, event, teams[2]!, [caps[2]!]), 409, 'team_event_full');
        expect(count(await admin(`select 1 from public.team_event_registrations where team_id = $1`, [teams[2]]))).toBe(0);
        expect(await counters(event)).toEqual({ seats_taken: 0, waitlist_count: 0, teams_taken: 2, team_waitlist_count: 0 });
      }
    }
  });

  it('capacity is decided from the rows, not from a drifted teams_taken counter', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_capacity: 1 });
    const cap1 = await createUser(); const cap2 = await createUser(); const t1 = await createTeam(cap1); const t2 = await createTeam(cap2);
    await submit(cap1, event, t1, [cap1]);
    await admin(`update public.events set teams_taken = 0 where id = $1`, [event]); // forged drift (superuser)
    expect((await submit(cap2, event, t2, [cap2])).status).toBe('waitlisted');
    expect(await counters(event)).toMatchObject({ teams_taken: 1, team_waitlist_count: 1 }); // rebuilt from rows
  });

  it('two captains race for the last team seat in parallel → exactly one pending_members and one waitlisted', async () => {
    const org = await createOrg();
    for (const waitlist of [true, false]) {
      const event = await createTeamEvent(org, { team_capacity: 2, waitlist_enabled: waitlist });
      const cap0 = await createUser(); await submit(cap0, event, await createTeam(cap0), [cap0]); // one seat left
      const capA = await createUser(); const capB = await createUser();
      const teamA = await createTeam(capA); const teamB = await createTeam(capB);
      const { blocked, results } = await race(event, [
        () => submit(capA, event, teamA, [capA]),
        () => submit(capB, event, teamB, [capB]),
      ]);
      expect(blocked).toBe(2); // both were really in flight at the same time
      const ok = results.flatMap((r) => (r.ok ? [r.value.status] : []));
      const errors = results.flatMap((r) => (r.ok ? [] : [(r.error as { message: string }).message]));
      if (waitlist) {
        expect(ok.sort()).toEqual(['pending_members', 'waitlisted']);
        expect(await counters(event)).toMatchObject({ teams_taken: 2, team_waitlist_count: 1 });
      } else {
        expect([ok, errors]).toEqual([['pending_members'], ['team_event_full']]);
        expect(await counters(event)).toMatchObject({ teams_taken: 2, team_waitlist_count: 0 });
      }
      const seats = (await admin(`select count(*)::int as n from public.team_event_registrations
                                  where event_id = $1 and status in ('pending_members', 'pending_review', 'confirmed')`, [event])).rows[0].n;
      expect(seats).toBe(2); // never three
    }
  });

  it('two teams race to put the same person on their rosters → one succeeds, the other 409 member_already_registered', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org);
    const capA = await createUser(); const capB = await createUser(); const shared = await createUser({ age: 17 });
    const teamA = await createTeam(capA, [shared]); const teamB = await createTeam(capB, [shared]);
    const { blocked, results } = await race(event, [
      () => submit(capA, event, teamA, [capA, shared]),
      () => submit(capB, event, teamB, [capB, shared]),
    ]);
    expect(blocked).toBe(2);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.flatMap((r) => (r.ok ? [] : [(r.error as { message: string }).message]))).toEqual(['member_already_registered']);
    expect(count(await admin(`select 1 from public.team_event_registration_members where user_id = $1 and state in ('invited', 'accepted')`, [shared]))).toBe(1);
  });

  it('an invited member cannot also register individually (409 already_on_team_roster); after declining they can; individual first still blocks the team', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { registration_mode: 'both', capacity: 10 });
    const captain = await createUser(); const invited = await createUser(); const solo = await createUser();
    const team = await createTeam(captain, [invited, solo]);
    const reg = await submit(captain, event, team, [captain, invited]);
    await expectFail(register(invited, event), 409, 'already_on_team_roster');
    // a waitlisted team's roster counts too
    await admin(`update public.team_event_registrations set status = 'waitlisted', hold_expires_at = null where id = $1`, [reg.id]);
    await expectFail(register(invited, event), 409, 'already_on_team_roster');
    await admin(`update public.team_event_registrations set status = 'pending_members', hold_expires_at = now() + interval '1 day' where id = $1`, [reg.id]);
    // decline (Task 3 RPC) simulated: the roster row is no longer live → individual registration is allowed
    await admin(`update public.team_event_registration_members set state = 'declined', responded_at = now() where team_registration_id = $1 and user_id = $2`, [reg.id, invited]);
    expect((await register(invited, event)).status).toBe('confirmed');
    // individual first, then a team submit naming them → refused, as before
    await register(solo, event);
    const other = await createUser(); const team2 = await createTeam(other, [solo]);
    expect(await failsWithIds(submit(other, event, team2, [other, solo]), 409, 'member_already_registered')).toEqual([solo]);
    expect(await counters(event)).toEqual({ seats_taken: 2, waitlist_count: 0, teams_taken: 1, team_waitlist_count: 0 });
  });

  it('a lapsed guardian request does not keep a member’s individual pending_guardian registration in the way', async () => {
    const org = await createOrg();
    const event = await createTeamEvent(org, { registration_mode: 'both', capacity: 10, guardian_required_under: 18 });
    const captain = await createUser(); const minor = await createUser({ age: 16 });
    const team = await createTeam(captain, [minor]);
    const solo = await register(minor, event);
    expect(solo.status).toBe('pending_guardian');
    await admin(`insert into public.guardian_requests (user_id, consent_purpose, subject_type, subject_id, guardian_email, policy_version, expires_at)
                 values ($1, 'event_participation', 'event_registration', $2, 'veli@example.test', 'v1', now() - interval '1 minute')`, [minor, solo.id]);
    const reg = await submit(captain, event, team, [captain, minor]);
    expect(reg.status).toBe('pending_members');
    expect((await admin(`select status from public.event_registrations where id = $1`, [solo.id])).rows[0].status).toBe('expired');
    expect((await admin(`select status from public.guardian_requests where subject_id = $1`, [solo.id])).rows[0].status).toBe('expired');
  });

  it('event_eligibility lists only teams where the caller is an active captain or mentor, with active_member_count', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_capacity: 3 });
    const me = await createUser(); const a = await createUser(); const b = await createUser(); const pending = await createUser();
    const captainTeam = await createTeam(me, [a, b]);
    await addMember(captainTeam, pending, 'member', 'pending'); // not active → not counted
    const mentorCap = await createUser(); const mentorTeam = await createTeam(mentorCap); await addMember(mentorTeam, me, 'mentor');
    const memberCap = await createUser(); const memberTeam = await createTeam(memberCap); await addMember(memberTeam, me, 'member');
    const leftCap = await createUser(); const leftTeam = await createTeam(leftCap); await addMember(leftTeam, me, 'captain', 'left');
    const suspCap = await createUser(); const suspended = await createTeam(suspCap); await addMember(suspended, me, 'mentor');
    await admin(`update public.teams set moderation_status = 'suspended' where id = $1`, [suspended]);
    const reg = await submit(mentorCap, event, mentorTeam, [mentorCap]);

    const elig = (await asUser(me, (q) => q(`select public.event_eligibility($1) as e`, [event]))).rows[0].e;
    // the individual contract is unchanged (mobile reads it today)
    expect(elig).toMatchObject({ event_id: event, authenticated: true, eligible: false, reasons: ['team_registration_only'], registration_id: null });
    expect(elig).toMatchObject({ registration_mode: 'team', team_seats_left: 2 });
    expect(elig.manageable_teams).toEqual([
      { team_id: captainTeam, name: 'Test Takımı', role: 'captain', active_member_count: 3, registration_id: null, registration_status: null },
      { team_id: mentorTeam, name: 'Test Takımı', role: 'mentor', active_member_count: 2, registration_id: reg.id, registration_status: 'pending_members' },
    ].sort((x, y) => (x.team_id < y.team_id ? -1 : 1)));
    // a plain member / anon see no manageable team; no team pool → team_seats_left null
    expect((await asUser(a, (q) => q(`select public.event_eligibility($1) as e`, [event]))).rows[0].e.manageable_teams).toEqual([]);
    const anon = (await asAnon((q) => q(`select public.event_eligibility($1) as e`, [event]))).rows[0].e;
    expect(anon).toMatchObject({ authenticated: false, manageable_teams: [], registration_mode: 'team' });
    const open = await createTeamEvent(org, { team_capacity: null });
    expect((await asUser(me, (q) => q(`select public.event_eligibility($1) as e`, [open]))).rows[0].e.team_seats_left).toBeNull();
  });
});

describe('team registration · waitlist promotion', () => {
  const promote = (eventId: string) =>
    admin(`select app.promote_team_waitlist(e) from public.events e where e.id = $1 for update`, [eventId]);

  it('promote_team_waitlist: a freed seat goes to the oldest waitlisted team, with a fresh hold', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_capacity: 1 });
    const caps = await Promise.all([createUser(), createUser(), createUser()]);
    const teams = await Promise.all(caps.map((c) => createTeam(c)));
    const regs: Submitted[] = [];
    for (let i = 0; i < 3; i += 1) regs.push(await submit(caps[i]!, event, teams[i]!, [caps[i]!]));
    expect(regs.map((r) => r.status)).toEqual(['pending_members', 'waitlisted', 'waitlisted']);
    await promote(event); // no free seat → nothing moves
    expect(await counters(event)).toMatchObject({ teams_taken: 1, team_waitlist_count: 2 });

    await admin(`update public.team_event_registrations set status = 'cancelled', cancelled_at = now() where id = $1`, [regs[0]!.id]);
    await promote(event);
    const rows = (await admin(`select id, status, hold_expires_at, status_reason from public.team_event_registrations where event_id = $1 order by created_at, id`, [event])).rows;
    expect(rows.map((r) => r.status)).toEqual(['cancelled', 'pending_members', 'waitlisted']);
    expect(rows[1]).toMatchObject({ id: regs[1]!.id, status_reason: 'promoted_from_waitlist' });
    expect(rows[1].hold_expires_at).not.toBeNull();
    expect(await counters(event)).toMatchObject({ teams_taken: 1, team_waitlist_count: 1 });
    expect(count(await admin(`select 1 from public.audit_events where target_id = $1 and action = 'team_registration.promoted'`, [regs[1]!.id]))).toBe(1);
  });

  it('promote_team_waitlist does nothing once registration has closed, and is not callable by API roles', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_capacity: 1 });
    const c1 = await createUser(); const c2 = await createUser();
    const r1 = await submit(c1, event, await createTeam(c1), [c1]); const r2 = await submit(c2, event, await createTeam(c2), [c2]);
    await admin(`update public.team_event_registrations set status = 'cancelled', cancelled_at = now() where id = $1`, [r1.id]);
    await admin(`update public.events set registration_closes_at = now() - interval '1 minute' where id = $1`, [event]);
    await promote(event);
    expect((await admin(`select status from public.team_event_registrations where id = $1`, [r2.id])).rows[0].status).toBe('waitlisted');
    for (const call of [asUser(c1, (q) => q(`select app.promote_team_waitlist(e) from public.events e where e.id = $1`, [event])),
                        asService((q) => q(`select app.promote_team_waitlist(e) from public.events e where e.id = $1`, [event]))]) {
      await expect(call).rejects.toThrow(PERMISSION_DENIED);
    }
  });
});

// ---------------------------------------------------------------- Task 3: members answer, guardian flow, roster edits, cancel, expiry
// Each member consents for THEMSELVES (respond_team_registration → their own event_registrations row + 'self' consent; a minor's
// row waits for the existing guardian flow). The team status is derived on the server (app.recompute_team_registration):
// every row of the current roster version accepted + confirmed and the size within team_min_size..team_max_size → confirmed
// (pending_review when the event requires review), otherwise pending_members. The active captain OR mentor edits / cancels
// (user decision 13 Nov 2026). A card / check-in needs the TEAM confirmed. No payload carries an e-mail, a birth date or a
// guardian detail; display names go only to the member's own team.

type Respond = { member_state: string; registration_id: string | null; registration_status: string | null; team_status: string };

const respond = (userId: string, memberId: string, accept: boolean, key: string = randomUUID()) =>
  asUser(userId, async (q) => (await q(`select public.respond_team_registration($1, $2, $3) r`, [memberId, accept, key])).rows[0].r as Respond);

const updateRoster = (userId: string, teamRegId: string, memberIds: string[], version: number) =>
  asUser(userId, async (q) => (await q(`select * from public.update_team_roster($1, $2::uuid[], $3)`, [teamRegId, memberIds, version])).rows[0] as Submitted);

const cancelTeam = (userId: string, teamRegId: string) =>
  asUser(userId, async (q) => (await q(`select * from public.cancel_team_registration($1)`, [teamRegId])).rows[0] as Submitted);

const detail = (userId: string, teamRegId: string) =>
  asUser(userId, async (q) => (await q(`select public.team_registration_detail($1) d`, [teamRegId])).rows[0].d);

const teamRow = async (teamRegId: string) =>
  (await admin(`select status, status_reason, roster_version, hold_expires_at, confirmed_at from public.team_event_registrations where id = $1`, [teamRegId])).rows[0];

/** The live (or latest) roster row of a person in a team registration. */
const memberRow = async (teamRegId: string, userId: string) =>
  (await admin(`select id, state, registration_id, roster_version from public.team_event_registration_members
                where team_registration_id = $1 and user_id = $2 order by created_at desc, id limit 1`, [teamRegId, userId])).rows[0];

const regRow = async (regId: string) =>
  (await admin(`select status, status_reason, team_registration_id, team_id from public.event_registrations where id = $1`, [regId])).rows[0];

const kindsOf = async (userId: string) =>
  (await admin(`select kind from public.notifications where user_id = $1 order by created_at, id`, [userId])).rows.map((r) => r.kind as string);

/** Submit as the first id (the captain), then let the listed people accept. Returns the team registration + roster row ids. */
async function submitted(captain: string, eventId: string, teamId: string, memberIds: string[]) {
  const reg = await submit(captain, eventId, teamId, memberIds);
  const rows: Record<string, string> = {};
  for (const id of memberIds) rows[id] = (await memberRow(reg.id, id)).id;
  return { reg, rows };
}

/** Minor asks a guardian; the mailer path issues a token; the guardian approves (or denies) on the anonymous page. */
async function guardianDecides(minor: string, registrationId: string, approve = true) {
  // a unique guardian address: issue_guardian_token limits sends per RECIPIENT per day across all tests (guardian_limits)
  const reqId = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, $2, 'Veli Kişi') id`, [registrationId, `veli-${randomUUID()}@example.test`]))).rows[0].id;
  const issued = (await asService((q) => q(`select public.issue_guardian_token($1) j`, [reqId]))).rows[0].j;
  const policy = (await admin(`select policy_version from public.guardian_requests where id = $1`, [reqId])).rows[0].policy_version;
  await asAnon((q) => q(`select public.guardian_decide($1, $2, 'Ayşe Demir', $3)`, [issued.token, approve, policy]));
  return reqId as string;
}

describe('team registration · members', () => {
  it('16-year-old accepts → own registration pending_guardian with team_registration_id; create_guardian_request + guardian_decide(approve) → confirmed; team confirmed when all ready', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { guardian_required_under: 18 });
    const captain = await createUser(); const minor = await createUser({ age: 16 });
    const team = await createTeam(captain, [minor]);
    const { reg, rows } = await submitted(captain, event, team, [captain, minor]);

    expect(await respond(captain, rows[captain]!, true)).toMatchObject({ member_state: 'accepted', registration_status: 'confirmed', team_status: 'pending_members' });
    const answer = await respond(minor, rows[minor]!, true);
    expect(answer).toMatchObject({ member_state: 'accepted', registration_status: 'pending_guardian', team_status: 'pending_members' });
    expect(await regRow(answer.registration_id!)).toMatchObject({ status: 'pending_guardian', team_registration_id: reg.id, team_id: team });
    expect((await admin(`select granted_by, subject_type from public.consents where subject_id = $1`, [answer.registration_id])).rows)
      .toEqual([{ granted_by: 'self', subject_type: 'event_registration' }]);
    expect((await teamRow(reg.id)).status).toBe('pending_members');

    await guardianDecides(minor, answer.registration_id!);
    expect((await regRow(answer.registration_id!)).status).toBe('confirmed');
    const team1 = await teamRow(reg.id);
    expect(team1.status).toBe('confirmed');
    expect(team1.confirmed_at).not.toBeNull();
    expect(await counters(event)).toEqual({ seats_taken: 0, waitlist_count: 0, teams_taken: 1, team_waitlist_count: 0 });

    // notifications: the minor is invited (the submitting captain is not told about their own action); the member's own
    // "registration confirmed" is replaced by the team-level one, which both receive
    expect(await kindsOf(minor)).toEqual(['team_registration.invited', 'team_registration.confirmed']);
    expect(await kindsOf(captain)).toEqual(['team_registration.confirmed']);
    const note = (await admin(`select target_type, target_id, title, body from public.notifications where user_id = $1 and kind = 'team_registration.confirmed'`, [minor])).rows[0];
    expect(note).toMatchObject({ target_type: 'team_event_registration', target_id: reg.id });
    expect(`${note.title} ${note.body}`).toContain('Test Etkinliği');
  });

  it('adult accepts → registration confirmed, self consent row (subject_type event_registration); team stays pending_members until everyone is ready', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { guardian_required_under: 18 });
    const captain = await createUser(); const adult = await createUser(); const later = await createUser();
    const team = await createTeam(captain, [adult, later]);
    const { reg, rows } = await submitted(captain, event, team, [captain, adult, later]);

    const key = randomUUID();
    const first = await respond(adult, rows[adult]!, true, key);
    expect(first).toMatchObject({ member_state: 'accepted', registration_status: 'confirmed', team_status: 'pending_members' });
    expect((await admin(`select user_id, purpose, granted_by, subject_type, withdrawn_at from public.consents where subject_id = $1`, [first.registration_id])).rows)
      .toEqual([{ user_id: adult, purpose: 'event_participation', granted_by: 'self', subject_type: 'event_registration', withdrawn_at: null }]);
    // idempotent: the same key, or another key once accepted, returns the same registration
    expect((await respond(adult, rows[adult]!, true, key)).registration_id).toBe(first.registration_id);
    expect((await respond(adult, rows[adult]!, true)).registration_id).toBe(first.registration_id);
    expect(count(await admin(`select 1 from public.event_registrations where user_id = $1 and event_id = $2`, [adult, event]))).toBe(1);

    await respond(captain, rows[captain]!, true);
    expect((await teamRow(reg.id)).status).toBe('pending_members'); // `later` has not answered
    await respond(later, rows[later]!, true);
    expect((await teamRow(reg.id)).status).toBe('confirmed');
  });

  it('captain cannot respond for another member → 403 not_invite_owner', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org);
    const captain = await createUser(); const mentor = await createUser(); const member = await createUser();
    const team = await createTeam(captain, [member]); await addMember(team, mentor, 'mentor');
    const { rows } = await submitted(captain, event, team, [captain, member]);
    for (const user of [captain, mentor]) {
      await expectFail(respond(user, rows[member]!, true), 403, 'not_invite_owner');
      await expectFail(respond(user, rows[member]!, false), 403, 'not_invite_owner');
    }
    await expectFail(respond(member, randomUUID(), true), 404, 'team_registration_not_found');
    await expectFail(respond(member, rows[member]!, true, null as unknown as string), 422, 'idempotency_key_required');
    expect((await memberRow((await admin(`select team_registration_id from public.team_event_registration_members where id = $1`, [rows[member]])).rows[0].team_registration_id, member)).state).toBe('invited');
  });

  it('accept needs a known birth date (409 profile_incomplete); a waitlisted team can be declined but not accepted', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_capacity: 1, waitlist_enabled: true, guardian_required_under: 18 });
    const captain = await createUser(); const noBirth = await createUser({ age: null });
    const team = await createTeam(captain, [noBirth]);
    const { rows } = await submitted(captain, event, team, [captain, noBirth]);
    await expectFail(respond(noBirth, rows[noBirth]!, true), 409, 'profile_incomplete');

    const cap2 = await createUser(); const m2 = await createUser(); const team2 = await createTeam(cap2, [m2]);
    const second = await submitted(cap2, event, team2, [cap2, m2]);
    expect(second.reg.status).toBe('waitlisted');
    expect(await kindsOf(m2)).toEqual([]); // invited only once the team holds a seat
    await expectFail(respond(m2, second.rows[m2]!, true), 409, 'team_registration_waitlisted');
    expect(await respond(m2, second.rows[m2]!, false)).toMatchObject({ member_state: 'declined', registration_id: null });
    // a declined invite cannot be accepted afterwards
    await expectFail(respond(m2, second.rows[m2]!, true), 409, 'invite_not_pending');
  });

  it('member declines → team pending_members; update_team_roster with expected version replaces them; stale version → 409 roster_changed', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_min_size: 2, team_max_size: 4 });
    const captain = await createUser(); const mentor = await createUser(); const a = await createUser(); const b = await createUser(); const c = await createUser();
    const team = await createTeam(captain, [a, b, c]); await addMember(team, mentor, 'mentor');
    const { reg, rows } = await submitted(captain, event, team, [captain, a, b]);
    await respond(captain, rows[captain]!, true); await respond(a, rows[a]!, true);
    expect(await respond(b, rows[b]!, false)).toMatchObject({ member_state: 'declined', team_status: 'pending_members' });
    const afterDecline = await teamRow(reg.id);
    expect(afterDecline).toMatchObject({ status: 'pending_members', roster_version: 2 }); // a decline changes the roster
    expect(await kindsOf(captain)).toEqual(['team_registration.member_declined']);
    expect(await kindsOf(mentor)).toEqual(['team_registration.member_declined']);

    await expectFail(updateRoster(captain, reg.id, [captain, a, c], 1), 409, 'roster_changed'); // edited from an old screen
    await expectFail(updateRoster(a, reg.id, [captain, a, c], 2), 403, 'not_team_manager');
    await expectFail(updateRoster(captain, reg.id, [captain], 2), 422, 'team_size_out_of_range');
    const edited = await updateRoster(captain, reg.id, [captain, a, c], 2);
    expect(edited).toMatchObject({ id: reg.id, roster_version: 3, status: 'pending_members' });
    expect(await roster(reg.id)).toEqual(expect.arrayContaining([
      { user_id: captain, role_at_submit: 'captain', state: 'accepted', roster_version: 3 },
      { user_id: a, role_at_submit: 'member', state: 'accepted', roster_version: 3 },
      { user_id: c, role_at_submit: 'member', state: 'invited', roster_version: 3 },
      { user_id: b, role_at_submit: 'member', state: 'declined', roster_version: 2 },
    ]));
    expect(await kindsOf(c)).toEqual(['team_registration.invited']);
    await expectFail(updateRoster(captain, reg.id, [captain, a, c], 2), 409, 'roster_changed');

    // the mentor may edit too: dropping c (invited) → removed; the rest is ready → confirmed
    const byMentor = await updateRoster(mentor, reg.id, [captain, a], 3);
    expect(byMentor).toMatchObject({ roster_version: 4, status: 'confirmed' });
    expect((await memberRow(reg.id, c)).state).toBe('removed');
    // the same set again is no change (no new version)
    expect((await updateRoster(captain, reg.id, [a, captain], 4)).roster_version).toBe(4);
    // someone already in another live registration for this event cannot be added (member ids only in the detail)
    const other = await createUser(); const d = await createUser(); const teamD = await createTeam(other, [d]); await addMember(team, d);
    await submit(other, event, teamD, [other, d]);
    expect(await failsWithIds(updateRoster(captain, reg.id, [captain, a, d], 4), 409, 'member_already_registered')).toEqual([d]);
  });

  it('roster edit after registration_closes_at → 409 team_registration_closed', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org);
    const captain = await createUser(); const a = await createUser(); const team = await createTeam(captain, [a]);
    const { reg } = await submitted(captain, event, team, [captain]);
    await admin(`update public.events set registration_closes_at = now() - interval '1 minute' where id = $1`, [event]);
    await expectFail(updateRoster(captain, reg.id, [captain, a], 1), 409, 'team_registration_closed');
    // and a team registration that is no longer live cannot be edited either
    const event2 = await createTeamEvent(org); const r2 = await submitted(captain, event2, team, [captain]);
    await cancelTeam(captain, r2.reg.id);
    await expectFail(updateRoster(captain, r2.reg.id, [captain, a], 1), 409, 'team_registration_closed');
    await expectFail(updateRoster(captain, randomUUID(), [captain], 1), 404, 'team_registration_not_found');
  });

  it('member leaves the team after accepting → member removed, registration cancelled, consents withdrawn, team pending_members', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org);
    const captain = await createUser(); const a = await createUser(); const b = await createUser();
    const team = await createTeam(captain, [a, b]);
    const { reg, rows } = await submitted(captain, event, team, [captain, a, b]);
    const answers: Record<string, Respond> = {};
    for (const u of [captain, a, b]) answers[u] = await respond(u, rows[u]!, true);
    expect((await teamRow(reg.id)).status).toBe('confirmed');

    await asUser(a, (q) => q(`select public.leave_team($1)`, [team]));
    expect((await memberRow(reg.id, a)).state).toBe('removed');
    expect(await regRow(answers[a]!.registration_id!)).toMatchObject({ status: 'cancelled', status_reason: 'team_member_left' });
    expect(count(await admin(`select 1 from public.consents where subject_id = $1 and withdrawn_at is null`, [answers[a]!.registration_id]))).toBe(0);
    const t = await teamRow(reg.id);
    expect(t).toMatchObject({ status: 'pending_members', roster_version: 2, confirmed_at: null });
    expect(new Date(t.hold_expires_at).getTime()).toBeGreaterThan(Date.now());
    await expectFail(asUser(a, (q) => q(`select public.get_participation_card($1)`, [answers[a]!.registration_id])), 409, 'registration_not_confirmed');
    // Review Focus 3: the captain was editing the version from before the leave → refused, not silently overwritten
    await expectFail(updateRoster(captain, reg.id, [captain, a, b], 1), 409, 'roster_changed');

    // removal by the captain behaves the same
    const bMembership = (await admin(`select id from public.team_memberships where team_id = $1 and user_id = $2`, [team, b])).rows[0].id;
    await asUser(captain, (q) => q(`select public.remove_team_member($1)`, [bMembership]));
    expect((await memberRow(reg.id, b)).state).toBe('removed');
    expect(await regRow(answers[b]!.registration_id!)).toMatchObject({ status: 'cancelled', status_reason: 'team_member_removed' });
    expect((await teamRow(reg.id)).status).toBe('pending_members');
    // the captain drops the holes → only ready members left → confirmed
    expect((await updateRoster(captain, reg.id, [captain], 3)).status).toBe('confirmed');
  });

  it('member of an unconfirmed team: get_participation_card → 409 team_registration_not_confirmed; check_in_participant refuses', async () => {
    const staff = await createUser(); const org = await createOrg({ [staff]: 'checkin_staff' });
    const event = await createTeamEvent(org, {
      starts_at: new Date(Date.now() + 36e5), ends_at: new Date(Date.now() + 6 * 36e5), registration_closes_at: new Date(Date.now() + 30 * 6e4) });
    const captain = await createUser(); const a = await createUser(); const team = await createTeam(captain, [a]);
    const { reg, rows } = await submitted(captain, event, team, [captain, a]);
    const mine = await respond(captain, rows[captain]!, true);
    expect(mine.registration_status).toBe('confirmed');
    await expectFail(asUser(captain, (q) => q(`select public.get_participation_card($1)`, [mine.registration_id])), 409, 'team_registration_not_confirmed');
    const token = (await admin(`select app.ticket_token(r) t from public.event_registrations r where r.id = $1`, [mine.registration_id])).rows[0].t;
    await expectFail(asUser(staff, (q) => q(`select public.check_in_participant($1)`, [token])), 409, 'team_registration_not_confirmed');
    expect(count(await admin(`select 1 from public.event_check_ins where registration_id = $1`, [mine.registration_id]))).toBe(0);

    await respond(a, rows[a]!, true);
    expect((await teamRow(reg.id)).status).toBe('confirmed');
    const card = (await asUser(captain, (q) => q(`select public.get_participation_card($1) c`, [mine.registration_id]))).rows[0].c;
    expect(card.qr_payload).toBe(token);
    expect((await asUser(staff, (q) => q(`select public.check_in_participant($1) j`, [token]))).rows[0].j.result).toBe('checked_in');
  });

  it('requires_review event: complete team → pending_review (members stay confirmed individually)', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { requires_review: true });
    const captain = await createUser(); const a = await createUser(); const team = await createTeam(captain, [a]);
    const { reg, rows } = await submitted(captain, event, team, [captain, a]);
    const ra = await respond(captain, rows[captain]!, true); const rb = await respond(a, rows[a]!, true);
    expect([ra.registration_status, rb.registration_status]).toEqual(['confirmed', 'confirmed']);
    expect((await teamRow(reg.id)).status).toBe('pending_review');
    expect(await counters(event)).toMatchObject({ teams_taken: 1, seats_taken: 0 });
    // still no card while the organiser has not decided
    await expectFail(asUser(a, (q) => q(`select public.get_participation_card($1)`, [rb.registration_id])), 409, 'team_registration_not_confirmed');
  });

  it('team_registration_detail: a member sees display names of their own team only; no email, birth_date or guardian fields anywhere in the payload', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { guardian_required_under: 18 });
    const captain = await createUser({ name: 'Kaptan Kerem' }); const minor = await createUser({ age: 15, name: 'Gizli Genç' });
    const invited = await createUser({ name: 'Davetli Deniz' }); const bench = await createUser({ name: 'Yedek Yaren' });
    const leaver = await createUser({ name: 'Ayrılan Arda' }); const mentor = await createUser({ name: 'Mentor Melis' });
    const pa = await createUser(); await admin(`insert into public.platform_admins (user_id) values ($1)`, [pa]);
    const team = await createTeam(captain, [minor, invited, bench, leaver]); await addMember(team, mentor, 'mentor');
    const { reg, rows } = await submitted(captain, event, team, [captain, minor, invited, leaver]);
    await respond(captain, rows[captain]!, true);
    const m = await respond(minor, rows[minor]!, true);
    await asUser(minor, (q) => q(`select public.create_guardian_request($1, 'veli.gizli@example.test', 'Veli Gizli')`, [m.registration_id]));

    const names = (d: { members: { display_name: string; step: string; state: string; role_at_submit: string }[] }) =>
      Object.fromEntries(d.members.map((x) => [x.display_name, [x.role_at_submit, x.state, x.step]]));
    const noPii = (d: unknown, extra: string[] = []) => {
      const text = JSON.stringify(d);
      for (const forbidden of ['@', 'birth', 'guardian_', 'email', 'Veli Gizli', 'veli.gizli', 'Yedek Yaren', 'Mentor Melis',
                               String(new Date().getFullYear() - 15), ...extra]) {
        expect([forbidden, text.includes(forbidden)]).toEqual([forbidden, false]);
      }
    };
    for (const viewer of [captain, minor, bench, mentor]) {
      const d = await detail(viewer, reg.id);
      expect(d).toMatchObject({ id: reg.id, status: 'pending_members', roster_version: 1,
        event: { id: event, title: 'Test Etkinliği' }, team: { id: team, name: 'Test Takımı' }, can_edit: viewer === captain || viewer === mentor });
      expect(d.hold_expires_at).not.toBeNull();
      expect(names(d)).toEqual({ 'Kaptan Kerem': ['captain', 'accepted', 'ready'], 'Gizli Genç': ['member', 'accepted', 'guardian'],
                                 'Davetli Deniz': ['member', 'invited', 'invited'], 'Ayrılan Arda': ['member', 'invited', 'invited'] });
      noPii(d);
      expect(Object.keys(d.members[0]).sort()).toEqual(['display_name', 'member_id', 'role_at_submit', 'state', 'step', 'user_id']);
      // user_id: managers (captain, mentor) see the members' ids, a plain member sees null
      const ids = d.members.map((x: { user_id: string | null }) => x.user_id);
      if (viewer === captain || viewer === mentor) expect([...ids].sort()).toEqual([captain, minor, invited, leaver].sort());
      else expect(ids).toEqual([null, null, null, null]);
    }
    // another team's member, the organisation and an outsider: not found (no names, no existence oracle)
    const staff = await createUser(); await admin(`insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')`, [org, staff]);
    const otherCap = await createUser(); await createTeam(otherCap);
    for (const viewer of [staff, otherCap, await createUser()]) await expectFail(detail(viewer, reg.id), 404, 'team_registration_not_found');

    // my_team_registration_invites: only my open invites, ids + event + team name
    const invites = (await asUser(invited, (q) => q(`select * from public.my_team_registration_invites() j`))).rows.map((r) => r.j);
    expect(invites).toEqual([{ member_id: rows[invited], team_registration_id: reg.id, state: 'invited', team_status: 'pending_members',
      hold_expires_at: expect.any(String), event: { id: event, title: 'Test Etkinliği', starts_at: expect.any(String) }, team: { id: team, name: 'Test Takımı' } }]);
    expect((await asUser(captain, (q) => q(`select * from public.my_team_registration_invites() j`))).rowCount).toBe(0);
    await expect(asAnon((q) => q(`select public.team_registration_detail($1)`, [reg.id]))).rejects.toThrow(PERMISSION_DENIED);

    // one declines, one leaves the team: their names go to the captain, the mentor and platform admins only
    await respond(invited, rows[invited]!, false);
    await asUser(leaver, (q) => q(`select public.leave_team($1)`, [team]));
    for (const viewer of [minor, bench]) {
      const d = await detail(viewer, reg.id);
      expect(names(d)).toEqual({ 'Kaptan Kerem': ['captain', 'accepted', 'ready'], 'Gizli Genç': ['member', 'accepted', 'guardian'] });
      noPii(d, ['Davetli Deniz', 'Ayrılan Arda']);
    }
    for (const viewer of [captain, mentor, pa]) {
      const d = await detail(viewer, reg.id);
      expect(names(d)).toEqual({ 'Kaptan Kerem': ['captain', 'accepted', 'ready'], 'Gizli Genç': ['member', 'accepted', 'guardian'],
                                 'Davetli Deniz': ['member', 'declined', 'declined'], 'Ayrılan Arda': ['member', 'removed', 'declined'] });
      noPii(d);
    }
    await expectFail(detail(leaver, reg.id), 404, 'team_registration_not_found'); // no longer in the team
  });

  it('a confirmed team that falls back (before close) refuses the card again', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org);
    const captain = await createUser(); const a = await createUser(); const team = await createTeam(captain, [a]);
    const { reg, rows } = await submitted(captain, event, team, [captain, a]);
    const mine = await respond(captain, rows[captain]!, true); await respond(a, rows[a]!, true);
    expect((await asUser(captain, (q) => q(`select public.get_participation_card($1) c`, [mine.registration_id]))).rows[0].c.registration_id).toBe(mine.registration_id);
    await asUser(a, (q) => q(`select public.leave_team($1)`, [team]));
    expect((await teamRow(reg.id)).status).toBe('pending_members');
    await expectFail(asUser(captain, (q) => q(`select public.get_participation_card($1)`, [mine.registration_id])), 409, 'team_registration_not_confirmed');
  });

  it('dropping an accepted member from a confirmed team: one recompute — no second confirmation, confirmed_at unchanged', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { requires_review: true });
    const captain = await createUser(); const a = await createUser(); const b = await createUser();
    const team = await createTeam(captain, [a, b]);
    const { reg, rows } = await submitted(captain, event, team, [captain, a, b]);
    const answers: Record<string, Respond> = {};
    for (const u of [captain, a, b]) answers[u] = await respond(u, rows[u]!, true);
    expect((await teamRow(reg.id)).status).toBe('pending_review');
    // the organiser approves (Task 4 RPC simulated)
    await admin(`update public.team_event_registrations set status = 'confirmed', confirmed_at = now() - interval '1 hour', status_reason = 'approved' where id = $1`, [reg.id]);
    const before = await teamRow(reg.id);
    const after = await updateRoster(captain, reg.id, [captain, a], 1);
    expect(after).toMatchObject({ status: 'confirmed', roster_version: 2 }); // not back to pending_review
    expect((await teamRow(reg.id)).confirmed_at).toEqual(before.confirmed_at);
    expect(await regRow(answers[b]!.registration_id!)).toMatchObject({ status: 'cancelled', status_reason: 'team_roster_changed' });
    for (const u of [captain, a]) {
      expect([u, (await kindsOf(u)).filter((k) => k === 'team_registration.confirmed').length]).toEqual([u, 1]);
    }
    expect(count(await admin(`select 1 from public.audit_events where target_id = $1 and action = 'team_registration.status_changed' and metadata->>'to' = 'pending_members'`, [reg.id]))).toBe(0);
  });
});

describe('team registration · lifecycle', () => {
  it('captain cancels → every member registration cancelled, pending guardian requests revoked, teams_taken −1, first waitlisted team promoted to pending_members', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_capacity: 1, waitlist_enabled: true, guardian_required_under: 18 });
    const captain = await createUser(); const minor = await createUser({ age: 16 }); const member = await createUser();
    const team = await createTeam(captain, [minor, member]);
    const { reg, rows } = await submitted(captain, event, team, [captain, minor]);
    const capReg = await respond(captain, rows[captain]!, true); const minorReg = await respond(minor, rows[minor]!, true);
    const reqId = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, 'veli@example.test') id`, [minorReg.registration_id]))).rows[0].id;
    const cap2 = await createUser(); const m2 = await createUser(); const team2 = await createTeam(cap2, [m2]);
    const waiting = await submitted(cap2, event, team2, [cap2, m2]);
    expect(waiting.reg.status).toBe('waitlisted');
    expect(await counters(event)).toMatchObject({ teams_taken: 1, team_waitlist_count: 1 });

    await expectFail(cancelTeam(member, reg.id), 403, 'not_team_manager');
    const cancelled = await cancelTeam(captain, reg.id);
    expect(cancelled).toMatchObject({ id: reg.id, status: 'cancelled' });
    for (const r of [capReg, minorReg]) expect(await regRow(r.registration_id!)).toMatchObject({ status: 'cancelled', status_reason: 'team_registration_cancelled' });
    expect((await admin(`select status from public.guardian_requests where id = $1`, [reqId])).rows[0].status).toBe('revoked');
    expect(count(await admin(`select 1 from public.consents where subject_id = any($1::uuid[]) and withdrawn_at is null`, [[capReg.registration_id, minorReg.registration_id]]))).toBe(0);
    const promoted = await teamRow(waiting.reg.id);
    expect(promoted).toMatchObject({ status: 'pending_members', status_reason: 'promoted_from_waitlist' });
    expect(promoted.hold_expires_at).not.toBeNull();
    expect(await counters(event)).toEqual({ seats_taken: 0, waitlist_count: 0, teams_taken: 1, team_waitlist_count: 0 });
    expect(await kindsOf(m2)).toEqual(['team_registration.invited']); // told once the team holds a seat
    // idempotent: cancelling again returns the cancelled row
    expect((await cancelTeam(captain, reg.id)).status).toBe('cancelled');
    // the cancelled team's members may now answer nothing, and may register with another roster later
    await expectFail(respond(member, rows[minor]!, true), 403, 'not_invite_owner');
  });

  it('expire_team_registrations: pending_members past hold_expires_at → expired, member registrations expired, guardian requests revoked, waitlist promoted; confirmed teams untouched', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_capacity: 2, waitlist_enabled: true, guardian_required_under: 18 });
    const c1 = await createUser(); const minor = await createUser({ age: 16 }); const t1 = await createTeam(c1, [minor]);
    const late = await submitted(c1, event, t1, [c1, minor]);
    const r1 = await respond(c1, late.rows[c1]!, true); const rm = await respond(minor, late.rows[minor]!, true);
    const reqId = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, 'veli@example.test') id`, [rm.registration_id]))).rows[0].id;
    const c2 = await createUser(); const t2 = await createTeam(c2);
    const done = await submitted(c2, event, t2, [c2]); await respond(c2, done.rows[c2]!, true);
    expect((await teamRow(done.reg.id)).status).toBe('confirmed');
    const c3 = await createUser(); const t3 = await createTeam(c3);
    const queued = await submitted(c3, event, t3, [c3]);
    expect(queued.reg.status).toBe('waitlisted');
    // also hold the confirmed team's hold in the past: confirmed is never expired
    await admin(`update public.team_event_registrations set hold_expires_at = now() - interval '1 minute' where id = any($1::uuid[])`, [[late.reg.id, done.reg.id]]);

    const n = (await admin(`select app.expire_team_registrations() n`)).rows[0].n;
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await teamRow(late.reg.id)).toMatchObject({ status: 'expired', status_reason: 'hold_expired' });
    for (const r of [r1, rm]) expect(await regRow(r.registration_id!)).toMatchObject({ status: 'expired', status_reason: 'team_registration_expired' });
    expect((await admin(`select status from public.guardian_requests where id = $1`, [reqId])).rows[0].status).toBe('revoked');
    expect((await teamRow(done.reg.id)).status).toBe('confirmed');
    expect(await teamRow(queued.reg.id)).toMatchObject({ status: 'pending_members', status_reason: 'promoted_from_waitlist' });
    expect(await counters(event)).toMatchObject({ teams_taken: 2, team_waitlist_count: 0 });
    // the team-level message replaces the member-level "veli onayı zamanında gelmedi"
    expect(await kindsOf(minor)).toEqual(['team_registration.invited', 'team_registration.expired']);
    expect(await kindsOf(c1)).toEqual(['team_registration.expired']);
    // a second run finds nothing more for these rows
    await admin(`select app.expire_team_registrations()`);
    expect((await teamRow(late.reg.id)).status).toBe('expired');

    // waitlisted rows are closed out once registration has closed (nobody can be promoted any more)
    const closing = await createTeamEvent(org, { team_capacity: 1, waitlist_enabled: true });
    const k1 = await createUser(); const k2 = await createUser();
    await submit(k1, closing, await createTeam(k1), [k1]);
    const stuck = await submit(k2, closing, await createTeam(k2), [k2]);
    expect(stuck.status).toBe('waitlisted');
    await admin(`update public.events set registration_closes_at = now() - interval '1 minute' where id = $1`, [closing]);
    await admin(`select app.expire_team_registrations()`);
    expect(await teamRow(stuck.id)).toMatchObject({ status: 'expired', status_reason: 'registration_closed' });
    expect(await counters(closing)).toMatchObject({ team_waitlist_count: 0 });

    await expect(asUser(c1, (q) => q(`select app.expire_team_registrations()`))).rejects.toThrow(PERMISSION_DENIED);
    await expect(asService((q) => q(`select app.recompute_team_registration($1)`, [late.reg.id]))).rejects.toThrow(PERMISSION_DENIED);
  });

  it('member cancels own registration via cancel_event_registration → member declined, team pending_members (seat kept until hold expiry)', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org);
    const captain = await createUser(); const a = await createUser(); const team = await createTeam(captain, [a]);
    const { reg, rows } = await submitted(captain, event, team, [captain, a]);
    await respond(captain, rows[captain]!, true); const ra = await respond(a, rows[a]!, true);
    expect((await teamRow(reg.id)).status).toBe('confirmed');
    await asUser(a, (q) => q(`select public.cancel_event_registration($1)`, [ra.registration_id]));
    expect((await memberRow(reg.id, a)).state).toBe('declined');
    const t = await teamRow(reg.id);
    expect(t.status).toBe('pending_members');
    expect(new Date(t.hold_expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(await counters(event)).toMatchObject({ teams_taken: 1 });
    expect(await kindsOf(captain)).toEqual(['team_registration.confirmed', 'team_registration.member_declined']);
  });

  it('guardian denies → the member is declined and the team waits for a roster edit', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { guardian_required_under: 18 });
    const captain = await createUser(); const minor = await createUser({ age: 14 }); const team = await createTeam(captain, [minor]);
    const { reg, rows } = await submitted(captain, event, team, [captain, minor]);
    await respond(captain, rows[captain]!, true); const rm = await respond(minor, rows[minor]!, true);
    await guardianDecides(minor, rm.registration_id!, false);
    expect(await regRow(rm.registration_id!)).toMatchObject({ status: 'cancelled', status_reason: 'guardian_denied' });
    expect((await memberRow(reg.id, minor)).state).toBe('declined');
    expect(await teamRow(reg.id)).toMatchObject({ status: 'pending_members', roster_version: 2 });
  });

  it('event cancelled → team rows cancelled too, counters recounted, nobody promoted', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_capacity: 1, waitlist_enabled: true });
    const c1 = await createUser(); const t1 = await createTeam(c1); const first = await submitted(c1, event, t1, [c1]);
    const r1 = await respond(c1, first.rows[c1]!, true);
    const c2 = await createUser(); const t2 = await createTeam(c2); const second = await submit(c2, event, t2, [c2]);
    expect(second.status).toBe('waitlisted');
    await admin(`update public.events set status = 'cancelled' where id = $1`, [event]);
    expect(await teamRow(first.reg.id)).toMatchObject({ status: 'cancelled', status_reason: 'event_cancelled' });
    expect(await teamRow(second.id)).toMatchObject({ status: 'cancelled', status_reason: 'event_cancelled' });
    expect(await regRow(r1.registration_id!)).toMatchObject({ status: 'cancelled', status_reason: 'event_cancelled' });
    expect((await memberRow(first.reg.id, c1)).state).toBe('accepted'); // history kept as it was
    expect(await counters(event)).toEqual({ seats_taken: 0, waitlist_count: 0, teams_taken: 0, team_waitlist_count: 0 });
    expect(await kindsOf(c1)).toEqual(['team_registration.confirmed', 'event.cancelled']);
  });

  it('account deletion of a roster member recomputes the team (the cascade cannot leave a stale status)', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_min_size: 2 });
    const captain = await createUser(); const a = await createUser(); const team = await createTeam(captain, [a]);
    const { reg, rows } = await submitted(captain, event, team, [captain, a]);
    await respond(captain, rows[captain]!, true); await respond(a, rows[a]!, true);
    expect((await teamRow(reg.id)).status).toBe('confirmed');
    await admin(`delete from auth.users where id = $1`, [a]);
    expect(await teamRow(reg.id)).toMatchObject({ status: 'pending_members', roster_version: 2 });
  });

  it('volunteer brief: confirmed counts only people who can check in; teams come from confirmed team registrations', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { registration_mode: 'both', capacity: 10, accepts_volunteers: true });
    const vol = await createUser(); await admin(`insert into public.event_volunteers (event_id, user_id, status) values ($1, $2, 'approved')`, [event, vol]);
    const solo = await createUser(); await register(solo, event);
    const captain = await createUser(); const a = await createUser(); const team = await createTeam(captain, [a]);
    const { reg, rows } = await submitted(captain, event, team, [captain, a]);
    await respond(captain, rows[captain]!, true);
    const brief = async () => (await asUser(vol, (q) => q(`select public.volunteer_event_brief($1) j`, [event]))).rows[0].j;
    expect((await brief()).stats).toMatchObject({ confirmed: 1, confirmed_individual: 1, confirmed_team_members: 0, confirmed_teams: 0, capacity: 10, team_capacity: 10 });
    expect((await brief()).teams).toEqual([]);
    await respond(a, rows[a]!, true);
    expect((await teamRow(reg.id)).status).toBe('confirmed');
    expect((await brief()).stats).toMatchObject({ confirmed: 3, confirmed_individual: 1, confirmed_team_members: 2, confirmed_teams: 1 });
    expect((await brief()).teams).toEqual([{ name: 'Test Takımı', category: null }]);
  });

  it('after close (user decision A): a confirmed team keeping team_min_size ready members stays confirmed; below it → pending_review roster_below_min_after_close, not expired at close, closed (expired) at ends_at', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_min_size: 3, team_max_size: 6 });
    const captain = await createUser(); const ms = [await createUser(), await createUser(), await createUser(), await createUser()];
    const team = await createTeam(captain, ms);
    const { reg, rows } = await submitted(captain, event, team, [captain, ...ms]);
    const regs: Record<string, string> = {};
    for (const u of [captain, ...ms]) regs[u] = (await respond(u, rows[u]!, true)).registration_id!;
    const confirmed = await teamRow(reg.id);
    expect(confirmed.status).toBe('confirmed');
    await admin(`update public.events set registration_closes_at = now() - interval '1 minute' where id = $1`, [event]);

    await asUser(ms[0]!, (q) => q(`select public.leave_team($1)`, [team]));           // 5 → 4 ready
    expect(await teamRow(reg.id)).toMatchObject({ status: 'confirmed', roster_version: 2, confirmed_at: confirmed.confirmed_at });
    const card = (await asUser(captain, (q) => q(`select public.get_participation_card($1) c`, [regs[captain]]))).rows[0].c;
    expect(card.registration_id).toBe(regs[captain]);
    await asUser(ms[1]!, (q) => q(`select public.cancel_event_registration($1)`, [regs[ms[1]!]])); // 3 ready = min
    expect((await teamRow(reg.id)).status).toBe('confirmed');
    await asUser(ms[2]!, (q) => q(`select public.leave_team($1)`, [team]));           // 2 ready < 3
    expect(await teamRow(reg.id)).toMatchObject({ status: 'pending_review', status_reason: 'roster_below_min_after_close', confirmed_at: null });
    await expectFail(asUser(captain, (q) => q(`select public.get_participation_card($1)`, [regs[captain]])), 409, 'team_registration_not_confirmed');
    expect(await counters(event)).toMatchObject({ teams_taken: 1 });

    await admin(`select app.expire_team_registrations()`);                              // no auto-expiry at close
    expect((await teamRow(reg.id)).status).toBe('pending_review');
    // still undecided when the event is over → expired
    await admin(`update public.events set registration_closes_at = now() - interval '4 hours', starts_at = now() - interval '3 hours',
                 ends_at = now() - interval '1 minute' where id = $1`, [event]);
    await admin(`select app.expire_team_registrations()`);
    expect(await teamRow(reg.id)).toMatchObject({ status: 'expired', status_reason: 'review_not_decided' });
    expect(await regRow(regs[captain]!)).toMatchObject({ status: 'expired', status_reason: 'team_registration_expired' });
    expect(await counters(event)).toMatchObject({ teams_taken: 0 });
  });

  it('after close: a guardian revoking a member follows the same minimum-size rule', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { team_min_size: 3, guardian_required_under: 18 });
    const captain = await createUser(); const minor = await createUser({ age: 16 }); const a = await createUser();
    const team = await createTeam(captain, [minor, a]);
    const { reg, rows } = await submitted(captain, event, team, [captain, minor, a]);
    await respond(captain, rows[captain]!, true); await respond(a, rows[a]!, true);
    const rm = await respond(minor, rows[minor]!, true);
    const reqId = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, $2) id`, [rm.registration_id, `veli-${randomUUID()}@example.test`]))).rows[0].id;
    const issued = (await asService((q) => q(`select public.issue_guardian_token($1) j`, [reqId]))).rows[0].j;
    const policy = (await admin(`select policy_version from public.guardian_requests where id = $1`, [reqId])).rows[0].policy_version;
    const decided = (await asAnon((q) => q(`select public.guardian_decide($1, true, 'Ayşe Demir', $2) j`, [issued.token, policy]))).rows[0].j;
    expect((await teamRow(reg.id)).status).toBe('confirmed');
    await admin(`update public.events set registration_closes_at = now() - interval '1 minute' where id = $1`, [event]);

    await asAnon((q) => q(`select public.guardian_revoke($1)`, [decided.revoke_token]));
    expect(await regRow(rm.registration_id!)).toMatchObject({ status: 'cancelled', status_reason: 'guardian_revoked' });
    expect((await memberRow(reg.id, minor)).state).toBe('declined');
    expect(await teamRow(reg.id)).toMatchObject({ status: 'pending_review', status_reason: 'roster_below_min_after_close' });
    await admin(`select app.expire_team_registrations()`);
    expect((await teamRow(reg.id)).status).toBe('pending_review');
  });

  it('guardian request lapses inside a team (cron team branch): member declined, team notice to the minor, member_declined to managers', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { guardian_required_under: 18 });
    const captain = await createUser(); const minor = await createUser({ age: 16 }); const team = await createTeam(captain, [minor]);
    const { reg, rows } = await submitted(captain, event, team, [captain, minor]);
    await respond(captain, rows[captain]!, true); const rm = await respond(minor, rows[minor]!, true);
    const reqId = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, 'veli@example.test') id`, [rm.registration_id]))).rows[0].id;
    await admin(`update public.guardian_requests set expires_at = now() - interval '1 minute' where id = $1`, [reqId]);

    // the team branch (event lock → request SKIP LOCKED). Narrowed to this event: an unfiltered call here would hold other
    // test files' lapsed requests (SKIP LOCKED) while they assert their lazy expiry — a cross-file race, not a product path.
    expect((await admin(`select app.expire_guardian_requests($1) n`, [event])).rows[0].n).toBe(1);
    expect((await admin(`select status from public.guardian_requests where id = $1`, [reqId])).rows[0].status).toBe('expired');
    expect(await regRow(rm.registration_id!)).toMatchObject({ status: 'expired', status_reason: 'guardian_request_expired' });
    expect((await memberRow(reg.id, minor)).state).toBe('declined');
    expect(await teamRow(reg.id)).toMatchObject({ status: 'pending_members', roster_version: 2 });
    expect(await kindsOf(minor)).toEqual(['team_registration.invited', 'team_registration.guardian_expired']);
    const note = (await admin(`select target_type, target_id, body from public.notifications where user_id = $1 and kind = 'team_registration.guardian_expired'`, [minor])).rows[0];
    expect(note).toMatchObject({ target_type: 'team_event_registration', target_id: reg.id });
    expect(note.body).not.toContain('yeniden kaydolabilirsin');
    expect(await kindsOf(captain)).toEqual(['team_registration.member_declined']);
  });

  it('24 h reminder: a team member only once the team is confirmed; individual registrations as before', async () => {
    const org = await createOrg();
    const event = await createTeamEvent(org, { registration_mode: 'both', capacity: 10, starts_at: new Date(Date.now() + 24 * 36e5),
      ends_at: new Date(Date.now() + 30 * 36e5), registration_closes_at: new Date(Date.now() + 20 * 36e5) });
    const solo = await createUser(); await register(solo, event);
    const captain = await createUser(); const a = await createUser(); const team = await createTeam(captain, [a]);
    const { reg, rows } = await submitted(captain, event, team, [captain, a]);
    await respond(captain, rows[captain]!, true);
    await admin(`select app.queue_event_reminders()`);
    expect(await kindsOf(solo)).toEqual(['event.reminder_24h']);
    expect(await kindsOf(captain)).toEqual([]);
    await respond(a, rows[a]!, true);
    expect((await teamRow(reg.id)).status).toBe('confirmed');
    await admin(`select app.queue_event_reminders()`);
    expect(await kindsOf(captain)).toEqual(['team_registration.confirmed', 'event.reminder_24h']);
    expect(await kindsOf(solo)).toEqual(['event.reminder_24h']);
  });

  it('grants: the new RPCs are authenticated-only; the app.* helpers are not callable by API roles', async () => {
    const rows = (await admin(`select p.proname, n.nspname, has_function_privilege('anon', p.oid, 'execute') anon,
                                      has_function_privilege('authenticated', p.oid, 'execute') auth,
                                      has_function_privilege('service_role', p.oid, 'execute') svc
                               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                               where p.proname in ('respond_team_registration', 'update_team_roster', 'cancel_team_registration',
                                                   'team_registration_detail', 'my_team_registration_invites', 'recompute_team_registration',
                                                   'expire_team_registrations', 'next_member_status')
                               order by p.proname`)).rows;
    expect(rows.map((r) => [r.proname, r.anon, r.auth])).toEqual([
      ['cancel_team_registration', false, true], ['expire_team_registrations', false, false], ['my_team_registration_invites', false, true],
      ['next_member_status', false, false], ['recompute_team_registration', false, false], ['respond_team_registration', false, true],
      ['team_registration_detail', false, true], ['update_team_roster', false, true]]);
  });
});

// ---------------------------------------------------------------- Task 4: organiser side
// The event organisation's owner|admin|reviewer (and platform admins) list team registrations and decide pending_review ones.
// checkin_staff, editors and other organisations get 403. The list carries team name, states, counts and each roster member's
// display name + state + step only — never an e-mail, a birth date or a guardian detail (members include minors).
// Lock order for a decision: event → team row → member registrations. Every organiser list of "confirmed participants" counts
// a team member only when the TEAM is confirmed (same filter as reminders / volunteer brief / card / check-in).

type OrgTeamRow = {
  id: string; team_id: string; team_name: string; status: TeamRegStatus; status_reason: string | null; roster_version: number;
  roster_size: number; ready_count: number; hold_expires_at: string | null; confirmed_at: string | null; created_at: string;
  members: { display_name: string; role_at_submit: string; state: string; step: string }[];
};

const orgList = (userId: string, eventId: string) =>
  asUser(userId, async (q) => (await q(`select j from public.admin_event_team_registrations($1) j`, [eventId])).rows.map((r) => r.j as OrgTeamRow));

const review = (userId: string, teamRegId: string, approve: boolean) =>
  asUser(userId, async (q) => (await q(`select * from public.review_team_registration($1, $2)`, [teamRegId, approve])).rows[0] as Submitted & { status_reason: string | null });

/** Every key of a JSON value, recursively. */
const keysOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.flatMap(keysOf) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)]) : [];

/** A complete team (captain + the given members, all accepted adults) on a requires_review event → pending_review. */
async function teamInReview(eventId: string, extra = 1) {
  const captain = await createUser(); const ms: string[] = [];
  for (let i = 0; i < extra; i += 1) ms.push(await createUser());
  const team = await createTeam(captain, ms);
  const { reg, rows } = await submitted(captain, eventId, team, [captain, ...ms]);
  const regs: Record<string, string> = {};
  for (const u of [captain, ...ms]) regs[u] = (await respond(u, rows[u]!, true)).registration_id!;
  return { captain, members: ms, team, reg, regs };
}

describe('team registration · organizer', () => {
  it('admin_event_team_registrations: owner|admin|reviewer and platform admins list; checkin_staff, editor and another organisation → 403; anon has no grant', async () => {
    const [owner, orgAdmin, reviewer, staff, editor, otherOwner, pa, outsider] = await Promise.all(
      [createUser(), createUser(), createUser(), createUser(), createUser(), createUser(), createUser(), createUser()]);
    const org = await createOrg({ [owner]: 'owner', [orgAdmin]: 'admin', [reviewer]: 'reviewer', [staff]: 'checkin_staff', [editor]: 'editor' });
    await createOrg({ [otherOwner]: 'owner' });
    await admin(`insert into public.platform_admins (user_id) values ($1)`, [pa]);
    const event = await createTeamEvent(org);
    const captain = await createUser(); const team = await createTeam(captain);
    const reg = await submit(captain, event, team, [captain]);
    for (const user of [owner, orgAdmin, reviewer, pa]) expect((await orgList(user, event)).map((r) => r.id)).toEqual([reg.id]);
    for (const user of [staff, editor, otherOwner, outsider, captain]) await expectFail(orgList(user, event), 403, 'forbidden');
    await expect(asAnon((q) => q(`select * from public.admin_event_team_registrations($1)`, [event]))).rejects.toThrow(PERMISSION_DENIED);
    await expectFail(orgList(owner, randomUUID()), 404, 'event_not_found');
  });

  it('the list: team name, status, roster_size, ready_count, hold, members with display_name / role / state / step — no birth_date, email or guardian key anywhere', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createTeamEvent(org, { guardian_required_under: 18 });
    const captain = await createUser({ name: 'Kaptan Kişi' }); const minor = await createUser({ age: 16, name: 'Genç Üye' });
    const waiting = await createUser({ name: 'Bekleyen Üye' }); const decliner = await createUser({ name: 'Vazgeçen Üye' });
    const team = await createTeam(captain, [minor, waiting, decliner]);
    const { reg, rows } = await submitted(captain, event, team, [captain, minor, waiting, decliner]);
    await respond(captain, rows[captain]!, true);
    const rm = await respond(minor, rows[minor]!, true);
    await asUser(minor, (q) => q(`select public.create_guardian_request($1, $2, 'Veli Gizli')`, [rm.registration_id, `veli-${randomUUID()}@example.test`]));
    await respond(decliner, rows[decliner]!, false);

    const [row] = await orgList(owner, event);
    expect(row).toMatchObject({ id: reg.id, team_id: team, team_name: 'Test Takımı', status: 'pending_members', status_reason: null,
                                roster_version: 2, roster_size: 3, ready_count: 1, confirmed_at: null });
    expect(row!.hold_expires_at).not.toBeNull();
    // organisers see the whole current version, holes included (same as the staff RLS on the roster rows)
    expect(row!.members.map((m) => [m.display_name, m.state, m.step]).sort()).toEqual([
      ['Bekleyen Üye', 'invited', 'invited'], ['Genç Üye', 'accepted', 'guardian'], ['Kaptan Kişi', 'accepted', 'ready'],
      ['Vazgeçen Üye', 'declined', 'declined']]);
    expect(Object.keys(row!).sort()).toEqual(['confirmed_at', 'created_at', 'hold_expires_at', 'id', 'members', 'ready_count', 'roster_size',
      'roster_version', 'status', 'status_reason', 'team_id', 'team_name']);
    expect([...new Set(keysOf(row!.members))].sort()).toEqual(['display_name', 'role_at_submit', 'state', 'step']);
    expect(keysOf(row).filter((k) => /birth|email|guardian|phone|user_id|member_id/i.test(k))).toEqual([]);
    const text = JSON.stringify(row);
    expect(text).not.toMatch(/@|Veli Gizli|"\d{4}-\d{2}-\d{2}"/);
  });

  it('review_team_registration: only owner|admin|reviewer of the event organisation and platform admins; not pending_review → 409; unknown → 404', async () => {
    const [owner, reviewer, staff, editor, otherOwner, pa] = await Promise.all(
      [createUser(), createUser(), createUser(), createUser(), createUser(), createUser()]);
    const org = await createOrg({ [owner]: 'owner', [reviewer]: 'reviewer', [staff]: 'checkin_staff', [editor]: 'editor' });
    await createOrg({ [otherOwner]: 'owner' });
    await admin(`insert into public.platform_admins (user_id) values ($1)`, [pa]);
    const event = await createTeamEvent(org, { requires_review: true });
    const a = await teamInReview(event); const b = await teamInReview(event);
    expect((await teamRow(a.reg.id)).status).toBe('pending_review');

    for (const user of [staff, editor, otherOwner, a.captain]) await expectFail(review(user, a.reg.id, true), 403, 'review_forbidden');
    await expect(asAnon((q) => q(`select public.review_team_registration($1, true)`, [a.reg.id]))).rejects.toThrow(PERMISSION_DENIED);
    await expectFail(review(owner, randomUUID(), true), 404, 'team_registration_not_found');
    expect((await review(reviewer, a.reg.id, true)).status).toBe('confirmed');
    await expectFail(review(owner, a.reg.id, false), 409, 'team_registration_not_pending_review');   // already decided
    expect((await review(pa, b.reg.id, true)).status).toBe('confirmed');
    // a pending_members team is not the organiser's to decide
    const c = await createUser(); const cm = await createUser(); const ct = await createTeam(c, [cm]);
    const pending = await submit(c, event, ct, [c, cm]);
    await expectFail(review(owner, pending.id, true), 409, 'team_registration_not_pending_review');
  });

  it('approve a requires_review team → confirmed (approved_by_organizer): cards open, team_registration.confirmed sent; member registrations unchanged', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createTeamEvent(org, { requires_review: true });
    const t = await teamInReview(event);
    await expectFail(asUser(t.captain, (q) => q(`select public.get_participation_card($1)`, [t.regs[t.captain]])), 409, 'team_registration_not_confirmed');
    const decided = await review(owner, t.reg.id, true);
    expect(decided).toMatchObject({ id: t.reg.id, status: 'confirmed', status_reason: 'approved_by_organizer' });
    expect((await teamRow(t.reg.id)).confirmed_at).not.toBeNull();
    for (const u of [t.captain, ...t.members]) expect(await regRow(t.regs[u]!)).toMatchObject({ status: 'confirmed' });
    const card = (await asUser(t.captain, (q) => q(`select public.get_participation_card($1) c`, [t.regs[t.captain]]))).rows[0].c;
    expect(card.registration_id).toBe(t.regs[t.captain]);
    expect(await kindsOf(t.members[0]!)).toEqual(['team_registration.invited', 'team_registration.confirmed']);
    expect(await counters(event)).toMatchObject({ teams_taken: 1, seats_taken: 0 });
    const audit = (await admin(`select actor_id, metadata from public.audit_events where target_id = $1 and action = 'team_registration.reviewed'`, [t.reg.id])).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor_id: owner, metadata: { approved: true, from_reason: 'members_ready', status: 'confirmed' } });
    expect(JSON.stringify(audit[0].metadata)).not.toMatch(/Test Kullanıcı|@/);         // ids and states only
  });

  it('reject → team rejected, member registrations rejected (consents withdrawn, guardian requests revoked), teams_taken drops, the oldest waitlisted team promoted', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createTeamEvent(org, { requires_review: true, team_capacity: 1, waitlist_enabled: true, guardian_required_under: 18 });
    const t = await teamInReview(event);
    const c2 = await createUser(); const m2 = await createUser(); const t2 = await createTeam(c2, [m2]);
    const waiting = await submit(c2, event, t2, [c2, m2]);
    expect(waiting.status).toBe('waitlisted');
    expect(await counters(event)).toMatchObject({ teams_taken: 1, team_waitlist_count: 1 });

    const decided = await review(owner, t.reg.id, false);
    expect(decided).toMatchObject({ id: t.reg.id, status: 'rejected', status_reason: 'rejected_by_organizer' });
    for (const u of [t.captain, ...t.members]) {
      expect(await regRow(t.regs[u]!)).toMatchObject({ status: 'rejected', status_reason: 'team_registration_rejected' });
      expect((await memberRow(t.reg.id, u)).state).toBe('accepted');                     // history: the team is already dead
    }
    expect(count(await admin(`select 1 from public.consents where subject_id = any($1::uuid[]) and withdrawn_at is null`, [Object.values(t.regs)]))).toBe(0);
    expect(await teamRow(waiting.id)).toMatchObject({ status: 'pending_members', status_reason: 'promoted_from_waitlist' });
    expect(await counters(event)).toMatchObject({ teams_taken: 1, team_waitlist_count: 0, seats_taken: 0 });
    expect(await kindsOf(t.members[0]!)).toEqual(['team_registration.invited', 'registration.rejected']);
    expect(await kindsOf(m2)).toEqual(['team_registration.invited']);
    await expectFail(asUser(t.captain, (q) => q(`select public.get_participation_card($1)`, [t.regs[t.captain]])), 409, 'registration_not_confirmed');
  });

  it('a pending guardian request of a rejected team is revoked', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createTeamEvent(org, { requires_review: true, guardian_required_under: 18 });
    const captain = await createUser(); const minor = await createUser({ age: 16 }); const team = await createTeam(captain, [minor]);
    const { reg, rows } = await submitted(captain, event, team, [captain, minor]);
    await respond(captain, rows[captain]!, true); const rm = await respond(minor, rows[minor]!, true);
    // fixture: the organiser decides while the minor's guardian request is still out (only reachable after close: min-size rule)
    const reqId = (await asUser(minor, (q) => q(`select public.create_guardian_request($1, $2) id`, [rm.registration_id, `veli-${randomUUID()}@example.test`]))).rows[0].id;
    await admin(`update public.team_event_registrations set status = 'pending_review', status_reason = 'roster_below_min_after_close' where id = $1`, [reg.id]);
    await review(owner, reg.id, false);
    expect((await admin(`select status from public.guardian_requests where id = $1`, [reqId])).rows[0].status).toBe('revoked');
    expect(await regRow(rm.registration_id!)).toMatchObject({ status: 'rejected', status_reason: 'team_registration_rejected' });
  });

  it('after close: approve as-is a roster_below_min_after_close team → confirmed approved_below_min_after_close; recompute leaves it alone; the expiry job does not touch it at ends_at', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createTeamEvent(org, { team_min_size: 3 });
    const t = await teamInReview(event, 3);                                              // requires_review off → confirmed
    expect((await teamRow(t.reg.id)).status).toBe('confirmed');
    await admin(`update public.events set registration_closes_at = now() - interval '1 minute' where id = $1`, [event]);
    await asUser(t.members[0]!, (q) => q(`select public.leave_team($1)`, [t.team]));     // 3 ready = min
    await asUser(t.members[1]!, (q) => q(`select public.leave_team($1)`, [t.team]));     // 2 ready < 3
    expect(await teamRow(t.reg.id)).toMatchObject({ status: 'pending_review', status_reason: 'roster_below_min_after_close' });
    expect((await orgList(owner, event))[0]).toMatchObject({ status: 'pending_review', status_reason: 'roster_below_min_after_close', ready_count: 2, roster_size: 2 });

    const decided = await review(owner, t.reg.id, true);
    expect(decided).toMatchObject({ status: 'confirmed', status_reason: 'approved_below_min_after_close' });
    const card = (await asUser(t.captain, (q) => q(`select public.get_participation_card($1) c`, [t.regs[t.captain]]))).rows[0].c;
    expect(card.registration_id).toBe(t.regs[t.captain]);
    await asUser(t.members[2]!, (q) => q(`select public.leave_team($1)`, [t.team]));     // 1 ready: the organiser already accepted it
    expect(await teamRow(t.reg.id)).toMatchObject({ status: 'confirmed', status_reason: 'approved_below_min_after_close' });
    await admin(`update public.events set starts_at = now() - interval '3 hours', ends_at = now() - interval '1 minute',
                 registration_closes_at = now() - interval '4 hours' where id = $1`, [event]);
    await admin(`select app.expire_team_registrations($1)`, [event]);
    expect((await teamRow(t.reg.id)).status).toBe('confirmed');
  });

  it('after close: reject a roster_below_min_after_close team → rejected, member registrations rejected, seat freed, nobody promoted (registration closed)', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createTeamEvent(org, { team_min_size: 2, team_capacity: 1, waitlist_enabled: true });
    const t = await teamInReview(event, 1);
    const c2 = await createUser(); const m2 = await createUser(); const t2 = await createTeam(c2, [m2]);
    const waiting = await submit(c2, event, t2, [c2, m2]);
    expect(waiting.status).toBe('waitlisted');
    await admin(`update public.events set registration_closes_at = now() - interval '1 minute' where id = $1`, [event]);
    await asUser(t.members[0]!, (q) => q(`select public.leave_team($1)`, [t.team]));
    expect(await teamRow(t.reg.id)).toMatchObject({ status: 'pending_review', status_reason: 'roster_below_min_after_close' });

    expect((await review(owner, t.reg.id, false)).status).toBe('rejected');
    expect(await regRow(t.regs[t.captain]!)).toMatchObject({ status: 'rejected', status_reason: 'team_registration_rejected' });
    // the waitlisted team was closed by the lazy expiry (registration closed) — nobody is promoted after close
    expect((await teamRow(waiting.id)).status).toBe('expired');
    expect(await counters(event)).toMatchObject({ teams_taken: 0, team_waitlist_count: 0 });
  });

  it('a requires_review team still undecided (members_ready) at ends_at is closed by the expiry job (review_not_decided); a late decision → 409', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createTeamEvent(org, { requires_review: true });
    const t = await teamInReview(event);
    expect(await teamRow(t.reg.id)).toMatchObject({ status: 'pending_review', status_reason: 'members_ready' });
    await admin(`update public.events set registration_closes_at = now() - interval '2 hours' where id = $1`, [event]);
    await admin(`select app.expire_team_registrations($1)`, [event]);
    expect((await teamRow(t.reg.id)).status).toBe('pending_review');                     // closed for registration ≠ over
    await admin(`update public.events set starts_at = now() - interval '1 hour', ends_at = now() - interval '1 minute' where id = $1`, [event]);
    // a late decision: the lazy expiry under the event lock closes it first → 409 (the failed call rolls its own expiry back) …
    await expectFail(review(owner, t.reg.id, true), 409, 'team_registration_not_pending_review');
    expect((await teamRow(t.reg.id)).status).toBe('pending_review');
    // … and the cron job closes it for good
    expect((await admin(`select app.expire_team_registrations($1) n`, [event])).rows[0].n).toBe(1);
    expect(await teamRow(t.reg.id)).toMatchObject({ status: 'expired', status_reason: 'review_not_decided' });
    expect(await regRow(t.regs[t.captain]!)).toMatchObject({ status: 'expired', status_reason: 'team_registration_expired' });
    expect(await counters(event)).toMatchObject({ teams_taken: 0 });
  });

  it('a decision takes the event row lock first (lock order event → team row → member registrations)', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createTeamEvent(org, { requires_review: true });
    const t = await teamInReview(event);
    const gate = await pool.connect();
    try {
      await gate.query('begin');
      await gate.query(`select 1 from public.events where id = $1 for update`, [event]);
      const run = review(owner, t.reg.id, false).then((v) => v, (e) => e);
      let blocked = 0;
      for (let i = 0; i < 500 && blocked < 1; i += 1) {
        blocked = (await admin(`select count(*)::int as n from pg_stat_activity
                                where wait_event_type = 'Lock' and query like '%review_team_registration%' and pid <> pg_backend_pid()`)).rows[0].n;
        if (blocked < 1) await sleep(10);
      }
      // while the event row is held, the team row is not locked yet (a writer that follows the lock order is never inverted)
      const teamLock = await gate.query(`select id from public.team_event_registrations where id = $1 for update nowait`, [t.reg.id]);
      expect(teamLock.rowCount).toBe(1);
      await gate.query('commit');
      expect(blocked).toBe(1);
      expect((await run).status).toBe('rejected');
    } finally {
      gate.release();
    }
  });

  it('organiser lists of confirmed participants count a team member only when the TEAM is confirmed (admin_event_registrations, participant announcements)', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createTeamEvent(org, { registration_mode: 'both', capacity: 10, requires_review: true });
    const solo = await createUser({ name: 'Bireysel Katılımcı' });
    const soloReg = (await register(solo, event)).id as string;                       // individual review: unchanged path
    await asUser(owner, (q) => q(`select public.review_event_registration($1, true)`, [soloReg]));
    const t = await teamInReview(event);
    await admin(`insert into public.event_announcements (event_id, audience, title, body) values ($1, 'participants', 'Katılımcılara', 'Salon B')`, [event]);
    const list = async () => (await asUser(owner, (q) => q(`select registration_id, display_name, status from public.admin_event_registrations($1)`, [event]))).rows;
    const sees = async (u: string) => count(await asUser(u, (q) => q(`select 1 from public.event_announcements where event_id = $1`, [event])));

    // the team is pending_review: its members' own (confirmed) registrations are not participants yet
    expect((await list()).map((r) => r.registration_id)).toEqual([soloReg]);
    expect([await sees(solo), await sees(t.captain)]).toEqual([1, 0]);
    await review(owner, t.reg.id, true);
    expect((await list()).map((r) => r.registration_id).sort()).toEqual([soloReg, t.regs[t.captain], t.regs[t.members[0]!]].sort());
    expect((await list()).every((r) => r.status === 'confirmed')).toBe(true);
    expect([await sees(solo), await sees(t.captain)]).toEqual([1, 1]);
  });

  it('a team member who already checked in stays on the organiser list and stays a confirmed participant when the team drops out of confirmed; a teammate who did not check in does not', async () => {
    const owner = await createUser(); const org = await createOrg({ [owner]: 'owner' });
    const event = await createTeamEvent(org, { team_min_size: 3 });
    const t = await teamInReview(event, 2);                                              // captain + a + b, requires_review off
    const [a, b] = t.members as [string, string];
    expect((await teamRow(t.reg.id)).status).toBe('confirmed');
    // registration closed, event about to start: the check-in window is open
    await admin(`update public.events set registration_closes_at = now() - interval '1 hour', starts_at = now() + interval '1 hour',
                 ends_at = now() + interval '6 hours' where id = $1`, [event]);
    const token = (await asUser(a, (q) => q(`select public.get_participation_card($1) c`, [t.regs[a]]))).rows[0].c.qr_payload;
    expect((await asUser(owner, (q) => q(`select public.check_in_participant($1, null, $2) j`, [token, event]))).rows[0].j.result).toBe('checked_in');
    await admin(`insert into public.event_announcements (event_id, audience, title, body) values ($1, 'participants', 'Katılımcılara', 'Salon B')`, [event]);

    await asUser(b, (q) => q(`select public.leave_team($1)`, [t.team]));                 // 2 ready < 3 after close
    expect(await teamRow(t.reg.id)).toMatchObject({ status: 'pending_review', status_reason: 'roster_below_min_after_close' });

    const list = (await asUser(owner, (q) => q(`select registration_id, status, checked_in_at from public.admin_event_registrations($1)`, [event]))).rows;
    expect(list.map((r) => r.registration_id)).toEqual([t.regs[a]]);                    // the captain did not check in → not listed
    expect(list[0]).toMatchObject({ status: 'confirmed' });
    expect(list[0].checked_in_at).not.toBeNull();
    const sees = async (u: string) => count(await asUser(u, (q) => q(`select 1 from public.event_announcements where event_id = $1`, [event])));
    expect([await sees(a), await sees(t.captain)]).toEqual([1, 0]);
  });

  it('a caller without the organiser role is refused before the event row lock (never waits on it)', async () => {
    const owner = await createUser(); const staff = await createUser();
    const org = await createOrg({ [owner]: 'owner', [staff]: 'checkin_staff' });
    const event = await createTeamEvent(org, { requires_review: true });
    const t = await teamInReview(event);
    const gate = await pool.connect();
    try {
      await gate.query('begin');
      await gate.query(`select 1 from public.events where id = $1 for update`, [event]);
      const outcome = await Promise.race([
        review(staff, t.reg.id, true).then(() => 'succeeded', (e: { code?: string; message?: string }) => `${e.code} ${e.message}`),
        sleep(2000).then(() => 'blocked'),
      ]);
      expect(outcome).toBe('PT403 review_forbidden');
    } finally {
      await gate.query('commit');
      gate.release();
    }
  });

  it('grants: the organiser RPCs are authenticated-only', async () => {
    const rows = (await admin(`select p.proname, has_function_privilege('anon', p.oid, 'execute') anon,
                                      has_function_privilege('authenticated', p.oid, 'execute') auth
                               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                               where n.nspname = 'public' and p.proname in ('admin_event_team_registrations', 'review_team_registration')
                               order by p.proname`)).rows;
    expect(rows.map((r) => [r.proname, r.anon, r.auth])).toEqual([['admin_event_team_registrations', false, true], ['review_team_registration', false, true]]);
  });
});
