import { supabase } from '../../lib/supabase'
import { safeWriteAuditLog } from '../audit/api'

export type TeamOption = { id: string; name: string }
export type RankOption = { id: number; rank_label: string; rank_slug?: string | null }
export type RoleOption = { id: number; role_slug: string; role_label: string }

export type CurrentSeasonMember = {
  id: string
  auth_user_id: string | null
  full_name: string
  personal_phone: string | null
  guardian_name: string | null
  guardian_phone: string | null
  birth_date: string | null
  avatar_url: string | null
  whatsapp_opt_in_personal: boolean | null
  whatsapp_opt_in_guardian: boolean | null
  scout_year_id: string
  team_id: string | null
  team_name: string | null
  rank_id: number | null
  rank_label: string | null
  rank_slug: string | null
  is_equipier: boolean
  is_active: boolean
  joined_at: string | null
  left_at: string | null
  season_notes: string | null
  created_at: string | null
}

export type CurrentSeasonRole = {
  id: string
  scout_year_id: string
  user_id: string
  role_id: number
  role_slug: string
  role_label: string | null
  team_id: string | null
  team_name: string | null
  is_active: boolean
  created_at: string | null
  created_by: string | null
  notes: string | null
}


function toFieldLabel(field: string) {
  const labels: Record<string, string> = {
    team_id: 'الفريق',
    rank_id: 'الرتبة',
    is_equipier: 'الصفة',
    is_active: 'الحالة',
    notes: 'الملاحظات',
    role_id: 'الدور',
    team_name: 'الفريق',
    rank_label: 'الرتبة',
    role_label: 'الدور',
  }
  return labels[field] || field
}

function summarizeChangedFields(fields: string[]) {
  if (!fields.length) return 'بدون تغييرات واضحة'
  return fields.map(toFieldLabel).join('، ')
}

type AdminSeasonReferenceData = {
  teams: TeamOption[]
  ranks: RankOption[]
  roles: RoleOption[]
}

let adminReferenceCache: { value: AdminSeasonReferenceData; expiresAt: number } | null = null
let adminReferencePromise: Promise<AdminSeasonReferenceData> | null = null
const ADMIN_REFERENCE_CACHE_MS = 5 * 60 * 1000

export function clearAdminSeasonReferenceCache() {
  adminReferenceCache = null
  adminReferencePromise = null
}

export async function fetchAdminSeasonReferenceData(): Promise<AdminSeasonReferenceData> {
  const now = Date.now()
  if (adminReferenceCache && adminReferenceCache.expiresAt > now) return adminReferenceCache.value
  if (adminReferencePromise) return adminReferencePromise

  // Teams / ranks / role catalog are shared reference data. Coalesce concurrent
  // callers so AdminMembers does not request the same catalogs multiple times.
  adminReferencePromise = (async () => {
    const [teamsRes, ranksRes, rolesRes] = await Promise.all([
      supabase.from('teams').select('id,name').order('name'),
      supabase.from('ranks').select('id,rank_label,rank_slug').order('id'),
      supabase.from('roles').select('id,role_slug,role_label').order('id'),
    ])

    if (teamsRes.error) throw teamsRes.error
    if (ranksRes.error) throw ranksRes.error
    if (rolesRes.error) throw rolesRes.error

    const value: AdminSeasonReferenceData = {
      teams: (teamsRes.data || []) as TeamOption[],
      ranks: (ranksRes.data || []) as RankOption[],
      roles: (rolesRes.data || []) as RoleOption[],
    }
    adminReferenceCache = { value, expiresAt: Date.now() + ADMIN_REFERENCE_CACHE_MS }
    return value
  })()

  try {
    return await adminReferencePromise
  } finally {
    adminReferencePromise = null
  }
}

export async function fetchSeasonMembers(scoutYearId: string) {
  if (!scoutYearId) return [] as CurrentSeasonMember[]

  const { data: assignments, error: assignmentsError } = await supabase
    .from('member_season_assignments')
    .select('member_id,team_id,rank_id,is_equipier,is_active,joined_at,left_at,notes')
    .eq('scout_year_id', scoutYearId)
  if (assignmentsError) throw assignmentsError

  const assignmentRows = (assignments || []) as any[]
  const memberIds = assignmentRows.map((row) => row.member_id).filter(Boolean)
  if (!memberIds.length) return [] as CurrentSeasonMember[]

  const [{ data: members, error: membersError }, reference] = await Promise.all([
    supabase
      .from('members')
      .select('id,auth_user_id,full_name,personal_phone,guardian_name,guardian_phone,birth_date,avatar_url,whatsapp_opt_in_personal,whatsapp_opt_in_guardian,created_at')
      .in('id', memberIds),
    fetchAdminSeasonReferenceData(),
  ])
  if (membersError) throw membersError

  const membersById = new Map(((members || []) as any[]).map((row) => [row.id, row]))
  const teamsById = new Map(reference.teams.map((row) => [row.id, row.name]))
  const ranksById = new Map(reference.ranks.map((row) => [row.id, row]))

  return assignmentRows
    .map((assignment) => {
      const member = membersById.get(assignment.member_id)
      const rank = assignment.rank_id ? ranksById.get(assignment.rank_id) : null
      return {
        id: assignment.member_id,
        auth_user_id: member?.auth_user_id ?? null,
        full_name: member?.full_name ?? assignment.member_id,
        personal_phone: member?.personal_phone ?? null,
        guardian_name: member?.guardian_name ?? null,
        guardian_phone: member?.guardian_phone ?? null,
        birth_date: member?.birth_date ?? null,
        avatar_url: member?.avatar_url ?? null,
        whatsapp_opt_in_personal: member?.whatsapp_opt_in_personal ?? null,
        whatsapp_opt_in_guardian: member?.whatsapp_opt_in_guardian ?? null,
        scout_year_id: scoutYearId,
        team_id: assignment.team_id ?? null,
        team_name: assignment.team_id ? teamsById.get(assignment.team_id) ?? null : null,
        rank_id: assignment.rank_id ?? null,
        rank_label: rank?.rank_label ?? null,
        rank_slug: rank?.rank_slug ?? null,
        is_equipier: Boolean(assignment.is_equipier),
        is_active: assignment.is_active !== false,
        joined_at: assignment.joined_at ?? null,
        left_at: assignment.left_at ?? null,
        season_notes: assignment.notes ?? null,
        created_at: member?.created_at ?? null,
      } as CurrentSeasonMember
    })
    .sort((a, b) => `${a.team_name || ''} ${a.full_name}`.localeCompare(`${b.team_name || ''} ${b.full_name}`, 'ar'))
}

export async function fetchCurrentSeasonMembers() {
  const { data, error } = await supabase
    .from('v_members_current')
    .select('*')
    .order('team_name', { ascending: true })
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data || []) as CurrentSeasonMember[]
}

export async function fetchSeasonRoles(scoutYearId: string, userId?: string | null) {
  if (!scoutYearId) return [] as CurrentSeasonRole[]

  let query = supabase
    .from('user_role_assignments')
    .select('id,scout_year_id,user_id,role_id,team_id,is_active,created_at,created_by,notes')
    .eq('scout_year_id', scoutYearId)
    .eq('is_active', true) as any
  if (userId) query = query.eq('user_id', userId)

  const [{ data: assignments, error: assignmentsError }, reference] = await Promise.all([
    query,
    fetchAdminSeasonReferenceData(),
  ])
  if (assignmentsError) throw assignmentsError

  const rolesById = new Map(reference.roles.map((row) => [row.id, row]))
  const teamsById = new Map(reference.teams.map((row) => [row.id, row.name]))

  return ((assignments || []) as any[]).map((assignment) => {
    const role = rolesById.get(assignment.role_id)
    return {
      ...assignment,
      role_slug: role?.role_slug || String(assignment.role_id),
      role_label: role?.role_label ?? null,
      team_name: assignment.team_id ? teamsById.get(assignment.team_id) ?? null : null,
    } as CurrentSeasonRole
  }).sort((a, b) => String(a.role_label || a.role_slug).localeCompare(String(b.role_label || b.role_slug), 'ar'))
}

export async function fetchCurrentSeasonRoles(userId?: string | null) {
  let query = supabase
    .from('v_user_roles_current')
    .select('id,scout_year_id,user_id,role_id,role_slug,role_label,team_id,team_name,is_active,created_at,created_by,notes')
    .eq('is_active', true) as any
  if (userId) query = query.eq('user_id', userId)
  query = query.order('role_label', { ascending: true })
  const { data, error } = await query
  if (error) throw error
  return (data || []) as CurrentSeasonRole[]
}

export async function upsertCurrentSeasonMemberAssignment(payload: {
  scoutYearId: string
  memberId: string
  teamId: string | null
  rankId: number | null
  isEquipier: boolean
  isActive: boolean
  seasonNotes?: string | null
  syncLegacy?: boolean
}) {
  if (!payload.scoutYearId) throw new Error('لا توجد سنة كشفية حالية')

  const [existingSeasonRes, memberRes] = await Promise.all([
    supabase
      .from('member_season_assignments')
      .select('team_id,rank_id,is_equipier,is_active,notes')
      .eq('scout_year_id', payload.scoutYearId)
      .eq('member_id', payload.memberId)
      .maybeSingle(),
    supabase.from('members').select('full_name,auth_user_id').eq('id', payload.memberId).maybeSingle(),
  ])
  if (existingSeasonRes.error) throw existingSeasonRes.error

  if (payload.teamId) {
    const { error: teamSeasonError } = await supabase
      .from('team_seasons')
      .upsert(
        {
          scout_year_id: payload.scoutYearId,
          team_id: payload.teamId,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'scout_year_id,team_id' } as any
      )
    if (teamSeasonError) throw teamSeasonError
  }

  const nowIso = new Date().toISOString()
  const leftAt = payload.isActive ? null : nowIso.slice(0, 10)

  const { error: seasonError } = await supabase
    .from('member_season_assignments')
    .upsert(
      {
        scout_year_id: payload.scoutYearId,
        member_id: payload.memberId,
        team_id: payload.teamId,
        rank_id: payload.rankId,
        is_equipier: payload.isEquipier,
        is_active: payload.isActive,
        left_at: leftAt,
        notes: payload.seasonNotes ?? null,
        updated_at: nowIso,
      },
      { onConflict: 'scout_year_id,member_id' } as any
    )
  if (seasonError) throw seasonError

  if (payload.syncLegacy !== false) {
    const { error: legacyError } = await supabase
      .from('members')
      .update({
        team_id: payload.teamId,
        rank_id: payload.rankId,
        is_equipier: payload.isEquipier,
      })
      .eq('id', payload.memberId)
    if (legacyError) throw legacyError
  }

  const [teamRes, rankRes] = await Promise.all([
    payload.teamId ? supabase.from('teams').select('name').eq('id', payload.teamId).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
    payload.rankId ? supabase.from('ranks').select('rank_label').eq('id', payload.rankId).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
  ])

  const before = {
    team_id: existingSeasonRes.data?.team_id ?? null,
    rank_id: existingSeasonRes.data?.rank_id ?? null,
    is_equipier: existingSeasonRes.data?.is_equipier ?? null,
    is_active: existingSeasonRes.data?.is_active ?? null,
    notes: existingSeasonRes.data?.notes ?? null,
  }
  const after = {
    team_id: payload.teamId,
    team_name: teamRes.data?.name ?? null,
    rank_id: payload.rankId,
    rank_label: rankRes.data?.rank_label ?? null,
    is_equipier: payload.isEquipier,
    is_active: payload.isActive,
    notes: payload.seasonNotes ?? null,
  }
  const changedFields = ['team_id', 'rank_id', 'is_equipier', 'is_active', 'notes'].filter((field) => JSON.stringify((before as any)[field]) !== JSON.stringify((after as any)[field]))

  void safeWriteAuditLog({
    action: existingSeasonRes.data ? 'update_member_season' : 'create_member_season',
    module: 'members',
    entityType: 'member',
    entityId: payload.memberId,
    entityDisplay: memberRes.data?.full_name || payload.memberId,
    summary: `${existingSeasonRes.data ? 'حدّث' : 'أنشأ'} بيانات العضو ${memberRes.data?.full_name || ''} داخل السنة الحالية${changedFields.length ? ` — ${summarizeChangedFields(changedFields)}` : ''}`,
    severity: 'info',
    source: 'AdminMembers',
    scoutYearId: payload.scoutYearId,
    teamId: payload.teamId,
    targetMemberId: payload.memberId,
    before,
    after,
    changedFields,
    context: {
      member_name: memberRes.data?.full_name ?? null,
      member_auth_user_id: memberRes.data?.auth_user_id ?? null,
      team_name: teamRes.data?.name ?? null,
      rank_label: rankRes.data?.rank_label ?? null,
    },
  })
}

export async function addCurrentSeasonRole(payload: {
  scoutYearId: string
  userId: string
  roleId: number
  teamId?: string | null
  createdBy?: string | null
  syncLegacy?: boolean
}) {
  const teamId = payload.teamId || null
  if (!payload.scoutYearId) throw new Error('لا توجد سنة كشفية حالية')
  if (!payload.userId) throw new Error('لا يوجد مستخدم مرتبط بهذا العضو')

  if (teamId) {
    const { error: teamSeasonError } = await supabase
      .from('team_seasons')
      .upsert(
        {
          scout_year_id: payload.scoutYearId,
          team_id: teamId,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'scout_year_id,team_id' } as any
      )
    if (teamSeasonError) throw teamSeasonError
  }

  let seasonLookup = supabase
    .from('user_role_assignments')
    .select('id')
    .eq('scout_year_id', payload.scoutYearId)
    .eq('user_id', payload.userId)
    .eq('role_id', payload.roleId) as any
  if (teamId === null) seasonLookup = seasonLookup.is('team_id', null)
  else seasonLookup = seasonLookup.eq('team_id', teamId)

  const { data: existingSeason, error: existingSeasonError } = await seasonLookup.maybeSingle()
  if (existingSeasonError) throw existingSeasonError

  if (!existingSeason?.id) {
    const { error } = await supabase.from('user_role_assignments').insert({
      scout_year_id: payload.scoutYearId,
      user_id: payload.userId,
      role_id: payload.roleId,
      team_id: teamId,
      is_active: true,
      created_by: payload.createdBy ?? null,
    })
    if (error) throw error
  }

  if (payload.syncLegacy !== false) {
    let legacyQuery = supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', payload.userId)
      .eq('role_id', payload.roleId) as any
    if (teamId === null) legacyQuery = legacyQuery.is('team_id', null)
    else legacyQuery = legacyQuery.eq('team_id', teamId)
    const { data: existingLegacy, error: existingLegacyError } = await legacyQuery.maybeSingle()
    if (existingLegacyError) throw existingLegacyError

    if (!existingLegacy?.id) {
      const { error: legacyInsertError } = await supabase.from('user_roles').insert({
        user_id: payload.userId,
        role_id: payload.roleId,
        team_id: teamId,
      })
      if (legacyInsertError) throw legacyInsertError
    }
  }

  const [roleRes, teamRes, targetMemberRes] = await Promise.all([
    supabase.from('roles').select('role_label,role_slug').eq('id', payload.roleId).maybeSingle(),
    teamId ? supabase.from('teams').select('name').eq('id', teamId).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
    supabase.from('members').select('id,full_name').eq('auth_user_id', payload.userId).maybeSingle(),
  ])

  void safeWriteAuditLog({
    action: 'add_role',
    module: 'roles',
    entityType: 'user_role',
    entityDisplay: roleRes.data?.role_label || roleRes.data?.role_slug || String(payload.roleId),
    summary: `أضاف دور ${roleRes.data?.role_label || roleRes.data?.role_slug || payload.roleId} للمستخدم${targetMemberRes.data?.full_name ? ` ${targetMemberRes.data.full_name}` : ''}${teamRes.data?.name ? ` على فريق ${teamRes.data.name}` : ''}`,
    severity: 'warning',
    source: 'AdminMembers',
    scoutYearId: payload.scoutYearId,
    teamId,
    targetMemberId: targetMemberRes.data?.id ?? null,
    after: { user_id: payload.userId, role_id: payload.roleId, role_label: roleRes.data?.role_label ?? null, team_id: teamId, team_name: teamRes.data?.name ?? null, is_active: true },
    changedFields: ['role_id', 'team_id', 'is_active'],
    context: { target_member_name: targetMemberRes.data?.full_name ?? null },
  })
}

export async function removeCurrentSeasonRole(payload: {
  scoutYearId: string
  userId: string
  roleId: number
  teamId?: string | null
  syncLegacy?: boolean
}) {
  const teamId = payload.teamId || null

  let seasonDelete = supabase
    .from('user_role_assignments')
    .delete()
    .eq('scout_year_id', payload.scoutYearId)
    .eq('user_id', payload.userId)
    .eq('role_id', payload.roleId) as any
  if (teamId === null) seasonDelete = seasonDelete.is('team_id', null)
  else seasonDelete = seasonDelete.eq('team_id', teamId)

  const { error: seasonError } = await seasonDelete
  if (seasonError) throw seasonError

  if (payload.syncLegacy !== false) {
    let legacyDelete = supabase
      .from('user_roles')
      .delete()
      .eq('user_id', payload.userId)
      .eq('role_id', payload.roleId) as any
    if (teamId === null) legacyDelete = legacyDelete.is('team_id', null)
    else legacyDelete = legacyDelete.eq('team_id', teamId)

    const { error: legacyError } = await legacyDelete
    if (legacyError) throw legacyError
  }

  const [roleRes, teamRes, targetMemberRes] = await Promise.all([
    supabase.from('roles').select('role_label,role_slug').eq('id', payload.roleId).maybeSingle(),
    teamId ? supabase.from('teams').select('name').eq('id', teamId).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
    supabase.from('members').select('id,full_name').eq('auth_user_id', payload.userId).maybeSingle(),
  ])

  void safeWriteAuditLog({
    action: 'remove_role',
    module: 'roles',
    entityType: 'user_role',
    entityDisplay: roleRes.data?.role_label || roleRes.data?.role_slug || String(payload.roleId),
    summary: `حذف دور ${roleRes.data?.role_label || roleRes.data?.role_slug || payload.roleId} من المستخدم${targetMemberRes.data?.full_name ? ` ${targetMemberRes.data.full_name}` : ''}${teamRes.data?.name ? ` على فريق ${teamRes.data.name}` : ''}`,
    severity: 'warning',
    source: 'AdminMembers',
    scoutYearId: payload.scoutYearId,
    teamId,
    targetMemberId: targetMemberRes.data?.id ?? null,
    before: { user_id: payload.userId, role_id: payload.roleId, role_label: roleRes.data?.role_label ?? null, team_id: teamId, team_name: teamRes.data?.name ?? null, is_active: true },
    changedFields: ['role_id', 'team_id', 'is_active'],
    context: { target_member_name: targetMemberRes.data?.full_name ?? null },
  })
}
