import { getScoutYearViewOverride, isHistoricalScoutYearView, scoutYearFrom, supabase } from '../../lib/supabase'
import { belongsToScoutYear } from '../../lib/scoutYearScope'

export type TeamOption = { id: string; name: string }
export type TermOption = {
  id: string
  name: string
  year: number
  start_date: string | null
  end_date: string | null
  scout_year_id?: string | null
}
export type CurrentScoutYear = {
  id: string
  name: string
  start_date: string
  end_date: string
  status: 'draft' | 'active' | 'archived' | 'cancelled'
  is_current: boolean
  notes?: string | null
}
export type CurrentUserContext = {
  member_id: string | null
  team_id: string | null
  team_name?: string | null
}
export type CurrentUserRole = {
  id?: string
  user_id: string
  role_id?: number
  role_slug: string
  role_label?: string | null
  team_id: string | null
  team_name?: string | null
  is_active?: boolean
}
export type CurrentMemberOption = {
  id: string
  auth_user_id: string | null
  full_name: string
  team_id: string | null
  team_name?: string | null
  rank_id: number | null
  rank_label?: string | null
  rank_slug?: string | null
  is_equipier: boolean
  is_active: boolean
  avatar_url?: string | null
}

async function resolveAuthUserId(userId?: string | null) {
  if (userId) return userId
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  return data.user?.id ?? null
}

export async function fetchTeams() {
  const { data, error } = await supabase.from('teams').select('id,name').order('name')
  if (error) throw error
  return (data || []) as TeamOption[]
}

export async function fetchPhysicalCurrentScoutYear() {
  const { data, error } = await supabase
    .from('v_current_scout_year')
    .select('id,name,start_date,end_date,status,is_current')
    .maybeSingle()
  if (error) throw error
  return (data || null) as CurrentScoutYear | null
}

export async function fetchScoutYearById(scoutYearId: string) {
  if (!scoutYearId) return null
  const { data, error } = await supabase
    .from('scout_years')
    .select('id,name,start_date,end_date,status,is_current')
    .eq('id', scoutYearId)
    .maybeSingle()
  if (error) throw error
  return (data || null) as CurrentScoutYear | null
}

export async function fetchCurrentScoutYear() {
  if (isHistoricalScoutYearView()) {
    const { data, error } = await supabase
      .from('scout_years')
      .select('id,name,start_date,end_date,status,is_current')
      .eq('id', String(getScoutYearViewOverride() || ''))
      .maybeSingle()
    if (error) throw error
    return (data || null) as CurrentScoutYear | null
  }
  return fetchPhysicalCurrentScoutYear()
}

export async function fetchCurrentScoutYearId() {
  const row = await fetchCurrentScoutYear()
  return row?.id ?? null
}

export async function fetchTerms() {
  // Never fall back to a previous year's terms, even if a stale view is returned.
  const year = await fetchCurrentScoutYear()
  if (!year?.id) return [] as TermOption[]

  let query = scoutYearFrom('v_terms_with_scout_year', 'v_terms_context')
    .select('id,name,year,start_date,end_date,scout_year_id')
    .eq('scout_year_id', year.id) as any

  if (!isHistoricalScoutYearView()) query = query.eq('is_current', true)

  const { data, error } = await query
    .order('year', { ascending: false })
    .order('name', { ascending: true })
  if (error) throw error
  return ((data || []) as TermOption[]).filter((term) => belongsToScoutYear(term, year))
}

export async function fetchCurrentUserContext(userId?: string | null) {
  const resolvedUserId = await resolveAuthUserId(userId)
  if (!resolvedUserId) {
    return {
      member_id: null,
      team_id: null,
      team_name: null,
    } as CurrentUserContext
  }

  const { data, error } = await supabase
    .from('v_members_current')
    .select('id, team_id, team_name')
    .eq('auth_user_id', resolvedUserId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw error
  return {
    member_id: data?.id ?? null,
    team_id: data?.team_id ?? null,
    team_name: data?.team_name ?? null,
  } as CurrentUserContext
}

export async function fetchCurrentUserRoles(userId?: string | null) {
  const resolvedUserId = await resolveAuthUserId(userId)
  if (!resolvedUserId) return [] as CurrentUserRole[]

  const { data, error } = await supabase
    .from('v_user_roles_current')
    .select('id,user_id,role_id,role_slug,role_label,team_id,team_name,is_active')
    .eq('user_id', resolvedUserId)
    .eq('is_active', true)

  if (error) throw error

  const currentRoles = ((data || []) as CurrentUserRole[])
  if (currentRoles.some((role) => role.role_slug === 'admin')) {
    return currentRoles
  }

  // Super Admin is a permanent platform entitlement in the legacy user_roles table
  // used by RLS via public.has_role('admin'). It must not disappear from the UI
  // simply because the seasonal current-year role view does not contain an admin row.
  const { data: permanentAdmin, error: adminError } = await supabase.rpc('has_role', {
    _role: 'admin',
    _team: null,
  })

  if (adminError) throw adminError

  if (permanentAdmin === true) {
    return [
      ...currentRoles,
      {
        id: 'permanent-admin',
        user_id: resolvedUserId,
        role_id: -1,
        role_slug: 'admin',
        role_label: 'Admin',
        team_id: null,
        team_name: null,
        is_active: true,
      } as CurrentUserRole,
    ]
  }

  return currentRoles
}

export async function fetchCurrentUserChefTeamIds(userId?: string | null) {
  const roles = await fetchCurrentUserRoles(userId)
  return Array.from(
    new Set(
      roles
        .filter((role) => role.role_slug === 'chef_de_legion' && role.team_id)
        .map((role) => role.team_id as string)
    )
  )
}

export async function fetchCurrentMembers(options?: {
  teamId?: string | null
  isEquipier?: boolean
  activeOnly?: boolean
  authUserId?: string | null
  memberIds?: string[]
}) {
  let query = scoutYearFrom('v_members_current', 'v_members_context').select(
    'id, auth_user_id, full_name, team_id, team_name, rank_id, rank_label, rank_slug, is_equipier, is_active, avatar_url'
  ) as any

  if (options?.teamId) query = query.eq('team_id', options.teamId)
  if (typeof options?.isEquipier === 'boolean') query = query.eq('is_equipier', options.isEquipier)
  if (options?.activeOnly !== false) query = query.eq('is_active', true)
  if (options?.authUserId) query = query.eq('auth_user_id', options.authUserId)
  if (options?.memberIds?.length) query = query.in('id', options.memberIds)

  query = query.order('full_name', { ascending: true })

  const { data, error } = await query
  if (error) throw error
  return (data || []) as CurrentMemberOption[]
}

export async function fetchTeamById(teamId: string) {
  const { data, error } = await supabase.from('teams').select('id,name').eq('id', teamId).maybeSingle()
  if (error) throw error
  return (data || null) as TeamOption | null
}
