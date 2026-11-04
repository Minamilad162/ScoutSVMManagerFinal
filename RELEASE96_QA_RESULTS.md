# ScoutSVM Release 96 — QA Results

## PASS
- Static regression suite: PASS.
- 94 TypeScript/TSX source files parsed successfully (syntax-level parse).
- 55 registered routes scanned.
- Sensitive admin routes verified to use `RouteAccessGuard`.
- Finance global navigation scope verified.
- Materials + Chef same-team guard verified for field administration.
- Home finance quick action role gate verified.
- Atomic Scout Year RPC reference verified in frontend.
- SQL15 contains transaction serialization and single-current-year invariant.
- Service worker JavaScript syntax: PASS.
- Service worker cache version/update strategy checks: PASS.
- All six optimized Knowledge Bank WebP files passed image integrity verification.
- Knowledge Bank runtime artwork total: ~491 KB (< 1 MB target).
- Public asset reference scan: PASS.
- Existing Release 95 RLS regression checks: PASS.
- Secret scan: only `.env.example` remains at project root; no production/local env file bundled.

## Production build status
`npm run build` could not execute in this isolated workspace because `node_modules` is not installed (`vite: not found`). This is an environment/dependency availability limitation, not a reported TypeScript syntax failure.

Required release gate in a normal dev/CI environment:
1. `npm ci`
2. `npm run typecheck`
3. `npm run qa:static`
4. `npm run build`

## Live Supabase verification still required
After SQL14 + SQL15 are applied to staging/live, verify:
- Admin can atomically switch current Scout Year.
- Two simultaneous activation attempts still result in exactly one current year.
- Non-admin cannot call `set_current_scout_year_atomic`.
- Global finance/admin pages are inaccessible to team-only finance accounts.
- Admin pages reject direct URL access for normal authenticated accounts.
- Field admin page rejects materials/Chef roles when they belong to different teams.

## Remaining major work after Release 96
1. Canonical migration coverage for the database objects/RPCs missing from the bundled migration chain.
2. Move push-notification permission behind an explicit user action.
3. Add real CI with clean dependency install, full typecheck/build and browser E2E role tests.
4. Live RLS role-matrix tests against disposable/staging Supabase.
