import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { canUploadSecretaryForms, visibleSecretaryTeams } from '../src/features/secretaryForms/permissions.ts'

const year = 'year-2026-2027'
const teams = [{ id: 'ashbal' }, { id: 'baraem' }]
const scoped = [{ role_slug: 'responsable_secretary', team_id: 'ashbal' }]
const global = [{ role_slug: 'responsable_secretary', team_id: null }]
const permission = (roles, teamId = 'ashbal', yearId = year, historical = false) => canUploadSecretaryForms({
  roles, teamId, scoutYearId: yearId, currentPhysicalScoutYearId: year, userId: 'some-user', isHistoricalView: historical,
})

test('team secretary can upload ONLY current-year forms for their assigned team', () => {
  assert.equal(permission(scoped), true)
  assert.equal(permission(scoped, 'baraem'), false)
  assert.equal(permission(scoped, 'ashbal', 'year-2025-2026'), false)
  assert.equal(permission(scoped, 'ashbal', year, true), false)
})

test('global secretary and admin may upload for any selected team in the current year', () => {
  for (const who of [global, [{ role_slug: 'admin', team_id: null }]]) {
    assert.equal(permission(who, 'ashbal'), true)
    assert.equal(permission(who, 'baraem'), true)
    assert.equal(permission(who, 'baraem', 'year-2025-2026'), false)
    assert.equal(permission(who, 'baraem', year, true), false)
  }
  assert.equal(permission([{ role_slug: 'chef_de_legion', team_id: 'ashbal' }]), false)
  assert.equal(permission([...global, ...scoped], 'baraem'), true)
})

test('team sidebar is restricted for scoped secretaries; manager sees all teams', () => {
  assert.deepEqual(visibleSecretaryTeams(teams, scoped), [{ id: 'ashbal' }])
  assert.equal(visibleSecretaryTeams(teams, global).length, 2)
  assert.equal(visibleSecretaryTeams(teams, [{ role_slug: 'admin', team_id: null }]).length, 2)
})

test('frontend queries exact team and scout year; storage and database enforce scoped write', () => {
  const api = fs.readFileSync('src/features/secretaryForms/api.ts','utf8')
  const sql = fs.readFileSync('supabase/24_secretary_team_forms.sql','utf8')
  const managerMigration = fs.readFileSync('supabase/28_secretary_manager_cross_team_upload.sql','utf8')
  const routes = fs.readFileSync('src/App.tsx','utf8')
  assert.match(api, /\.eq\('team_id', teamId\)/)
  assert.match(api, /\.eq\('scout_year_id', scoutYearId\)/)
  assert.match(api, /upload\(storagePath, file, \{ upsert: false, contentType: 'application\/pdf' \}\)/)
  assert.match(sql, /secretary_forms_can_upload\(team_id, scout_year_id\)/)
  assert.match(sql, /secretary_forms_can_upload_path\(name\)/)
  assert.match(sql, /secretary-forms', 'secretary-forms', false/)
  assert.match(managerMigration, /CREATE OR REPLACE FUNCTION public\.secretary_forms_can_upload/)
  assert.match(managerMigration, /public\.has_role\('admin'\)/)
  assert.match(managerMigration, /ura\.team_id IS NULL/)
  assert.match(managerMigration, /ura\.team_id = p_team/)
  assert.match(managerMigration, /sy\.is_current IS TRUE/)
  assert.match(managerMigration, /msa\.scout_year_id = sy\.id/)
  assert.doesNotMatch(managerMigration, /DROP POLICY|CREATE POLICY/)
  assert.match(routes, /path="AdminSecretary"/)
})
