# Release 103 — Production Readiness Hardening

## Status
**AMBER — substantially hardened, but not yet fully disaster-recovery/production verified.**

## Fixed in this release

### Push-notification consent
- Removed automatic browser notification permission prompts from the authenticated app shell.
- Existing granted permissions still synchronize silently.
- First-time permission is now requested only from an explicit user action inside Notifications.
- Added a visible permission state for granted / denied / unsupported browsers.

### Broken placeholder RPCs
Replaced the literal placeholder RPC `__DO_NOT_USE__` in:
- `MaterialsReturnApprove.tsx`
- `AdminFieldReservations.tsx`

Both now load terms from the same current-year view already used elsewhere in ScoutSVM:
`v_terms_with_scout_year`.

### Dependency hardening
- Removed `xlsx@0.18.5`.
- Consolidated the remaining XLSX export paths onto the existing Excel export implementation.
- Patched Vite `5.4.20 -> 5.4.21`.
- Set Node engine requirement to `>=20`.

### PWA
- Service Worker cache version bumped to `v1.2.0-r103`.

### CI
Added `.github/workflows/ci.yml`:
1. `npm ci`
2. static regression QA
3. TypeScript typecheck
4. production Vite build

Added `npm run check` as the local combined verification command.

### Regression guards
Static QA now prevents:
- automatic Notification permission requests from returning to `App.tsx`,
- reintroduction of `xlsx`,
- Vite falling below `5.4.21`,
- removal of CI,
- introduction of Excel workbook-reading APIs into the current write-only export model.

## Confirmed blockers / remaining work

### 1. Canonical database migrations are incomplete
Frontend usage vs bundled SQL migration coverage:
- 81 referenced tables/views
- 44 referenced tables/views not created by bundled migrations
- 15 referenced RPCs
- 12 referenced RPCs not created by bundled migrations

See `DATABASE_COVERAGE_AUDIT_RELEASE103.md`.

This does **not** mean those objects are missing from the live database. It means a clean Supabase project cannot currently be reconstructed from this repository alone.

### 2. Clean install/build not completed in this environment
- `npm ci` timed out due unavailable registry/network access.
- `npm audit` could not resolve the npm registry endpoint.
- Full `tsc --noEmit` cannot be claimed without installed local type packages.
- A syntax/transpile pass over all executable TypeScript/TSX files passed.

The new CI workflow is intended to run the complete install/typecheck/build in a normal GitHub environment.

### 3. Live Supabase role/RLS matrix still required
Before production sign-off, validate representative accounts for:
- admin
- Chef de Legion
- Finance
- Materials
- Secretary
- normal member/equipier

This requires access to the live/staging Supabase instance and real role assignments.

### 4. ExcelJS residual dependency risk
Current code does not use the advisory-sensitive read/note/image code paths, but the library itself remains old and should be replaced/upgraded in a separate regression-tested release.

## Production sign-off rule
Do not mark the project fully production-ready until:
1. the missing canonical database DDL/RLS/RPC migrations are reconstructed/exported,
2. CI completes `npm ci`, `typecheck`, and `build`,
3. live RLS/role matrix testing passes.
