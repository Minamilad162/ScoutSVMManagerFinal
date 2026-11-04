# Release 106 — QA Results

## Passed
- Static QA: **PASS — 96 source files / 55 registered routes**
- TypeScript/TSX syntax/transpile: **PASS — 95 executable files**
- CSS parse: **PASS — 0 errors**
- Service Worker JavaScript syntax: **PASS**
- Service Worker version: `v1.2.0-r106`

## New regression guards
Static QA now checks that:
- SQL 16 exists.
- account-only rollover RPC exists.
- Auth email lookup RPC exists.
- unlinked Auth-account RPC exists.
- Scout Year UI calls the account-only rollover RPC.
- source roles cannot silently become target roles by default.
- Admin Members accepts a Scout Year from the URL/year selector.
- future/draft-year edits do not sync into current legacy state.

## Safety checks
- Source-year assignments and roles are not modified by the rollover RPC.
- Accounts not selected do not receive a target-year assignment.
- Selected accounts receive a blank target-year configuration (Team/Rank/Roles must be assigned explicitly).
- New target-year accounts that were not part of the source roster are preserved.

## Build environment note
A full clean Vite production build is not claimed in this workspace because local `node_modules` are not part of the release package. Static route/regression QA and TypeScript syntax/transpile checks passed.
