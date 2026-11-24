-- ScoutSVM R153: read-only; run on the correct production project.
select id, name, status from public.scout_years where is_current is true;

with eligible as (
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
  ))
)
select r.role_slug, count(*) as active_eligible_assignments,
  count(*) filter (where not exists (
    select 1 from public.user_roles ur
    where ur.user_id=e.user_id and ur.role_id=e.role_id
      and ur.team_id is not distinct from e.team_id
  )) as missing_legacy
from eligible e join public.roles r on r.id=e.role_id
group by r.role_slug order by r.role_slug;

-- Legacy-only rows are deliberately NOT imported: their year is unknown.
select r.role_slug, count(*) as legacy_without_active_current_assignment
from public.user_roles ur join public.roles r on r.id=ur.role_id
where r.role_slug <> 'admin' and not exists (
  select 1 from public.user_role_assignments ura
  join public.scout_years sy on sy.id=ura.scout_year_id and sy.is_current is true
  where ura.is_active is true and ura.user_id=ur.user_id and ura.role_id=ur.role_id
    and ura.team_id is not distinct from ur.team_id
)
group by r.role_slug order by r.role_slug;

-- Check the actual login view implementation if menus remain wrong.
select pg_get_viewdef('public.v_user_roles_current'::regclass, true) as current_role_view_definition;
