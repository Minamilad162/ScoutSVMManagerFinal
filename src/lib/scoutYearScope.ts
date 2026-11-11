/** Calendar dates are compared as YYYY-MM-DD strings to avoid timezone rollovers.
 * The authoritative boundaries are the Scout Year stored in the database, not Jan–Dec.
 */
export type DateBounds = { start: string; end: string }
export type DatedScope = { start_date?: string | null; end_date?: string | null }

export function getScoutYearBounds(year: DatedScope | null | undefined): DateBounds | null {
  const start = year?.start_date?.slice(0, 10)
  const end = year?.end_date?.slice(0, 10)
  return start && end && start <= end ? { start, end } : null
}

/** Intersection of a term's dates and its parent scout year. No overlap => no data. */
export function getTermYearBounds(year: DatedScope | null | undefined, term?: DatedScope | null): DateBounds | null {
  const bounds = getScoutYearBounds(year)
  if (!bounds) return null
  const start = term?.start_date?.slice(0, 10)
  const end = term?.end_date?.slice(0, 10)
  const result = {
    start: start && start > bounds.start ? start : bounds.start,
    end: end && end < bounds.end ? end : bounds.end,
  }
  return result.start <= result.end ? result : null
}

export function inDateBounds(date: string | null | undefined, bounds: DateBounds | null) {
  const value = date?.slice(0, 10) || ''
  return Boolean(bounds && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= bounds.start && value <= bounds.end)
}

export function clampDateToBounds(date: string | null | undefined, bounds: DateBounds | null) {
  if (!bounds) return ''
  if (!date || date < bounds.start) return bounds.start
  if (date > bounds.end) return bounds.end
  return date
}

export function belongsToScoutYear(
  term: { scout_year_id?: string | null; start_date?: string | null; end_date?: string | null },
  year: (DatedScope & { id?: string | null }) | null | undefined,
) {
  return Boolean(year?.id && term.scout_year_id === year.id && getTermYearBounds(year, term))
}
