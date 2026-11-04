-- ScoutSVM Release 106
-- Account-only Scout Year rollover.
-- The selected source-year auth accounts are transferred into the target year
-- WITHOUT inheriting team, rank, or roles. Historical source-year data remains untouched.

begin;

create or replace function public.admin_list_auth_accounts(p_user_ids uuid[])
returns table(user_id uuid, email text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'Admin permission is required' using errcode = '42501';
  end if;

  return query
  select u.id, u.email::text
  from auth.users u
  where u.id = any(coalesce(p_user_ids, array[]::uuid[]))
  order by lower(coalesce(u.email, ''));
end;
$$;

revoke all on function public.admin_list_auth_accounts(uuid[]) from public;
grant execute on function public.admin_list_auth_accounts(uuid[]) to authenticated;


create or replace function public.admin_list_unlinked_auth_accounts(p_limit integer default 100)
returns table(user_id uuid, email text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'Admin permission is required' using errcode = '42501';
  end if;

  return query
  select u.id, u.email::text, u.created_at
  from auth.users u
  where not exists (
    select 1 from public.members m where m.auth_user_id = u.id
  )
  order by u.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.admin_list_unlinked_auth_accounts(integer) from public;
grant execute on function public.admin_list_unlinked_auth_accounts(integer) to authenticated;

create or replace function public.admin_replace_scout_year_account_roster(
  p_source_year_id uuid,
  p_target_year_id uuid,
  p_member_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_start date;
  v_source_member_ids uuid[] := array[]::uuid[];
  v_selected_member_ids uuid[] := array[]::uuid[];
  v_source_user_ids uuid[] := array[]::uuid[];
  v_selected_count integer := 0;
  v_removed_existing integer := 0;
  v_deleted_roles integer := 0;
  v_inserted integer := 0;
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'Admin permission is required' using errcode = '42501';
  end if;

  if p_source_year_id is null or p_target_year_id is null then
    raise exception 'Source and target Scout Year are required' using errcode = '22023';
  end if;

  if p_source_year_id = p_target_year_id then
    raise exception 'Source and target Scout Year cannot be the same' using errcode = '22023';
  end if;

  select sy.start_date
  into v_target_start
  from public.scout_years sy
  where sy.id = p_target_year_id
  for update;

  if not found then
    raise exception 'Target Scout Year not found' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.scout_years where id = p_target_year_id and is_current = true) then
    raise exception 'Account rollover is only allowed before the target year becomes current' using errcode = '55000';
  end if;

  select coalesce(array_agg(msa.member_id), array[]::uuid[])
  into v_source_member_ids
  from public.member_season_assignments msa
  join public.members m on m.id = msa.member_id
  where msa.scout_year_id = p_source_year_id
    and msa.is_active = true
    and coalesce(msa.is_equipier, false) = false
    and m.auth_user_id is not null;

  -- Legacy bridge: older installations may not have season assignments for the source year yet.
  if coalesce(array_length(v_source_member_ids, 1), 0) = 0
     and exists (select 1 from public.scout_years where id = p_source_year_id and is_current = true) then
    select coalesce(array_agg(m.id), array[]::uuid[])
    into v_source_member_ids
    from public.members m
    where m.auth_user_id is not null
      and coalesce(m.is_equipier, false) = false;
  end if;

  select coalesce(array_agg(x.member_id), array[]::uuid[])
  into v_selected_member_ids
  from (
    select distinct unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
  ) x
  where x.member_id = any(v_source_member_ids);

  select coalesce(array_agg(distinct m.auth_user_id), array[]::uuid[])
  into v_source_user_ids
  from public.members m
  where m.id = any(v_source_member_ids)
    and m.auth_user_id is not null;

  -- The source-year selection is authoritative for source members only.
  -- New accounts already added directly to the target year are not affected.
  if array_length(v_source_user_ids, 1) is not null then
    delete from public.user_role_assignments ura
    where ura.scout_year_id = p_target_year_id
      and ura.user_id = any(v_source_user_ids);
    get diagnostics v_deleted_roles = row_count;
  end if;

  if array_length(v_source_member_ids, 1) is not null then
    delete from public.member_season_assignments msa
    where msa.scout_year_id = p_target_year_id
      and msa.member_id = any(v_source_member_ids);
    get diagnostics v_removed_existing = row_count;
  end if;

  if array_length(v_selected_member_ids, 1) is not null then
    insert into public.member_season_assignments (
      scout_year_id,
      member_id,
      team_id,
      rank_id,
      is_equipier,
      is_active,
      joined_at,
      left_at,
      notes,
      updated_at
    )
    select
      p_target_year_id,
      x.member_id,
      null,
      null,
      false,
      true,
      v_target_start,
      null,
      'Account transferred only; team, rank and roles require setup for this Scout Year.',
      now()
    from unnest(v_selected_member_ids) as x(member_id);
    get diagnostics v_inserted = row_count;
  end if;

  v_selected_count := coalesce(array_length(v_selected_member_ids, 1), 0);

  return jsonb_build_object(
    'source_year_id', p_source_year_id,
    'target_year_id', p_target_year_id,
    'source_accounts', coalesce(array_length(v_source_member_ids, 1), 0),
    'selected_accounts', v_selected_count,
    'not_transferred', greatest(coalesce(array_length(v_source_member_ids, 1), 0) - v_selected_count, 0),
    'target_assignments_replaced', v_removed_existing,
    'target_roles_deleted', v_deleted_roles,
    'target_assignments_inserted', v_inserted
  );
end;
$$;

revoke all on function public.admin_replace_scout_year_account_roster(uuid, uuid, uuid[]) from public;
grant execute on function public.admin_replace_scout_year_account_roster(uuid, uuid, uuid[]) to authenticated;

commit;
