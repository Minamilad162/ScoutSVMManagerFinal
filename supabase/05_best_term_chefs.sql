-- Best chefs by term (current scout year aware)
create table if not exists public.term_best_chefs (
  id uuid not null default gen_random_uuid(),
  scout_year_id uuid not null,
  term_id uuid not null,
  member_id uuid not null,
  sort_order integer not null default 0,
  note text null,
  selected_by uuid null default auth.uid(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint term_best_chefs_pkey primary key (id),
  constraint term_best_chefs_unique unique (term_id, member_id),
  constraint term_best_chefs_scout_year_id_fkey foreign key (scout_year_id)
    references public.scout_years (id) on delete cascade,
  constraint term_best_chefs_term_id_fkey foreign key (term_id)
    references public.terms (id) on delete cascade,
  constraint term_best_chefs_member_id_fkey foreign key (member_id)
    references public.members (id) on delete cascade,
  constraint term_best_chefs_selected_by_fkey foreign key (selected_by)
    references auth.users (id) on delete set null
);

create index if not exists idx_term_best_chefs_term_sort
  on public.term_best_chefs (term_id, sort_order, created_at);

create index if not exists idx_term_best_chefs_scout_year
  on public.term_best_chefs (scout_year_id);

create trigger trg_term_best_chefs_updated_at
before update on public.term_best_chefs
for each row
execute function public.set_updated_at();

alter table public.term_best_chefs enable row level security;

create policy "term_best_chefs read authenticated" on public.term_best_chefs
  for select using (auth.uid() is not null);

create policy "term_best_chefs admin modify" on public.term_best_chefs
  for all using (public.has_role('admin'))
  with check (public.has_role('admin'));

create or replace view public.v_term_best_chefs_readable as
select
  btc.id,
  btc.scout_year_id,
  btc.term_id,
  t.name as term_name,
  btc.member_id,
  m.full_name,
  msa.team_id,
  tm.name as team_name,
  m.avatar_url,
  btc.sort_order,
  btc.note,
  btc.selected_by,
  btc.created_at,
  btc.updated_at
from public.term_best_chefs btc
join public.terms t
  on t.id = btc.term_id
join public.members m
  on m.id = btc.member_id
left join public.member_season_assignments msa
  on msa.member_id = btc.member_id
 and msa.scout_year_id = btc.scout_year_id
 and msa.is_active = true
left join public.teams tm
  on tm.id = msa.team_id;
