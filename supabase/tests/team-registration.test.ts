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
    for (const status of ['pending', 'left', 'removed', null] as const) {
      const user = await createUser();
      if (status) await addMember(team, user, 'member', status);
      await expectFail(submit(captain, event, team, [captain, active, user]), 422, 'member_not_active');
    }
    expect(await counters(event)).toMatchObject({ teams_taken: 0 });
  });

  it('member with a live individual registration, or in another team’s live registration for this event → 409 member_already_registered', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { registration_mode: 'both', capacity: 10 });
    const capA = await createUser(); const capB = await createUser(); const solo = await createUser(); const shared = await createUser();
    const teamA = await createTeam(capA, [solo, shared]); const teamB = await createTeam(capB, [shared]);
    await register(solo, event);
    await expectFail(submit(capA, event, teamA, [capA, solo]), 409, 'member_already_registered');
    const regB = await submit(capB, event, teamB, [capB, shared]);
    await expectFail(submit(capA, event, teamA, [capA, shared]), 409, 'member_already_registered');
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

  it('member outside min_age/max_age → 403 member_age_not_eligible (no name or age in the error payload)', async () => {
    const org = await createOrg(); const event = await createTeamEvent(org, { min_age: 16, max_age: 20 });
    const captain = await createUser({ age: 19 }); const young = await createUser({ age: 14, name: 'Gizli Küçük Üye' });
    const old = await createUser({ age: 23, name: 'Gizli Büyük Üye' }); const noBirth = await createUser({ age: null });
    const team = await createTeam(captain, [young, old, noBirth]);
    for (const [user, age] of [[young, '14'], [old, '23']] as const) {
      const err = await failure(submit(captain, event, team, [captain, user]));
      expect([err.code, err.message]).toEqual(['PT403', 'member_age_not_eligible']);
      const payload = JSON.stringify({ message: err.message, detail: err.detail, hint: err.hint, where: err.where });
      expect(payload).not.toMatch(/Gizli|Küçük|Büyük/);
      expect(payload).not.toContain(age);
      expect(payload).not.toContain(user); // not even which member
    }
    await expectFail(submit(captain, event, team, [captain, noBirth]), 403, 'member_age_not_eligible');
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
