-- Camp Daily Program / نظام برنامج المعسكر
-- Apply this file after the existing camp_installments tables have been created.

create or replace function public.has_any_role(_role text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.role_slug = _role
  );
$$;

create table if not exists public.camp_daily_plans (
  id uuid primary key default gen_random_uuid(),
  camp_id uuid not null references public.camp_installments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  plan_date date not null,
  day_title text,
  day_theme text,
  notes text,
  assistant_day_leader_member_id uuid references public.members(id) on delete set null,
  assistant_day_leader_name text,
  assistant_day_leader_note text,
  first_sergeant_member_id uuid references public.members(id) on delete set null,
  first_sergeant_name text,
  first_sergeant_note text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  soft_deleted_at timestamptz
);

create unique index if not exists idx_camp_daily_plans_unique_active
  on public.camp_daily_plans (camp_id, team_id, plan_date)
  where soft_deleted_at is null;

create index if not exists idx_camp_daily_plans_camp_team_date
  on public.camp_daily_plans (camp_id, team_id, plan_date);

create table if not exists public.camp_program_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.camp_daily_plans(id) on delete cascade,
  title text not null,
  start_time time not null,
  end_time time not null,
  location text,
  manual_materials text,
  manual_assignees text,
  notes text,
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  soft_deleted_at timestamptz,
  check (end_time > start_time)
);

create index if not exists idx_camp_program_items_plan_time
  on public.camp_program_items (plan_id, start_time, end_time);

create table if not exists public.camp_program_item_materials (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.camp_program_items(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  material_name text not null,
  qty numeric(12,2) default 1 check (qty is null or qty > 0),
  created_at timestamptz not null default now(),
  unique (item_id, material_id)
);

create index if not exists idx_camp_program_item_materials_material
  on public.camp_program_item_materials (material_id);

create table if not exists public.camp_program_item_members (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.camp_program_items(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  member_name text not null,
  created_at timestamptz not null default now(),
  unique (item_id, member_id)
);

create table if not exists public.camp_program_item_teams (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.camp_program_items(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  team_name text not null,
  created_at timestamptz not null default now(),
  unique (item_id, team_id)
);

alter table public.camp_daily_plans enable row level security;
alter table public.camp_program_items enable row level security;
alter table public.camp_program_item_materials enable row level security;
alter table public.camp_program_item_members enable row level security;
alter table public.camp_program_item_teams enable row level security;

drop policy if exists "camp_daily_plans read by chefs" on public.camp_daily_plans;
create policy "camp_daily_plans read by chefs" on public.camp_daily_plans
  for select using (
    auth.uid() is not null
    and (public.has_role('admin') or public.has_any_role('chef_de_legion'))
  );

drop policy if exists "camp_daily_plans modify own team" on public.camp_daily_plans;
create policy "camp_daily_plans modify own team" on public.camp_daily_plans
  for all using (
    public.has_role('admin')
    or public.has_role('chef_de_legion', team_id)
  )
  with check (
    public.has_role('admin')
    or public.has_role('chef_de_legion', team_id)
  );

drop policy if exists "camp_program_items read by chefs" on public.camp_program_items;
create policy "camp_program_items read by chefs" on public.camp_program_items
  for select using (
    exists (
      select 1
      from public.camp_daily_plans p
      where p.id = camp_program_items.plan_id
        and p.soft_deleted_at is null
        and (public.has_role('admin') or public.has_any_role('chef_de_legion'))
    )
  );

drop policy if exists "camp_program_items modify own team" on public.camp_program_items;
create policy "camp_program_items modify own team" on public.camp_program_items
  for all using (
    exists (
      select 1
      from public.camp_daily_plans p
      where p.id = camp_program_items.plan_id
        and (public.has_role('admin') or public.has_role('chef_de_legion', p.team_id))
    )
  )
  with check (
    exists (
      select 1
      from public.camp_daily_plans p
      where p.id = camp_program_items.plan_id
        and (public.has_role('admin') or public.has_role('chef_de_legion', p.team_id))
    )
  );

drop policy if exists "camp_item_materials read by chefs" on public.camp_program_item_materials;
create policy "camp_item_materials read by chefs" on public.camp_program_item_materials
  for select using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_materials.item_id
        and i.soft_deleted_at is null
        and p.soft_deleted_at is null
        and (public.has_role('admin') or public.has_any_role('chef_de_legion'))
    )
  );

drop policy if exists "camp_item_materials modify own team" on public.camp_program_item_materials;
create policy "camp_item_materials modify own team" on public.camp_program_item_materials
  for all using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_materials.item_id
        and (public.has_role('admin') or public.has_role('chef_de_legion', p.team_id))
    )
  )
  with check (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_materials.item_id
        and (public.has_role('admin') or public.has_role('chef_de_legion', p.team_id))
    )
  );

drop policy if exists "camp_item_members read by chefs" on public.camp_program_item_members;
create policy "camp_item_members read by chefs" on public.camp_program_item_members
  for select using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_members.item_id
        and i.soft_deleted_at is null
        and p.soft_deleted_at is null
        and (public.has_role('admin') or public.has_any_role('chef_de_legion'))
    )
  );

drop policy if exists "camp_item_members modify own team" on public.camp_program_item_members;
create policy "camp_item_members modify own team" on public.camp_program_item_members
  for all using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_members.item_id
        and (public.has_role('admin') or public.has_role('chef_de_legion', p.team_id))
    )
  )
  with check (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_members.item_id
        and (public.has_role('admin') or public.has_role('chef_de_legion', p.team_id))
    )
  );

drop policy if exists "camp_item_teams read by chefs" on public.camp_program_item_teams;
create policy "camp_item_teams read by chefs" on public.camp_program_item_teams
  for select using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_teams.item_id
        and i.soft_deleted_at is null
        and p.soft_deleted_at is null
        and (public.has_role('admin') or public.has_any_role('chef_de_legion'))
    )
  );

drop policy if exists "camp_item_teams modify own team" on public.camp_program_item_teams;
create policy "camp_item_teams modify own team" on public.camp_program_item_teams
  for all using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_teams.item_id
        and (public.has_role('admin') or public.has_role('chef_de_legion', p.team_id))
    )
  )
  with check (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_teams.item_id
        and (public.has_role('admin') or public.has_role('chef_de_legion', p.team_id))
    )
  );

-- Release 33: Camp resource booking enhancements / تحسينات حجز موارد المعسكر
-- Rooms are intentionally separate from materials, and are scoped only to the camp daily program module.

create table if not exists public.camp_program_item_rooms (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.camp_program_items(id) on delete cascade,
  room_key text not null check (room_key in ('large_hall', 'small_hall')),
  room_name text not null,
  created_at timestamptz not null default now(),
  unique (item_id)
);

create index if not exists idx_camp_program_item_rooms_room
  on public.camp_program_item_rooms (room_key);

alter table public.camp_program_item_rooms enable row level security;

drop policy if exists "camp_item_rooms read by chefs" on public.camp_program_item_rooms;
create policy "camp_item_rooms read by chefs" on public.camp_program_item_rooms
  for select using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_rooms.item_id
        and i.soft_deleted_at is null
        and p.soft_deleted_at is null
        and (public.has_role('admin') or public.has_any_role('chef_de_legion'))
    )
  );

drop policy if exists "camp_item_rooms modify own team" on public.camp_program_item_rooms;
create policy "camp_item_rooms modify own team" on public.camp_program_item_rooms
  for all using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_rooms.item_id
        and (public.has_role('admin') or public.has_role('chef_de_legion', p.team_id))
    )
  )
  with check (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_rooms.item_id
        and (public.has_role('admin') or public.has_role('chef_de_legion', p.team_id))
    )
  );

-- Release 37: Premium PDF branding, per-row colors, and delegated team access
-- تحسين هوية ملف PDF، ألوان الفقرات، وتفويض صلاحية نظام المعسكر من قائد الفريق

-- 1) PDF row colors are stored with each activity.
alter table public.camp_program_items
  add column if not exists row_background_color text not null default '#ffffff';

alter table public.camp_program_items
  add column if not exists row_text_color text not null default '#0f172a';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'camp_program_items_row_background_color_check'
      and conrelid = 'public.camp_program_items'::regclass
  ) then
    alter table public.camp_program_items
      add constraint camp_program_items_row_background_color_check
      check (row_background_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'camp_program_items_row_text_color_check'
      and conrelid = 'public.camp_program_items'::regclass
  ) then
    alter table public.camp_program_items
      add constraint camp_program_items_row_text_color_check
      check (row_text_color ~ '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

-- Release 35 introduced a third small hall in the UI. Keep the room constraint aligned.
alter table public.camp_program_item_rooms
  drop constraint if exists camp_program_item_rooms_room_key_check;

alter table public.camp_program_item_rooms
  add constraint camp_program_item_rooms_room_key_check
  check (room_key in ('large_hall', 'small_hall', 'small_hall_3'));

-- 2) Delegated access is module-specific. It does not create or modify any system role.
create table if not exists public.camp_program_team_access (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, user_id),
  unique (team_id, member_id)
);

create index if not exists idx_camp_program_team_access_user
  on public.camp_program_team_access (user_id, is_active);

create index if not exists idx_camp_program_team_access_team
  on public.camp_program_team_access (team_id, is_active);

create or replace function public.validate_camp_program_team_access()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.members m
    where m.id = new.member_id
      and m.team_id = new.team_id
      and m.auth_user_id = new.user_id
      and coalesce(m.is_equipier, false) = false
  ) then
    raise exception 'The selected chef must belong to the selected team and have the same linked login account.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_validate_camp_program_team_access on public.camp_program_team_access;
create trigger trg_validate_camp_program_team_access
before insert or update on public.camp_program_team_access
for each row execute function public.validate_camp_program_team_access();

-- Access helpers use SECURITY DEFINER so checking a user's own module grant does not
-- depend on the caller being able to read the full user_roles/access tables.
create or replace function public.has_any_camp_program_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and r.role_slug in ('admin', 'chef_de_legion')
    )
    or exists (
      select 1
      from public.camp_program_team_access a
      where a.user_id = auth.uid()
        and a.is_active = true
    );
$$;

create or replace function public.has_camp_program_access(_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and (
          r.role_slug = 'admin'
          or (r.role_slug = 'chef_de_legion' and ur.team_id = _team)
        )
    )
    or exists (
      select 1
      from public.camp_program_team_access a
      where a.user_id = auth.uid()
        and a.team_id = _team
        and a.is_active = true
    );
$$;

create or replace function public.can_manage_camp_program_access(_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and (
        r.role_slug = 'admin'
        or (r.role_slug = 'chef_de_legion' and ur.team_id = _team)
      )
  );
$$;

alter table public.camp_program_team_access enable row level security;

drop policy if exists "camp program access read self or manager" on public.camp_program_team_access;
create policy "camp program access read self or manager"
on public.camp_program_team_access
for select
using (
  user_id = auth.uid()
  or public.can_manage_camp_program_access(team_id)
);

drop policy if exists "camp program access insert by team leader" on public.camp_program_team_access;
create policy "camp program access insert by team leader"
on public.camp_program_team_access
for insert
with check (public.can_manage_camp_program_access(team_id));

drop policy if exists "camp program access update by team leader" on public.camp_program_team_access;
create policy "camp program access update by team leader"
on public.camp_program_team_access
for update
using (public.can_manage_camp_program_access(team_id))
with check (public.can_manage_camp_program_access(team_id));

drop policy if exists "camp program access delete by team leader" on public.camp_program_team_access;
create policy "camp program access delete by team leader"
on public.camp_program_team_access
for delete
using (public.can_manage_camp_program_access(team_id));

-- Delegated users need to see the camp selector used by this module.
drop policy if exists "camp installments read by camp program access" on public.camp_installments;
create policy "camp installments read by camp program access"
on public.camp_installments
for select
using (public.has_any_camp_program_access());

-- 3) Rebuild module policies to include delegated users.
drop policy if exists "camp_daily_plans read by chefs" on public.camp_daily_plans;
create policy "camp_daily_plans read by chefs" on public.camp_daily_plans
  for select using (
    auth.uid() is not null
    and public.has_any_camp_program_access()
  );

drop policy if exists "camp_daily_plans modify own team" on public.camp_daily_plans;
create policy "camp_daily_plans modify own team" on public.camp_daily_plans
  for all using (public.has_camp_program_access(team_id))
  with check (public.has_camp_program_access(team_id));

drop policy if exists "camp_program_items read by chefs" on public.camp_program_items;
create policy "camp_program_items read by chefs" on public.camp_program_items
  for select using (
    exists (
      select 1
      from public.camp_daily_plans p
      where p.id = camp_program_items.plan_id
        and p.soft_deleted_at is null
        and public.has_any_camp_program_access()
    )
  );

drop policy if exists "camp_program_items modify own team" on public.camp_program_items;
create policy "camp_program_items modify own team" on public.camp_program_items
  for all using (
    exists (
      select 1
      from public.camp_daily_plans p
      where p.id = camp_program_items.plan_id
        and public.has_camp_program_access(p.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.camp_daily_plans p
      where p.id = camp_program_items.plan_id
        and public.has_camp_program_access(p.team_id)
    )
  );

drop policy if exists "camp_item_materials read by chefs" on public.camp_program_item_materials;
create policy "camp_item_materials read by chefs" on public.camp_program_item_materials
  for select using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_materials.item_id
        and i.soft_deleted_at is null
        and p.soft_deleted_at is null
        and public.has_any_camp_program_access()
    )
  );

drop policy if exists "camp_item_materials modify own team" on public.camp_program_item_materials;
create policy "camp_item_materials modify own team" on public.camp_program_item_materials
  for all using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_materials.item_id
        and public.has_camp_program_access(p.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_materials.item_id
        and public.has_camp_program_access(p.team_id)
    )
  );

drop policy if exists "camp_item_members read by chefs" on public.camp_program_item_members;
create policy "camp_item_members read by chefs" on public.camp_program_item_members
  for select using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_members.item_id
        and i.soft_deleted_at is null
        and p.soft_deleted_at is null
        and public.has_any_camp_program_access()
    )
  );

drop policy if exists "camp_item_members modify own team" on public.camp_program_item_members;
create policy "camp_item_members modify own team" on public.camp_program_item_members
  for all using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_members.item_id
        and public.has_camp_program_access(p.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_members.item_id
        and public.has_camp_program_access(p.team_id)
    )
  );

drop policy if exists "camp_item_teams read by chefs" on public.camp_program_item_teams;
create policy "camp_item_teams read by chefs" on public.camp_program_item_teams
  for select using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_teams.item_id
        and i.soft_deleted_at is null
        and p.soft_deleted_at is null
        and public.has_any_camp_program_access()
    )
  );

drop policy if exists "camp_item_teams modify own team" on public.camp_program_item_teams;
create policy "camp_item_teams modify own team" on public.camp_program_item_teams
  for all using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_teams.item_id
        and public.has_camp_program_access(p.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_teams.item_id
        and public.has_camp_program_access(p.team_id)
    )
  );

drop policy if exists "camp_item_rooms read by chefs" on public.camp_program_item_rooms;
create policy "camp_item_rooms read by chefs" on public.camp_program_item_rooms
  for select using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_rooms.item_id
        and i.soft_deleted_at is null
        and p.soft_deleted_at is null
        and public.has_any_camp_program_access()
    )
  );

drop policy if exists "camp_item_rooms modify own team" on public.camp_program_item_rooms;
create policy "camp_item_rooms modify own team" on public.camp_program_item_rooms
  for all using (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_rooms.item_id
        and public.has_camp_program_access(p.team_id)
    )
  )
  with check (
    exists (
      select 1
      from public.camp_program_items i
      join public.camp_daily_plans p on p.id = i.plan_id
      where i.id = camp_program_item_rooms.item_id
        and public.has_camp_program_access(p.team_id)
    )
  );


-- Release 38: Optional day theme + safer one-day-per-page PDF layout
-- إضافة Theme اختياري لكل يوم. تعديل صفحات PDF يتم في الواجهة، بينما هذا العمود يحفظ البيانات.
alter table public.camp_daily_plans
  add column if not exists day_theme text;

-- Release 40: Daily leadership assignments + fixed daily schedule
-- إضافة مساعد قائد اليوم وعريف أول اليوم. الفقرات الثابتة نفسها تُنشأ افتراضيًا في الواجهة والـ PDF
-- وتُستخدم كفترات محظورة عند إضافة أي فقرة جديدة.
alter table public.camp_daily_plans
  add column if not exists assistant_day_leader_member_id uuid references public.members(id) on delete set null;

alter table public.camp_daily_plans
  add column if not exists assistant_day_leader_name text;

alter table public.camp_daily_plans
  add column if not exists assistant_day_leader_note text;

alter table public.camp_daily_plans
  add column if not exists first_sergeant_member_id uuid references public.members(id) on delete set null;

alter table public.camp_daily_plans
  add column if not exists first_sergeant_name text;

alter table public.camp_daily_plans
  add column if not exists first_sergeant_note text;

create index if not exists idx_camp_daily_plans_assistant_day_leader
  on public.camp_daily_plans (assistant_day_leader_member_id);

create index if not exists idx_camp_daily_plans_first_sergeant
  on public.camp_daily_plans (first_sergeant_member_id);

-- Server-side guard: Assistant Day Leader is required for every active day.
create or replace function public.validate_camp_daily_plan_leadership()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.soft_deleted_at is null and new.assistant_day_leader_member_id is null then
    raise exception 'Assistant Day Leader is required for every camp day.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_camp_daily_plan_leadership on public.camp_daily_plans;
create trigger trg_validate_camp_daily_plan_leadership
before insert or update
on public.camp_daily_plans
for each row execute function public.validate_camp_daily_plan_leadership();

-- Server-side guard: no editable activity may overlap the four fixed daily periods.
create or replace function public.validate_camp_program_item_fixed_periods()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.soft_deleted_at is not null then
    return new;
  end if;

  if (new.start_time < time '11:00' and time '10:00' < new.end_time) then
    raise exception 'Activity overlaps the fixed breakfast period (10:00-11:00).';
  end if;

  if (new.start_time < time '17:00' and time '16:00' < new.end_time) then
    raise exception 'Activity overlaps the fixed lunch period (16:00-17:00).';
  end if;

  if (new.start_time < time '18:00' and time '17:00' < new.end_time) then
    raise exception 'Activity overlaps the fixed Rovo period (17:00-18:00).';
  end if;

  if (new.start_time < time '23:00' and time '22:00' < new.end_time) then
    raise exception 'Activity overlaps the fixed dinner period (22:00-23:00).';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_camp_program_item_fixed_periods on public.camp_program_items;
create trigger trg_validate_camp_program_item_fixed_periods
before insert or update
on public.camp_program_items
for each row execute function public.validate_camp_program_item_fixed_periods();

-- Release 46: Overnight camp day support + room booking limit cleanup
-- اليوم التشغيلي للمعسكر يبدأ 06:00 ص وينتهي 04:00 ص من اليوم التالي.
-- لذلك يجب السماح بتوقيت نهاية أصغر من البداية عند عبور منتصف الليل، مثل 11:00 م - 2:00 ص.

create or replace function public.camp_program_operational_minutes(_time time)
returns integer
language sql
immutable
as $$
  select (extract(hour from _time)::int * 60 + extract(minute from _time)::int)
       + case when _time < time '06:00' then 1440 else 0 end;
$$;

alter table public.camp_program_items
  drop constraint if exists camp_program_items_check;

alter table public.camp_program_items
  drop constraint if exists camp_program_items_operational_time_check;

alter table public.camp_program_items
  add constraint camp_program_items_operational_time_check
  check (
    public.camp_program_operational_minutes(end_time) > public.camp_program_operational_minutes(start_time)
    and public.camp_program_operational_minutes(start_time) >= public.camp_program_operational_minutes(time '06:00')
    and public.camp_program_operational_minutes(end_time) <= public.camp_program_operational_minutes(time '04:00')
  );

create or replace function public.validate_camp_program_item_fixed_periods()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  _start integer;
  _end integer;
begin
  if new.soft_deleted_at is not null then
    return new;
  end if;

  _start := public.camp_program_operational_minutes(new.start_time);
  _end := public.camp_program_operational_minutes(new.end_time);

  if _end <= _start then
    raise exception 'Camp activity end time must be after start time within the camp day window (06:00-04:00).';
  end if;

  if _start < public.camp_program_operational_minutes(time '11:00')
     and public.camp_program_operational_minutes(time '10:00') < _end then
    raise exception 'Activity overlaps the fixed breakfast period (10:00-11:00).';
  end if;

  if _start < public.camp_program_operational_minutes(time '17:00')
     and public.camp_program_operational_minutes(time '16:00') < _end then
    raise exception 'Activity overlaps the fixed lunch period (16:00-17:00).';
  end if;

  if _start < public.camp_program_operational_minutes(time '18:00')
     and public.camp_program_operational_minutes(time '17:00') < _end then
    raise exception 'Activity overlaps the fixed Rovo period (17:00-18:00).';
  end if;

  if _start < public.camp_program_operational_minutes(time '23:00')
     and public.camp_program_operational_minutes(time '22:00') < _end then
    raise exception 'Activity overlaps the fixed dinner period (22:00-23:00).';
  end if;

  return new;
end;
$$;

-- No daily maximum is enforced for room bookings in the camp module.
-- The only hard room rule is still: the exact same room cannot be booked by two activities at overlapping times.

-- Release 47: Final cleanup for overnight camp day and old room daily-limit validators
-- 1) Remove any old check constraint that still forces end_time > start_time by name or definition.
do $$
declare
  _constraint record;
begin
  for _constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.camp_program_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%end_time%'
      and pg_get_constraintdef(oid) ilike '%start_time%'
      and conname <> 'camp_program_items_operational_time_check'
  loop
    execute format('alter table public.camp_program_items drop constraint if exists %I', _constraint.conname);
  end loop;
end $$;

alter table public.camp_program_items
  drop constraint if exists camp_program_items_operational_time_check;

alter table public.camp_program_items
  add constraint camp_program_items_operational_time_check
  check (
    public.camp_program_operational_minutes(end_time) > public.camp_program_operational_minutes(start_time)
    and public.camp_program_operational_minutes(start_time) >= public.camp_program_operational_minutes(time '06:00')
    and public.camp_program_operational_minutes(end_time) <= public.camp_program_operational_minutes(time '04:00')
  );

-- 2) Drop old room daily-limit/quota triggers if any earlier release created them.
do $$
declare
  _trigger record;
begin
  for _trigger in
    select tg.tgname, cls.relname
    from pg_trigger tg
    join pg_class cls on cls.oid = tg.tgrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and cls.relname in ('camp_program_items', 'camp_program_item_rooms')
      and not tg.tgisinternal
      and (
        lower(tg.tgname) like '%room%limit%'
        or lower(tg.tgname) like '%room%quota%'
        or lower(tg.tgname) like '%daily%room%'
        or lower(tg.tgname) like '%hall%limit%'
        or lower(tg.tgname) like '%hall%quota%'
      )
  loop
    execute format('drop trigger if exists %I on public.%I', _trigger.tgname, _trigger.relname);
  end loop;
end $$;

-- 3) Keep the current fixed-period trigger rebuilt after the overnight constraint cleanup.
drop trigger if exists trg_validate_camp_program_item_fixed_periods on public.camp_program_items;
create trigger trg_validate_camp_program_item_fixed_periods
before insert or update
on public.camp_program_items
for each row execute function public.validate_camp_program_item_fixed_periods();
