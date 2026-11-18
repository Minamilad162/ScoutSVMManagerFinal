import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/31_field_reservations_current_year_rls.sql',import.meta.url),'utf8')
const page = readFileSync(new URL('../src/pages/FieldReservationsTeam.tsx',import.meta.url),'utf8')

test('field reservation policy only authorizes current-year team membership and roles', () => {
  assert.match(migration,/msa\.team_id = p_team/)
  assert.match(migration,/sy\.is_current IS TRUE/)
  assert.match(migration,/ura\.is_active IS TRUE/)
  assert.match(migration,/r\.role_slug IN \('chef_de_legion','responsable_materials'\)/)
  assert.match(migration,/ura\.team_id = p_team OR ura\.team_id IS NULL/)
  assert.match(migration,/p_start AT TIME ZONE 'Africa\/Cairo'/)
})

test('insert, select and soft-cancel update are protected without disabling RLS', () => {
  for (const policy of ['select','insert','update']) {
    assert.match(migration,new RegExp('CREATE POLICY "field bookings active role '+policy+'"'))
  }
  assert.match(migration,/WITH CHECK \([\s\S]*?public\.field_booking_can_write\(team_id\)/)
  assert.match(migration,/DROP POLICY IF EXISTS "field_res modify by team"/)
  assert.match(migration,/DROP POLICY IF EXISTS "field_res read by team"/)
  assert.doesNotMatch(migration,/DISABLE ROW LEVEL SECURITY|TRUNCATE|DELETE FROM public\.field_reservations/i)
})

test('migration refuses missing schema and unexpected custom write policies', () => {
  assert.match(migration,/missing tables: %/)
  assert.match(migration,/missing columns: %/)
  assert.match(migration,/unexpected field reservation write policies/)
  assert.match(migration,/REVOKE ALL ON FUNCTION public\.field_booking_can_write/)
  assert.match(migration,/TO authenticated/)
})

test('app checks the database RLS decision before inserting a field reservation', () => {
  const rpc=page.indexOf("'field_booking_can_write'")
  const insert=page.indexOf(".from('field_reservations')\n        .insert({")
  assert.ok(rpc>=0 && insert>rpc)
  assert.match(page,/if \(databaseAllowsBooking !== true\)/)
  assert.match(page,/e\?\.code === '42501'/)
  assert.match(page,/Migration 31/)
})
