import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  canBookMaterialsForTeam, canManageMaterialBookingsAcrossTeams,
  preferredMaterialBookingTeamId, materialBookableTeams, materialBookingPermissionMessage,
} from '../src/features/reservations/materialBookingPermissions.ts'
const teams = [{ id: 'ashbal', name: 'أشبال' }, { id: 'advanced', name: 'متقدم أول' }]
const lead = [{ role_slug: 'chef_de_legion', team_id: 'advanced' }]
const materials = [{ role_slug: 'responsable_materials', team_id: 'advanced' }]
const globalRole = [{ role_slug: 'responsable_materials', team_id: null }]
test('scoped team lead books only their team', () => {
  assert.equal(canBookMaterialsForTeam(lead, 'advanced'), true)
  assert.equal(canBookMaterialsForTeam(lead, 'ashbal'), false)
})
test('scoped materials responsible books only own team', () => {
  assert.equal(canBookMaterialsForTeam(materials, 'advanced'), true)
  assert.equal(canBookMaterialsForTeam(materials, 'ashbal'), false)
})
test('global materials responsible books across teams', () => {
  assert.equal(canManageMaterialBookingsAcrossTeams(globalRole), true)
  assert.equal(canBookMaterialsForTeam(globalRole, 'advanced'), true)
  assert.equal(canBookMaterialsForTeam(globalRole, 'ashbal'), true)
})
test('permanent admin can book any team', () => {
  assert.equal(canBookMaterialsForTeam([{ role_slug: 'admin', team_id: null }], 'ashbal'), true)
})
test('unrelated roles and global chef are not eligible', () => {
  assert.equal(canBookMaterialsForTeam([{ role_slug: 'responsable_finance', team_id: 'advanced' }], 'advanced'), false)
  assert.equal(canBookMaterialsForTeam([{ role_slug: 'chef_de_legion', team_id: null }], 'advanced'), false)
  assert.equal(canBookMaterialsForTeam([], ''), false)
})
test('archived Scout Years are read-only', () => {
  assert.equal(canBookMaterialsForTeam(globalRole, 'advanced', true), false)
  assert.equal(canBookMaterialsForTeam([{ role_slug: 'admin' }], 'advanced', true), false)
  assert.match(materialBookingPermissionMessage({ roles: lead, teamId: 'advanced', isReadOnlyView: true }), /المؤرشفة/)
})
test('selected team is authorized seasonal role, not unrelated legacy team', () => {
  assert.equal(preferredMaterialBookingTeamId(lead, teams, 'ashbal'), 'advanced')
  assert.equal(preferredMaterialBookingTeamId(globalRole, teams, 'advanced'), 'advanced')
  assert.equal(preferredMaterialBookingTeamId([], teams, 'advanced'), '')
})
test('chooser only exposes authorized teams', () => {
  assert.deepEqual(materialBookableTeams(lead, teams).map(t => t.id), ['advanced'])
  assert.deepEqual(materialBookableTeams(globalRole, teams).map(t => t.id), ['ashbal', 'advanced'])
})
test('page guards save and cancel callbacks', () => {
  const page = readFileSync(new URL('../src/pages/MaterialsTeamReservations.tsx', import.meta.url), 'utf8')
  assert.match(page, /if \(!canBook\) return toast\.error\(bookingPermissionMessage/)
  assert.match(page, /preferredMaterialBookingTeamId\(roles/)
  assert.match(page, /disabled=\{!canBook \|\| saving \|\| isReadOnlyView\}/)
})
test('SQL migration uses scoped current-year RLS on INSERT/UPDATE', () => {
  const s = readFileSync(new URL('../supabase/29_material_reservations_current_year_role_scope.sql', import.meta.url), 'utf8')
  assert.match(s, /sy\.is_current IS TRUE/)
  assert.match(s, /ura\.is_active IS TRUE/)
  assert.match(s, /ura\.team_id = p_team/)
  assert.match(s, /CREATE POLICY "material bookings active role insert"/)
  assert.match(s, /CREATE POLICY "material bookings active role update"/)
  assert.doesNotMatch(s, /DISABLE ROW LEVEL SECURITY|TRUNCATE|DELETE FROM public\.material_reservations/)
})
