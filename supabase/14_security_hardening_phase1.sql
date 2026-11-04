-- ScoutSVM Release 95
-- Phase 1 security hardening migration.
-- Safe to run after the current production schema is present.

begin;

-- ---------------------------------------------------------------------------
-- 1) Legacy user_roles compatibility: allow global roles (team_id IS NULL)
--    while keeping a stable row id used by the current frontend.
-- ---------------------------------------------------------------------------
do $$
declare
  pk_name text;
  pk_def text;
begin
  if to_regclass('public.user_roles') is null then
    raise exception 'public.user_roles is missing; apply the base schema before Release 95 hardening';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'user_roles' and column_name = 'id'
  ) then
    alter table public.user_roles add column id uuid default gen_random_uuid();
    update public.user_roles set id = gen_random_uuid() where id is null;
  end if;

  select c.conname, pg_get_constraintdef(c.oid)
    into pk_name, pk_def
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'user_roles'
    and c.contype = 'p'
  limit 1;

  -- The old composite PK implicitly made team_id NOT NULL and therefore
  -- prevented global roles. Replace only when the PK is not already id-based.
  if pk_name is not null and position('(id)' in replace(pk_def, ' ', '')) = 0 then
    execute format('alter table public.user_roles drop constraint %I', pk_name);
  end if;

  alter table public.user_roles alter column team_id drop not null;
  alter table public.user_roles alter column user_id set not null;
  alter table public.user_roles alter column role_id set not null;

  -- If there is no primary key now, promote id.
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public' and t.relname = 'user_roles' and c.contype = 'p'
  ) then
    update public.user_roles set id = gen_random_uuid() where id is null;
    alter table public.user_roles alter column id set not null;
    alter table public.user_roles add constraint user_roles_pkey primary key (id);
  end if;
end $$;

create unique index if not exists uq_user_roles_team_scoped
  on public.user_roles (user_id, role_id, team_id)
  where team_id is not null;

create unique index if not exists uq_user_roles_global
  on public.user_roles (user_id, role_id)
  where team_id is null;

-- ---------------------------------------------------------------------------
-- 2) RLS helper functions. SECURITY DEFINER avoids self-recursion when a
--    policy on user_roles/members calls a helper that reads the same table.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(_role text, _team uuid default null)
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
      and r.role_slug = _role
      and ( (_team is null and ur.team_id is null) or ur.team_id = _team )
  );
$$;

create or replace function public.user_team_id(_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.team_id
  from public.members m
  where m.auth_user_id = _user
  limit 1;
$$;

revoke all on function public.has_role(text, uuid) from public;
grant execute on function public.has_role(text, uuid) to authenticated;
revoke all on function public.user_team_id(uuid) from public;
grant execute on function public.user_team_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Fix unrestricted admin INSERT checks.
-- ---------------------------------------------------------------------------
drop policy if exists "members admin modify" on public.members;
create policy "members admin modify" on public.members
  for all
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "user_roles read self" on public.user_roles;
create policy "user_roles read self" on public.user_roles
  for select
  using (user_id = auth.uid());

drop policy if exists "user_roles admin modify" on public.user_roles;
create policy "user_roles admin modify" on public.user_roles
  for all
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "team_links admin modify" on public.team_links;
create policy "team_links admin modify" on public.team_links
  for all
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "materials modify by global RM or admin" on public.materials;
create policy "materials modify by global RM or admin" on public.materials
  for all
  using (public.has_role('admin') or public.has_role('responsable_materials'))
  with check (public.has_role('admin') or public.has_role('responsable_materials'));

drop policy if exists "field_zones modify admin" on public.field_zones;
create policy "field_zones modify admin" on public.field_zones
  for all
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

drop policy if exists "eval_q admin modify" on public.evaluation_questions;
create policy "eval_q admin modify" on public.evaluation_questions
  for all
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- ---------------------------------------------------------------------------
-- 4) Meetings and attendance: enforce the documented roles at the DB layer.
-- ---------------------------------------------------------------------------
drop policy if exists "meetings create by lead/secretary" on public.meetings;
create policy "meetings create by lead/secretary" on public.meetings
  for insert
  with check (
    public.has_role('admin') or
    (
      team_id = public.user_team_id(auth.uid()) and
      (
        public.has_role('chef_de_legion', team_id) or
        public.has_role('responsable_secretary', team_id)
      )
    )
  );

drop policy if exists "meetings update by lead/secretary" on public.meetings;
create policy "meetings update by lead/secretary" on public.meetings
  for update
  using (
    public.has_role('admin') or
    (
      team_id = public.user_team_id(auth.uid()) and
      (
        public.has_role('chef_de_legion', team_id) or
        public.has_role('responsable_secretary', team_id)
      )
    )
  )
  with check (
    public.has_role('admin') or
    (
      team_id = public.user_team_id(auth.uid()) and
      (
        public.has_role('chef_de_legion', team_id) or
        public.has_role('responsable_secretary', team_id)
      )
    )
  );

drop policy if exists "attendance modify by team" on public.attendance;
drop policy if exists "attendance modify by authorized role" on public.attendance;
create policy "attendance modify by authorized role" on public.attendance
  for all
  using (
    public.has_role('admin') or exists (
      select 1
      from public.meetings mt
      join public.members mb on mb.id = attendance.member_id
      where mt.id = attendance.meeting_id
        and mt.team_id = public.user_team_id(auth.uid())
        and (
          public.has_role('chef_de_legion', mt.team_id) or
          (
            public.has_role('responsable_secretary', mt.team_id)
            and mb.is_equipier = true
            and mt.mtype = 'meeting'
          )
        )
    )
  )
  with check (
    public.has_role('admin') or exists (
      select 1
      from public.meetings mt
      join public.members mb on mb.id = attendance.member_id
      where mt.id = attendance.meeting_id
        and mt.team_id = public.user_team_id(auth.uid())
        and (
          public.has_role('chef_de_legion', mt.team_id) or
          (
            public.has_role('responsable_secretary', mt.team_id)
            and mb.is_equipier = true
            and mt.mtype = 'meeting'
          )
        )
    )
  );

-- Align database permissions with the current TeamFinance/Finance UI gate:
-- Chef de Legion and Responsable Finance can modify expenses for their own team.
drop policy if exists "expenses modify" on public.expenses;
create policy "expenses modify" on public.expenses
  for all
  using (
    public.has_role('admin') or
    (
      team_id = public.user_team_id(auth.uid()) and
      (
        public.has_role('responsable_finance', team_id) or
        public.has_role('chef_de_legion', team_id)
      )
    )
  )
  with check (
    public.has_role('admin') or
    (
      team_id = public.user_team_id(auth.uid()) and
      (
        public.has_role('responsable_finance', team_id) or
        public.has_role('chef_de_legion', team_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Evaluation answers: read follows readable parent evaluation; writes are
--    limited to admin or Chef de Legion for the parent evaluation team.
-- ---------------------------------------------------------------------------
-- Tighten the parent evaluation read boundary as documented: admin/ancien,
-- Chef de Legion for own team, or the evaluated member themselves.
drop policy if exists "eval read" on public.evaluations;
create policy "eval read" on public.evaluations
  for select
  using (
    public.has_role('admin') or
    public.has_role('ancien') or
    (team_id = public.user_team_id(auth.uid()) and public.has_role('chef_de_legion', team_id)) or
    exists (
      select 1 from public.members m
      where m.id = evaluations.evaluatee_member_id and m.auth_user_id = auth.uid()
    )
  );

drop policy if exists "eval_answers follow eval" on public.evaluation_answers;
drop policy if exists "eval_answers read authorized" on public.evaluation_answers;
drop policy if exists "eval_answers write authorized" on public.evaluation_answers;

create policy "eval_answers read authorized" on public.evaluation_answers
  for select
  using (
    exists (
      select 1
      from public.evaluations e
      where e.id = evaluation_answers.evaluation_id
        and (
          public.has_role('admin') or
          public.has_role('ancien') or
          (e.team_id = public.user_team_id(auth.uid()) and public.has_role('chef_de_legion', e.team_id)) or
          exists (
            select 1
            from public.members m
            where m.id = e.evaluatee_member_id
              and m.auth_user_id = auth.uid()
          )
        )
    )
  );

create policy "eval_answers write authorized" on public.evaluation_answers
  for all
  using (
    exists (
      select 1
      from public.evaluations e
      where e.id = evaluation_answers.evaluation_id
        and (
          public.has_role('admin') or
          (
            e.team_id = public.user_team_id(auth.uid()) and
            public.has_role('chef_de_legion', e.team_id)
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.evaluations e
      where e.id = evaluation_answers.evaluation_id
        and (
          public.has_role('admin') or
          (
            e.team_id = public.user_team_id(auth.uid()) and
            public.has_role('chef_de_legion', e.team_id)
          )
        )
    )
  );

commit;
