-- ScoutSVM Release 110
-- Fix New Year setup failing with:
--   new row violates row-level security policy for table "terms"
--
-- Scope:
-- - keep term writes restricted to ScoutSVM admins only
-- - allow authenticated reads required by operational pages
-- - apply the same protection to term_meeting_dates so the next rollover step
--   does not fail immediately after terms are created
--
-- Safe to run repeatedly.

begin;

alter table public.terms enable row level security;

drop policy if exists "terms admin modify" on public.terms;
create policy "terms admin modify"
on public.terms
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

-- Preserve the existing read behavior for authenticated application users.
-- The older "terms read" policy may already exist; do not duplicate it.

do $$
begin
  if to_regclass('public.term_meeting_dates') is not null then
    execute 'alter table public.term_meeting_dates enable row level security';

    execute 'drop policy if exists "term meeting dates read authenticated" on public.term_meeting_dates';
    execute 'create policy "term meeting dates read authenticated"
             on public.term_meeting_dates
             for select
             to authenticated
             using (true)';

    execute 'drop policy if exists "term meeting dates admin modify" on public.term_meeting_dates';
    execute 'create policy "term meeting dates admin modify"
             on public.term_meeting_dates
             for all
             to authenticated
             using (public.has_role(''admin''))
             with check (public.has_role(''admin''))';
  end if;
end
$$;

commit;

-- Verification (run after the migration if needed):
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('terms', 'term_meeting_dates')
-- order by tablename, policyname;
