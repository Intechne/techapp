-- TechApp · Faz 3b Task 2 (12 Kasım 2026) — who founded a team / wrote a recruitment post is not public.
--
-- `teams.created_by` and `recruitment_posts.created_by` are the founder's user UUID. Teams can be founded by minors, and once
-- that person turns 18 and becomes `discoverable`, the UUID links straight to their profile. Both tables are publicly
-- readable (rows filtered by RLS), and the API roles held the default table-level SELECT grant, which covers every column:
-- anon could GET /rest/v1/teams?select=created_by. RLS filters rows, not columns.
--
-- Fix (same technique as 20260920000300_hide_org_verifier): drop the table-level SELECT grant from anon AND authenticated
-- and grant SELECT on every column except created_by. No client reads created_by (members/managers included); the server
-- reads it with owner rights where it matters (create_team's per-founder limit, protect_team_columns). Row policies are
-- unchanged and none of them reads created_by. INSERT/UPDATE/DELETE grants are unchanged (RLS still decides).
--
-- Consequences for clients: `select('*')` / `team:teams(*)` / `returning *` on these tables now fails with
-- "permission denied" — clients use the explicit lists TEAM_PUBLIC_COLUMNS / RECRUITMENT_POST_COLUMNS
-- (apps/mobile/src/features/teams/api.ts).
--
-- NEW COLUMNS: a column added to either table later is NOT readable by the API roles until it is added to a grant like the
-- one below (in the new migration). supabase/tests/pilot-privacy.test.ts fails until every column is either granted or
-- listed in its CREATOR_DENIED list, so the choice is explicit. Keep the client column constants in step.
revoke select on public.teams from anon, authenticated;
grant select (id, organization_id, slug, name, kind, category, tagline, about, city, topic_interest_id, tone,
              accepts_join_requests, moderation_status, member_count, is_demo, created_at, updated_at)
  on public.teams to anon, authenticated;

revoke select on public.recruitment_posts from anon, authenticated;
grant select (id, team_id, title, role_label, description, skills, is_open, closes_at, created_at, updated_at)
  on public.recruitment_posts to anon, authenticated;
