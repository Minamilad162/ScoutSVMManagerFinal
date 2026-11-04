-- Release 78 — Year Responsibilities / مسؤوليات السنة
-- Run after SQL 12 on existing databases.
-- Adds events/organizing items for the current scout year and assigns active chefs/leaders to them.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.year_responsibilities_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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
  );
$$;

create table if not exists public.year_responsibility_events (
  id uuid primary key default gen_random_uuid(),
  scout_year_id uuid not null references public.scout_years(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  event_date date,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scout_year_id, title)
);

create index if not exists idx_year_resp_events_year_date
  on public.year_responsibility_events (scout_year_id, event_date, created_at);

create table if not exists public.year_responsibility_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.year_responsibility_events(id) on delete cascade,
  scout_year_id uuid not null references public.scout_years(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create index if not exists idx_year_resp_assignments_year_member
  on public.year_responsibility_assignments (scout_year_id, member_id);

create index if not exists idx_year_resp_assignments_event
  on public.year_responsibility_assignments (event_id);

create or replace function public.guard_year_responsibility_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_year_id uuid;
  v_is_active_chef boolean := false;
begin
  select e.scout_year_id
  into v_event_year_id
  from public.year_responsibility_events e
  where e.id = new.event_id;

  if v_event_year_id is null then
    raise exception 'Responsibility event not found';
  end if;

  if new.scout_year_id is null then
    new.scout_year_id := v_event_year_id;
  end if;

  if new.scout_year_id <> v_event_year_id then
    raise exception 'Assignment scout year must match event scout year';
  end if;

  select exists (
    select 1
    from public.members m
    left join public.member_season_assignments msa
      on msa.member_id = m.id
     and msa.scout_year_id = new.scout_year_id
    where m.id = new.member_id
      and m.auth_user_id is not null
      and coalesce(msa.is_active, true) = true
      and coalesce(msa.is_equipier, m.is_equipier, false) = false
  ) into v_is_active_chef;

  if not coalesce(v_is_active_chef, false) then
    raise exception 'Only active chefs/leaders with login accounts can be assigned to year responsibilities';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_year_resp_events_updated_at on public.year_responsibility_events;
create trigger trg_year_resp_events_updated_at
before update on public.year_responsibility_events
for each row execute function public.set_updated_at();

drop trigger if exists trg_year_resp_assignment_guard on public.year_responsibility_assignments;
create trigger trg_year_resp_assignment_guard
before insert or update on public.year_responsibility_assignments
for each row execute function public.guard_year_responsibility_assignment();

alter table public.year_responsibility_events enable row level security;
alter table public.year_responsibility_assignments enable row level security;

drop policy if exists "year responsibilities events read authenticated" on public.year_responsibility_events;
drop policy if exists "year responsibilities events insert admin" on public.year_responsibility_events;
drop policy if exists "year responsibilities events update admin" on public.year_responsibility_events;
drop policy if exists "year responsibilities events delete admin" on public.year_responsibility_events;

create policy "year responsibilities events read authenticated"
  on public.year_responsibility_events
  for select
  using (auth.uid() is not null);

create policy "year responsibilities events insert admin"
  on public.year_responsibility_events
  for insert
  with check (public.year_responsibilities_is_admin());

create policy "year responsibilities events update admin"
  on public.year_responsibility_events
  for update
  using (public.year_responsibilities_is_admin())
  with check (public.year_responsibilities_is_admin());

create policy "year responsibilities events delete admin"
  on public.year_responsibility_events
  for delete
  using (public.year_responsibilities_is_admin());


drop policy if exists "year responsibilities assignments read authenticated" on public.year_responsibility_assignments;
drop policy if exists "year responsibilities assignments insert admin" on public.year_responsibility_assignments;
drop policy if exists "year responsibilities assignments update admin" on public.year_responsibility_assignments;
drop policy if exists "year responsibilities assignments delete admin" on public.year_responsibility_assignments;

create policy "year responsibilities assignments read authenticated"
  on public.year_responsibility_assignments
  for select
  using (auth.uid() is not null);

create policy "year responsibilities assignments insert admin"
  on public.year_responsibility_assignments
  for insert
  with check (public.year_responsibilities_is_admin());

create policy "year responsibilities assignments update admin"
  on public.year_responsibility_assignments
  for update
  using (public.year_responsibilities_is_admin())
  with check (public.year_responsibilities_is_admin());

create policy "year responsibilities assignments delete admin"
  on public.year_responsibility_assignments
  for delete
  using (public.year_responsibilities_is_admin());

grant select, insert, update, delete on public.year_responsibility_events to authenticated;
grant select, insert, update, delete on public.year_responsibility_assignments to authenticated;
grant execute on function public.year_responsibilities_is_admin() to authenticated;
