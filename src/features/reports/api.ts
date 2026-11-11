import { supabase } from '../../lib/supabase'
import { getScoutYearNumericValue } from '../../lib/scoutYear'
import { fetchCurrentMembers, fetchCurrentUserChefTeamIds, fetchTerms } from '../reference/api'

export type ReportTeamOption = { id: string; name: string }
export type BudgetReportRow = {
  term_id: string
  term_name: string
  term_year: number
  budget_total: number
  spent_total: number
  remaining_total: number
  expenses_count: number
}
export type AttendanceReportRow = {
  term_id: string | null
  term_name: string
  meetings_count: number
  attendance_count: number
  present_count: number
  absent_count: number
  attendance_ratio: number
}
export type CampReportRow = {
  camp_id: string
  title: string
  status: string
  start_date: string | null
  due_date: string | null
  members_count: number
  required_total: number
  paid_total: number
  remaining_total: number
  collection_percentage: number
}
export type CaseReportRow = {
  case_type: string
  total_count: number
  open_count: number
  archived_count: number
  pinned_count: number
}
export type EvaluationReportRow = {
  term_id: string
  term_name: string
  eligible_count: number
  evaluated_count: number
  coverage_ratio: number
}
export type FinalEvaluationSummary = {
  eligible_count: number
  final_evaluated_count: number
  average_score: number
  promote_votes: number
  exceptional_votes: number
}
export type TaskOwnerReportRow = {
  owner_name: string
  total_count: number
  pending_count: number
  in_progress_count: number
  done_count: number
  cancelled_count: number
  overdue_count: number
}
export type ReportCenterData = {
  budgetRows: BudgetReportRow[]
  attendanceRows: AttendanceReportRow[]
  campRows: CampReportRow[]
  caseRows: CaseReportRow[]
  evaluationRows: EvaluationReportRow[]
  finalEvaluationSummary: FinalEvaluationSummary
  taskOwnerRows: TaskOwnerReportRow[]
}

function num(v: unknown) {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}


function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function fetchLeaderReportTeams(userId?: string | null) {
  const teamIds = await fetchCurrentUserChefTeamIds(userId)
  if (!teamIds.length) return [] as ReportTeamOption[]

  const { data, error } = await supabase
    .from('teams')
    .select('id,name')
    .in('id', teamIds)
    .order('name', { ascending: true })

  if (error) throw error
  return (data || []) as ReportTeamOption[]
}

export async function fetchReportCenterData(options: {
  userId?: string | null
  teamId: string
  termId?: string | null
  scoutYearId: string
  scoutYearStart: string
  scoutYearEnd: string
}): Promise<ReportCenterData> {
  const { teamId, termId, scoutYearId, scoutYearStart, scoutYearEnd } = options
  const terms = await fetchTerms()
  const currentTerms = terms.filter((term) => term.scout_year_id === scoutYearId)
  const filteredTerms = termId ? currentTerms.filter((term) => term.id === termId) : currentTerms
  const filteredTermIds = filteredTerms.map((term) => term.id)
  const termMap = new Map(currentTerms.map((term) => [term.id, term]))
  const reportRangeStart = termId ? (filteredTerms[0]?.start_date || scoutYearStart) : scoutYearStart
  const reportRangeEnd = termId ? (filteredTerms[0]?.end_date || scoutYearEnd) : scoutYearEnd
  const seasonYearValue = getScoutYearNumericValue({ start_date: scoutYearStart, end_date: scoutYearEnd })

  // ===== الميزانية =====
  let budgetReq = supabase
    .from('v_team_budgets_effective')
    .select('team_id, term_id, amount_total')
    .eq('team_id', teamId)
    .is('soft_deleted_at', null)

  let expensesReq = supabase
    .from('expenses')
    .select('team_id, term_id, total')
    .eq('team_id', teamId)
    .is('soft_deleted_at', null)

  // The empty set must not become an all-years finance query.
  // A requested term from another year must not fall back to all current terms.
  const scopedIds = filteredTermIds.length ? filteredTermIds : ['00000000-0000-0000-0000-000000000000']
  budgetReq = budgetReq.in('term_id', scopedIds)
  expensesReq = expensesReq.in('term_id', scopedIds)
    .gte('expense_date', reportRangeStart > scoutYearStart ? reportRangeStart : scoutYearStart)
    .lte('expense_date', reportRangeEnd < scoutYearEnd ? reportRangeEnd : scoutYearEnd)

  const [{ data: budgetRowsRaw, error: budgetError }, { data: expenseRowsRaw, error: expenseError }] = await Promise.all([
    budgetReq,
    expensesReq,
  ])
  if (budgetError) throw budgetError
  if (expenseError) throw expenseError

  const spentByTerm = new Map<string, { spent: number; count: number }>()
  for (const row of expenseRowsRaw || []) {
    const key = String(row.term_id ?? '')
    const prev = spentByTerm.get(key) || { spent: 0, count: 0 }
    prev.spent += num(row.total)
    prev.count += 1
    spentByTerm.set(key, prev)
  }

  const budgetRows: BudgetReportRow[] = ((budgetRowsRaw || []) as Array<{ term_id: string; amount_total: number }>).map((row) => {
    const term = termMap.get(row.term_id)
    const spentMeta = spentByTerm.get(row.term_id) || { spent: 0, count: 0 }
    const budgetTotal = num(row.amount_total)
    const spentTotal = spentMeta.spent
    return {
      term_id: row.term_id,
      term_name: term?.name || '—',
      term_year: term?.year || 0,
      budget_total: budgetTotal,
      spent_total: spentTotal,
      remaining_total: budgetTotal - spentTotal,
      expenses_count: spentMeta.count,
    }
  }).sort((a, b) => a.term_year === b.term_year ? a.term_name.localeCompare(b.term_name, 'ar') : b.term_year - a.term_year)

  // ===== الحضور =====
  let meetingsReq = supabase
    .from('meetings')
    .select('id, term_id, meeting_date')
    .eq('team_id', teamId)
    .eq('mtype', 'meeting')
    .eq('scout_year_id', scoutYearId)
    .order('meeting_date', { ascending: true })

  if (termId) meetingsReq = meetingsReq.eq('term_id', termId)

  const { data: meetingRows, error: meetingsError } = await meetingsReq
  if (meetingsError) throw meetingsError

  const meetingIds = ((meetingRows || []) as Array<{ id: string }>).map((row) => row.id)
  const attendanceByMeeting = new Map<string, Array<{ is_present: boolean }>>()

  if (meetingIds.length) {
    const { data: attendanceRows, error: attendanceError } = await supabase
      .from('attendance')
      .select('meeting_id, is_present')
      .in('meeting_id', meetingIds)

    if (attendanceError) throw attendanceError

    for (const row of attendanceRows || []) {
      const arr = attendanceByMeeting.get(String(row.meeting_id)) || []
      arr.push({ is_present: !!row.is_present })
      attendanceByMeeting.set(String(row.meeting_id), arr)
    }
  }

  const attendanceMap = new Map<string, AttendanceReportRow>()
  for (const meeting of (meetingRows || []) as Array<{ id: string; term_id: string | null }>) {
    const key = meeting.term_id || 'no-term'
    const term = meeting.term_id ? termMap.get(meeting.term_id) : null
    const bucket = attendanceMap.get(key) || {
      term_id: meeting.term_id,
      term_name: term?.name || 'بدون ترم',
      meetings_count: 0,
      attendance_count: 0,
      present_count: 0,
      absent_count: 0,
      attendance_ratio: 0,
    }
    bucket.meetings_count += 1
    const rows = attendanceByMeeting.get(meeting.id) || []
    bucket.attendance_count += rows.length
    bucket.present_count += rows.filter((row) => row.is_present).length
    bucket.absent_count += rows.filter((row) => !row.is_present).length
    attendanceMap.set(key, bucket)
  }

  const attendanceRows: AttendanceReportRow[] = Array.from(attendanceMap.values())
    .map((row) => ({
      ...row,
      attendance_ratio: row.attendance_count > 0 ? Number(((row.present_count / row.attendance_count) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => a.term_name.localeCompare(b.term_name, 'ar'))

  // ===== المعسكرات / التحصيل =====
  const { data: campMemberRows, error: campMembersError } = await supabase
    .from('camp_installment_members')
    .select('camp_id, required_amount, paid_amount, remaining_amount, payment_status, is_participating')
    .eq('team_id', teamId)
    .eq('scout_year_id', scoutYearId)

  if (campMembersError) throw campMembersError

  const campIds = Array.from(new Set(((campMemberRows || []) as Array<{ camp_id: string }>).map((row) => row.camp_id).filter(Boolean)))
  let campRows: CampReportRow[] = []

  if (campIds.length) {
    const { data: campsRaw, error: campsError } = await supabase
      .from('camp_installments')
      .select('id, title, status, start_date, due_date, scout_year_id')
      .in('id', campIds)
      .eq('scout_year_id', scoutYearId)
      .order('created_at', { ascending: false })

    if (campsError) throw campsError

    const campMap = new Map<string, { title: string; status: string; start_date: string | null; due_date: string | null }>()
    for (const camp of campsRaw || []) {
      campMap.set(String(camp.id), {
        title: String(camp.title ?? '—'),
        status: String(camp.status ?? 'draft'),
        start_date: camp.start_date || null,
        due_date: camp.due_date || null,
      })
    }

    const totalsMap = new Map<string, CampReportRow>()
    for (const row of (campMemberRows || []) as Array<{ camp_id: string; required_amount: number; paid_amount: number; remaining_amount: number; is_participating: boolean }>) {
      const base = totalsMap.get(row.camp_id) || {
        camp_id: row.camp_id,
        title: campMap.get(row.camp_id)?.title || '—',
        status: campMap.get(row.camp_id)?.status || 'draft',
        start_date: campMap.get(row.camp_id)?.start_date || null,
        due_date: campMap.get(row.camp_id)?.due_date || null,
        members_count: 0,
        required_total: 0,
        paid_total: 0,
        remaining_total: 0,
        collection_percentage: 0,
      }
      if (row.is_participating) {
        base.members_count += 1
        base.required_total += num(row.required_amount)
        base.paid_total += num(row.paid_amount)
        base.remaining_total += num(row.remaining_amount)
      }
      totalsMap.set(row.camp_id, base)
    }

    campRows = Array.from(totalsMap.values()).map((row) => ({
      ...row,
      collection_percentage: row.required_total > 0 ? Number(((row.paid_total / row.required_total) * 100).toFixed(1)) : 0,
    }))
  }

  // ===== الحالات =====
  let casesReq = supabase
    .from('member_cases')
    .select('case_type, status, pinned, effective_from, effective_to')
    .eq('team_id', teamId)
    .lte('effective_from', scoutYearEnd)

  if (scoutYearStart) casesReq = casesReq.or(`effective_to.is.null,effective_to.gte.${scoutYearStart}`)

  const { data: casesRaw, error: casesError } = await casesReq
  if (casesError) throw casesError

  const casesMap = new Map<string, CaseReportRow>()
  for (const row of (casesRaw || []) as Array<{ case_type: string; status: string; pinned: boolean }>) {
    const key = row.case_type || 'other'
    const bucket = casesMap.get(key) || {
      case_type: key,
      total_count: 0,
      open_count: 0,
      archived_count: 0,
      pinned_count: 0,
    }
    bucket.total_count += 1
    if (row.status === 'open') bucket.open_count += 1
    if (row.status === 'archived') bucket.archived_count += 1
    if (row.pinned) bucket.pinned_count += 1
    casesMap.set(key, bucket)
  }

  const caseRows = Array.from(casesMap.values()).sort((a, b) => b.total_count - a.total_count)

  // ===== التقييمات =====
  const eligibleMembers = await fetchCurrentMembers({ teamId, isEquipier: false, activeOnly: true })
  const eligibleEvaluationMembers = eligibleMembers.filter((member) => member.rank_slug !== 'chef_de_legion')
  const eligibleMemberIds = eligibleEvaluationMembers.map((member) => member.id)

  const evaluationCountByTerm = new Map<string, Set<string>>()
  if (eligibleMemberIds.length) {
    let evalReq = supabase
      .from('evaluations')
      .select('term_id, evaluatee_member_id, team_id')
      .eq('team_id', teamId)
      .in('evaluatee_member_id', eligibleMemberIds)

    if (filteredTermIds.length) evalReq = evalReq.in('term_id', filteredTermIds)
    else if (allowedTermIds.length) evalReq = evalReq.in('term_id', allowedTermIds)

    const { data: evaluationRowsRaw, error: evaluationsError } = await evalReq
    if (evaluationsError) throw evaluationsError

    for (const row of (evaluationRowsRaw || []) as Array<{ term_id: string; evaluatee_member_id: string }>) {
      const bucket = evaluationCountByTerm.get(row.term_id) || new Set<string>()
      bucket.add(row.evaluatee_member_id)
      evaluationCountByTerm.set(row.term_id, bucket)
    }
  }

  const evaluationRows: EvaluationReportRow[] = filteredTerms.map((term) => {
    const evaluatedCount = evaluationCountByTerm.get(term.id)?.size || 0
    const eligibleCount = eligibleEvaluationMembers.length
    return {
      term_id: term.id,
      term_name: term.name,
      eligible_count: eligibleCount,
      evaluated_count: evaluatedCount,
      coverage_ratio: eligibleCount > 0 ? Number(((evaluatedCount / eligibleCount) * 100).toFixed(1)) : 0,
    }
  })

  // ===== التقييم النهائي =====
  let finalEvaluatedCount = 0
  let averageScore = 0
  let promoteVotes = 0
  let exceptionalVotes = 0

  if (eligibleMemberIds.length) {
    const [{ data: finalRows, error: finalError }, { data: finalVotesRows, error: finalVotesError }] = await Promise.all([
      supabase
        .from('final_evaluations')
        .select('member_id, score, year')
        .eq('year', seasonYearValue)
        .in('member_id', eligibleMemberIds),
      supabase
        .from('final_votes')
        .select('member_id, promote, exceptional, year')
        .eq('year', seasonYearValue)
        .in('member_id', eligibleMemberIds),
    ])

    if (finalError) throw finalError
    if (finalVotesError) throw finalVotesError

    const uniqueFinalMembers = new Set<string>()
    let scoreSum = 0
    let scoreCount = 0

    for (const row of (finalRows || []) as Array<{ member_id: string; score: number | null }>) {
      uniqueFinalMembers.add(row.member_id)
      if (row.score != null) {
        scoreSum += num(row.score)
        scoreCount += 1
      }
    }
    finalEvaluatedCount = uniqueFinalMembers.size
    averageScore = scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(1)) : 0

    for (const row of (finalVotesRows || []) as Array<{ promote: boolean; exceptional: boolean }>) {
      if (row.promote) promoteVotes += 1
      if (row.exceptional) exceptionalVotes += 1
    }
  }

  const finalEvaluationSummary: FinalEvaluationSummary = {
    eligible_count: eligibleEvaluationMembers.length,
    final_evaluated_count: finalEvaluatedCount,
    average_score: averageScore,
    promote_votes: promoteVotes,
    exceptional_votes: exceptionalVotes,
  }

  // ===== المهام =====
  const { data: taskRowsRaw, error: tasksError } = await supabase
    .from('meeting_minute_tasks')
    .select(`
      owner_name,
      due_date,
      status,
      meeting_minutes!inner (
        meeting_date
      )
    `)
    .gte('meeting_minutes.meeting_date', reportRangeStart)
    .lte('meeting_minutes.meeting_date', reportRangeEnd)
    .order('due_date', { ascending: true })

  if (tasksError) throw tasksError

  const taskOwnerMap = new Map<string, TaskOwnerReportRow>()
  const today = isoDate(new Date())

  for (const row of (taskRowsRaw || []) as Array<{ owner_name: string; due_date: string; status: string }>) {
    const key = row.owner_name || 'غير محدد'
    const bucket = taskOwnerMap.get(key) || {
      owner_name: key,
      total_count: 0,
      pending_count: 0,
      in_progress_count: 0,
      done_count: 0,
      cancelled_count: 0,
      overdue_count: 0,
    }
    bucket.total_count += 1
    if (row.status === 'pending') bucket.pending_count += 1
    if (row.status === 'in_progress') bucket.in_progress_count += 1
    if (row.status === 'done') bucket.done_count += 1
    if (row.status === 'cancelled') bucket.cancelled_count += 1
    if (row.status !== 'done' && row.status !== 'cancelled' && row.due_date < today) bucket.overdue_count += 1
    taskOwnerMap.set(key, bucket)
  }

  const taskOwnerRows = Array.from(taskOwnerMap.values())
    .sort((a, b) => {
      if (b.overdue_count !== a.overdue_count) return b.overdue_count - a.overdue_count
      return b.total_count - a.total_count
    })

  return {
    budgetRows,
    attendanceRows,
    campRows,
    caseRows,
    evaluationRows,
    finalEvaluationSummary,
    taskOwnerRows,
  }
}
