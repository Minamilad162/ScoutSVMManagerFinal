-- Release 52: Manual attendance overrides for final chefs evaluation
-- Allows the displayed final attendance to be corrected manually per member/year.
-- If no override exists, the application keeps using calculated attendance from meetings/evaluations.

create table if not exists public.final_attendance_overrides (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  year integer not null,
  present_count integer not null check (present_count >= 0),
  total_count integer not null check (total_count >= 0 and present_count <= total_count),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, year)
);

alter table public.final_attendance_overrides enable row level security;

drop policy if exists "final attendance overrides read by team or admin" on public.final_attendance_overrides;
drop policy if exists "final attendance overrides insert by team or admin" on public.final_attendance_overrides;
drop policy if exists "final attendance overrides update by team or admin" on public.final_attendance_overrides;
drop policy if exists "final attendance overrides delete by team or admin" on public.final_attendance_overrides;

create policy "final attendance overrides read by team or admin"
  on public.final_attendance_overrides
  for select
  using (
    public.has_role('admin')
    or exists (
      select 1
      from public.members m
      where m.id = final_attendance_overrides.member_id
        and m.team_id = public.user_team_id(auth.uid())
    )
  );

create policy "final attendance overrides insert by team or admin"
  on public.final_attendance_overrides
  for insert
  with check (
    public.has_role('admin')
    or exists (
      select 1
      from public.members m
      where m.id = final_attendance_overrides.member_id
        and m.team_id = public.user_team_id(auth.uid())
    )
  );

create policy "final attendance overrides update by team or admin"
  on public.final_attendance_overrides
  for update
  using (
    public.has_role('admin')
    or exists (
      select 1
      from public.members m
      where m.id = final_attendance_overrides.member_id
        and m.team_id = public.user_team_id(auth.uid())
    )
  )
  with check (
    public.has_role('admin')
    or exists (
      select 1
      from public.members m
      where m.id = final_attendance_overrides.member_id
        and m.team_id = public.user_team_id(auth.uid())
    )
  );

create policy "final attendance overrides delete by team or admin"
  on public.final_attendance_overrides
  for delete
  using (
    public.has_role('admin')
    or exists (
      select 1
      from public.members m
      where m.id = final_attendance_overrides.member_id
        and m.team_id = public.user_team_id(auth.uid())
    )
  );

grant select, insert, update, delete on public.final_attendance_overrides to authenticated;
