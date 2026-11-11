# Release 120 — Reservations Storage Fix + Materials Return Workflow

## Fixed runtime error
The Admin Reservations page was still selecting the removed legacy column `materials.storage`. The live materials model uses `storage_location_id` and the `storage_locations` relation.

The page now:
- reads `storage_location_id` + `storage_locations(name)`;
- excludes soft-deleted/cancelled material reservations;
- defaults to **All teams** instead of forcing the first team;
- shows the count of teams actually visible in the selected filter;
- uses local-day ISO boundaries for the daily intersection query.

## Return / hand-back workflow redesign
The existing `material_return_approvals` workflow was kept as the source of truth and redesigned instead of creating a parallel system.

The new page includes:
- scout-themed hero and responsive layout;
- KPI cards for due reservations, full returns, partial returns, overdue items, and currently-active booking periods;
- term/date/team filters;
- Cairo-time display and Cairo day-boundary filtering;
- lifecycle status badges: Upcoming, Booking period active, Overdue, Partial return, Returned;
- full start/end date + minute display;
- reserved / returned / remaining quantities;
- inline full or partial return approval;
- ability to edit or revoke a return approval;
- existing overdue notification RPC preserved;
- clear note distinguishing time-derived booking status from persisted return approval.

## Navigation
`تسليم العهدة` was renamed to `استلام واسترجاع الأدوات` for clearer wording.

## Database
No new SQL migration is required. Existing tables/RPCs are reused.

## PWA
Service Worker cache version: `v1.2.0-r120`.
