-- Save member avatar url safely from client code
create or replace function public.set_member_avatar_url(
  p_member_id uuid,
  p_avatar_url text
)
returns table (
  member_id uuid,
  avatar_url text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_target_auth_user_id uuid;
  v_is_admin boolean;
  v_is_global_secretary boolean;
begin
  select m.auth_user_id
  into v_target_auth_user_id
  from public.members m
  where m.id = p_member_id;

  if not found then
    raise exception 'Member not found';
  end if;

  select public.has_role('admin') into v_is_admin;
  select public.has_role('responsable_secretary') into v_is_global_secretary;

  if coalesce(v_target_auth_user_id, gen_random_uuid()) <> auth.uid()
     and not coalesce(v_is_admin, false)
     and not coalesce(v_is_global_secretary, false) then
    raise exception 'Not allowed to update this member avatar';
  end if;

  update public.members m
  set avatar_url = p_avatar_url
  where m.id = p_member_id;

  return query
  select m.id, m.avatar_url
  from public.members m
  where m.id = p_member_id;
end;
$function$;

grant execute on function public.set_member_avatar_url(uuid, text) to authenticated;
