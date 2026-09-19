-- TechApp · 0007 scheduled maintenance. Guardian requests also expire lazily inside the RPCs; this job releases
-- held seats on time even when nobody touches the event. No-op where pg_cron is unavailable (tests, local stack).
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron not available: skipping scheduled jobs';
    return;
  end if;
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'techapp-expire-guardian-requests';
  perform cron.schedule('techapp-expire-guardian-requests', '*/10 * * * *', 'select app.expire_guardian_requests()');
end $$;
