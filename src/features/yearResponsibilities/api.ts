import { scoutYearFrom, supabase } from '../../lib/supabase'
import { safeWriteAuditLog } from '../audit/api'

export type YearResponsibilityEvent = {
  id: string
  scout_year_id: string
  title: string
  event_date: string | null
  description: string | null
  is_active: boolean
  created_by: string | null
  created_at: string | null
  updated_at: string | null
}

export type YearResponsibilityAssignment = {
  id: string
  event_id: string
  scout_year_id: string
  member_id: string
  assigned_by: string | null
  note: string | null
  created_at: string | null
}

export type YearResponsibilityMember = {
  id: string
  auth_user_id: string | null
  full_name: string
  team_id: string | null
  team_name: string | null
  rank_id: number | null
  rank_label: string | null
  rank_slug?: string | null
  is_equipier: boolean
  is_active: boolean
  avatar_url?: string | null
}

export type TeamOption = { id: string; name: string }

export async function listYearResponsibilityEvents(scoutYearId: string) {
  if (!scoutYearId) return [] as YearResponsibilityEvent[]

  const { data, error } = await supabase
    .from('year_responsibility_events')
    .select('id,scout_year_id,title,event_date,description,is_active,created_by,created_at,updated_at')
    .eq('scout_year_id', scoutYearId)
    .eq('is_active', true)
    .order('event_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as YearResponsibilityEvent[]
}

export async function createYearResponsibilityEvent(payload: {
  scoutYearId: string
  title: string
  eventDate?: string | null
  description?: string | null
  createdBy?: string | null
}) {
  const title = payload.title.trim()
  if (!payload.scoutYearId) throw new Error('لا توجد سنة كشفية حالية')
  if (!title) throw new Error('اكتب اسم الـ event أو التنظيم')

  const { data, error } = await supabase
    .from('year_responsibility_events')
    .insert({
      scout_year_id: payload.scoutYearId,
      title,
      event_date: payload.eventDate || null,
      description: payload.description?.trim() || null,
      created_by: payload.createdBy ?? null,
      is_active: true,
    })
    .select('id,scout_year_id,title,event_date,description,is_active,created_by,created_at,updated_at')
    .single()

  if (error) throw error

  void safeWriteAuditLog({
    action: 'create_event',
    module: 'year_responsibilities',
    entityType: 'year_responsibility_event',
    entityId: data.id,
    entityDisplay: data.title,
    summary: `أنشأ Event لمسؤوليات السنة: ${data.title}`,
    severity: 'info',
    source: 'YearResponsibilities',
    scoutYearId: payload.scoutYearId,
    after: data as Record<string, unknown>,
    changedFields: ['title', 'event_date', 'description'],
  })

  return data as YearResponsibilityEvent
}

export async function deleteYearResponsibilityEvent(event: YearResponsibilityEvent) {
  const { error } = await supabase
    .from('year_responsibility_events')
    .delete()
    .eq('id', event.id)

  if (error) throw error

  void safeWriteAuditLog({
    action: 'delete_event',
    module: 'year_responsibilities',
    entityType: 'year_responsibility_event',
    entityId: event.id,
    entityDisplay: event.title,
    summary: `حذف Event من مسؤوليات السنة: ${event.title}`,
    severity: 'warning',
    source: 'YearResponsibilities',
    scoutYearId: event.scout_year_id,
    before: event as unknown as Record<string, unknown>,
    changedFields: ['deleted'],
  })
}

export async function listYearResponsibilityAssignments(scoutYearId: string) {
  if (!scoutYearId) return [] as YearResponsibilityAssignment[]

  const { data, error } = await supabase
    .from('year_responsibility_assignments')
    .select('id,event_id,scout_year_id,member_id,assigned_by,note,created_at')
    .eq('scout_year_id', scoutYearId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as YearResponsibilityAssignment[]
}

export async function listYearResponsibilityMembers() {
  const { data, error } = await scoutYearFrom('v_members_current', 'v_members_context')
    .select('id,auth_user_id,full_name,team_id,team_name,rank_id,rank_label,rank_slug,is_equipier,is_active,avatar_url')
    .eq('is_active', true)
    .eq('is_equipier', false)
    .order('team_name', { ascending: true })
    .order('full_name', { ascending: true })

  if (error) throw error

  return ((data || []) as YearResponsibilityMember[]).filter(
    (member) => Boolean(member.auth_user_id) && member.is_equipier === false
  )
}

export async function listTeams() {
  const { data, error } = await supabase.from('teams').select('id,name').order('name')
  if (error) throw error
  return (data || []) as TeamOption[]
}

export async function assignMembersToYearResponsibilityEvent(payload: {
  scoutYearId: string
  eventId: string
  memberIds: string[]
  assignedBy?: string | null
}) {
  const cleanMemberIds = Array.from(new Set(payload.memberIds.filter(Boolean)))
  if (!payload.scoutYearId) throw new Error('لا توجد سنة كشفية حالية')
  if (!payload.eventId) throw new Error('اختار event الأول')
  if (!cleanMemberIds.length) return [] as YearResponsibilityAssignment[]

  const rows = cleanMemberIds.map((memberId) => ({
    scout_year_id: payload.scoutYearId,
    event_id: payload.eventId,
    member_id: memberId,
    assigned_by: payload.assignedBy ?? null,
  }))

  const { data, error } = await supabase
    .from('year_responsibility_assignments')
    .upsert(rows, { onConflict: 'event_id,member_id' } as any)
    .select('id,event_id,scout_year_id,member_id,assigned_by,note,created_at')

  if (error) throw error

  void safeWriteAuditLog({
    action: 'assign_members',
    module: 'year_responsibilities',
    entityType: 'year_responsibility_assignment',
    entityDisplay: `${cleanMemberIds.length} member(s)`,
    summary: `أسند ${cleanMemberIds.length} شيف/قائد إلى Event في مسؤوليات السنة`,
    severity: 'info',
    source: 'YearResponsibilities',
    scoutYearId: payload.scoutYearId,
    after: { event_id: payload.eventId, member_ids: cleanMemberIds },
    changedFields: ['event_id', 'member_ids'],
  })

  return (data || []) as YearResponsibilityAssignment[]
}

export async function removeMembersFromYearResponsibilityEvent(payload: {
  eventId: string
  scoutYearId: string
  memberIds: string[]
}) {
  const cleanMemberIds = Array.from(new Set(payload.memberIds.filter(Boolean)))
  if (!payload.eventId) throw new Error('اختار event الأول')
  if (!cleanMemberIds.length) return

  const { error } = await supabase
    .from('year_responsibility_assignments')
    .delete()
    .eq('event_id', payload.eventId)
    .in('member_id', cleanMemberIds)

  if (error) throw error

  void safeWriteAuditLog({
    action: 'remove_members',
    module: 'year_responsibilities',
    entityType: 'year_responsibility_assignment',
    entityDisplay: `${cleanMemberIds.length} member(s)`,
    summary: `ألغى تكليف ${cleanMemberIds.length} شيف/قائد من Event في مسؤوليات السنة`,
    severity: 'warning',
    source: 'YearResponsibilities',
    scoutYearId: payload.scoutYearId,
    before: { event_id: payload.eventId, member_ids: cleanMemberIds },
    changedFields: ['member_ids'],
  })
}
