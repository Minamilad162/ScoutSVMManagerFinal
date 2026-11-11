import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isMissingBudgetConfirmationSchema, isMissingEffectiveBudgetView } from '../src/features/finance/budgetSchema.ts'

const adminFinance = readFileSync(new URL('../src/pages/AdminFinance.tsx', import.meta.url), 'utf8')

test('missing confirmed_at is recognized as a schema migration mismatch', () => {
  assert.equal(isMissingBudgetConfirmationSchema({ code: '42703', message: 'column team_budgets.confirmed_at does not exist' }), true)
  assert.equal(isMissingBudgetConfirmationSchema({ code: 'PGRST204', message: "Could not find the 'scout_year_id' column of 'team_budgets' in the schema cache" }), true)
})

test('authorization and network failures are never disguised as missing migration', () => {
  assert.equal(isMissingBudgetConfirmationSchema({ code: '42501', message: 'permission denied for table team_budgets' }), false)
  assert.equal(isMissingBudgetConfirmationSchema({ code: 'PGRST301', message: 'JWT expired' }), false)
  assert.equal(isMissingBudgetConfirmationSchema(null), false)
})

test('legacy fallback is team- and term-scoped and never implicitly confirms the amount', () => {
  assert.match(adminFinance, /\.select\('id,amount_total,created_at,created_by'\)/)
  assert.match(adminFinance, /\.eq\('team_id', teamId\)\.eq\('term_id', termId\)/)
  assert.match(adminFinance, /confirmed_at: null, confirmed_by: null/)
  assert.match(adminFinance, /confirmationSchemaReady && record/)
})

test('writes remain blocked until the confirmation schema exists', () => {
  assert.match(adminFinance, /if \(!budgetSchemaReady\) return toast\.error/)
  assert.match(adminFinance, /disabled=\{isReadOnlyView \|\| !termBounds \|\| !budgetSchemaReady\}/)
  assert.match(adminFinance, /role="alert"/)
})

test('missing effective budget view also blocks confirmation', () => {
  assert.equal(isMissingEffectiveBudgetView({ code: 'PGRST205', message: "Could not find the table 'public.v_team_budgets_effective' in the schema cache" }), true)
  assert.equal(isMissingEffectiveBudgetView({ code: '42P01', message: 'relation "v_team_budgets_effective" does not exist' }), true)
  assert.equal(isMissingEffectiveBudgetView({ code: '42501', message: 'permission denied on v_team_budgets_effective' }), false)
  assert.match(adminFinance, /if \(confirmationSchemaReady\)/)
})
