export type ScoutYearLike = {
  id?: string | null
  name?: string | null
  start_date?: string | null
  end_date?: string | null
} | null | undefined

export function getScoutYearNumericValue(scoutYear: ScoutYearLike, fallbackYear = new Date().getFullYear()) {
  const source = scoutYear?.start_date || scoutYear?.end_date || null
  if (!source) return fallbackYear
  const parsed = new Date(source)
  const year = parsed.getFullYear()
  return Number.isFinite(year) ? year : fallbackYear
}

export function getScoutYearDateRange(scoutYear: ScoutYearLike) {
  if (!scoutYear?.start_date || !scoutYear?.end_date) return null
  return {
    start: scoutYear.start_date,
    end: scoutYear.end_date,
  }
}
