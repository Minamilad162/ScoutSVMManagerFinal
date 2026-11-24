import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/pages/AdminMembers.tsx', import.meta.url), 'utf8')

test('new account team selector is adjacent to role choices rather than above account search', () => {
  const section = source.indexOf('title="إضافة قائد جديد"')
  const auth = source.indexOf('المستخدم (Auth user)', section)
  const roleSection = source.indexOf('الأدوار ونطاقها', auth)
  const picker = source.indexOf('id="new-chef-role-team"', auth)
  const rolesTable = source.indexOf('<table', roleSection)
  assert.ok(section >= 0 && auth > section && picker > auth && picker < roleSection && roleSection < rolesTable)
  assert.ok(!source.slice(section, auth).includes('value={chefTeamId}'))
})

test('team selection controls both seasonal membership and scoped roles', () => {
  assert.match(source, /value=\{chefTeamId\}[\s\S]*?onChange=\{\(e\) => setChefTeamId\(e\.target\.value\)\}/)
  assert.match(source, /upsertCurrentSeasonMemberAssignment\(\{[\s\S]*?teamId: chefTeamId \|\| null/)
  assert.match(source, /selectedTeamRoles\.includes\(choice\.slug\) && chefTeamId\) requestedRoles\.push\(\{ roleId: role\.id, teamId: chefTeamId \}\)/)
})

test('scoped roles require an actual selected team before save', () => {
  assert.match(source, /selectedTeamRoles\.length && !chefTeamId\) return toast\.error/)
  assert.match(source, /chefTeamId && !teams\.some\(\(team\) => team\.id === chefTeamId\)/)
  assert.match(source, /selectedTeamRoles\.length > 0 && !chefTeamId/)
  assert.match(source, /<option value="">— اختر الفريق أو اتركه بدون فريق —<\/option>/)
})

test('existing member role/team editing remains in place', () => {
  assert.match(source, /الفريق في السنة المختارة/)
  assert.match(source, /value=\{seasonTeamId\}/)
  assert.match(source, /value=\{newRoleTeamId\}/)
  assert.match(source, /handleAddRole/)
})

test('missing new leader name is explained and focused rather than a generic toast', () => {
  assert.match(source, /const chefFullNameInputRef = useRef<HTMLInputElement>\(null\)/)
  assert.match(source, /if \(!chefFullName\.trim\(\)\) \{[\s\S]*?setChefNameError\(true\)[\s\S]*?focusChefFullName\(\)/)
  assert.match(source, /field\?\.scrollIntoView/)
  assert.match(source, /field\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(source, /aria-invalid=\{chefNameError\}/)
})

test('selected account prompts for name without inventing it from email', () => {
  assert.match(source, /selectedUser && !chefFullName\.trim\(\)/)
  assert.match(source, /انتقل لحقل الاسم/)
  assert.match(source, /ولا يُستخرج تلقائيًا من البريد الإلكتروني/)
  assert.doesNotMatch(source, /setChefFullName\(selectedUser\.email/)
})

const rosterApi = readFileSync(new URL('../src/features/scoutYears/adminRosterApi.ts', import.meta.url), 'utf8')
test('Chef rank repair is an explicit admin action for the saved team and selected year', () => {
  assert.match(source, /const savedChefRank = selectedManagedMember\?\.rank_slug === 'chef_de_legion'/)
  assert.match(source, /const needsSavedChefRole = Boolean\(selectedManagedMember\?\.scout_year_id === selectedYearId/)
  assert.match(source, /async function repairSavedChefRole\(\)[\s\S]*?window\.confirm[\s\S]*?grantChefTeamRole\(selectedManagedMember\.auth_user_id, savedChefTeam\)/)
  assert.match(source, /async function grantChefTeamRole[\s\S]*?scoutYearId: selectedYearId,[\s\S]*?teamId: targetTeamId,[\s\S]*?fetchSeasonRoles\(selectedYearId, targetUserId\)/)
  assert.match(source, /onClick=\{repairSavedChefRole\}/)
  assert.match(source, /const confirmed = missingRole && window\.confirm/)
  assert.match(source, /const confirmChefRole = wantsChefRole && window\.confirm/)
  assert.match(rosterApi, /else if \(existingSeason\.is_active !== true\)[\s\S]*?\.update\(\{ is_active: true \}\)/)
})

test('Legacy Admin role editor uses the same year-scoped assignment API', () => {
  const admin = readFileSync(new URL('../src/pages/Admin.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(admin, /from\('user_roles'\)\.insert/)
  assert.match(admin, /await addCurrentSeasonRole\(\{[\s\S]*?scoutYearId: yearId,[\s\S]*?syncLegacy: isCurrent/)
  assert.match(admin, /await fetchSeasonRoles\(yearId, mem.auth_user_id\)/)
  assert.match(admin, /currentScoutYear\?\.status !== 'draft'/)
})
test('Bulk repair only copies active current-year roles to missing legacy rows', () => {
  const repair = readFileSync(new URL('../supabase/ROLE_SYNC_CURRENT_YEAR_REPAIR.sql', import.meta.url), 'utf8')
  assert.match(repair, /sy\.is_current is true/)
  assert.match(repair, /ura\.is_active is true and r\.role_slug <> 'admin'/)
  assert.match(repair, /msa\.is_active is true/)
  assert.match(repair, /ts\.is_active is true/)
  assert.match(repair, /ur\.team_id is not distinct from e\.team_id/)
  assert.match(repair, /insert into public\.user_roles/)
  assert.doesNotMatch(repair, /delete from|insert into public\.user_role_assignments/i)
  assert.match(repair, /PASS_R153_ELIGIBLE_ROLE_SYNC/)
})
