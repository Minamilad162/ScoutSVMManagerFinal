import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const sql = readFileSync(new URL('../supabase/32_field_reservations_legacy_policy_compat.sql', import.meta.url), 'utf8')

test('preserves all four reported existing production write policies', () => {
  for (const name of ['field_res admin write','field_res team upd','field_res team writers','fres_write_team']) {
    assert.ok(sql.includes(name), name)
    assert.ok(!sql.includes('DROP POLICY IF EXISTS "' + name + '"'), name)
  }
  assert.match(sql, /pre-existing restrictive policies/)
  assert.match(sql, /p\.permissive='RESTRICTIVE'/)
})

test('adds permissive allow and mandatory restrictive policies for INSERT and UPDATE', () => {
  assert.match(sql, /AS PERMISSIVE FOR INSERT TO authenticated/)
  assert.match(sql, /AS PERMISSIVE FOR UPDATE TO authenticated/)
  assert.match(sql, /AS RESTRICTIVE FOR INSERT TO PUBLIC/)
  assert.match(sql, /AS RESTRICTIVE FOR UPDATE TO PUBLIC/)
  assert.match(sql, /AS PERMISSIVE FOR SELECT TO authenticated/)
  assert.match(sql, /CREATE POLICY "field bookings compat allow select 32"/)
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON public\.field_reservations TO authenticated/)
})

test('RLS always checks current-year active membership and team roles', () => {
  assert.match(sql, /msa\.team_id = p_team/)
  assert.match(sql, /msa\.is_active IS TRUE/)
  assert.match(sql, /ura\.is_active IS TRUE/)
  assert.match(sql, /sy\.is_current IS TRUE/)
  assert.match(sql, /r\.role_slug IN \('chef_de_legion','responsable_materials'\)/)
  assert.match(sql, /Africa\/Cairo/)
  assert.match(sql, /public\.field_booking_can_write\(team_id\)/)
  assert.match(sql, /public\.field_booking_is_current_year\(starts_at, ends_at\)/)
})

test('does not alter prior reservations or disable security', () => {
  assert.doesNotMatch(sql, /DISABLE ROW LEVEL SECURITY|TRUNCATE|DELETE FROM public\.field_reservations/i)
  assert.match(sql, /ALTER TABLE public\.field_reservations ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /missing tables: %/)
  assert.match(sql, /missing columns: %/)
  assert.match(sql, /expected exactly one current Scout Year/)
})
