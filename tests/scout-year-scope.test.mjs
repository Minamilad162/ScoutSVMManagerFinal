import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getScoutYearBounds,
  getTermYearBounds,
  inDateBounds,
  clampDateToBounds,
  belongsToScoutYear,
} from '../src/lib/scoutYearScope.ts'

const year = { id: 'scout-2026-27', name: '2026/2027', start_date: '2026-09-01', end_date: '2027-08-31' }
const oldTerm = { id: 'old', scout_year_id: 'scout-2025-26', start_date: '2025-09-01', end_date: '2026-08-31' }
const summer = { id: 'summer', scout_year_id: year.id, start_date: '2027-06-15', end_date: '2027-10-20' }

test('uses scout year dates instead of Jan-Dec calendar dates', () => {
  assert.deepEqual(getScoutYearBounds(year), { start: '2026-09-01', end: '2027-08-31' })
  assert.equal(inDateBounds('2026-10-01', getScoutYearBounds(year)), true)
  assert.equal(inDateBounds('2027-06-01', getScoutYearBounds(year)), true)
  assert.equal(inDateBounds('2025-10-01', getScoutYearBounds(year)), false)
  assert.equal(inDateBounds('2027-09-01', getScoutYearBounds(year)), false)
})

test('intersects summer 2027 term dates with the selected scout year', () => {
  assert.deepEqual(getTermYearBounds(year, summer), { start: '2027-06-15', end: '2027-08-31' })
  assert.equal(inDateBounds('2027-06-14', getTermYearBounds(year, summer)), false)
  assert.equal(inDateBounds('2027-08-31', getTermYearBounds(year, summer)), true)
  assert.equal(inDateBounds('2027-10-20', getTermYearBounds(year, summer)), false)
})

test('blocks old terms even when dates partially overlap', () => {
  assert.equal(belongsToScoutYear(oldTerm, year), false)
  assert.equal(belongsToScoutYear({ ...oldTerm, scout_year_id: year.id }, year), false)
  assert.equal(belongsToScoutYear(summer, year), true)
  assert.equal(getTermYearBounds(year, oldTerm), null)
})

test('clamps out-of-range dates, without silently allowing invalid year', () => {
  assert.equal(clampDateToBounds('2025-12-04', getScoutYearBounds(year)), '2026-09-01')
  assert.equal(clampDateToBounds('2028-01-12', getScoutYearBounds(year)), '2027-08-31')
  assert.equal(clampDateToBounds('2027-05-01', getScoutYearBounds(year)), '2027-05-01')
  assert.equal(getScoutYearBounds({ start_date: '2027-01-01', end_date: '2026-01-01' }), null)
  assert.equal(getTermYearBounds(null, summer), null)
  assert.equal(inDateBounds('2027-01-01', null), false)
})
