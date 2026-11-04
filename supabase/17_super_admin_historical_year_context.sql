-- ScoutSVM Release 107
-- Super Admin historical Scout Year read context.
-- These views expose season-aware data only to users with the admin role.
-- The frontend applies an exact scout_year_id filter whenever historical mode is enabled.

begin;

create or replace view public.v_members_context
with (security_invoker = true)
as
select
  msa.scout_year_id,
  m.id,
  m.auth_user_id,
  m.full_name,
  msa.team_id,
  tm.name as team_name,
  msa.rank_id,
  r.rank_label,
  r.rank_slug,
  coalesce(msa.is_equipier, false) as is_equipier,
  coalesce(msa.is_active, true) as is_active,
  m.personal_phone,
  m.guardian_name,
  m.guardian_phone,
  m.birth_date,
  (to_jsonb(m) ->> 'avatar_url')::text as avatar_url,
  case
    when coalesce(to_jsonb(m) ->> 'whatsapp_opt_in_personal', '') = '' then null
    else (to_jsonb(m) ->> 'whatsapp_opt_in_personal')::boolean
  end as whatsapp_opt_in_personal,
  case
    when coalesce(to_jsonb(m) ->> 'whatsapp_opt_in_guardian', '') = '' then null
    else (to_jsonb(m) ->> 'whatsapp_opt_in_guardian')::boolean
  end as whatsapp_opt_in_guardian,
  msa.joined_at,
  msa.left_at,
  msa.notes as season_notes,
  m.created_at
from public.member_season_assignments msa
join public.members m on m.id = msa.member_id
left join public.teams tm on tm.id = msa.team_id
left join public.ranks r on r.id = msa.rank_id
where public.has_role('admin');

grant select on public.v_members_context to authenticated;

create or replace view public.v_user_roles_context
with (security_invoker = true)
as
select
  ura.id,
  ura.scout_year_id,
  ura.user_id,
  ura.role_id,
  r.role_slug,
  r.role_label,
  ura.team_id,
  tm.name as team_name,
  coalesce(ura.is_active, true) as is_active,
  ura.created_at,
  ura.created_by,
  ura.notes
from public.user_role_assignments ura
join public.roles r on r.id = ura.role_id
left join public.teams tm on tm.id = ura.team_id
where public.has_role('admin');

grant select on public.v_user_roles_context to authenticated;

create or replace view public.v_terms_context
with (security_invoker = true)
as
select
  t.id,
  t.name,
  t.year,
  t.start_date,
  t.end_date,
  t.scout_year_id,
  true::boolean as is_current
from public.terms t
where public.has_role('admin');

grant select on public.v_terms_context to authenticated;

commit;
