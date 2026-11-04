-- Release 58 — Term Evaluation Voice Notes
-- Adds private audio notes for term evaluations only.
-- Rules:
--   * Max 2 active voice notes per evaluatee per term.
--   * Max 3 minutes per voice note.
--   * Chef de legion for the same team and Admin can add/delete.
--   * Evaluatee can listen to their own saved voice notes.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evaluation-voice-notes',
  'evaluation-voice-notes',
  false,
  25000000,
  array['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.evaluation_voice_notes (
  id uuid primary key default gen_random_uuid(),
  evaluatee_member_id uuid not null references public.members(id) on delete cascade,
  evaluator_user_id uuid not null references auth.users(id) on delete cascade,
  evaluator_member_id uuid references public.members(id) on delete set null,
  evaluator_display_name text,
  team_id uuid not null references public.teams(id) on delete cascade,
  term_id uuid not null references public.terms(id) on delete cascade,
  storage_path text not null unique,
  mime_type text,
  duration_seconds int not null check (duration_seconds between 1 and 180),
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes > 0),
  created_at timestamptz not null default now(),
  soft_deleted_at timestamptz
);

create index if not exists evaluation_voice_notes_eval_idx
  on public.evaluation_voice_notes (evaluatee_member_id, term_id)
  where soft_deleted_at is null;

create index if not exists evaluation_voice_notes_team_term_idx
  on public.evaluation_voice_notes (team_id, term_id)
  where soft_deleted_at is null;

create or replace function public.eval_voice_has_role(_role text, _team uuid default null)
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
      and (
        (_team is null and ur.team_id is null)
        or (ur.team_id = _team)
        or (_role = 'admin' and ur.team_id is null)
      )
  );
$$;

create or replace function public.can_manage_evaluation_voice_note(_team uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.eval_voice_has_role('admin', null)
      or public.eval_voice_has_role('chef_de_legion', _team);
$$;

create or replace function public.can_read_evaluation_voice_note(_evaluatee_member_id uuid, _team uuid, _evaluator_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_evaluation_voice_note(_team)
      or _evaluator_user_id = auth.uid()
      or exists (
        select 1
        from public.members m
        where m.id = _evaluatee_member_id
          and m.auth_user_id = auth.uid()
      );
$$;

create or replace function public.can_read_evaluation_voice_note_path(_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.evaluation_voice_notes n
    where n.storage_path = _storage_path
      and n.soft_deleted_at is null
      and public.can_read_evaluation_voice_note(n.evaluatee_member_id, n.team_id, n.evaluator_user_id)
  );
$$;

create or replace function public.can_manage_evaluation_voice_note_path(_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.evaluation_voice_notes n
    where n.storage_path = _storage_path
      and public.can_manage_evaluation_voice_note(n.team_id)
  );
$$;

create or replace function public.enforce_evaluation_voice_notes_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count int;
begin
  if new.soft_deleted_at is null then
    select count(*) into active_count
    from public.evaluation_voice_notes n
    where n.evaluatee_member_id = new.evaluatee_member_id
      and n.term_id = new.term_id
      and n.soft_deleted_at is null
      and n.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if active_count >= 2 then
      raise exception 'Maximum 2 active voice notes are allowed per term evaluation';
    end if;
  end if;

  if new.duration_seconds > 180 then
    raise exception 'Voice note duration cannot exceed 3 minutes';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_evaluation_voice_notes_limit on public.evaluation_voice_notes;
create trigger trg_enforce_evaluation_voice_notes_limit
before insert or update on public.evaluation_voice_notes
for each row execute function public.enforce_evaluation_voice_notes_limit();

alter table public.evaluation_voice_notes enable row level security;

drop policy if exists "evaluation_voice_notes read" on public.evaluation_voice_notes;
create policy "evaluation_voice_notes read" on public.evaluation_voice_notes
  for select using (
    public.can_read_evaluation_voice_note(evaluatee_member_id, team_id, evaluator_user_id)
  );

drop policy if exists "evaluation_voice_notes insert" on public.evaluation_voice_notes;
create policy "evaluation_voice_notes insert" on public.evaluation_voice_notes
  for insert with check (
    public.can_manage_evaluation_voice_note(team_id)
    and evaluator_user_id = auth.uid()
    and duration_seconds between 1 and 180
  );

drop policy if exists "evaluation_voice_notes update" on public.evaluation_voice_notes;
create policy "evaluation_voice_notes update" on public.evaluation_voice_notes
  for update using (
    public.can_manage_evaluation_voice_note(team_id)
  ) with check (
    public.can_manage_evaluation_voice_note(team_id)
  );

drop policy if exists "evaluation_voice_notes delete" on public.evaluation_voice_notes;
create policy "evaluation_voice_notes delete" on public.evaluation_voice_notes
  for delete using (
    public.can_manage_evaluation_voice_note(team_id)
  );

-- Storage policies for the private voice-notes bucket.
drop policy if exists "evaluation voice notes upload" on storage.objects;
create policy "evaluation voice notes upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evaluation-voice-notes'
    and auth.uid() is not null
  );

drop policy if exists "evaluation voice notes read signed" on storage.objects;
create policy "evaluation voice notes read signed" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evaluation-voice-notes'
    and public.can_read_evaluation_voice_note_path(name)
  );

drop policy if exists "evaluation voice notes delete" on storage.objects;
create policy "evaluation voice notes delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evaluation-voice-notes'
    and public.can_manage_evaluation_voice_note_path(name)
  );
