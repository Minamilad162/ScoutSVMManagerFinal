/** Compatibility detection for deployments whose database is behind SQL migration 23. */
export type BudgetDatabaseError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

export function isMissingBudgetConfirmationSchema(error: BudgetDatabaseError | null): boolean {
  if (!error) return false
  const message = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()
  const missingField = /confirmed_at|confirmed_by|scout_year_id/.test(message)
  const missingColumn = /column|schema cache|does not exist|could not find/.test(message)
  return ((error.code === '42703' || error.code === 'PGRST204') && missingField) || (missingField && missingColumn)
}

export function isMissingEffectiveBudgetView(error: BudgetDatabaseError | null): boolean {
  if (!error) return false
  const message = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()
  return (error.code === '42P01' || error.code === 'PGRST205')
    && /v_team_budgets_effective/.test(message)
}
