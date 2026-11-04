-- ScoutSVM Release 96
-- Atomic current Scout Year activation.
-- Run after Release 95 SQL14 on the live/staging database.

begin;

-- Fail early if historical data already contains more than one current year.
do $$
begin
  if to_regclass('public.scout_years') is null then
    raise exception 'public.scout_years is missing; apply the canonical Scout Year schema first';
  end if;

  if (select count(*) from public.scout_years where is_current = true) > 1 then
    raise exception 'More than one scout_year is marked current. Clean the data before Release 96 activation hardening.';
  end if;
end $$;

-- Database-level invariant: at most one current Scout Year.
create unique index if not exists uq_scout_years_single_current
  on public.scout_years ((is_current))
  where is_current = true;

create or replace function public.set_current_scout_year_atomic(p_scout_year_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous jsonb := null;
  v_target jsonb := null;
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'Admin permission is required to activate a Scout Year'
      using errcode = '42501';
  end if;

  if p_scout_year_id is null then
    raise exception 'Scout Year id is required' using errcode = '22023';
  end if;

  -- Serialize current-year switches even when two admin clients click together.
  perform pg_advisory_xact_lock(hashtext('scoutsvm:set-current-scout-year'));

  if not exists (select 1 from public.scout_years where id = p_scout_year_id) then
    raise exception 'Scout Year not found' using errcode = 'P0002';
  end if;

  -- Lock current + target rows for this transaction.
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
    'target', v_target
  );
end;
$$;

revoke all on function public.set_current_scout_year_atomic(uuid) from public;
grant execute on function public.set_current_scout_year_atomic(uuid) to authenticated;

commit;
