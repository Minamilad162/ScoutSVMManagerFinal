import { supabase } from '../../lib/supabase'
import type { TermOption } from '../reference/api'

export type TermMeetingAdminRow = TermOption & {
  planned_meetings_count: number
  actual_meetings_count: number
  last_planned_date: string | null
  last_actual_meeting_date: string | null
}

export type TermMeetingDateRow = {
  id: string
  term_id: string
  meeting_date: string
  actual_meetings_count: number
}

export async function listTermsWithMeetingStats(scoutYearId: string) {
  const { data: terms, error: termsError } = await supabase
    .from('terms')
    .select('id,name,year,start_date,end_date,scout_year_id')
    .eq('scout_year_id', scoutYearId)
    .order('start_date', { ascending: true })
    .order('name', { ascending: true })

  if (termsError) throw termsError
  const termRows = (terms || []) as TermOption[]
  const termIds = termRows.map((row) => row.id)
  if (!termIds.length) return [] as TermMeetingAdminRow[]

  const [datesRes, meetingsRes] = await Promise.all([
    supabase
      .from('term_meeting_dates')
      .select('id,term_id,meeting_date')
      .in('term_id', termIds)
      .order('meeting_date', { ascending: true }),
    supabase
      .from('meetings')
      .select('id,term_id,meeting_date,mtype')
      .eq('scout_year_id', scoutYearId)
      .in('term_id', termIds)
      .order('meeting_date', { ascending: true }),
  ])

  if (datesRes.error) throw datesRes.error
  if (meetingsRes.error) throw meetingsRes.error

  const plannedMap = new Map<string, { count: number; last: string | null }>()
  for (const row of (datesRes.data || []) as Array<{ term_id: string; meeting_date: string }>) {
    const prev = plannedMap.get(row.term_id) || { count: 0, last: null }
    prev.count += 1
    prev.last = row.meeting_date
    plannedMap.set(row.term_id, prev)
  }

  const actualMap = new Map<string, { count: number; last: string | null }>()
  for (const row of (meetingsRes.data || []) as Array<{ term_id: string | null; meeting_date: string }>) {
    if (!row.term_id) continue
    const prev = actualMap.get(row.term_id) || { count: 0, last: null }
    prev.count += 1
    prev.last = row.meeting_date
    actualMap.set(row.term_id, prev)
  }

  return termRows.map((term) => ({
    ...term,
    planned_meetings_count: plannedMap.get(term.id)?.count ?? 0,
    actual_meetings_count: actualMap.get(term.id)?.count ?? 0,
    last_planned_date: plannedMap.get(term.id)?.last ?? null,
    last_actual_meeting_date: actualMap.get(term.id)?.last ?? null,
  }))
}

export async function saveTermForScoutYear(payload: {
  id?: string | null
  scoutYearId: string
  name: string
  year: number
  start_date: string | null
  end_date: string | null
}) {
  const clean = {
    scout_year_id: payload.scoutYearId,
    name: payload.name.trim(),
    year: Number(payload.year),
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
  }

  if (payload.id) {
    const { data, error } = await supabase
      .from('terms')
      .update(clean)
      .eq('id', payload.id)
      .select('id,name,year,start_date,end_date,scout_year_id')
      .single()
    if (error) throw error
    return data as TermOption
  }

  const { data, error } = await supabase
    .from('terms')
    .insert(clean)
    .select('id,name,year,start_date,end_date,scout_year_id')
    .single()
  if (error) throw error
  return data as TermOption
}

export async function listTermMeetingDates(termId: string) {
  const [datesRes, meetingsRes] = await Promise.all([
    supabase
      .from('term_meeting_dates')
      .select('id,term_id,meeting_date')
      .eq('term_id', termId)
      .order('meeting_date', { ascending: true }),
    supabase
      .from('meetings')
      .select('id,term_id,meeting_date')
      .eq('term_id', termId)
      .order('meeting_date', { ascending: true }),
  ])

  if (datesRes.error) throw datesRes.error
  if (meetingsRes.error) throw meetingsRes.error

  const meetingCountByDate = new Map<string, number>()
  for (const row of (meetingsRes.data || []) as Array<{ meeting_date: string }>) {
    meetingCountByDate.set(row.meeting_date, (meetingCountByDate.get(row.meeting_date) || 0) + 1)
  }

  return ((datesRes.data || []) as Array<{ id: string; term_id: string; meeting_date: string }>).map((row) => ({
    ...row,
    actual_meetings_count: meetingCountByDate.get(row.meeting_date) || 0,
  })) as TermMeetingDateRow[]
}

export async function addMeetingDateToTerm(payload: {
  termId: string
  meetingDate: string
  termStartDate?: string | null
  termEndDate?: string | null
}) {
  const meetingDate = payload.meetingDate
  if (!meetingDate) throw new Error('اختر تاريخ الاجتماع')
  if (payload.termStartDate && meetingDate < payload.termStartDate) throw new Error('التاريخ خارج حدود بداية الترم')
  if (payload.termEndDate && meetingDate > payload.termEndDate) throw new Error('التاريخ خارج حدود نهاية الترم')

  const { data, error } = await supabase
    .from('term_meeting_dates')
    .insert({ term_id: payload.termId, meeting_date: meetingDate })
    .select('id,term_id,meeting_date')
    .single()

  if (error) throw error
  return data as { id: string; term_id: string; meeting_date: string }
}

export async function deleteMeetingDateFromTerm(id: string) {
  const { error } = await supabase.from('term_meeting_dates').delete().eq('id', id)
  if (error) throw error
}
