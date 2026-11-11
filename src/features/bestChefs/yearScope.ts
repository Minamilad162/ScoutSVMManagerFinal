/** Enforce BOTH the selected Scout Year and its distinct term IDs.
 * A term-only lookup is insufficient if a legacy row was linked to the wrong year.
 */
export function filterTermsForScoutYear<T extends { id: string; scout_year_id?: string | null }>(
  terms: T[], scoutYearId: string,
): T[] {
  return terms.filter((term) => term.scout_year_id === scoutYearId)
}

export function filterSelectionsForScoutYear<T extends { scout_year_id: string; term_id: string }>(
  rows: T[], scoutYearId: string, termIds: readonly string[],
): T[] {
  const allowedTermIds = new Set(termIds)
  return rows.filter((item) => item.scout_year_id === scoutYearId && allowedTermIds.has(item.term_id))
}
