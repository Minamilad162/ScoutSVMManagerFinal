-- Release 54: Final evaluation potential flags, manual rank statistics, and admin-only vote policies
-- 1) Potential flags are admin-controlled markers used for filtering candidate chefs.
-- 2) Rank statistic adjustments allow admins to add manual extra counts per rank/year.
-- 3) Final votes are kept admin-only and deletable so clearing a vote is persisted.

-- Ensure final_votes is available for projects that were created before this table was scripted.
create table if not exists public.final_votes (
  member_id uuid not null references public.members(id) on delete cascade,
  year integer not null,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  promote boolean,
  exceptional boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (member_id, year, voter_user_id)
);

alter table public.final_votes enable row level security;

drop policy if exists "final votes read by team or admin" on public.final_votes;
drop policy if exists "final votes insert by admin" on public.final_votes;
drop policy if exists "final votes update by admin" on public.final_votes;
drop policy if exists "final votes delete by admin" on public.final_votes;
drop policy if exists "final votes insert by voters" on public.final_votes;
drop policy if exists "final votes update by voters" on public.final_votes;
drop policy if exists "final votes delete by voters" on public.final_votes;

create policy "final votes read by team or admin"
  on public.final_votes
  for select
  using (
    public.has_role('admin')
    or exists (
      select 1
      from public.members m
      where m.id = final_votes.member_id
        and m.team_id = public.user_team_id(auth.uid())
    )
  );

create policy "final votes insert by admin"
  on public.final_votes
  for insert
  with check (public.has_role('admin'));

create policy "final votes update by admin"
  on public.final_votes
  for update
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy "final votes delete by admin"
  on public.final_votes
  for delete
  using (public.has_role('admin'));

grant select, insert, update, delete on public.final_votes to authenticated;

-- Potential flags
create table if not exists public.final_potential_flags (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  year integer not null,
  is_potential boolean not null default true,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, year)
);

alter table public.final_potential_flags enable row level security;

drop policy if exists "final potential flags read by team or admin" on public.final_potential_flags;
drop policy if exists "final potential flags insert by admin" on public.final_potential_flags;
drop policy if exists "final potential flags update by admin" on public.final_potential_flags;
drop policy if exists "final potential flags delete by admin" on public.final_potential_flags;

create policy "final potential flags read by team or admin"
  on public.final_potential_flags
  for select
  using (
    public.has_role('admin')
    or exists (
      select 1
      from public.members m
      where m.id = final_potential_flags.member_id
        and m.team_id = public.user_team_id(auth.uid())
    )
  );

create policy "final potential flags insert by admin"
  on public.final_potential_flags
  for insert
  with check (public.has_role('admin'));

create policy "final potential flags update by admin"
  on public.final_potential_flags
  for update
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy "final potential flags delete by admin"
  on public.final_potential_flags
  for delete
  using (public.has_role('admin'));

grant select, insert, update, delete on public.final_potential_flags to authenticated;

-- Manual extra counts for rank statistics
create table if not exists public.final_rank_stat_adjustments (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  rank_id integer not null references public.ranks(id) on delete cascade,
  extra_count integer not null default 0 check (extra_count >= 0),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, rank_id)
);

alter table public.final_rank_stat_adjustments enable row level security;

drop policy if exists "final rank stat adjustments read" on public.final_rank_stat_adjustments;
drop policy if exists "final rank stat adjustments insert by admin" on public.final_rank_stat_adjustments;
drop policy if exists "final rank stat adjustments update by admin" on public.final_rank_stat_adjustments;
drop policy if exists "final rank stat adjustments delete by admin" on public.final_rank_stat_adjustments;

create policy "final rank stat adjustments read"
  on public.final_rank_stat_adjustments
  for select
  using (auth.role() = 'authenticated');

create policy "final rank stat adjustments insert by admin"
  on public.final_rank_stat_adjustments
  for insert
  with check (public.has_role('admin'));

create policy "final rank stat adjustments update by admin"
  on public.final_rank_stat_adjustments
  for update
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy "final rank stat adjustments delete by admin"
  on public.final_rank_stat_adjustments
  for delete
  using (public.has_role('admin'));

grant select, insert, update, delete on public.final_rank_stat_adjustments to authenticated;
