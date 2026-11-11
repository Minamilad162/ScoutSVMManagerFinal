# Release 122 — AdminReservationsAll Route Fix

## Problem
The modern reservations management UI from Release 121 was implemented in `ReservationsAdmin.tsx`, but the navigation item `/app/AdminReservationsAll` still rendered the older `AdminReservationsAll.tsx`. This is why the Admin Reservation All screen continued to look unchanged.

## Fix
- `/app/AdminReservationsAll` now renders the same modern `ReservationsAdmin` dashboard used by `/app/reservation`.
- `AdminReservationsAll.tsx` is retained as a compatibility entry point and delegates to `ReservationsAdmin`, preventing future direct imports from restoring the legacy screen.
- The modern UI includes the Release 121 KPI cards, date/team/status/search filters, list/cards views, pagination, reservation detail panel, minute-accurate date/time display, storage location, return lifecycle status and links to the existing return workflow.
- The route remains Admin-only.
- No database schema or business logic changes were made.

## PWA
Service Worker cache version bumped to `v1.2.0-r122`.
