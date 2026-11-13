// Faz 3a Task 1 — team event registration: schema, RLS and counters (no submit/accept RPCs yet; fixtures are superuser inserts).
// Rules under test: the team pool (team_capacity / teams_taken / team_waitlist_count) and the individual pool (capacity /
// seats_taken / waitlist_count) never touch each other; team rows are readable only by the registered team's active members,
// the event organisation's owner|admin|reviewer|checkin_staff and platform admins (members of the team include minors);
// clients have no write path to either table; the counters are server-owned.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { admin, asAnon, asService, asUser, createOrg, createTeam, createTeamEvent, createUser, expectFail, register } from './helpers';

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
