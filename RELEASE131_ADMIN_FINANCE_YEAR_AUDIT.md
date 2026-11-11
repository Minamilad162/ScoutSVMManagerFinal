# ScoutSVM Release 131 — Finance budget ownership and archived-year navigation

**Source:** Release 130 ZIP from this conversation. This is an additive patch; no new scaffold.

## Incident and cause

Expenses had already been year-bound in release 130, but `team_budgets` was keyed by `(team_id, term_id)` and its amount was still displayed whether or not an administrator explicitly approved it for the new year. The base table recorded `created_at` and `created_by` but had no dedicated `scout_year_id` or confirmation provenance. The old `Finance` page also had a budget writer, so the budget could have been entered outside `/AdminFinance`. This explains possible paths for the unexpected amount; **without the live ScoutSVM database's records and audit log it is not possible to identify the exact source or person**.

## Fixes

1. `supabase/23_team_budget_scout_year_confirmation.sql` adds `team_budgets.scout_year_id`, `confirmed_at`, `confirmed_by`, validates the year/term match on writes, and restricts budget edit permission to Super Admin. A preexisting amount for the **physical current Scout Year** is kept in the database but omitted from budget totals until explicitly confirmed in `/AdminFinance`. Archived years retain their original budget history for read-only reports. No historical amount is deleted.
2. `/AdminFinance` lists a pending budget as **unconfirmed** with its stored value, creation timestamp, creator UUID and latest audit activity. It does not silently count the pending figure, and the admin can set a new amount and explicitly confirm it. Only the amount confirmed by the admin is displayed as the current budget. Historical years are read-only.
3. All known finance readers (`TeamFinance`, `Finance`, Admin statistics, Ops dashboard, reports, Knowledge Bank) use `v_team_budgets_effective` rather than directly using the raw budget table. `/Finance` no longer writes the approved budget independently.
4. The global Scout Year selector in the app header remains authoritative. `/AdminMembers` uses that same year (old `?year=` links are mapped to the header selection). The year-specific Admin statistics, attendance/secretary, meeting minutes, admin field reservations, general reservation administration, and material returns are scoped to the selected Scout Year. Date ranges are clipped to the selected year and selected term where applicable. Archived years are read-only.
5. The migration preserves provenance during `scout_year_id` backfill by suppressing only the existing budget-audit and budget-notification triggers for the backfill. Threshold notification logic counts only confirmed budgets and expense dates within the current Scout Year / term; no new alert from an unconfirmed legacy amount.

## Rollout order — IMPORTANT

1. Back up the ScoutSVM database or otherwise establish recovery / rollback procedures. Inspect the remote Supabase migration ledger, `team_budgets` columns, policies, and existing trigger definitions **before** applying changes. Do not replay older migrations.
2. Run `SCOUT_YEAR_BUDGET_AUDIT_READ_ONLY.sql` **before** migration 23 to examine budget dates, actual owner term and historical audit trails. The query modifies nothing.
3. After reviewing the audit results and receiving explicit approval for production database mutation, apply `supabase/23_team_budget_scout_year_confirmation.sql` **once** to the correct ScoutSVM database. It has **NOT** been applied remotely by this delivery. Review any drift in the existing `notify_budget_threshold()` definition before replacing it; the SQL is based on the release archive's version.
4. Verify that `team_budgets.scout_year_id` matches `terms.scout_year_id`, that `v_team_budgets_effective` works under normal authenticated RLS, that current unconfirmed budgets are excluded from the totals, and that archived budgets are still visible. Test Super Admin `confirm` and the role limitations on a staging or disposable record.
5. Only after the migration succeeds, build/deploy the frontend. Avoid deploying it first because the new frontend expects the new view and columns. Confirm the actual current year in `scout_years.is_current` is 2026/2027.
6. In `/AdminFinance`, select each team/term for 2026/2027 and **explicitly confirm** only amounts you intend to carry forward; leave unapproved/unwanted entries pending, without deleting them.
7. Switch the topbar from 2026/2027 to 2025/2026 as Admin and check attendance, members, finance, reports, reservations, and the return approvals; switch back and ensure no previous-year values remain in new-year screens.

## QA performed locally

- `npm run qa:static` — PASS (97 source files, 55 registered routes).
- `npm run test:scout-year` — PASS (4/4 date boundary tests).
- `npm run test:budget-year` — PASS (5/5 static migration/frontend contract checks).
- TypeScript/TSX **syntax parsing** — PASS (all 97 source files).
- Full TypeScript typecheck / Vite production build — **NOT COMPLETED**; `npm ci --offline` cannot download the uncached `zip-stream@4.1.1` dependency in this environment. Syntax and static QA are not a substitute for building the app and integration testing against the user's database.
- No live ScoutSVM Supabase connection was identified among the connected accounts; **no production data was inspected or changed**. Therefore, the identity behind the preexisting budget and runtime behavior with production data remain unverified.

## Scope / intentional exceptions

Reference catalogs (teams, ranks, equipment stock and role definitions), global security roles used for permissions, and system-wide audit/account administration are not season-specific business facts; they remain global or have separate auditing. Selected-year **operational records** are the objects targeted by the seasonal filter. Historical read-only client logic is not a replacement for server-side RLS; retain and review the production policy safeguards.
