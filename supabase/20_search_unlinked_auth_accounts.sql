-- ScoutSVM Release 111
-- Scalable searchable picker for Auth accounts that are not linked to a Member.
-- Admin-only, bounded results, safe to run repeatedly.

create or replace function public.admin_search_unlinked_auth_accounts(
  p_query text default '',
  p_limit integer default 50
)
returns table(user_id uuid, email text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_query text := lower(trim(coalesce(p_query, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'Admin permission is required' using errcode = '42501';
  end if;

  return query
  select u.id, u.email::text, u.created_at
  from auth.users u
  where not exists (
    select 1
    from public.members m
    where m.auth_user_id = u.id
  )
    and (
      v_query = ''
      or lower(coalesce(u.email, '')) like '%' || v_query || '%'
    )
  order by
    case when v_query <> '' and lower(coalesce(u.email, '')) like v_query || '%' then 0 else 1 end,
    u.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.admin_search_unlinked_auth_accounts(text, integer) from public;
grant execute on function public.admin_search_unlinked_auth_accounts(text, integer) to authenticated;
