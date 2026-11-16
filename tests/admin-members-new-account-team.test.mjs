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
