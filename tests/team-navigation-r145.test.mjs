import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hasChefNavigationRole, hasCurrentTeamRole, TEAM_OVERVIEW_ROLES } from '../src/features/navigation/teamAccess.ts'

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

test('team secretary sees minutes and tasks, material staff see tools catalog', () => {
  assert.match(nav, /if \(hasTeamSecretary\) \{[\s\S]*?\/app\/meeting-minutes'[\s\S]*?\/app\/meeting-tasks'/)
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
  assert.deepEqual(paths, ["/app/member-profile","/app/best-chefs","/app/reservations-overview","/app/materials","/app/meeting-minutes","/app/LegionAttendance","/app/TeamCases","/app/TeamStatistics","/app/FieldReservationsTeam","/app/TeamFinance","/app/MaterialTeamReservation","/app/TeamSecretary","/app/TeamSecretaryAttendance","/app/storage","/app/notifications"])
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
