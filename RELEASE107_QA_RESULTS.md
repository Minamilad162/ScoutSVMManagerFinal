# Release 107 — QA Results

## Passed
- Static QA: **PASS — 96 source files / 55 registered routes**
- TypeScript/TSX syntax/transpile: **PASS — 95 executable files**
- CSS parser: **PASS — 0 errors**
- Service Worker JavaScript syntax: **PASS**
- Service Worker cache version: **v1.2.0-r107**

## Regression checks
Release 106 -> Release 107 mutation call counts are unchanged:
- `.insert(`: **49 -> 49**
- `.update(`: **57 -> 57**
- `.upsert(`: **43 -> 43**
- `.delete(`: **28 -> 28**
- `.rpc(`: **21 -> 21**

This phase changes read context and application-shell state, not the number of application mutation paths.

## Seasonal context coverage
- Central Scout Year provider distinguishes:
  - physical current year,
  - Super Admin viewed year.
- Existing `useCurrentScoutYear()` consumers now read the central context.
- 37 season-aware member/role/term read locations use the historical query helper.
- Current-user authentication/permission reads remain on current-year security views by design.

## SQL17 static verification
Confirmed migration contains:
- Admin-only `v_members_context`
- Admin-only `v_user_roles_context`
- Admin-only `v_terms_context`
- `security_invoker = true`
- explicit `scout_year_id` columns for frontend filtering.

## Historical safety
Confirmed:
- non-current view state is session-scoped,
- Super Admin selector exists in the global header,
- historical banner and reset action exist,
- REST mutations are blocked by the application client in historical mode,
- known read-only RPCs are allowlisted.

## Production build environment note
A clean `npm ci` was attempted but timed out in this execution environment. Therefore a full local Vite production build and full `tsc --noEmit` dependency-based check are not claimed here.

The release retains the existing GitHub CI workflow, which is intended to run:
1. `npm ci`
2. static QA
3. TypeScript typecheck
4. production build

in a normal registry-connected environment.
