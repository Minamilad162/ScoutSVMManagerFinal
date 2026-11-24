import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getMobileShortcuts, hasChefNavigationRole, hasCurrentTeamRole, hasGlobalNavigationRole, PROGRAM_URL, IMAGES_URL, TEAM_OVERVIEW_ROLES } from '../src/features/navigation/teamAccess.ts'

const root = new URL('../', import.meta.url)
const nav = readFileSync(new URL('src/components/SideNav.tsx', root), 'utf8')
const routes = readFileSync(new URL('src/App.tsx', root), 'utf8')
const guards = readFileSync(new URL('src/components/RouteAccessGuard.tsx', root), 'utf8')
const assigned = (slug, teamId) => [{ role_slug: slug, team_id: teamId }]

test('read-only team overview for all active scoped staff roles, including normal chefs', () => {
  for (const slug of TEAM_OVERVIEW_ROLES) {
    assert.equal(hasCurrentTeamRole(assigned(slug, 'team-1'), 'team-1'), true, slug)
    assert.equal(hasCurrentTeamRole(assigned(slug, 'team-2'), 'team-1'), false, slug)
    // Global roles may see their own active team, but never a different team.
    assert.equal(hasCurrentTeamRole(assigned(slug, null), 'team-1'), true, slug)
  }
  assert.equal(hasCurrentTeamRole(assigned('equipier', 'team-1'), 'team-1'), false)
  assert.equal(hasCurrentTeamRole(assigned('responsable_finance', 'team-1'), null), false)
})

test('menu and RouteAccessGuard use identical team overview permission helper', () => {
  assert.match(nav, /canViewTeamOverview = hasCurrentTeamRole\(roles, myTeamId\)/)
  assert.match(nav, /if \(canViewTeamOverview\) \{[\s\S]*?\/app\/TeamStatistics/)
  assert.match(routes, /TeamStatistics" element=\{<RouteAccessGuard anyTeamRoles=\{TEAM_OVERVIEW_ROLES\} globalRoles=/)
  assert.match(guards, /const hasTeamScopedRole = hasCurrentTeamRole\(roles, myTeamId, anyTeamRoles\)/)
})

test('leader-only evaluation and attendance stay role guarded', () => {
  assert.match(routes, /LegionEvaluations" element=\{<RouteAccessGuard anyRoles=\{\['chef_de_legion'\]\}/)
  assert.match(routes, /LegionAttendance" element=\{<RouteAccessGuard anyRoles=\{\['chef_de_legion'\]\}/)
  assert.match(nav, /if \(hasChefTeam\) \{[\s\S]*?\/app\/LegionEvaluations/)
})

test('global management is not exposed by a team-scoped responsibility', () => {
  assert.match(nav, /if \(isGlobalSecretary\) \{[\s\S]*?\/app\/AdminSecretary/)
  assert.match(nav, /if \(hasTeamSecretary\) \{[\s\S]*?\/app\/TeamSecretary/)
  assert.doesNotMatch(nav.slice(nav.indexOf("if (hasTeamSecretary)"), nav.indexOf("if (showDelegatedCampProgram)")), /\/app\/AdminSecretary/)
  assert.match(routes, /AdminSecretary" element=\{<RouteAccessGuard globalRoles=\{\['responsable_secretary'\]\}/)
  assert.match(routes, /AdminFinance" element=\{<RouteAccessGuard globalRoles=\{\['responsable_finance'\]\}/)
  assert.match(routes, /MaterialAdmin" element=\{<RouteAccessGuard globalRoles=\{\['responsable_materials'\]\}/)
})

test('team secretary keeps secretary pages, but minutes and tasks are menu links for admin and Chef only', () => {
  const secretaryBlock = nav.match(/if \(hasTeamSecretary\) \{([^}]*)\}/)
  assert.ok(secretaryBlock)
  assert.match(secretaryBlock[1], /\/app\/TeamSecretary'/)
  assert.match(secretaryBlock[1], /\/app\/TeamSecretaryAttendance'/)
  assert.match(secretaryBlock[1], /\/app\/TeamCases'/)
  assert.doesNotMatch(secretaryBlock[1], /\/app\/meeting-(minutes|tasks)'/)
  const adminBlock = nav.slice(nav.indexOf('    if (isAdmin) {'), nav.indexOf('    } else {', nav.indexOf('    if (isAdmin) {')))
  assert.match(adminBlock, /\/app\/meeting-minutes'/)
  assert.match(adminBlock, /\/app\/meeting-tasks'/)
  const chefBlock = nav.match(/const chefItems: Item\[\] = \[([\s\S]*?)\]\s*if \(isChefOnly\) return chefItems/)
  assert.ok(chefBlock)
  assert.match(chefBlock[1], /\/app\/meeting-minutes'/)
  assert.match(chefBlock[1], /\/app\/meeting-tasks'/)
  assert.match(nav, /if \(hasChefRole\) \{\s*for \(const item of chefItems\)/)
  assert.match(nav, /if \(hasTeamMaterials \|\| isGlobalMaterials\) \{[\s\S]*?\/app\/materials'/)
  assert.match(nav, /if \(isGlobalSecretary\) \{[\s\S]*?\/app\/AdminDashboard/)
})

test('global Chef de legion keeps team pages for their active-year team', () => {
  assert.equal(hasCurrentTeamRole(assigned('chef_de_legion', null), 'team-1', ['chef_de_legion']), true)
  assert.equal(hasCurrentTeamRole(assigned('chef_de_legion', 'team-2'), 'team-1', ['chef_de_legion']), false)
  assert.equal(hasCurrentTeamRole(assigned('chef_de_legion', null), null, ['chef_de_legion']), false)
})

test('global team staff can see team overview only with current team membership', () => {
  for (const slug of TEAM_OVERVIEW_ROLES) {
    assert.equal(hasCurrentTeamRole(assigned(slug, null), 'team-1'), true, slug)
    assert.equal(hasCurrentTeamRole(assigned(slug, null), null), false, slug)
  }
  assert.equal(hasCurrentTeamRole(assigned('equipier', null), 'team-1'), false)
})

test('Chef-only menu has exactly the approved internal links in order', () => {
  const block = nav.match(/const chefItems: Item\[\] = \[([\s\S]*?)\]\s*if \(isChefOnly\) return chefItems/)
  assert.ok(block)
  const paths = [...block[1].matchAll(/to: '([^']+)'/g)].map(match => match[1])
  assert.deepEqual(paths, ["/app/member-profile","/app/best-chefs","/app/reservations-overview","/app/materials","/app/meeting-minutes","/app/meeting-tasks","/app/LegionAttendance","/app/TeamCases","/app/TeamStatistics","/app/FieldReservationsTeam","/app/TeamFinance","/app/MaterialTeamReservation","/app/TeamSecretary","/app/TeamSecretaryAttendance","/app/storage","/app/notifications"])
  assert.match(nav, /const isChefOnly = !isAdmin && hasChefRole/)
  assert.match(nav, /roles\.every\(\(role: RoleRow\) => \['chef_de_legion', 'normal_chef'\]/)
  assert.match(nav, /href=\{PROGRAM_URL\}/)
  assert.match(nav, /href=\{IMAGES_URL\}/)
})

test('Chef reservation link is overview-only; admin direct management remains restricted', () => {
  assert.match(routes, /path="reservations-overview" element=\{<RouteAccessGuard anyRoles=\{\['chef_de_legion'\]\}><ReservationsOverview \/>/)
  assert.match(routes, /path="reservation" element=\{<RouteAccessGuard adminOnly><ReservationsDirectManage \/>/)
  assert.match(routes, /path="admin-best-chefs" element=\{<RouteAccessGuard adminOnly>/)
  assert.match(routes, /path="materials" element=\{<RouteAccessGuard anyRoles=\{\['responsable_materials', 'chef_de_legion'\]\}/)
})

test('Chef menu entitlement does not depend on a member team or role team match', () => {
  for (const teamId of [null, 'team-1', 'team-2']) {
    assert.equal(hasChefNavigationRole(assigned('chef_de_legion', teamId)), true)
  }
  assert.equal(hasChefNavigationRole(assigned('normal_chef', 'team-1')), false)
  assert.equal(hasChefNavigationRole([]), false)
  assert.equal(hasChefNavigationRole([...assigned('normal_chef', 'team-1'), ...assigned('chef_de_legion', 'team-2')]), true)
  assert.match(nav, /const hasChefRole = hasChefNavigationRole\(roles\)/)
  assert.match(nav, /if \(hasChefRole\) \{\s*for \(const item of chefItems\)/)
  assert.match(routes, /TeamStatistics" element=\{<RouteAccessGuard anyTeamRoles=\{TEAM_OVERVIEW_ROLES\} globalRoles=\{\['responsable_secretary'\]\} anyRoles=\{\['chef_de_legion'\]\}/)
})

test('global media plus scoped secretary exposes own-team secretary links without global management', () => {
  const roles = [...assigned('responsable_media', null), ...assigned('responsable_secretary', 'team-1')]
  assert.equal(hasCurrentTeamRole(roles, 'team-1'), true)
  assert.equal(hasCurrentTeamRole(roles, 'team-1', ['responsable_secretary']), true)
  assert.equal(hasCurrentTeamRole(roles, 'team-2', ['responsable_secretary']), false)
  assert.equal(roles.some(r => r.role_slug === 'responsable_secretary' && r.team_id === null), false)
  assert.equal(hasChefNavigationRole(roles), false)
})

const mobilePaths = (roles, team = 'team-1') => getMobileShortcuts(roles, team).map(item => item.to)
test('mobile shortcuts follow active team and global responsibility scopes', () => {
  assert.deepEqual(mobilePaths(assigned('admin', null)), ['/app/AdminDashboard', '/app/AdminAttendance'])
  assert.deepEqual(mobilePaths(assigned('chef_de_legion', 'team-1')), ['/app/LegionAttendance', '/app/reservations-overview'])
  assert.deepEqual(mobilePaths(assigned('responsable_secretary', 'team-1')), ['/app/TeamSecretaryAttendance', '/app/TeamSecretary'])
  assert.deepEqual(mobilePaths(assigned('responsable_secretary', null)), ['/app/AdminSecretary', '/app/TeamSecretaryAttendance'])
  assert.deepEqual(mobilePaths(assigned('responsable_secretary', null), null), ['/app/AdminSecretary', '/app/AdminDashboard'])
  assert.deepEqual(mobilePaths(assigned('responsable_finance', 'team-1')), ['/app/TeamFinance'])
  assert.deepEqual(mobilePaths(assigned('responsable_finance', null)), ['/app/AdminFinance', '/app/financeEvent'])
  assert.deepEqual(mobilePaths(assigned('responsable_materials', 'team-1')), ['/app/MaterialTeamReservation', '/app/FieldReservationsTeam'])
  assert.deepEqual(mobilePaths(assigned('responsable_materials', null)), ['/app/MaterialAdmin', '/app/MaterialsReturnApprove'])
  for (const slug of ['responsable_secretary', 'responsable_finance', 'responsable_materials']) {
    assert.deepEqual(mobilePaths(assigned(slug, 'team-2')), ['/app/notifications'])
    assert.deepEqual(mobilePaths(assigned(slug, 'team-1'), null), ['/app/notifications'])
    assert.equal(hasGlobalNavigationRole(assigned(slug, 'team-1'), slug), false)
  }
  assert.deepEqual(mobilePaths(assigned('normal_chef', 'team-1')), ['/app/TeamStatistics'])
  assert.deepEqual(mobilePaths([]), ['/app/notifications'])
})
test('multi-role mobile shortcuts are stable, unique, limited and cover distinct responsibilities', () => {
  const roles = [...assigned('responsable_secretary', 'team-1'), ...assigned('responsable_finance', 'team-1'), ...assigned('responsable_media', null)]
  assert.deepEqual(mobilePaths(roles), ['/app/TeamSecretaryAttendance', '/app/TeamFinance'])
  assert.deepEqual(mobilePaths([...roles].reverse()), mobilePaths(roles))
  assert.deepEqual(mobilePaths([...assigned('responsable_media', null), ...assigned('responsable_secretary', 'team-1')]), ['/app/TeamSecretaryAttendance', IMAGES_URL])
  assert.deepEqual(mobilePaths(assigned('responsable_manhag', null)), [PROGRAM_URL])
  assert.equal(getMobileShortcuts(assigned('responsable_media', null), 'team-1')[0].external, true)
  assert.deepEqual(mobilePaths([...assigned('admin', null), ...roles]), ['/app/AdminDashboard', '/app/AdminAttendance'])
  assert.ok(!mobilePaths(roles).some(path => path.includes('meeting-')))
})
test('mobile bar preserves home, profile and full menu, with no new routes', () => {
  const bar = routes.slice(routes.indexOf('function MobileBottomNav'), routes.indexOf('const ROUTE_SCROLL_STORAGE_PREFIX'))
  assert.match(bar, /getMobileShortcuts\(roles, myTeamId\)/)
  assert.match(bar, /to="\/app" end/)
  assert.match(bar, /to="\/app\/member-profile"/)
  assert.match(bar, /onClick=\{onMore\}/)
  assert.match(bar, /data-columns=\{3 \+ shortcuts.length\}/)
  assert.match(nav, /hasGlobalNavigationRole\(roles, 'responsable_secretary'\)/)
  const css = readFileSync(new URL('src/index.css', root), 'utf8')
  assert.match(css, /\.mobile-bottom-nav\[data-columns="5"\]/)
  for (const slug of ['admin', 'chef_de_legion', 'responsable_secretary', 'responsable_finance', 'responsable_materials', 'normal_chef']) {
    for (const scope of ['team-1', null]) {
      for (const path of mobilePaths(assigned(slug, scope))) {
        assert.ok(nav.includes("'" + path + "'"), path + ' exists in sidebar')
        assert.ok(routes.includes('path="' + path.slice(5) + '"'), path + ' exists in routes')
      }
    }
  }
})
