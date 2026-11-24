-- ScoutSVM R153: one-time additive reconciliation, not a schema migration.
-- First run ROLE_SYNC_AUDIT_READ_ONLY.sql and inspect the selected year/counts.
-- Execute this whole file together in SQL Editor. Never imports old roles
-- into a new year, never changes ranks, never grants admin, never deletes roles.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
select pg_advisory_xact_lock(hashtext('scoutsvm:set-current-scout-year'));
lock table public.scout_years, public.user_role_assignments,
  public.member_season_assignments, public.members, public.team_seasons,
  public.roles in share mode;
lock table public.user_roles in share row exclusive mode;

do $$
begin
  if (select count(*) from public.scout_years where is_current is true) <> 1 then
    raise exception 'Expected exactly one current Scout Year; abort';
  end if;
end $$;

create temporary table r153_eligible_roles on commit drop as
-- Current-year assignments are authoritative. Only already-active, linked
-- users and active team scopes are eligible; admin is permanent and excluded.
select distinct ura.user_id, ura.role_id, ura.team_id
from public.user_role_assignments ura
join public.scout_years sy on sy.id = ura.scout_year_id and sy.is_current is true
join public.roles r on r.id = ura.role_id
where ura.is_active is true and r.role_slug <> 'admin'
  and exists (
    select 1 from public.members m
    join public.member_season_assignments msa on msa.member_id = m.id
      and msa.scout_year_id = sy.id and msa.is_active is true
    where m.auth_user_id = ura.user_id
  )
  and (ura.team_id is null or exists (
    select 1 from public.team_seasons ts
    where ts.scout_year_id = sy.id and ts.team_id = ura.team_id and ts.is_active is true
  ));

with inserted as (
  insert into public.user_roles (user_id, role_id, team_id)
  select e.user_id, e.role_id, e.team_id
  from r153_eligible_roles e
  where not exists (
    select 1 from public.user_roles ur
    where ur.user_id=e.user_id and ur.role_id=e.role_id
      and ur.team_id is not distinct from e.team_id
  )
  on conflict do nothing
  returning user_id
)
select count(*) as restored_roles, count(distinct user_id) as affected_accounts
from inserted;

do $$
begin
  if exists (
    select 1 from r153_eligible_roles e where not exists (
      select 1 from public.user_roles ur
      where ur.user_id=e.user_id and ur.role_id=e.role_id
        and ur.team_id is not distinct from e.team_id
    )
  ) then
    raise exception 'Role synchronization incomplete; transaction rolled back';
  end if;
end $$;
select 'PASS_R153_ELIGIBLE_ROLE_SYNC' as verdict,
  count(*) as verified_active_roles from r153_eligible_roles;
commit;
