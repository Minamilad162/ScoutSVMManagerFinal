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

test('view-all does not grant upload to admin or global secretary', () => {
  assert.equal(permission(global), false)
  assert.equal(permission([{ role_slug: 'admin', team_id: null }]), false)
  assert.equal(permission([{ role_slug: 'chef_de_legion', team_id: 'ashbal' }]), false)
  assert.equal(permission([...global, ...scoped]), true)
})

test('team sidebar is restricted for scoped secretaries; manager sees all teams', () => {
  assert.deepEqual(visibleSecretaryTeams(teams, scoped), [{ id: 'ashbal' }])
  assert.equal(visibleSecretaryTeams(teams, global).length, 2)
  assert.equal(visibleSecretaryTeams(teams, [{ role_slug: 'admin', team_id: null }]).length, 2)
})

test('frontend queries exact team and scout year; storage and database enforce scoped write', () => {
  const api = fs.readFileSync('src/features/secretaryForms/api.ts','utf8')
  const sql = fs.readFileSync('supabase/24_secretary_team_forms.sql','utf8')
  const routes = fs.readFileSync('src/App.tsx','utf8')
  assert.match(api, /\.eq\('team_id', teamId\)/)
  assert.match(api, /\.eq\('scout_year_id', scoutYearId\)/)
  assert.match(api, /upload\(storagePath, file, \{ upsert: false, contentType: 'application\/pdf' \}\)/)
  assert.match(sql, /secretary_forms_can_upload\(team_id, scout_year_id\)/)
  assert.match(sql, /secretary_forms_can_upload_path\(name\)/)
  assert.match(sql, /secretary-forms', 'secretary-forms', false/)
  assert.match(routes, /path="AdminSecretary"/)
})
