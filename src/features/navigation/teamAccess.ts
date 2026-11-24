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

/** Navigation entitlement comes from active-year roles; team scope is still
 * checked by operational pages and RLS, never inferred from a menu link. */
export function hasChefNavigationRole(roles: readonly TeamScopedRole[]): boolean {
  return roles.some(role => role.role_slug === 'chef_de_legion')
}

export const PROGRAM_URL = 'https://drive.google.com/drive/folders/10Sr1dGAQLXKfz7ZauyPymnxEC_kaN6FO?usp=sharing'
export const IMAGES_URL = 'https://drive.google.com/drive/folders/13wB3GMbm8CTxKLNomKB_Jr38OD1XjeR2?usp=sharing'

export function hasGlobalNavigationRole(roles: readonly TeamScopedRole[], slug: string): boolean {
  return roles.some(role => role.role_slug === slug && role.team_id == null)
}

export type MobileShortcutIcon = 'bell' | 'attendance' | 'secretary' | 'finance' | 'tools' | 'field' | 'dashboard' | 'book' | 'images' | 'statistics' | 'calendar'
export type MobileShortcut = { to: string; label: string; icon: MobileShortcutIcon; external?: boolean }

/** Pick at most two shortcuts from existing sidebar entitlements. For multiple
 * responsibilities, prefer one primary action per role before a second action
 * from the same role. No new access is granted by navigation. */
export function getMobileShortcuts(roles: readonly TeamScopedRole[], myTeamId: string | null | undefined): MobileShortcut[] {
  const notification: MobileShortcut = { to: '/app/notifications', label: 'الإشعارات', icon: 'bell' }
  const groups: MobileShortcut[][] = []
  const hasTeam = (slug: string) => hasCurrentTeamRole(roles, myTeamId, [slug])
  const hasGlobal = (slug: string) => hasGlobalNavigationRole(roles, slug)
  const hasRole = (slug: string) => roles.some(role => role.role_slug === slug)
  const item = (to: string, label: string, icon: MobileShortcutIcon): MobileShortcut => ({ to, label, icon })
  if (hasRole('admin')) {
    return [item('/app/AdminDashboard', 'لوحة التحكم', 'dashboard'), item('/app/AdminAttendance', 'الحضور', 'attendance')]
  }
  if (hasChefNavigationRole(roles)) {
    groups.push([
      item('/app/LegionAttendance', 'غياب فريقي', 'attendance'),
      item('/app/reservations-overview', 'الحجوزات', 'calendar'),
    ])
  }
  if (hasGlobal('responsable_secretary')) {
    groups.push([
      item('/app/AdminSecretary', 'السكرتارية', 'secretary'),
      hasTeam('responsable_secretary')
        ? item('/app/TeamSecretaryAttendance', 'غياب فريقي', 'attendance')
        : item('/app/AdminDashboard', 'لوحة التحكم', 'dashboard'),
    ])
  } else if (hasTeam('responsable_secretary')) {
    groups.push([
      item('/app/TeamSecretaryAttendance', 'غياب فريقي', 'attendance'),
      item('/app/TeamSecretary', 'سكرتارية فريقي', 'secretary'),
    ])
  }
  if (hasGlobal('responsable_finance')) {
    groups.push([item('/app/AdminFinance', 'إدارة الميزانية', 'finance'), item('/app/financeEvent', 'ميزانية المجموعة', 'finance')])
  } else if (hasTeam('responsable_finance')) {
    groups.push([item('/app/TeamFinance', 'ميزانية فريقي', 'finance')])
  }
  if (hasGlobal('responsable_materials')) {
    groups.push([item('/app/MaterialAdmin', 'إدارة الأدوات', 'tools'), item('/app/MaterialsReturnApprove', 'استلام الأدوات', 'tools')])
  } else if (hasTeam('responsable_materials')) {
    groups.push([item('/app/MaterialTeamReservation', 'حجز الأدوات', 'tools'), item('/app/FieldReservationsTeam', 'حجز الأرض', 'field')])
  }
  // Media and Manhag already have these same external links in every sidebar.
  if (hasRole('responsable_media')) groups.push([{ to: IMAGES_URL, label: 'الصور', icon: 'images', external: true }])
  if (hasRole('responsable_manhag')) groups.push([{ to: PROGRAM_URL, label: 'المنهج', icon: 'book', external: true }])
  if (!groups.length && hasCurrentTeamRole(roles, myTeamId)) {
    groups.push([item('/app/TeamStatistics', 'إحصائيات الفريق', 'statistics')])
  }
  const result: MobileShortcut[] = []
  for (let index = 0; index < 2; index++) {
    for (const group of groups) {
      const candidate = group[index]
      if (candidate && !result.some(entry => entry.to === candidate.to)) result.push(candidate)
      if (result.length === 2) return result
    }
  }
  return result.length ? result : [notification]
}
