-- TechApp · 0012  Stop leaking WHO verified an organisation to the public.
-- `organizations` is publicly readable (verified orgs are public branding), but `verified_by` is the platform-admin's
-- user id and `verified_at` is internal review metadata — neither is branding. No client selects them (admin reads
-- id/name only). Row visibility is unchanged; this only narrows which COLUMNS the anon role may read.
-- A table-level SELECT grant covers every column, so a column REVOKE alone does nothing: we drop the blanket grant
-- and re-grant SELECT on the public columns only. `authenticated` keeps full access (org admins / platform review),
-- still row-scoped by the existing RLS policy.
revoke select on public.organizations from anon;
grant select (id, slug, name, type, tagline, about, website, logo_path, verification, is_demo, created_at, updated_at)
  on public.organizations to anon;
