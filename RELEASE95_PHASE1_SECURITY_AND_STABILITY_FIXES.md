# ScoutSVM Release 95 — Phase 1 Security & Stability Fixes

Baseline: Release 94

## Fixed in this release

### Critical / security
- Hardened the six legacy RLS policies that used unrestricted `WITH CHECK (true)`.
- Corrected `evaluation_answers` authorization so writes are limited to Admin or Chef de Legion for the parent evaluation team.
- Tightened evaluation reads to Admin, Ancien, Chef de Legion for own team, or the evaluated member.
- Repaired the legacy `user_roles` schema model so global roles can use `team_id IS NULL` without conflicting with a composite primary key.
- Added a stable `id` primary key to the clean-install `user_roles` definition and partial unique indexes for global/team-scoped assignments.
- Fixed the `user_roles read self` RLS expression (`ur.user_id` -> `user_id`).
- Hardened `has_role()` and `user_team_id()` as `SECURITY DEFINER` helpers with a fixed `search_path` to avoid RLS self-recursion.
- Enforced Chef de Legion / Team Secretary roles for meeting writes.
- Enforced role-aware attendance writes; team secretary writes are limited to Equipiers on meeting days, while Chef de Legion can manage team attendance.
- Aligned Expense RLS with the current UI: Chef de Legion and Responsable Finance can modify expenses for their own team.

### Functional stability
- Fixed `AdminSecretary.tsx` using an undefined `teamName` variable.
- Fixed SideNav link `/app/AdminEvaluation` -> `/app/AdminEvaluations`.
- Fixed Reports Center back button `/app/TeamDashboard` -> `/app/TeamStatistics`.
- Fixed the page title map for `/app/AdminEvaluations`.
- Removed the unsafe direct-delete fallback for scout years when `admin_delete_scout_year` RPC is missing; the UI now fails safely with a setup message instead of risking incomplete cleanup.

### Repository / secret hygiene
- Removed `.env.local` and `.env.production` from the distributable project package.
- Added `.env.example` containing only safe placeholders.
- `ADMIN_BULK_TOKEN` is not included in Release 95.
- If the previously packaged `ADMIN_BULK_TOKEN` contained a real secret, rotate it before further deployment.

### Regression testing added
- Added `npm run qa:static`.
- Added `npm test` as a static regression gate.
- Added `npm run typecheck` for environments with a complete dependency install.
- Static QA scans registered routes, exact `/app/...` links, public asset references, key RLS regressions, and critical Release 95 migration presence.

## Database action required
Run the following migration on the current Supabase database **before treating the security fixes as live**:

`supabase/14_security_hardening_phase1.sql`

The frontend ZIP containing this file does not change the live database automatically.

## Verification completed in this workspace
- `npm run qa:static`: PASS
- Static route scan: PASS (0 missing exact route targets)
- Relative import scan: PASS (0 missing relative imports)
- TypeScript syntax/transpile scan: PASS (92 `.ts/.tsx` files; declaration file excluded)
- Full `tsc --noEmit`: not completed because the cached `node_modules` set in this environment is incomplete and missing type packages.
- Full Vite production build: not claimed for the same dependency-install limitation.

## Still open after Phase 1
1. Complete migration coverage for the newer seasonal tables/views/RPCs is still missing from the repository.
2. Add role-level route guards in React as defense-in-depth (RLS remains the primary security boundary).
3. Make Scout Year activation atomic through one database RPC/transaction.
4. Fix PWA cache versioning / stale asset strategy.
5. Optimize Knowledge Bank image payload.
6. Move push-notification permission behind a user action.
7. Add real unit/integration/E2E tests and a CI build gate.
