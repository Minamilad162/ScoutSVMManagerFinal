import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { filterTermsForScoutYear, filterSelectionsForScoutYear } from '../src/features/bestChefs/yearScope.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const api = read('../src/features/bestChefs/api.ts')
const gallery = read('../src/pages/BestChefsGallery.tsx')
const home = read('../src/pages/Home.tsx')
const admin = read('../src/pages/AdminBestChefs.tsx')
const migration = read('../supabase/25_best_chefs_year_integrity.sql')

test('terms are selected only from the explicitly requested Scout Year', () => {
  const terms = [
    { id: 'old-term', scout_year_id: '2025/26' },
    { id: 'new-1', scout_year_id: '2026/27' },
    { id: 'new-2', scout_year_id: '2026/27' },
    { id: 'ambiguous', scout_year_id: null },
  ]
  assert.deepEqual(filterTermsForScoutYear(terms, '2026/27').map((term) => term.id), ['new-1', 'new-2'])
  assert.deepEqual(filterTermsForScoutYear(terms, '2025/26').map((term) => term.id), ['old-term'])
  assert.deepEqual(filterTermsForScoutYear(terms, 'unknown'), [])
})

test('mismatched and unrelated selections cannot leak into a term or year', () => {
  const rows = [
    { scout_year_id: '2025/26', term_id: 'new-2', name: 'wrong-year legacy row' },
    { scout_year_id: '2026/27', term_id: 'old-term', name: 'wrong-term legacy row' },
    { scout_year_id: '2026/27', term_id: 'new-2', name: 'valid new year row' },
    { scout_year_id: '2025/26', term_id: 'old-term', name: 'valid old year row' },
  ]
  assert.deepEqual(filterSelectionsForScoutYear(rows, '2026/27', ['new-1', 'new-2']).map((x) => x.name), ['valid new year row'])
  assert.deepEqual(filterSelectionsForScoutYear(rows, '2025/26', ['old-term']).map((x) => x.name), ['valid old year row'])
  assert.deepEqual(filterSelectionsForScoutYear(rows, '2026/27', []), [])
})

test('Supabase query enforces both independent year and term predicates', () => {
  assert.match(api, /\.eq\('scout_year_id', scoutYearId\)\s*\.in\('term_id', termIds\)/)
  assert.match(api, /filterSelectionsForScoutYear\(\(data \|\| \[\]\)/)
  assert.match(api, /filterTermsForScoutYear\(await fetchTerms\(\), scoutYearId\)/)
})

test('gallery and home reset stale rows on year changes', () => {
  assert.match(gallery, /fetchBestChefsGallery\(yearId\)/)
  assert.match(gallery, /setSections\(\[\]\)/)
  assert.match(gallery, /if \(!cancelled\) setSections\(rows\)/)
  assert.match(home, /fetchBestChefsHomeShowcase\(yearId\)/)
  assert.match(home, /setBestChefsShowcase\(null\)/)
  assert.match(home, /if \(!cancelled\) setBestChefsShowcase\(showcase\)/)
  assert.doesNotMatch(gallery, /firstWithItems\?\.term\.id/)
})

test('admin prevents cross-year writes and archived edits', () => {
  assert.match(api, /payload\.term\.scout_year_id !== scoutYear\.id/)
  assert.match(api, /isScoutYearViewReadOnly\(\)/)
  assert.match(api, /uniqueMemberIds\.some\(\(id\) => !candidateIds\.has\(id\)\)/)
  assert.match(admin, /disabled=\{isReadOnlyView\}/)
  assert.match(admin, /listBestChefsForTerm\(termId, yearId\)/)
})

test('SQL integrity migration is additive and preserves historical rows', () => {
  assert.match(migration, /BEFORE INSERT OR UPDATE ON public\.term_best_chefs/)
  assert.match(migration, /t\.scout_year_id = btc\.scout_year_id/)
  assert.doesNotMatch(migration, /DELETE FROM public\.term_best_chefs/i)
  assert.doesNotMatch(migration, /UPDATE public\.term_best_chefs/i)
})

test('a new Scout Year remains blank when all selections belong to the prior year', () => {
  const oldRows = [
    { scout_year_id: '2025/26', term_id: 'old-first' },
    { scout_year_id: '2025/26', term_id: 'old-second' },
  ]
  assert.deepEqual(filterSelectionsForScoutYear(oldRows, '2026/27', ['new-first', 'new-second']), [])
  assert.equal(filterSelectionsForScoutYear(oldRows, '2025/26', ['old-first', 'old-second']).length, 2)
})
