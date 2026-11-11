# Release 121 — Reservations Management UI/UX Redesign

## Scope
Redesigns the Admin Reservations page to match the visual language introduced for Materials Booking and Materials Administration while preserving the existing reservation, overlap, RLS, and return-approval logic.

## What changed
- New scout-themed reservations hero and primary actions.
- KPI cards for selected period, currently active, partial returns, overdue, and fully returned reservations.
- Search by material, team, storage location, or reservation id.
- Team, status, and date-range filters with quick Today action.
- List/Card view switch.
- Paginated results for large reservation sets.
- Selectable reservation rows/cards with a dedicated details panel.
- Details panel shows team, quantity, storage location, exact start/end time, duration, overlapping field zones, booking timeline, and return summary.
- Return actions reuse the existing `MaterialsReturnApprove` workflow rather than duplicating business logic.

## Compatibility fixes included
- Materials storage is resolved through `storage_location_id -> storage_locations(name)`.
- Field reservation names are resolved through `field_zone_id -> field_zones(name)`.
- The page no longer depends on legacy/nonexistent `materials.storage` or `field_reservations.zone_name` columns.

## Database
No SQL migration is required. Release 121 adds one read-only query to `material_return_approvals` so reservation status can reflect the actual return workflow. No new inserts, updates, deletes, or upserts were added.

## PWA
Service Worker cache version: `v1.2.0-r121`.
