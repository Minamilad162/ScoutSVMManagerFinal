-- ScoutSVM Release 108
-- Scout Year activation readiness + performance indexes.
-- Run after SQL 16 and SQL 17.

begin;

-- ---------------------------------------------------------------------------
-- Performance indexes for year-scoped administration and readiness checks.
-- ---------------------------------------------------------------------------
create index if not exists idx_member_season_assignments_year_active
  on public.member_season_assignments (scout_year_id, is_active);

create index if not exists idx_member_season_assignments_year_member
  on public.member_season_assignments (scout_year_id, member_id);

create index if not exists idx_user_role_assignments_year_active_user
  on public.user_role_assignments (scout_year_id, is_active, user_id);

create index if not exists idx_user_role_assignments_year_team
  on public.user_role_assignments (scout_year_id, team_id)
  where is_active = true;

create index if not exists idx_team_seasons_year_active
  on public.team_seasons (scout_year_id, is_active);

create index if not exists idx_terms_scout_year
  on public.terms (scout_year_id);

create index if not exists idx_term_meeting_dates_term
  on public.term_meeting_dates (term_id);

create index if not exists idx_members_auth_user_id
  on public.members (auth_user_id)
  where auth_user_id is not null;

-- ---------------------------------------------------------------------------
-- One-query overview for the Scout Year administration screen.
-- Replaces the previous N+1 summary requests from the frontend.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_scout_year_overview()
returns table(
  id uuid,
  name text,
  start_date date,
  end_date date,
  status text,
  is_current boolean,
  notes text,
  created_at text,
  updated_at text,
  teams_count bigint,
  members_count bigint,
  active_members_count bigint,
  roles_count bigint,
  terms_count bigint,
  meeting_dates_count bigint,
  configured_members_count bigint,
  needs_setup_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with member_role_counts as (
    select
      ura.scout_year_id,
      ura.user_id,
      count(*) filter (where ura.is_active = true) as active_role_count
    from public.user_role_assignments ura
    group by ura.scout_year_id, ura.user_id
  ),
  member_stats as (
    select
      msa.scout_year_id,
      count(*) as members_count,
      count(*) filter (where msa.is_active = true) as active_members_count,
      count(*) filter (
        where msa.is_active = true
          and msa.team_id is not null
          and msa.rank_id is not null
          and (
            coalesce(msa.is_equipier, false) = true
            or (
              m.auth_user_id is not null
              and coalesce(mrc.active_role_count, 0) > 0
            )
          )
      ) as configured_members_count
    from public.member_season_assignments msa
    join public.members m on m.id = msa.member_id
    left join member_role_counts mrc
      on mrc.scout_year_id = msa.scout_year_id
     and mrc.user_id = m.auth_user_id
    group by msa.scout_year_id
  ),
  team_stats as (
    select scout_year_id, count(*) filter (where is_active = true) as teams_count
    from public.team_seasons
    group by scout_year_id
  ),
  role_stats as (
    select scout_year_id, count(*) filter (where is_active = true) as roles_count
    from public.user_role_assignments
    group by scout_year_id
  ),
  term_stats as (
    select scout_year_id, count(*) as terms_count
    from public.terms
    group by scout_year_id
  ),
  meeting_stats as (
    select t.scout_year_id, count(tmd.id) as meeting_dates_count
    from public.terms t
    left join public.term_meeting_dates tmd on tmd.term_id = t.id
    group by t.scout_year_id
  )
  select
    sy.id,
    sy.name,
    sy.start_date,
    sy.end_date,
    sy.status::text,
    sy.is_current,
    sy.notes,
    sy.created_at::text,
    sy.updated_at::text,
    coalesce(ts.teams_count, 0),
    coalesce(ms.members_count, 0),
    coalesce(ms.active_members_count, 0),
    coalesce(rs.roles_count, 0),
    coalesce(trs.terms_count, 0),
    coalesce(mts.meeting_dates_count, 0),
    coalesce(ms.configured_members_count, 0),
    greatest(coalesce(ms.active_members_count, 0) - coalesce(ms.configured_members_count, 0), 0)
  from public.scout_years sy
  left join member_stats ms on ms.scout_year_id = sy.id
  left join team_stats ts on ts.scout_year_id = sy.id
  left join role_stats rs on rs.scout_year_id = sy.id
  left join term_stats trs on trs.scout_year_id = sy.id
  left join meeting_stats mts on mts.scout_year_id = sy.id
  where auth.uid() is not null and public.has_role('admin')
  order by sy.start_date desc;
$$;

revoke all on function public.admin_list_scout_year_overview() from public;
grant execute on function public.admin_list_scout_year_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- Readiness snapshot. One RPC returns all blocking counts, warnings and a
-- bounded sample of members needing setup. The issue list is deliberately
-- capped so a large roster does not generate a large payload.
-- ---------------------------------------------------------------------------
create or replace function public.admin_scout_year_activation_readiness(
  p_scout_year_id uuid,
  p_issue_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  v_year public.scout_years%rowtype;
  v_active_members integer := 0;
  v_active_leaders integer := 0;
  v_active_equipiers integer := 0;
  v_missing_team integer := 0;
  v_missing_rank integer := 0;
  v_missing_auth integer := 0;
  v_missing_role integer := 0;
  v_configured integer := 0;
  v_teams integer := 0;
  v_roles integer := 0;
  v_terms integer := 0;
  v_meetings integer := 0;
  v_orphan_roles integer := 0;
  v_roles_on_inactive_teams integer := 0;
  v_issues jsonb := '[]'::jsonb;
  v_critical jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_can_activate boolean := false;
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'Admin permission is required' using errcode = '42501';
  end if;

  select * into v_year
  from public.scout_years
  where id = p_scout_year_id;

  if not found then
    raise exception 'Scout Year not found' using errcode = 'P0002';
  end if;

  with role_counts as (
    select user_id, count(*) as role_count
    from public.user_role_assignments
    where scout_year_id = p_scout_year_id
      and is_active = true
    group by user_id
  ), active_roster as (
    select
      msa.member_id,
      msa.team_id,
      msa.rank_id,
      coalesce(msa.is_equipier, false) as is_equipier,
      m.auth_user_id,
      coalesce(rc.role_count, 0) as role_count
    from public.member_season_assignments msa
    join public.members m on m.id = msa.member_id
    left join role_counts rc on rc.user_id = m.auth_user_id
    where msa.scout_year_id = p_scout_year_id
      and msa.is_active = true
  )
  select
    count(*),
    count(*) filter (where is_equipier = false),
    count(*) filter (where is_equipier = true),
    count(*) filter (where team_id is null),
    count(*) filter (where rank_id is null),
    count(*) filter (where is_equipier = false and auth_user_id is null),
    count(*) filter (where is_equipier = false and auth_user_id is not null and role_count = 0),
    count(*) filter (
      where team_id is not null
        and rank_id is not null
        and (
          is_equipier = true
          or (auth_user_id is not null and role_count > 0)
        )
    )
  into
    v_active_members,
    v_active_leaders,
    v_active_equipiers,
    v_missing_team,
    v_missing_rank,
    v_missing_auth,
    v_missing_role,
    v_configured
  from active_roster;

  select count(*) into v_teams
  from public.team_seasons
  where scout_year_id = p_scout_year_id
    and is_active = true;

  select count(*) into v_roles
  from public.user_role_assignments
  where scout_year_id = p_scout_year_id
    and is_active = true;

  select count(*) into v_terms
  from public.terms
  where scout_year_id = p_scout_year_id;

  select count(*) into v_meetings
  from public.term_meeting_dates tmd
  join public.terms t on t.id = tmd.term_id
  where t.scout_year_id = p_scout_year_id;

  select count(*) into v_orphan_roles
  from public.user_role_assignments ura
  where ura.scout_year_id = p_scout_year_id
    and ura.is_active = true
    and not exists (
      select 1
      from public.member_season_assignments msa
      join public.members m on m.id = msa.member_id
      where msa.scout_year_id = p_scout_year_id
        and msa.is_active = true
        and m.auth_user_id = ura.user_id
    );

  select count(*) into v_roles_on_inactive_teams
  from public.user_role_assignments ura
  where ura.scout_year_id = p_scout_year_id
    and ura.is_active = true
    and ura.team_id is not null
    and not exists (
      select 1
      from public.team_seasons ts
      where ts.scout_year_id = p_scout_year_id
        and ts.team_id = ura.team_id
        and ts.is_active = true
    );

  with role_counts as (
    select user_id, count(*) as role_count
    from public.user_role_assignments
    where scout_year_id = p_scout_year_id
      and is_active = true
    group by user_id
  ), issue_rows as (
    select
      msa.member_id,
      m.full_name,
      u.email::text as email,
      coalesce(msa.is_equipier, false) as is_equipier,
      msa.team_id,
      msa.rank_id,
      m.auth_user_id,
      coalesce(rc.role_count, 0) as role_count,
      array_remove(array[
        case when msa.team_id is null then 'team' end,
        case when msa.rank_id is null then 'rank' end,
        case when coalesce(msa.is_equipier, false) = false and m.auth_user_id is null then 'account' end,
        case when coalesce(msa.is_equipier, false) = false and m.auth_user_id is not null and coalesce(rc.role_count, 0) = 0 then 'role' end
      ]::text[], null) as missing
    from public.member_season_assignments msa
    join public.members m on m.id = msa.member_id
    left join auth.users u on u.id = m.auth_user_id
    left join role_counts rc on rc.user_id = m.auth_user_id
    where msa.scout_year_id = p_scout_year_id
      and msa.is_active = true
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'member_id', member_id,
    'full_name', full_name,
    'email', email,
    'is_equipier', is_equipier,
    'missing', to_jsonb(missing)
  )), '[]'::jsonb)
  into v_issues
  from (
    select *
    from issue_rows
    where cardinality(missing) > 0
    order by full_name
    limit greatest(0, least(coalesce(p_issue_limit, 50), 200))
  ) limited;

  if v_active_members = 0 then
    v_critical := v_critical || jsonb_build_array(jsonb_build_object('code','no_active_members','label','لا يوجد أعضاء نشطون في السنة','count',1));
  end if;
  if v_teams = 0 then
    v_critical := v_critical || jsonb_build_array(jsonb_build_object('code','no_active_teams','label','لا توجد فرق مفعلة في السنة','count',1));
  end if;
  if v_missing_team > 0 then
    v_critical := v_critical || jsonb_build_array(jsonb_build_object('code','missing_team','label','أعضاء بدون فريق','count',v_missing_team));
  end if;
  if v_missing_rank > 0 then
    v_critical := v_critical || jsonb_build_array(jsonb_build_object('code','missing_rank','label','أعضاء بدون رتبة','count',v_missing_rank));
  end if;
  if v_missing_auth > 0 then
    v_critical := v_critical || jsonb_build_array(jsonb_build_object('code','missing_account','label','قادة بدون Auth Account','count',v_missing_auth));
  end if;
  if v_missing_role > 0 then
    v_critical := v_critical || jsonb_build_array(jsonb_build_object('code','missing_role','label','قادة بدون Role للسنة','count',v_missing_role));
  end if;

  if v_terms = 0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','no_terms','label','لا توجد ترمات للسنة','count',1));
  end if;
  if v_meetings = 0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','no_meeting_dates','label','لا توجد مواعيد اجتماعات مخططة','count',1));
  end if;
  if v_orphan_roles > 0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','orphan_roles','label','Roles غير مرتبطة بعضو نشط في السنة','count',v_orphan_roles));
  end if;
  if v_roles_on_inactive_teams > 0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code','role_team_inactive','label','Team Roles مرتبطة بفرق غير مفعلة في السنة','count',v_roles_on_inactive_teams));
  end if;

  v_can_activate :=
    v_active_members > 0
    and v_teams > 0
    and v_missing_team = 0
    and v_missing_rank = 0
    and v_missing_auth = 0
    and v_missing_role = 0;

  return jsonb_build_object(
    'year', jsonb_build_object(
      'id', v_year.id,
      'name', v_year.name,
      'status', v_year.status,
      'is_current', v_year.is_current,
      'start_date', v_year.start_date,
      'end_date', v_year.end_date
    ),
    'can_activate', v_can_activate,
    'counts', jsonb_build_object(
      'active_members', v_active_members,
      'active_leaders', v_active_leaders,
      'active_equipiers', v_active_equipiers,
      'configured_members', v_configured,
      'needs_setup', greatest(v_active_members - v_configured, 0),
      'missing_team', v_missing_team,
      'missing_rank', v_missing_rank,
      'missing_account', v_missing_auth,
      'missing_role', v_missing_role,
      'teams', v_teams,
      'roles', v_roles,
      'terms', v_terms,
      'meeting_dates', v_meetings,
      'orphan_roles', v_orphan_roles,
      'roles_on_inactive_teams', v_roles_on_inactive_teams
    ),
    'critical', v_critical,
    'warnings', v_warnings,
    'issues', v_issues,
    'issues_returned', jsonb_array_length(v_issues),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.admin_scout_year_activation_readiness(uuid, integer) from public;
grant execute on function public.admin_scout_year_activation_readiness(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Harden the existing atomic activation function: readiness is enforced by
-- the database, so a stale browser or direct RPC cannot bypass the review.
-- ---------------------------------------------------------------------------
create or replace function public.set_current_scout_year_atomic(p_scout_year_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous jsonb := null;
  v_target jsonb := null;
  v_readiness jsonb := null;
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'Admin permission is required to activate a Scout Year'
      using errcode = '42501';
  end if;

  if p_scout_year_id is null then
    raise exception 'Scout Year id is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('scoutsvm:set-current-scout-year'));

  if not exists (select 1 from public.scout_years where id = p_scout_year_id) then
    raise exception 'Scout Year not found' using errcode = 'P0002';
  end if;

  v_readiness := public.admin_scout_year_activation_readiness(p_scout_year_id, 20);
  if not coalesce((v_readiness->>'can_activate')::boolean, false) then
    raise exception 'Scout Year is not ready for activation'
      using errcode = '55000', detail = v_readiness::text;
  end if;

  perform 1
  from public.scout_years
  where is_current = true or id = p_scout_year_id
  for update;

  select to_jsonb(s)
    into v_previous
  from public.scout_years s
  where s.is_current = true
  limit 1;

  update public.scout_years
  set is_current = false,
      status = case when id <> p_scout_year_id and status = 'active' then 'archived' else status end,
      updated_at = now()
  where is_current = true
    and id <> p_scout_year_id;

  update public.scout_years
  set is_current = true,
      status = 'active',
      updated_at = now()
  where id = p_scout_year_id;

  select to_jsonb(s)
    into v_target
  from public.scout_years s
  where s.id = p_scout_year_id;

  return jsonb_build_object(
    'previous_current', v_previous,
    'target', v_target,
    'readiness', v_readiness
  );
end;
$$;

revoke all on function public.set_current_scout_year_atomic(uuid) from public;
grant execute on function public.set_current_scout_year_atomic(uuid) to authenticated;

commit;
