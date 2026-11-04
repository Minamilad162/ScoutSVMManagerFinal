-- Release 72 — Scout year detailed rollover loading support and safe delete RPC
-- Run after the existing scout year / seasonal database migrations.

create extension if not exists pgcrypto;

create or replace function public.admin_delete_scout_year(p_scout_year_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_year record;
  v_is_admin boolean := false;
  v_term_ids uuid[] := array[]::uuid[];
  v_meeting_ids uuid[] := array[]::uuid[];
  v_table record;
  v_count integer := 0;
  v_deleted jsonb := '{}'::jsonb;
begin
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.role_slug = 'admin'
  )
  or exists (
    select 1
    from public.user_role_assignments ura
    join public.roles r on r.id = ura.role_id
    where ura.user_id = auth.uid()
      and ura.is_active = true
      and r.role_slug = 'admin'
  ) into v_is_admin;

  if not coalesce(v_is_admin, false) then
    raise exception 'Only admin can delete scout years';
  end if;

  select id, name, is_current
    into v_year
  from public.scout_years
  where id = p_scout_year_id;

  if not found then
    raise exception 'Scout year not found';
  end if;

  if coalesce(v_year.is_current, false) then
    raise exception 'Cannot delete the current scout year. Set another year as current first.';
  end if;

  if to_regclass('public.terms') is not null then
    execute 'select coalesce(array_agg(id), array[]::uuid[]) from public.terms where scout_year_id = $1'
      using p_scout_year_id
      into v_term_ids;
  end if;

  if array_length(v_term_ids, 1) is not null then
    if to_regclass('storage.objects') is not null and to_regclass('public.evaluation_voice_notes') is not null then
      delete from storage.objects so
      where so.bucket_id = 'evaluation-voice-notes'
        and exists (
          select 1
          from public.evaluation_voice_notes evn
          where evn.storage_path = so.name
            and evn.term_id = any(v_term_ids)
        );
      get diagnostics v_count = row_count;
      v_deleted := v_deleted || jsonb_build_object('storage.evaluation_voice_notes_objects', v_count);
    end if;

    if to_regclass('public.evaluation_answers') is not null and to_regclass('public.evaluations') is not null then
      delete from public.evaluation_answers ea
      using public.evaluations e
      where ea.evaluation_id = e.id
        and e.term_id = any(v_term_ids);
      get diagnostics v_count = row_count;
      v_deleted := v_deleted || jsonb_build_object('evaluation_answers', v_count);
    end if;

    if to_regclass('public.evaluation_voice_notes') is not null then
      delete from public.evaluation_voice_notes where term_id = any(v_term_ids);
      get diagnostics v_count = row_count;
      v_deleted := v_deleted || jsonb_build_object('evaluation_voice_notes', v_count);
    end if;

    if to_regclass('public.evaluations') is not null then
      delete from public.evaluations where term_id = any(v_term_ids);
      get diagnostics v_count = row_count;
      v_deleted := v_deleted || jsonb_build_object('evaluations', v_count);
    end if;

    if to_regclass('public.term_meeting_dates') is not null then
      delete from public.term_meeting_dates where term_id = any(v_term_ids);
      get diagnostics v_count = row_count;
      v_deleted := v_deleted || jsonb_build_object('term_meeting_dates', v_count);
    end if;

    if to_regclass('public.team_budgets') is not null then
      delete from public.team_budgets where term_id = any(v_term_ids);
      get diagnostics v_count = row_count;
      v_deleted := v_deleted || jsonb_build_object('team_budgets', v_count);
    end if;

    if to_regclass('public.expenses') is not null then
      delete from public.expenses where term_id = any(v_term_ids);
      get diagnostics v_count = row_count;
      v_deleted := v_deleted || jsonb_build_object('expenses', v_count);
    end if;
  end if;

  if to_regclass('public.meetings') is not null then
    execute 'select coalesce(array_agg(id), array[]::uuid[]) from public.meetings where scout_year_id = $1'
      using p_scout_year_id
      into v_meeting_ids;

    if array_length(v_meeting_ids, 1) is not null and to_regclass('public.attendance') is not null then
      delete from public.attendance where meeting_id = any(v_meeting_ids);
      get diagnostics v_count = row_count;
      v_deleted := v_deleted || jsonb_build_object('attendance', v_count);
    end if;
  end if;

  for v_table in
    select c.table_schema, c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'scout_year_id'
      and t.table_type = 'BASE TABLE'
      and c.table_name <> 'scout_years'
    order by
      case
        when c.table_name in ('terms', 'meetings') then 90
        when c.table_name = 'audit_log' then 95
        else 10
      end,
      c.table_name
  loop
    execute format('delete from %I.%I where scout_year_id = $1', v_table.table_schema, v_table.table_name)
      using p_scout_year_id;
    get diagnostics v_count = row_count;
    v_deleted := v_deleted || jsonb_build_object(v_table.table_name, v_count);
  end loop;

  delete from public.scout_years where id = p_scout_year_id;
  get diagnostics v_count = row_count;
  v_deleted := v_deleted || jsonb_build_object('scout_years', v_count);

  return jsonb_build_object(
    'deleted_scout_year_id', p_scout_year_id,
    'deleted_scout_year_name', v_year.name,
    'deleted_rows', v_deleted
  );
end;
$$;

grant execute on function public.admin_delete_scout_year(uuid) to authenticated;
