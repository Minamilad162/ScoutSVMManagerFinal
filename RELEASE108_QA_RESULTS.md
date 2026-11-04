# Release 108 — QA Results

## Automated checks
- Static QA: **PASS — 96 source files / 55 registered routes**
- TypeScript/TSX syntax/transpile: **PASS — 95 executable files**
- CSS parse: **PASS — 0 errors**
- Service Worker JavaScript syntax: **PASS**
- Service Worker cache version: **v1.2.0-r108**
- `node_modules`: excluded
- `dist`: excluded
- local `.env*` secrets: none packaged

## Regression checks against Release 107
### Business mutations
No new page-level write path was introduced.

`AdminScoutYears.tsx` mutation call counts remain unchanged:
- insert: 0 → 0
- update: 0 → 0
- delete: 0 → 0
- upsert: 0 → 0

`scoutYears/api.ts` mutation call counts remain unchanged:
- insert: 3 → 3
- update: 2 → 2
- delete: 1 → 1
- upsert: 4 → 4

The two new API RPC calls are read/validation operations:
- optimized year overview;
- activation readiness.

## Performance verification
- Scout Year overview changed from per-year summary loading to one overview RPC when SQL18 is installed.
- Readiness data is not loaded during normal page load.
- Readiness issue payload is capped.
- Admin roster reference queries were deduplicated and cached.
- Static `.from()` occurrences in `adminRosterApi.ts`: **32 → 28**.
- Estimated Admin Members initial DB round-trips: **~10 → ~6**.
- Warm-cache roster reload: **~3 DB round-trips** for the dynamic roster/role data.

## Server-side safety
SQL18 overrides `set_current_scout_year_atomic(...)` so activation is revalidated inside the same database transaction.

## Environment limitation
SQL18 was statically reviewed and packaged, but was not executed against the user's live Supabase project in this environment. The migration must be run on staging/live before testing the activation flow end-to-end.
