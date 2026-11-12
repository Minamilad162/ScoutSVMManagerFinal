/** Presentation-level guard; Postgres RLS and private Storage policies enforce the same scope. */
export type SecretaryRole = { role_slug: string; team_id: string | null }
export function canUploadSecretaryForms(input: {
  teamId: string
  scoutYearId: string
  currentPhysicalScoutYearId: string | null
  userId: string | null
  isHistoricalView: boolean
  roles: SecretaryRole[]
}): boolean {
  const { teamId, scoutYearId, currentPhysicalScoutYearId, userId, isHistoricalView, roles } = input
  return Boolean(
    userId && teamId && scoutYearId && scoutYearId === currentPhysicalScoutYearId && !isHistoricalView
    && roles.some(role =>
      role.role_slug === 'admin'
      || (role.role_slug === 'responsable_secretary' && (role.team_id === null || role.team_id === teamId))
    )
  )
}
export function visibleSecretaryTeams<T extends { id: string }>(teams: T[], roles: SecretaryRole[]) {
  const canViewAll = roles.some(role => role.role_slug === 'admin'
    || (role.role_slug === 'responsable_secretary' && !role.team_id))
  return canViewAll ? teams : teams.filter(team =>
    roles.some(role => role.role_slug === 'responsable_secretary' && role.team_id === team.id))
}
