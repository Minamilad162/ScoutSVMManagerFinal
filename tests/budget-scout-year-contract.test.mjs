import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/23_team_budget_scout_year_confirmation.sql')
const adminFinance = read('../src/pages/AdminFinance.tsx')
const provider = read('../src/components/ScoutYearProvider.tsx')

test('team budgets are linked to the term-owned Scout Year, not calendar created_at', () => {
  assert.match(migration, /scout_year_id uuid REFERENCES public\.scout_years\(id\)/)
  assert.match(migration, /SET scout_year_id = t\.scout_year_id/)
  assert.match(migration, /NEW\.scout_year_id := term_scout_year/)
  assert.match(migration, /NEW\.scout_year_id <> term_scout_year/)
})

test('the effective-budget view does not count unconfirmed current-year legacy amounts', () => {
  assert.match(migration, /WITH \(security_invoker = true\)/)
  assert.match(migration, /sy\.is_current IS NOT TRUE OR b\.confirmed_at IS NOT NULL/)
  assert.match(migration, /b\.scout_year_id = t\.scout_year_id/)
  assert.match(migration, /b\.soft_deleted_at IS NULL/)
})

test('AdminFinance requires explicit confirmation and shows origin of old budget', () => {
  assert.match(adminFinance, /\.from\('team_budgets'\)/)
  assert.match(adminFinance, /\.eq\('scout_year_id', currentScoutYear!\.id\)/)
  assert.match(adminFinance, /confirmed_at: new Date\(\)\.toISOString\(\)/)
  assert.match(adminFinance, /budgetRecord\.created_by/)
  assert.match(adminFinance, /v_audit_log_readable/)
})

test('other budget readers use effective view only', () => {
  for (const path of [
    '../src/pages/TeamFinance.tsx', '../src/pages/Finance.tsx',
    '../src/pages/Admin.tsx', '../src/pages/OpsDashboardBlocks.tsx',
    '../src/features/reports/api.ts', '../src/features/knowledgeBank/api.ts',
  ]) {
    const source = read(path)
    assert.match(source, /v_team_budgets_effective/, `${path} missing verified budget view`)
    assert.doesNotMatch(source, /\.from\('team_budgets'\)/, `${path} reads raw budget records`)
  }
})

test('the global year switch supports archived read-only data across routes', () => {
  assert.match(provider, /setViewedScoutYearId/)
  assert.match(provider, /status !== 'draft'/)
  const members = read('../src/pages/AdminMembers.tsx')
  assert.match(members, /setViewedScoutYearId\(requested\)/)
  const returns = read('../src/pages/MaterialsReturnApprove.tsx')
  assert.match(returns, /fetchTerms\(\)/)
  assert.doesNotMatch(returns, /\.eq\('is_current', true\)/)
  assert.match(returns, /isReadOnlyView/)
})
