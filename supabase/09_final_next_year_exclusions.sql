-- Release 53: Next-year statistics exclusion flags for final chefs evaluation
-- Admins can mark a member as "not available next year" so the member remains visible/evaluable,
-- but is excluded from rank statistics before/after promotion.

create table if not exists public.final_next_year_exclusions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  year integer not null,
  exclude_from_next_year_stats boolean not null default true,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, year)
);

alter table public.final_next_year_exclusions enable row level security;

drop policy if exists "final next year exclusions read by team or admin" on public.final_next_year_exclusions;
drop policy if exists "final next year exclusions insert by admin" on public.final_next_year_exclusions;
drop policy if exists "final next year exclusions update by admin" on public.final_next_year_exclusions;
drop policy if exists "final next year exclusions delete by admin" on public.final_next_year_exclusions;

create policy "final next year exclusions read by team or admin"
  on public.final_next_year_exclusions
  for select
  using (
    public.has_role('admin')
    or exists (
      select 1
      from public.members m
      where m.id = final_next_year_exclusions.member_id
        and m.team_id = public.user_team_id(auth.uid())
    )
  );

create policy "final next year exclusions insert by admin"
  on public.final_next_year_exclusions
  for insert
  with check (public.has_role('admin'));

create policy "final next year exclusions update by admin"
  on public.final_next_year_exclusions
  for update
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy "final next year exclusions delete by admin"
  on public.final_next_year_exclusions
  for delete
  using (public.has_role('admin'));

grant select, insert, update, delete on public.final_next_year_exclusions to authenticated;
