-- TechApp · pilot privacy audit (Task 9, 11 Kasım 2026) — team join notes stay between the applicant and the team's managers.
--
-- Root cause: team_roster() (SECURITY DEFINER) shows a membership's `message` (the note written with the join request)
-- to captains/mentors only. The table policy team_memberships_select_team, however, let EVERY active member select the
-- active rows of their team, and the API roles hold the default full-column SELECT grant. RLS filters rows, not columns,
-- so any member could read a teammate's — often a minor's — note directly (GET /rest/v1/team_memberships?select=message),
-- bypassing the roster's rule.
--
-- Fix (tightening only): other people's membership rows are readable through the table by the team's managers only,
-- which matches what team_roster() already gives them. Members keep seeing the roster through team_roster() and their own
-- rows through team_memberships_select_own; no client reads other members' rows from the table.
-- Regression test: supabase/tests/pilot-privacy.test.ts ("the join note the minor wrote to the captain …").

drop policy if exists team_memberships_select_team on public.team_memberships;
create policy team_memberships_select_managers on public.team_memberships for select to authenticated
  using (app.is_team_manager(team_id));
