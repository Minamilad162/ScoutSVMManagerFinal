import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const admin = fs.readFileSync('src/pages/AdminSecretary.tsx', 'utf8')
const team = fs.readFileSync('src/pages/TeamSecretary.tsx', 'utf8')
const styles = fs.readFileSync('src/index.css', 'utf8')

function containsBetween(text, start, end, target) {
  const a = text.indexOf(start)
  const b = text.indexOf(end, a + start.length)
  assert.ok(a >= 0 && b > a, `Missing boundaries: ${start} - ${end}`)
  assert.ok(text.slice(a, b).includes(target), `Expected ${target} between ${start} and ${end}`)
}

test('AdminSecretary sidebar wraps all four tabs, instead of living inside forms only', () => {
  const layout = admin.indexOf('<div className="secforms-admin-layout secretary133-layout">')
  const sidebar = admin.indexOf('<aside className="secforms-team-sidebar"', layout)
  const main = admin.indexOf('<main className="secretary133-main"', sidebar)
  const tabs = admin.indexOf('className="secforms-top-tabs secretary133-tabs"', main)
  const forms = admin.indexOf("secretaryTab === 'forms' && (", tabs)
  const layoutEnd = admin.lastIndexOf('</main>')
  assert.ok(layout >= 0 && sidebar > layout && main > sidebar && tabs > main && forms > tabs && layoutEnd > forms)
  assert.match(admin, /const \[secretaryTab, setSecretaryTab\] = useState<[^>]*>\('equipiers'\)/)
  assert.match(admin, /onClick=\{\(\) => selectTeam\(team\.id\)\}/)
  assert.match(admin, /role="tab" aria-selected=\{secretaryTab === 'equipiers'\}/)
  assert.match(admin, /role="tab" aria-selected=\{secretaryTab === 'chefs'\}/)
  assert.match(admin, /role="tab" aria-selected=\{secretaryTab === 'attendance'\}/)
  assert.match(admin, /role="tab" aria-selected=\{secretaryTab === 'forms'\}/)
})

test('AdminSecretary keeps separate boys/chefs tables and team scoped reads', () => {
  assert.match(admin, /scoutYearFrom\('v_members_current', 'v_members_context'\)/)
  assert.match(admin, /\.eq\('team_id', teamId\)/)
  assert.match(admin, /scoutYearFrom\('v_user_roles_current', 'v_user_roles_context'\)/)
  containsBetween(admin, "secretaryTab === 'equipiers' &&", "secretaryTab === 'chefs' &&", 'ولي الأمر')
  containsBetween(admin, "secretaryTab === 'chefs' &&", "secretaryTab === 'attendance' &&", 'المسؤوليات')
  assert.match(admin, /setRows\(\[\]\)/)
  assert.match(admin, /isHistoricalView && <span className="secretary133-history-badge"/)
  assert.match(admin, /canSeeAllTeams && !isHistoricalView && <th>الإجراءات<\/th>/)
})

test('TeamSecretary preserves CRUD and attendance, and forms stays its own tab', () => {
  assert.match(team, /const \[tab, setTab\] = useState<'equipiers'\|'attendance'\|'forms'>\('equipiers'\)/)
  assert.match(team, /onClick=\{addEquipier\}/)
  assert.match(team, /onClick=\{saveEdit\}/)
  assert.match(team, /onClick=\{\(\)=>deleteEquipier\(m.id\)\}/)
  assert.match(team, /onClick=\{saveAttendance\}/)
  assert.match(team, /onClick=\{\(\)=>setTab\('attendance'\)\}>حضور الاجتماعات/)
  assert.match(team, /tab === 'forms' && \(\s*<SecretaryFormsWorkspace/)
  assert.match(styles, /\.secretary133-tabs\{display:grid/)
})
