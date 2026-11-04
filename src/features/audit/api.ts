import { supabase } from '../../lib/supabase'
import { fetchCurrentScoutYearId, fetchCurrentUserContext } from '../reference/api'

export type AuditSeverity = 'info' | 'warning' | 'critical'

export type AuditLogReadableRow = {
  id: string
  created_at: string | null
  action: string
  module: string | null
  entity_type: string
  entity_id: string | null
  entity_display: string | null
  summary: string | null
  severity: AuditSeverity
  source: string | null
  request_id: string | null
  actor_user_id: string | null
  actor_member_id: string | null
  actor_name: string | null
  target_member_id: string | null
  target_member_name: string | null
  team_id: string | null
  team_name: string | null
  scout_year_id: string | null
  scout_year_name: string | null
  delta: Record<string, unknown> | null
}

export type AuditLogFilters = {
  scoutYearId?: string | null
  teamId?: string | null
  module?: string | null
  action?: string | null
  severity?: AuditSeverity | 'all' | null
  dateFrom?: string | null
  dateTo?: string | null
  search?: string | null
  limit?: number
}

export type AuditLogInput = {
  actorUserId?: string | null
  actorMemberId?: string | null
  actorDisplay?: string | null
  action: string
  module?: string | null
  entityType: string
  entityId?: string | null
  entityDisplay?: string | null
  summary?: string | null
  severity?: AuditSeverity
  source?: string | null
  requestId?: string | null
  scoutYearId?: string | null
  teamId?: string | null
  targetMemberId?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  changedFields?: string[] | null
  context?: Record<string, unknown> | null
  delta?: Record<string, unknown> | null
}

export async function listAuditLogs(filters: AuditLogFilters = {}) {
  let query = supabase
    .from('v_audit_log_readable')
    .select(
      'id,created_at,action,module,entity_type,entity_id,entity_display,summary,severity,source,request_id,actor_user_id,actor_member_id,actor_name,target_member_id,target_member_name,team_id,team_name,scout_year_id,scout_year_name,delta'
    )
    .order('created_at', { ascending: false }) as any

  if (filters.scoutYearId) query = query.eq('scout_year_id', filters.scoutYearId)
  if (filters.teamId) query = query.eq('team_id', filters.teamId)
  if (filters.module) query = query.eq('module', filters.module)
  if (filters.action) query = query.eq('action', filters.action)
  if (filters.severity && filters.severity !== 'all') query = query.eq('severity', filters.severity)
  if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`)
  if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999`)
  if (filters.limit) query = query.limit(filters.limit)

  const search = String(filters.search || '').trim()
  if (search) {
    const escaped = search.replace(/[,%]/g, ' ')
    query = query.or(
      [
        `summary.ilike.%${escaped}%`,
        `entity_display.ilike.%${escaped}%`,
        `actor_name.ilike.%${escaped}%`,
        `target_member_name.ilike.%${escaped}%`,
        `module.ilike.%${escaped}%`,
        `action.ilike.%${escaped}%`,
        `entity_type.ilike.%${escaped}%`,
        `team_name.ilike.%${escaped}%`,
      ].join(',')
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as AuditLogReadableRow[]
}


function valueChanged(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)
}

function deriveChangedFields(before?: Record<string, unknown> | null, after?: Record<string, unknown> | null) {
  if (!before && !after) return [] as string[]
  const keys = Array.from(new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]))
  return keys.filter((key) => valueChanged(before?.[key], after?.[key]))
}

function buildAuditDelta(input: AuditLogInput) {
  if (input.delta) return input.delta

  const before = input.before ?? null
  const after = input.after ?? null
  const changedFields = Array.isArray(input.changedFields)
    ? input.changedFields.filter(Boolean)
    : deriveChangedFields(before, after)

  const payload: Record<string, unknown> = {}
  if (before) payload.before = before
  if (after) payload.after = after
  if (changedFields.length) payload.changed_fields = changedFields
  if (input.context) payload.context = input.context

  return Object.keys(payload).length ? payload : null
}

export async function safeWriteAuditLog(input: AuditLogInput) {
  try {
    const actorUserId = input.actorUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null
    const currentYearId = input.scoutYearId ?? (await fetchCurrentScoutYearId())
    const actorContext = actorUserId ? await fetchCurrentUserContext(actorUserId) : { member_id: null, team_id: null, team_name: null }

    let actorDisplay: string | null = input.actorDisplay ?? null
    const actorMemberId = input.actorMemberId ?? actorContext.member_id ?? null

    if (!actorDisplay && actorMemberId) {
      const { data: actorMember } = await supabase
        .from('members')
        .select('full_name')
        .eq('id', actorMemberId)
        .maybeSingle()
      actorDisplay = actorMember?.full_name ?? null
    }

    const payload = {
      actor_user_id: actorUserId,
      actor_member_id: actorMemberId,
      actor_display: actorDisplay,
      action: input.action,
      module: input.module ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      entity_display: input.entityDisplay ?? null,
      summary: input.summary ?? null,
      severity: input.severity ?? 'info',
      source: input.source ?? null,
      request_id: input.requestId ?? null,
      scout_year_id: currentYearId ?? null,
      team_id: input.teamId ?? actorContext.team_id ?? null,
      target_member_id: input.targetMemberId ?? null,
      delta: buildAuditDelta(input),
    }

    const { error } = await supabase.from('audit_log').insert(payload)
    if (error) throw error
    return true
  } catch (error) {
    console.warn('[safeWriteAuditLog] failed', error)
    return false
  }
}
