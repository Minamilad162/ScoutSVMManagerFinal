import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const auth = readFileSync(new URL('../src/components/AuthProvider.tsx', import.meta.url), 'utf8')

test('refreshes current-year role/team snapshot when tab resumes or roles change', () => {
  assert.match(auth, /window\.addEventListener\('focus', onFocus\)/)
  assert.match(auth, /document\.addEventListener\('visibilitychange', onVisible\)/)
  assert.match(auth, /window\.addEventListener\('scoutsvm:roles-changed', onRoleUpdate\)/)
  assert.match(auth, /const snapshot = await fetchAccessSnapshot\(userId\)/)
  assert.match(auth, /setRoles\(snapshot\.roles\)/)
  assert.match(auth, /setMyTeamId\(snapshot\.myTeamId\)/)
})

test('refresh does not clear working permission state if API is temporarily unavailable', () => {
  const scope = auth.slice(auth.indexOf('const refreshScope = async'), auth.indexOf("window.addEventListener('focus', onFocus)"))
  assert.match(scope, /scopeRefreshPendingRef\.current/)
  assert.match(scope, /lastScopeRefreshAtRef\.current < 12000/)
  assert.match(scope, /activeUserIdRef\.current !== userId/)
  assert.match(scope, /logError\('AuthProvider\.refreshCurrentYearScope'/)
  assert.doesNotMatch(scope.slice(scope.indexOf('} catch (error)')), /setRoles\(\[\]\)/)
})

test('refresh signs out only for confirmed inactive membership, not transient errors', () => {
  const scope = auth.slice(auth.indexOf('const refreshScope = async'), auth.indexOf("window.addEventListener('focus', onFocus)"))
  assert.match(scope, /if \(!snapshot\.allowed\) \{[\s\S]*?blockInactiveAccount/)
  assert.doesNotMatch(scope.slice(scope.indexOf('} catch (error)')), /blockInactiveAccount/)
})

test('admission does not duplicate profile requests or clear the admitted role snapshot', () => {
  assert.doesNotMatch(auth, /AuthProvider\.loadProfile/)
  assert.match(auth, /applyAllowedSnapshot\(nextUser, snapshot\)/)
  assert.match(auth, /const refreshScope = async/)
})

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const client = readFileSync(new URL('../src/lib/supabase.ts', import.meta.url), 'utf8')
const members = readFileSync(new URL('../src/pages/AdminMembers.tsx', import.meta.url), 'utf8')
test('opening navigation and reconnecting refresh the existing authorized session', () => {
  assert.match(app, /if \(navOpen && user\?\.id\) window\.dispatchEvent\(new Event\('scoutsvm:roles-changed'\)\)/)
  assert.match(auth, /const onRoleUpdate = \(\) => \{ void refreshScope\(true\) \}/)
  assert.match(auth, /window\.addEventListener\('online', onOnline\)/)
  assert.match(auth, /window\.removeEventListener\('online', onOnline\)/)
  assert.match(client, /v_user_roles_current\|v_members_current/)
  assert.match(client, /cache: 'no-store'/)
  assert.match(client, /'has_role',/)
  assert.match(members, /if \(isSelectedCurrentYear\) window\.dispatchEvent\(new Event\('scoutsvm:roles-changed'\)\)/)
})
