-- Reuse the application's existing secret-validated workspace visibility.
-- No new credentials, security-definer functions, or RLS bypasses.
-- Existing workspace policies remain the authorization authority.
do $$
declare policy_row record;
begin
  for policy_row in
    select tablename, policyname from pg_policies
    where schemaname='public'
      and tablename in ('radar_alert_preferences','radar_briefings','radar_feedback','radar_intelligence_events','radar_jobs')
      and qual like '%app.settings.radar_api_secret%'
  loop
    execute format(
      'alter policy %I on public.%I to anon using (exists (select 1 from public.radar_workspaces w where w.id = %I.workspace_id)) with check (exists (select 1 from public.radar_workspaces w where w.id = %I.workspace_id))',
      policy_row.policyname, policy_row.tablename, policy_row.tablename, policy_row.tablename
    );
  end loop;
end $$;

alter table public.radar_recurring_tasks enable row level security;
create policy "radar server recurring tasks access"
on public.radar_recurring_tasks for all to anon
using (exists (select 1 from public.radar_workspaces w where w.id=radar_recurring_tasks.workspace_id))
with check (exists (select 1 from public.radar_workspaces w where w.id=radar_recurring_tasks.workspace_id));
