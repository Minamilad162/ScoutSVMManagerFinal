/** The material booking route, chooser and action must share one scope rule.
 * These are UI guards only; Supabase RLS enforces the same active-year roles.
 */
export type MaterialBookingRole = { role_slug: string; team_id?: string | null }
export type MaterialBookingTeam = { id: string; name: string }

const TEAM_BOOKING_ROLES = new Set(['chef_de_legion', 'responsable_materials'])

export function canManageMaterialBookingsAcrossTeams(roles: MaterialBookingRole[]): boolean {
  return roles.some(role => role.role_slug === 'admin'
    || (role.role_slug === 'responsable_materials' && role.team_id == null))
}

export function canBookMaterialsForTeam(roles: MaterialBookingRole[], teamId: string, isReadOnlyView = false): boolean {
  if (isReadOnlyView || !teamId) return false
  if (canManageMaterialBookingsAcrossTeams(roles)) return true
  return roles.some(role => TEAM_BOOKING_ROLES.has(role.role_slug) && role.team_id === teamId)
}

/** Never default to an unrelated member profile team when the current-year role
 * grants access to a different team. Global materials leads can choose any team.
 */
export function materialBookableTeams<T extends MaterialBookingTeam>(roles: MaterialBookingRole[], teams: T[]): T[] {
  if (canManageMaterialBookingsAcrossTeams(roles)) return teams
  return teams.filter(team => canBookMaterialsForTeam(roles, team.id))
}

export function preferredMaterialBookingTeamId<T extends MaterialBookingTeam>(
  roles: MaterialBookingRole[], teams: T[], memberTeamId: string | null | undefined,
): string {
  const allowed = materialBookableTeams(roles, teams)
  if (memberTeamId && allowed.some(team => team.id === memberTeamId)) return memberTeamId
  return allowed[0]?.id || ''
}

export function materialBookingPermissionMessage(args: {
  roles: MaterialBookingRole[]
  teamId: string
  isReadOnlyView: boolean
}): string {
  if (args.isReadOnlyView) return 'السنة الكشفية المؤرشفة للعرض فقط، ولا يمكن إضافة أو إلغاء حجوزات فيها.'
  if (!args.teamId) return 'لا يوجد فريق متاح للحجز لهذا الحساب في السنة الكشفية الحالية. راجع مسؤوليات السنة.'
  if (!canBookMaterialsForTeam(args.roles, args.teamId)) {
    return 'الحجز متاح لقائد الفريق أو مسؤول الأدوات المكلّف بالفريق، ولمسؤول الأدوات العام والأدمن.'
  }
  return ''
}
