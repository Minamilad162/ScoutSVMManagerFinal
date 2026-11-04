import { supabase } from '../../lib/supabase'
import { safeWriteAuditLog } from '../audit/api'

export type ScoutYearRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  status: 'draft' | 'active' | 'archived' | 'cancelled'
  is_current: boolean
  notes: string | null
  created_at?: string
  updated_at?: string
}

export type ScoutYearSummary = {
  teams_count: number
  members_count: number
  active_members_count: number
  roles_count: number
  terms_count: number
  meeting_dates_count: number
  configured_members_count?: number
  needs_setup_count?: number
}

export type ScoutYearActivationIssue = {
  member_id: string
  full_name: string
  email?: string | null
  is_equipier: boolean
  missing: Array<'team' | 'rank' | 'account' | 'role' | string>
}

export type ScoutYearActivationReadiness = {
  year: {
    id: string
    name: string
    status: string
    is_current: boolean
    start_date: string
    end_date: string
  }
  can_activate: boolean
  counts: Record<string, number> & {
    active_members: number
    active_leaders: number
    active_equipiers: number
    configured_members: number
    needs_setup: number
    missing_team: number
    missing_rank: number
    missing_account: number
    missing_role: number
    teams: number
    roles: number
    terms: number
    meeting_dates: number
  }
  critical: Array<{ code: string; label: string; count: number }>
  warnings: Array<{ code: string; label: string; count: number }>
  issues: ScoutYearActivationIssue[]
  issues_returned: number
  checked_at?: string
}

export type CloneTermsOptions = {
  cloneMeetingDates?: boolean
}

export async function listScoutYears() {
  const { data, error } = await supabase
    .from('scout_years')
    .select('id,name,start_date,end_date,status,is_current,notes,created_at,updated_at')
    .order('start_date', { ascending: false })

  if (error) throw error
  return (data || []) as ScoutYearRow[]
}

export async function listScoutYearOverview(): Promise<{ years: ScoutYearRow[]; summaries: Record<string, ScoutYearSummary> }> {
  const { data, error } = await supabase.rpc('admin_list_scout_year_overview') as any

  if (error) {
    const message = String(error.message || '')
    const rpcMissing =
      error.code === 'PGRST202' ||
      message.includes('admin_list_scout_year_overview') ||
      message.includes('schema cache')

    if (!rpcMissing) throw error

    // Safe fallback for installations that have not run SQL18 yet.
    // This keeps the page usable, while SQL18 removes the previous N+1 summary pattern.
    const years = await listScoutYears()
    const entries = await Promise.all(years.map(async (year) => [year.id, await fetchScoutYearSummary(year.id)] as const))
    return { years, summaries: Object.fromEntries(entries) }
  }

  const rows = (data || []) as any[]
  const years: ScoutYearRow[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    is_current: Boolean(row.is_current),
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))

  const summaries = Object.fromEntries(rows.map((row) => [row.id, {
    teams_count: Number(row.teams_count || 0),
    members_count: Number(row.members_count || 0),
    active_members_count: Number(row.active_members_count || 0),
    roles_count: Number(row.roles_count || 0),
    terms_count: Number(row.terms_count || 0),
    meeting_dates_count: Number(row.meeting_dates_count || 0),
    configured_members_count: Number(row.configured_members_count || 0),
    needs_setup_count: Number(row.needs_setup_count || 0),
  } satisfies ScoutYearSummary]))

  return { years, summaries }
}

export async function fetchScoutYearActivationReadiness(scoutYearId: string, issueLimit = 50): Promise<ScoutYearActivationReadiness> {
  if (!scoutYearId) throw new Error('حدد السنة الكشفية المطلوب مراجعتها')
  const { data, error } = await supabase.rpc('admin_scout_year_activation_readiness', {
    p_scout_year_id: scoutYearId,
    p_issue_limit: Math.max(0, Math.min(issueLimit, 200)),
  }) as any

  if (error) {
    const message = String(error.message || '')
    if (error.code === 'PGRST202' || message.includes('admin_scout_year_activation_readiness') || message.includes('schema cache')) {
      throw new Error('مراجعة جاهزية السنة تحتاج SQL رقم 18. شغّله ثم أعد المحاولة.')
    }
    throw error
  }

  return data as ScoutYearActivationReadiness
}

export async function saveScoutYear(payload: Partial<ScoutYearRow> & { name: string; start_date: string; end_date: string }) {
  if (payload.id) {
    const { data: beforeRow, error: beforeError } = await supabase
      .from('scout_years')
      .select('id,name,start_date,end_date,status,is_current,notes,created_at,updated_at')
      .eq('id', payload.id)
      .single()
    if (beforeError) throw beforeError

    const { data, error } = await supabase
      .from('scout_years')
      .update({
        name: payload.name,
        start_date: payload.start_date,
        end_date: payload.end_date,
        status: payload.status ?? 'draft',
        notes: payload.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.id)
      .select('id,name,start_date,end_date,status,is_current,notes,created_at,updated_at')
      .single()
    if (error) throw error

    void safeWriteAuditLog({
      action: 'update',
      module: 'scout_years',
      entityType: 'scout_year',
      entityId: data.id,
      entityDisplay: data.name,
      summary: `حدّث السنة الكشفية ${data.name}`,
      severity: 'info',
      source: 'AdminScoutYears',
      scoutYearId: data.id,
      before: beforeRow,
      after: data,
      changedFields: ['name', 'start_date', 'end_date', 'status', 'notes'].filter((field) => JSON.stringify((beforeRow as any)[field]) !== JSON.stringify((data as any)[field])),
    })

    return data as ScoutYearRow
  }

  const { data, error } = await supabase
    .from('scout_years')
    .insert({
      name: payload.name,
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: payload.status ?? 'draft',
      is_current: Boolean(payload.is_current),
      notes: payload.notes ?? null,
    })
    .select('id,name,start_date,end_date,status,is_current,notes,created_at,updated_at')
    .single()
  if (error) throw error

  void safeWriteAuditLog({
    action: 'create',
    module: 'scout_years',
    entityType: 'scout_year',
    entityId: data.id,
    entityDisplay: data.name,
    summary: `أنشأ سنة كشفية جديدة: ${data.name}`,
    severity: 'info',
    source: 'AdminScoutYears',
    scoutYearId: data.id,
    after: data,
    changedFields: ['name', 'start_date', 'end_date', 'status', 'is_current', 'notes'],
  })

  return data as ScoutYearRow
}

export async function setScoutYearAsCurrent(scoutYearId: string) {
  if (!scoutYearId) throw new Error('حدد السنة الكشفية المطلوب تفعيلها')

  const { data: rpcData, error: rpcError } = await supabase.rpc('set_current_scout_year_atomic', {
    p_scout_year_id: scoutYearId,
  }) as any

  if (rpcError) {
    const message = String(rpcError.message || '')
    const rpcMissing =
      rpcError.code === 'PGRST202' ||
      message.includes('Could not find the function') ||
      message.includes('schema cache') ||
      message.includes('set_current_scout_year_atomic')

    if (rpcMissing) {
      throw new Error('تفعيل السنة متوقف بأمان لأن دالة set_current_scout_year_atomic غير موجودة. شغّل SQL رقم 15 ثم أعد المحاولة.')
    }
    throw rpcError
  }

  const previousCurrent = rpcData?.previous_current ?? null
  const target = rpcData?.target ?? null

  if (!target?.id) {
    throw new Error('تم استدعاء تفعيل السنة لكن قاعدة البيانات لم تُرجع السنة الهدف بشكل صحيح')
  }

  void safeWriteAuditLog({
    action: 'set_current',
    module: 'scout_years',
    entityType: 'scout_year',
    entityId: target.id,
    entityDisplay: target.name,
    summary: `فعّل السنة الكشفية الحالية: ${target.name}`,
    severity: 'warning',
    source: 'AdminScoutYears',
    scoutYearId: target.id,
    before: previousCurrent,
    after: target,
    changedFields: ['is_current', 'status'],
    context: { previous_current_name: previousCurrent?.name ?? null, atomic: true },
  })

  return target as ScoutYearRow
}

export async function deleteScoutYear(scoutYearId: string) {
  if (!scoutYearId) throw new Error('حدد السنة الكشفية المراد حذفها')

  const { data: beforeRow, error: beforeError } = await supabase
    .from('scout_years')
    .select('id,name,start_date,end_date,status,is_current,notes,created_at,updated_at')
    .eq('id', scoutYearId)
    .maybeSingle()

  if (beforeError) throw beforeError
  if (!beforeRow) throw new Error('السنة الكشفية غير موجودة')
  if (beforeRow.is_current) throw new Error('لا يمكن حذف السنة الحالية. عيّن سنة أخرى كحالية أولًا.')

  const rpcResult = await supabase.rpc('admin_delete_scout_year', { p_scout_year_id: scoutYearId }) as any
  if (rpcResult.error) {
    const message = String(rpcResult.error.message || '')
    const rpcMissing =
      rpcResult.error.code === 'PGRST202' ||
      message.includes('Could not find the function') ||
      message.includes('schema cache') ||
      message.includes('function public.admin_delete_scout_year')

    if (!rpcMissing) throw rpcResult.error

    throw new Error('حذف السنة متوقف بأمان لأن دالة admin_delete_scout_year غير موجودة في قاعدة البيانات. شغّل SQL الخاص بحذف السنة أولًا ثم أعد المحاولة.')
  }

  void safeWriteAuditLog({
    action: 'delete',
    module: 'scout_years',
    entityType: 'scout_year',
    entityId: scoutYearId,
    entityDisplay: beforeRow.name,
    summary: `حذف السنة الكشفية ${beforeRow.name}`,
    severity: 'critical',
    source: 'AdminScoutYears',
    scoutYearId: null,
    before: beforeRow,
    changedFields: ['deleted'],
    context: { deleted_scout_year_id: scoutYearId },
  })

  return beforeRow as ScoutYearRow
}

export async function fetchScoutYearSummary(scoutYearId: string): Promise<ScoutYearSummary> {
  const [teamsRes, membersRes, activeMembersRes, rolesRes, termsRes] = await Promise.all([
    supabase.from('team_seasons').select('id', { head: true, count: 'exact' }).eq('scout_year_id', scoutYearId),
    supabase.from('member_season_assignments').select('id', { head: true, count: 'exact' }).eq('scout_year_id', scoutYearId),
    supabase.from('member_season_assignments').select('id', { head: true, count: 'exact' }).eq('scout_year_id', scoutYearId).eq('is_active', true),
    supabase.from('user_role_assignments').select('id', { head: true, count: 'exact' }).eq('scout_year_id', scoutYearId).eq('is_active', true),
    supabase.from('terms').select('id', { head: true, count: 'exact' }).eq('scout_year_id', scoutYearId),
  ])

  if (teamsRes.error) throw teamsRes.error
  if (membersRes.error) throw membersRes.error
  if (activeMembersRes.error) throw activeMembersRes.error
  if (rolesRes.error) throw rolesRes.error
  if (termsRes.error) throw termsRes.error

  const { data: termRows, error: termRowsError } = await supabase.from('terms').select('id').eq('scout_year_id', scoutYearId)
  if (termRowsError) throw termRowsError

  let meetingDatesCount = 0
  const termIds = (termRows || []).map((row) => row.id)
  if (termIds.length) {
    const { count, error } = await supabase
      .from('term_meeting_dates')
      .select('id', { head: true, count: 'exact' })
      .in('term_id', termIds)
    if (error) throw error
    meetingDatesCount = count ?? 0
  }

  return {
    teams_count: teamsRes.count ?? 0,
    members_count: membersRes.count ?? 0,
    active_members_count: activeMembersRes.count ?? 0,
    roles_count: rolesRes.count ?? 0,
    terms_count: termsRes.count ?? 0,
    meeting_dates_count: meetingDatesCount,
  }
}

export async function cloneScoutYearStructure(sourceYearId: string, targetYearId: string) {
  if (!sourceYearId || !targetYearId) throw new Error('حدد السنة المصدر والسنة الهدف')
  if (sourceYearId === targetYearId) throw new Error('السنة المصدر والهدف لا يمكن أن تكونا نفس السنة')

  const [sourceTeamsRes, sourceMembersRes, sourceRolesRes] = await Promise.all([
    supabase.from('team_seasons').select('team_id,is_active,notes').eq('scout_year_id', sourceYearId),
    supabase
      .from('member_season_assignments')
      .select('member_id,team_id,rank_id,is_equipier,is_active,joined_at,left_at,notes')
      .eq('scout_year_id', sourceYearId),
    supabase
      .from('user_role_assignments')
      .select('user_id,role_id,team_id,is_active,notes,created_by')
      .eq('scout_year_id', sourceYearId),
  ])

  if (sourceTeamsRes.error) throw sourceTeamsRes.error
  if (sourceMembersRes.error) throw sourceMembersRes.error
  if (sourceRolesRes.error) throw sourceRolesRes.error

  const teamsPayload = (sourceTeamsRes.data || []).map((row) => ({
    scout_year_id: targetYearId,
    team_id: row.team_id,
    is_active: row.is_active ?? true,
    notes: row.notes ?? null,
    updated_at: new Date().toISOString(),
  }))

  if (teamsPayload.length) {
    const { error } = await supabase.from('team_seasons').upsert(teamsPayload, { onConflict: 'scout_year_id,team_id' } as any)
    if (error) throw error
  }

  const membersPayload = (sourceMembersRes.data || []).map((row) => ({
    scout_year_id: targetYearId,
    member_id: row.member_id,
    team_id: row.team_id,
    rank_id: row.rank_id,
    is_equipier: row.is_equipier ?? false,
    is_active: row.is_active ?? true,
    joined_at: row.joined_at ?? null,
    left_at: row.left_at ?? null,
    notes: row.notes ?? null,
    updated_at: new Date().toISOString(),
  }))

  if (membersPayload.length) {
    const { error } = await supabase.from('member_season_assignments').upsert(membersPayload, { onConflict: 'scout_year_id,member_id' } as any)
    if (error) throw error
  }

  const rolesPayload = (sourceRolesRes.data || []).map((row) => ({
    scout_year_id: targetYearId,
    user_id: row.user_id,
    role_id: row.role_id,
    team_id: row.team_id,
    is_active: row.is_active ?? true,
    notes: row.notes ?? null,
    created_by: row.created_by ?? null,
  }))

  if (rolesPayload.length) {
    const { error } = await supabase.from('user_role_assignments').insert(rolesPayload)
    if (error && !/duplicate key/i.test(error.message || '')) throw error
  }

  void safeWriteAuditLog({
    action: 'clone_structure',
    module: 'scout_years',
    entityType: 'scout_year',
    entityId: targetYearId,
    entityDisplay: targetYearId,
    summary: 'نسخ الفرق والأعضاء والأدوار إلى سنة كشفية جديدة',
    severity: 'warning',
    source: 'AdminScoutYears',
    scoutYearId: targetYearId,
    delta: {
      context: { source_year_id: sourceYearId, target_year_id: targetYearId },
      after: { teams_count: teamsPayload.length, members_count: membersPayload.length, roles_count: rolesPayload.length },
    },
  })
}

function addDays(isoDate: string | null | undefined, days: number) {
  if (!isoDate) return null
  const dt = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(dt.getTime())) return isoDate
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}

export async function cloneScoutYearTermsAndMeetingDates(
  sourceYearId: string,
  targetYearId: string,
  options: CloneTermsOptions = {}
) {
  if (!sourceYearId || !targetYearId) throw new Error('حدد السنة المصدر والسنة الهدف')
  if (sourceYearId === targetYearId) throw new Error('السنة المصدر والهدف لا يمكن أن تكونا نفس السنة')

  const cloneMeetingDates = options.cloneMeetingDates !== false

  const [sourceYearRes, targetYearRes, sourceTermsRes] = await Promise.all([
    supabase.from('scout_years').select('id,name,start_date,end_date').eq('id', sourceYearId).single(),
    supabase.from('scout_years').select('id,name,start_date,end_date').eq('id', targetYearId).single(),
    supabase
      .from('terms')
      .select('id,name,year,start_date,end_date')
      .eq('scout_year_id', sourceYearId)
      .order('start_date', { ascending: true }),
  ])

  if (sourceYearRes.error) throw sourceYearRes.error
  if (targetYearRes.error) throw targetYearRes.error
  if (sourceTermsRes.error) throw sourceTermsRes.error

  const sourceYear = sourceYearRes.data
  const targetYear = targetYearRes.data
  const sourceTerms = sourceTermsRes.data || []

  const sourceStart = new Date(`${sourceYear.start_date}T00:00:00`)
  const targetStart = new Date(`${targetYear.start_date}T00:00:00`)
  const dayOffset = Math.round((targetStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24))
  const targetYearNumber = new Date(`${targetYear.start_date}T00:00:00`).getFullYear()

  const upsertPayload = sourceTerms.map((term) => ({
    name: term.name,
    year: targetYearNumber,
    start_date: addDays(term.start_date, dayOffset),
    end_date: addDays(term.end_date, dayOffset),
    scout_year_id: targetYearId,
  }))

  if (!upsertPayload.length) {
    return { termsCloned: 0, meetingDatesCloned: 0 }
  }

  const { data: upsertedTerms, error: upsertTermsError } = await supabase
    .from('terms')
    .upsert(upsertPayload, { onConflict: 'name,year' } as any)
    .select('id,name,year,start_date,end_date,scout_year_id')

  if (upsertTermsError) {
    if (/row-level security|rls/i.test(upsertTermsError.message || '')) {
      throw new Error('صلاحية تجهيز الترمات غير مفعلة للسوبر Admin. طبّق تحديث قاعدة البيانات الخاص بصلاحيات تجهيز السنة ثم أعد المحاولة.')
    }
    throw upsertTermsError
  }

  const targetTermsByName = new Map((upsertedTerms || []).map((term) => [term.name, term.id]))

  let meetingDatesCloned = 0
  if (cloneMeetingDates) {
    const sourceTermIds = sourceTerms.map((term) => term.id)
    if (sourceTermIds.length) {
      const { data: sourceMeetingDates, error: sourceMeetingDatesError } = await supabase
        .from('term_meeting_dates')
        .select('term_id,meeting_date')
        .in('term_id', sourceTermIds)
        .order('meeting_date', { ascending: true })

      if (sourceMeetingDatesError) throw sourceMeetingDatesError

      const sourceTermsById = new Map(sourceTerms.map((term) => [term.id, term]))
      const meetingDatesPayload = (sourceMeetingDates || [])
        .map((row) => {
          const sourceTerm = sourceTermsById.get(row.term_id)
          if (!sourceTerm) return null
          const targetTermId = targetTermsByName.get(sourceTerm.name)
          if (!targetTermId) return null
          return {
            term_id: targetTermId,
            meeting_date: addDays(row.meeting_date, dayOffset),
          }
        })
        .filter(Boolean) as { term_id: string; meeting_date: string | null }[]

      if (meetingDatesPayload.length) {
        const cleanPayload = meetingDatesPayload.filter((row) => Boolean(row.meeting_date)) as {
          term_id: string
          meeting_date: string
        }[]
        const { error } = await supabase
          .from('term_meeting_dates')
          .upsert(cleanPayload, { onConflict: 'term_id,meeting_date' } as any)
        if (error) {
          if (/row-level security|rls/i.test(error.message || '')) {
            throw new Error('صلاحية تجهيز مواعيد الاجتماعات غير مفعلة للسوبر Admin. طبّق تحديث قاعدة البيانات الخاص بصلاحيات تجهيز السنة ثم أعد المحاولة.')
          }
          throw error
        }
        meetingDatesCloned = cleanPayload.length
      }
    }
  }

  const summary = {
    termsCloned: upsertPayload.length,
    meetingDatesCloned,
  }

  void safeWriteAuditLog({
    action: 'clone_terms',
    module: 'terms',
    entityType: 'scout_year',
    entityId: targetYearId,
    entityDisplay: targetYear.name,
    summary: `نسخ ${summary.termsCloned} ترم و ${summary.meetingDatesCloned} موعد اجتماع إلى السنة ${targetYear.name}`,
    severity: 'info',
    source: 'AdminScoutYears',
    scoutYearId: targetYearId,
    after: summary,
    changedFields: ['termsCloned', 'meetingDatesCloned'],
    context: { source_year_id: sourceYearId, target_year_id: targetYearId, clone_meeting_dates: cloneMeetingDates },
  })

  return summary
}

export async function syncLegacyStateFromScoutYear(scoutYearId: string) {
  const [membersRes, rolesRes, existingRolesRes] = await Promise.all([
    supabase
      .from('member_season_assignments')
      .select('member_id,team_id,rank_id,is_equipier,is_active')
      .eq('scout_year_id', scoutYearId),
    supabase
      .from('user_role_assignments')
      .select('user_id,role_id,team_id,is_active')
      .eq('scout_year_id', scoutYearId)
      .eq('is_active', true),
    supabase.from('user_roles').select('id'),
  ])

  if (membersRes.error) throw membersRes.error
  if (rolesRes.error) throw rolesRes.error
  if (existingRolesRes.error) throw existingRolesRes.error

  const memberRows = membersRes.data || []
  const roleRows = rolesRes.data || []
  const existingRoleIds = (existingRolesRes.data || []).map((row) => row.id)

  if (existingRoleIds.length) {
    const chunkSize = 500
    for (let i = 0; i < existingRoleIds.length; i += chunkSize) {
      const chunk = existingRoleIds.slice(i, i + chunkSize)
      const { error } = await supabase.from('user_roles').delete().in('id', chunk)
      if (error) throw error
    }
  }

  if (roleRows.length) {
    const payload = roleRows.map((row) => ({
      user_id: row.user_id,
      role_id: row.role_id,
      team_id: row.team_id,
    }))
    const { error } = await supabase.from('user_roles').insert(payload)
    if (error) throw error
  }

  if (memberRows.length) {
    const chunkSize = 200
    for (let i = 0; i < memberRows.length; i += chunkSize) {
      const chunk = memberRows.slice(i, i + chunkSize)
      await Promise.all(
        chunk.map(async (row) => {
          const { error } = await supabase
            .from('members')
            .update({
              team_id: row.team_id,
              rank_id: row.rank_id,
              is_equipier: row.is_equipier ?? false,
            })
            .eq('id', row.member_id)
          if (error) throw error
        })
      )
    }
  }

  void safeWriteAuditLog({
    action: 'sync_legacy',
    module: 'scout_years',
    entityType: 'scout_year',
    entityId: scoutYearId,
    entityDisplay: scoutYearId,
    summary: 'زامن حقول الجداول القديمة من السنة الكشفية الحالية',
    severity: 'warning',
    source: 'AdminScoutYears',
    scoutYearId,
    after: { members_count: memberRows.length, roles_count: roleRows.length },
    changedFields: ['members_count', 'roles_count'],
  })
}
