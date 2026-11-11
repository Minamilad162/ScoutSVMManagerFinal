# ScoutSVM Release 135 — Reservations read-only / direct management split

Base: Release 134 archive; previous finance, secretary and Best Chefs changes retained.

## Scope & URLs

- `/app/AdminReservationsAll` (navigation: الحجوزات) now renders `ReservationsOverview`, a read-only *register* for both material and field reservations.
- `/app/reservation` (navigation: إدارة الحجوزات المباشرة) now renders `ReservationsDirectManage`, which supports editing existing reservations, cancelling and logical deletion, plus links to existing booking and return workflows.
- Both routes remain `adminOnly` (no unintended widening of access).
- `AdminReservationsAll.tsx` legacy import alias points to read-only overview, not former read-only/mixed component.

## Register

- Combined source: `material_reservations` and `field_reservations`; excludes logically deleted rows and supports overlapping bookings in the date range.
- Default filter: entire selected Scout Year from DB-defined start/end; admin can choose a day/range and a team. Material and field records are explicitly distinguished and display team, resource name, start/end date & time, quantity, and status.
- Material status uses `material_return_approvals` to distinguish fully returned, partly returned and overdue; completed field bookings are labeled `مكتمل`. Approved return timestamp appears as an extra completion detail.
- No create, edit, cancel or delete controls in register mode.

## Direct management

- Select team/type, date range, optional name search; edit team, resource/zone, quantity (materials), start and end; validation uses Egypt local time and selected Scout Year boundaries.
- Existing Postgres field-overlap constraint and material capacity checks remain authoritative; errors are surfaced rather than bypassed.
- Cancel and delete-from-register both use `soft_deleted_at` (no hard delete); action type is recorded separately in audit, and team notification is attempted.
- When moving a field booking to a different team, its `meeting_id` is cleared to avoid retaining an invalid association.
- Archived Scout Year views cannot write; editing approved-return material bookings cannot reduce quantity below returned amount.
- Bookings edited/deleted are reloaded from Supabase; no speculative local mutation or fake success on zero-row updates.

## Supporting files

- `src/pages/ReservationsWorkspace.tsx` — shared fetch/filter logic, distinct UI paths for viewer and manager.
- `src/pages/ReservationsOverview.tsx`, `src/pages/ReservationsDirectManage.tsx` — independent route entrypoints.
- `src/features/reservations/bookingApi.ts`, `bookingRecords.ts` — date-aware data read and pure validation/status logic.
- `src/pages/reservations-workspace.css` — responsive desktop/mobile RTL styling.
- `public/sw.js` cache version bumped to r135; corresponding QA guard updated.
- `tests/reservations-r135.test.mjs` — route, read-only controls, data sources, local Cairo DST, statuses, guards and mutation contract tests.

## Verification

- Static QA: pass (106 TS/TSX files, 55 routes).
- Regression tests: Scout Year 4/4, budget 5/5, secretary 7/7, best chefs 7/7, reservations 8/8 — **31/31 passed**.
- TypeScript AST parser: 106 TS/TSX files without syntax diagnostics.
- Full TypeScript typecheck / Vite build / browser E2E: **not verified**. `npm ci --offline` cannot install `zip-stream@4.1.1` (cache miss). A complete package install and CI build are still required in a connected environment.
- No production DB queries, migrations or writes were run; no GitHub push or deployment occurred.

## Manual smoke test after build

1. Log in as admin, select 2026/2027. Open `/app/AdminReservationsAll`; ensure both أدوات and أرض show within the chosen range and team filter, with no write actions.
2. Open `/app/reservation`; edit a test material booking (quantity/time), save and reload. Then edit a field booking with an available zone. Verify server overlap rejection if two field bookings conflict.
3. Cancel a test booking and delete another from the list. Both should disappear from active view while their `soft_deleted_at` and audit rows remain in DB; validate team notifications.
4. Switch to an archived year and ensure historical data loads while manager actions are disabled. Return to current Scout Year before any further writes.
5. Check April Cairo DST transition dates, mobile layout, and material return states against actual DB records.

**Note:** Two user-facing actions, Cancel and Delete, currently share the project's established logical-deletion mechanism. They differ in audit intent only. A separate persisted cancellation state would require a DB schema/workflow change and should not be introduced without reviewing existing historical rows and policies.
