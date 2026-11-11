# ScoutSVM Release 137 — Admin Finance schema compatibility

## Incident
`/app/AdminFinance` returned `column team_budgets.confirmed_at does not exist` on the live frontend. The code introduced by Release 131 relies on SQL 23 (`supabase/23_team_budget_scout_year_confirmation.sql`) for the `confirmed_at`, `confirmed_by`, `scout_year_id` columns and the `v_team_budgets_effective` view. The code deployment does **not** apply database SQL.

## Safe UI fix
- Detect only matching missing-column/schema-cache errors; permission and authentication errors stay visible.
- Read an existing legacy budget by the **selected team and term only** to show the stored amount and audit trail without treating it as approved.
- Continue loading year/term-scoped expenses.
- Check both confirmation columns and the effective-budget view.
- Fail closed: pending legacy values are never counted and budget approval/input are disabled until the schema is ready. An actionable Arabic banner replaces the raw missing-column toast.
- Keep year, team, term selection and existing roles intact.

## Database follow-up (NOT applied by this release)
1. Connect the **actual ScoutSVM** Supabase project. Read the remote migration ledger, `team_budgets` columns, existing triggers, RLS and term ownership. Use `supabase/SCOUTSVM_TEAM_BUDGET_SCHEMA_PREFLIGHT_READ_ONLY.sql`.
2. If SQL 23 is truly absent, review it against the current remote state before applying; do not replay all historical SQL scripts. Verify trigger/RLS compatibility, affected row counts and that no old budgets are auto-confirmed.
3. Confirm `scout_year_id`, `confirmed_at`, `confirmed_by`, `v_team_budgets_effective` and exact-year data isolation after applying. Then refresh the PostgREST schema cache if required.
4. Test one specific 2026/2027 team + term approval with authorized Admin and verify the budget on AdminFinance, Finance, TeamFinance and dashboard; test that unconfirmed legacy amounts remain excluded.

**No live database was changed**. This release only handles the migration gap safely; full budget approval will not work until SQL 23 is present on ScoutSVM's database.
