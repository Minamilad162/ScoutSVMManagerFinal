import { isScoutYearViewReadOnly, supabase } from '../../lib/supabase'
import { safeWriteAuditLog } from '../audit/api'
import { fetchCurrentMembers, fetchCurrentScoutYear, fetchTerms, type TermOption } from '../reference/api'
import { filterSelectionsForScoutYear, filterTermsForScoutYear } from './yearScope'

export type BestChefCandidate = {
  member_id: string
  auth_user_id: string | null
  full_name: string
  team_id: string | null
  team_name: string | null
  avatar_url: string | null
}

export type BestChefSelection = {
  id: string
  scout_year_id: string
  term_id: string
  term_name: string | null
  member_id: string
  full_name: string
  team_id: string | null
  team_name: string | null
  avatar_url: string | null
  sort_order: number
  note: string | null
  selected_by: string | null
  created_at: string | null
  updated_at: string | null
}

export type BestChefHomeShowcase = {
  term: TermOption
  items: BestChefSelection[]
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function resolveDisplayTerm(terms: TermOption[]) {
  if (!terms.length) return null
  const today = toDateOnly(new Date())

  const active = terms.find((term) => {
    if (!term.start_date || !term.end_date) return false
    return today >= term.start_date && today <= term.end_date
  })
  if (active) return active

  const started = terms
    .filter((term) => term.start_date && term.start_date <= today)
    .sort((a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')))
  if (started.length) return started[0]

  return [...terms].sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')))[0]
}


async function getSelectedHomeTermForCurrentYear(expectedScoutYearId: string) {
  const scoutYear = await fetchCurrentScoutYear()
  if (!scoutYear?.id || scoutYear.id !== expectedScoutYearId) return null as TermOption | null

  const { data, error } = await supabase
    .from('terms')
    .select('id,name,year,start_date,end_date,scout_year_id,show_best_chefs_on_home')
    .eq('scout_year_id', scoutYear.id)
    .eq('show_best_chefs_on_home', true)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data || null) as (TermOption & { show_best_chefs_on_home?: boolean }) | null
}

export async function getBestChefsHomeTermId(scoutYearId: string) {
  const row = await getSelectedHomeTermForCurrentYear(scoutYearId)
  return row?.id ?? null
}

export async function setBestChefsHomeTerm(payload: {
  term: TermOption
  actorUserId?: string | null
}) {
  const scoutYear = await fetchCurrentScoutYear()
  if (!scoutYear?.id) throw new Error('لا توجد سنة كشفية حالية مفعلة')
  if (isScoutYearViewReadOnly()) throw new Error('لا يمكن تعديل اختيارات سنة كشفية مؤرشفة')
  if (payload.term.scout_year_id !== scoutYear.id) throw new Error('الترم المختار لا ينتمي إلى السنة الكشفية المعروضة')

  const beforeSelected = await getSelectedHomeTermForCurrentYear(scoutYear.id)

  const { error: clearError } = await supabase
    .from('terms')
    .update({ show_best_chefs_on_home: false })
    .eq('scout_year_id', scoutYear.id)
    .eq('show_best_chefs_on_home', true)
  if (clearError) throw clearError

  const { error: setError } = await supabase
    .from('terms')
    .update({ show_best_chefs_on_home: true })
    .eq('id', payload.term.id)
    .eq('scout_year_id', scoutYear.id)
  if (setError) throw setError

  await safeWriteAuditLog({
    actorUserId: payload.actorUserId ?? null,
    action: 'set_best_chefs_home_term',
    module: 'best_term_chefs',
    entityType: 'term',
    entityId: payload.term.id,
    entityDisplay: payload.term.name,
    summary: `حدّد الترم ${payload.term.name} ليظهر في الصفحة الرئيسية لأفضل الـ chefs`,
    severity: 'info',
    source: 'AdminBestChefs',
    scoutYearId: scoutYear.id,
    before: beforeSelected
      ? {
          home_term_id: beforeSelected.id,
          home_term_name: beforeSelected.name,
        }
      : { home_term_id: null, home_term_name: null },
    after: {
      home_term_id: payload.term.id,
      home_term_name: payload.term.name,
    },
    changedFields: ['home_best_chefs_term'],
    context: {
      previous_term_name: beforeSelected?.name ?? null,
      selected_term_name: payload.term.name,
    },
  })

  return payload.term.id
}

async function listSelectionsForTerms(termIds: string[], scoutYearId: string) {
  if (!termIds.length || !scoutYearId) return [] as BestChefSelection[]

  const { data, error } = await supabase
    .from('v_term_best_chefs_readable')
    .select('id,scout_year_id,term_id,term_name,member_id,full_name,team_id,team_name,avatar_url,sort_order,note,selected_by,created_at,updated_at')
    .eq('scout_year_id', scoutYearId)
    .in('term_id', termIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return filterSelectionsForScoutYear((data || []) as BestChefSelection[], scoutYearId, termIds)
}

export async function listBestChefTermsForCurrentYear() {
  return fetchTerms()
}

export async function listBestChefCandidatesForCurrentYear() {
  const members = await fetchCurrentMembers({ activeOnly: true, isEquipier: false })

  return members
    .map((member) => ({
      member_id: member.id,
      auth_user_id: member.auth_user_id,
      full_name: member.full_name,
      team_id: member.team_id ?? null,
      team_name: member.team_name ?? null,
      avatar_url: member.avatar_url ?? null,
    }))
    .sort((a, b) => {
      const teamCmp = String(a.team_name || '').localeCompare(String(b.team_name || ''), 'ar')
      if (teamCmp !== 0) return teamCmp
      return a.full_name.localeCompare(b.full_name, 'ar')
    })
}

export async function listBestChefsForTerm(termId: string, scoutYearId: string) {
  const items = await listSelectionsForTerms([termId], scoutYearId)
  return items.filter((item) => item.term_id === termId)
}

export async function saveBestChefsForTerm(payload: {
  term: TermOption
  memberIds: string[]
  actorUserId?: string | null
}) {
  const scoutYear = await fetchCurrentScoutYear()
  if (!scoutYear?.id) throw new Error('لا توجد سنة كشفية حالية مفعلة')
  if (isScoutYearViewReadOnly()) throw new Error('لا يمكن تعديل اختيارات سنة كشفية مؤرشفة')
  if (payload.term.scout_year_id !== scoutYear.id) throw new Error('الترم المختار لا ينتمي إلى السنة الكشفية المعروضة')

  const candidates = await listBestChefCandidatesForCurrentYear()
  const candidateIds = new Set(candidates.map((item) => item.member_id))
  const uniqueMemberIds = Array.from(new Set(payload.memberIds.filter(Boolean)))
  if (uniqueMemberIds.some((id) => !candidateIds.has(id))) {
    throw new Error('الاختيارات تحتوي على قائد غير مفعّل في السنة الكشفية الحالية')
  }
  const current = await listBestChefsForTerm(payload.term.id, scoutYear.id)
  const currentIds = current.map((item) => item.member_id)

  const toDelete = current.filter((item) => !uniqueMemberIds.includes(item.member_id)).map((item) => item.id)
  const toInsert = uniqueMemberIds.filter((memberId) => !currentIds.includes(memberId))

  if (toDelete.length) {
    const { error } = await supabase.from('term_best_chefs').delete().in('id', toDelete)
    if (error) throw error
  }

  if (toInsert.length) {
    const rows = toInsert.map((memberId, index) => ({
      scout_year_id: scoutYear.id,
      term_id: payload.term.id,
      member_id: memberId,
      sort_order: uniqueMemberIds.indexOf(memberId),
      selected_by: payload.actorUserId ?? null,
    }))

    const { error } = await supabase.from('term_best_chefs').insert(rows)
    if (error) throw error
  }

  for (const memberId of uniqueMemberIds) {
    const sortOrder = uniqueMemberIds.indexOf(memberId)
    const existing = current.find((item) => item.member_id === memberId)
    if (!existing) continue
    if (existing.sort_order === sortOrder) continue

    const { error } = await supabase
      .from('term_best_chefs')
      .update({ sort_order: sortOrder, selected_by: payload.actorUserId ?? null })
      .eq('id', existing.id)

    if (error) throw error
  }

  const candidateMap = new Map(candidates.map((item) => [item.member_id, item]))
  const afterItems = uniqueMemberIds.map((memberId, index) => {
    const item = candidateMap.get(memberId)
    return {
      member_id: memberId,
      full_name: item?.full_name ?? memberId,
      team_name: item?.team_name ?? null,
      sort_order: index,
    }
  })

  await safeWriteAuditLog({
    actorUserId: payload.actorUserId ?? null,
    action: 'set_best_chefs',
    module: 'best_term_chefs',
    entityType: 'term',
    entityId: payload.term.id,
    entityDisplay: payload.term.name,
    summary: `حدّث قائمة أفضل الـ chefs للترم ${payload.term.name}`,
    severity: 'info',
    source: 'AdminBestChefs',
    scoutYearId: scoutYear.id,
    before: {
      best_chefs: current.map((item) => ({ member_id: item.member_id, full_name: item.full_name, team_name: item.team_name, sort_order: item.sort_order })),
    },
    after: {
      best_chefs: afterItems,
    },
    changedFields: ['best_chefs'],
    context: {
      term_name: payload.term.name,
      selected_count: uniqueMemberIds.length,
    },
  })

  return listBestChefsForTerm(payload.term.id, scoutYear.id)
}


export type BestChefGallerySection = {
  term: TermOption
  items: BestChefSelection[]
}

export async function fetchBestChefsGallery(scoutYearId: string | null) {
  if (!scoutYearId) return [] as BestChefGallerySection[]
  const terms = filterTermsForScoutYear(await fetchTerms(), scoutYearId)
  if (!terms.length) return [] as BestChefGallerySection[]

  const items = await listSelectionsForTerms(terms.map((term) => term.id), scoutYearId)
  const grouped = new Map<string, BestChefSelection[]>()

  for (const item of items) {
    const arr = grouped.get(item.term_id) || []
    arr.push(item)
    grouped.set(item.term_id, arr)
  }

  return terms.map((term) => ({
    term,
    items: (grouped.get(term.id) || []).sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
      return String(a.created_at || '').localeCompare(String(b.created_at || ''))
    }),
  }))
}

export async function fetchBestChefsHomeShowcase(scoutYearId: string | null) {
  if (!scoutYearId) return null
  const terms = filterTermsForScoutYear(await fetchTerms(), scoutYearId)
  if (!terms.length) return null

  const allItems = await listSelectionsForTerms(terms.map((term) => term.id), scoutYearId)
  if (!allItems.length) return null

  const grouped = new Map<string, BestChefSelection[]>()
  for (const item of allItems) {
    const arr = grouped.get(item.term_id) || []
    arr.push(item)
    grouped.set(item.term_id, arr)
  }

  const termsWithItems = terms.filter((term) => (grouped.get(term.id) || []).length > 0)
  if (!termsWithItems.length) return null

  const selectedHomeTerm = await getSelectedHomeTermForCurrentYear(scoutYearId)
  const selectedWithItems = selectedHomeTerm ? termsWithItems.find((term) => term.id === selectedHomeTerm.id) || null : null
  const term = selectedWithItems || resolveDisplayTerm(termsWithItems)
  if (!term) return null

  const items = (grouped.get(term.id) || []).sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return String(a.created_at || '').localeCompare(String(b.created_at || ''))
  })
  if (!items.length) return null

  return {
    term,
    items,
  } as BestChefHomeShowcase
}
