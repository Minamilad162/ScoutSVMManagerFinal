/** Navigation-level access to read-only team overview for current-year team staff.
 * Route and database policies remain the authority for all other operations.
 */
export type TeamScopedRole = { role_slug: string; team_id?: string | null }

export const TEAM_OVERVIEW_ROLES: readonly string[] = [
  'chef_de_legion',
  'normal_chef',
  'responsable_finance',
  'responsable_materials',
  'responsable_secretary',
  'responsable_media',
]

export function hasCurrentTeamRole(
  roles: readonly TeamScopedRole[],
  memberTeamId: string | null | undefined,
  allowedRoles: readonly string[] = TEAM_OVERVIEW_ROLES,
): boolean {
  return Boolean(
    memberTeamId &&
    roles.some((role) => role.team_id === memberTeamId && allowedRoles.includes(role.role_slug)),
  )
}
