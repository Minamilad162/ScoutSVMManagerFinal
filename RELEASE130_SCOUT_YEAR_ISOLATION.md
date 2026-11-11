# Release 130 — Scout Year 2026/2027 Data Isolation

**Source**: supplied `ScoutSVM-release129-team-finance-mockup-alignment.zip` (release129 retained, no fresh scaffold).

## Root cause and behavior

The Scout Year is a **record in `scout_years` with `start_date` and `end_date`**. A calendar year such as January–December 2026 is not the same range. Some pages used the term ID but did not check the actual dates of associated expenses; others read aggregated unfiltered views or allowed legacy all-years exports.

Release 130 computes the intersection of **selected Scout Year × selected term** for date-sensitive data, and fails closed where the year or term is unavailable. Existing old records are **not deleted or re-dated**. Super Admin's explicit year selector for historical/draft views remains intact.

## Audited / updated paths

- `src/features/reference/api.ts`: `fetchTerms` checks the explicitly selected Scout Year and rejects foreign/non-overlapping terms.
- `src/pages/TeamFinance.tsx`: list, totals, expense creation/edit validation, term dates, all/term/year Excel exports.
- `src/pages/Finance.tsx`, `src/pages/AdminFinance.tsx`, `src/pages/Admin.tsx`: budget/spending metrics and editing constrained to valid terms/periods; legacy `v_finance_summary` replaced in Admin stats with scoped queries.
- `src/pages/OpsDashboardBlocks.tsx`: expense-based budget warnings and date-range metrics use Scout Year, not historical all-year financial view; old overdue snapshot suppressed in historical context.
- `src/pages/AdminDashboard.tsx`: admin operational date range tied to Scout Year.
- `src/features/reports/api.ts`: financial report terms and expense dates scoped before aggregation.
- `src/pages/financeEvent.tsx`, `src/pages/AdminEvents.tsx`: event and expense dates and exports scoped to Scout Year.
- `src/pages/CampInstallmentsList.tsx`: date range switched from calendar year to Scout Year.
- `src/pages/TeamCases.tsx`: effective dates scoped to Scout Year.
- `src/pages/Materials.tsx`, `src/pages/MaterialsTeamReservations.tsx`: material/field reservations use Scout Year and term bounds; bookings outside chosen term rejected.
- `src/pages/TeamSecretaryAttendance.tsx`, `src/pages/AdminAttendance.tsx`, `src/pages/TeamSecretary.tsx`: meeting/attendance dates constrained and reload on year change.
- `src/features/knowledgeBank/api.ts`: finance Q&A and event spending cannot fall back to an unrelated year's terms or expense/event dates.
- `src/lib/scoutYearScope.ts`: reusable date bounds and season checks.
- `public/sw.js`: cache version bumped from r129 to r130.

## Verification

- `node scripts/qa-static.mjs` — PASS.
- `node --experimental-strip-types --test tests/scout-year-scope.test.mjs` — 4/4 PASS (Node 22 used locally; illustrative 2026/27 boundary fixture, **actual database dates always win**).
- All TS/TSX syntax/transpilation checks on app source — PASS.
- Full `npm run typecheck` and `npm run build`: **not verified here** due dependency installation failing in execution environment. Run `npm ci && npm run check && npm run test:scout-year` in a normal Node 22 build environment before deploying.
- No live Supabase database records, RLS policies, or migrations were modified or verified. For possible incorrectly dated existing records, run `SCOUT_YEAR_DATA_AUDIT_READ_ONLY.sql` manually; it's SELECT-only. Do not move/delete data without reviewing each anomaly.

## Deploy and smoke test

After deploy and browser refresh, validate Team Finance for a known team in the 2026/2027 selector, and check budget/spent/remaining and export across all/term/year. Compare summer term beginning and end dates with the selected Scout Year's actual start/end. Check an admin dashboard, finance reports, event page and attendance page. Then as Super Admin select an archived year and return to the current year to verify year switching and no cross-year cached figures.
