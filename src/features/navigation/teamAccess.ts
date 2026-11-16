/** Team-scoped navigation for active Scout Year roles.
 * A global role can operate for the user's currently assigned team; an explicitly
 * team-scoped role only applies when that team matches the user's current team.
 * The route guard and database policies remain the final authority for writes.
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
    roles.some((role) =>
      allowedRoles.includes(role.role_slug) &&
      (role.team_id === memberTeamId || role.team_id === null || role.team_id === undefined)
    ),
  )
}
