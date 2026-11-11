import type { DateBounds, DatedScope } from '../../lib/scoutYearScope'

/** The two admin reservation routes share the same Scout Year -> Term -> meeting selector. */
export type ReservationTerm = DatedScope & {
  id: string
  name: string
  scout_year_id: string
}
export type ReservationMeeting = { id: string; meeting_date: string }

function termYearIntersection(year: DatedScope, term: DatedScope): DateBounds | null {
  const yearStart = year.start_date?.slice(0, 10)
  const yearEnd = year.end_date?.slice(0, 10)
  if (!yearStart || !yearEnd || yearStart > yearEnd) return null
  const start = term.start_date && term.start_date > yearStart ? term.start_date : yearStart
  const end = term.end_date && term.end_date < yearEnd ? term.end_date : yearEnd
  return start <= end ? { start, end } : null
}

export function scopedReservationTerms(terms: ReservationTerm[], year: DatedScope & { id: string }) {
  return terms.filter((term) => term.scout_year_id === year.id && termYearIntersection(year, term))
}

export function scopedReservationMeetings(dates: ReservationMeeting[], bounds: DateBounds | null) {
  if (!bounds) return []
  const seen = new Set<string>()
  return dates.filter((row) => {
    const day = row.meeting_date?.slice(0, 10) || ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '') || day < bounds.start || day > bounds.end || seen.has(day)) return false
    seen.add(day)
    return true
  }).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
}

/** Prefer today's meeting, otherwise the next scheduled meeting, then the most recent past one. */
export function preferredReservationMeeting(days: ReservationMeeting[], today: string): string {
  const available = days.map((row) => row.meeting_date).sort()
  return available.find((day) => day >= today) || available[available.length - 1] || 'all'
}

/** No arbitrary dates: a selected meeting must be registered under the selected term. */
export function reservationSelectionBounds(
  year: DatedScope & { id: string }, term: ReservationTerm | null,
  selectedDay: string, meetings: ReservationMeeting[],
): DateBounds | null {
  if (!term || term.scout_year_id !== year.id) return null
  const bounds = termYearIntersection(year, term)
  if (!bounds) return null
  if (selectedDay === 'all') return bounds
  if (!meetings.some((meeting) => meeting.meeting_date === selectedDay)) return null
  if (selectedDay < bounds.start || selectedDay > bounds.end) return null
  return { start: selectedDay, end: selectedDay }
}
