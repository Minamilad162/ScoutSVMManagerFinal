# Release 124 — Materials Admin UI/UX Redesign

## Scope
Redesigns the existing `/app/MaterialAdmin` page while preserving its current data model and CRUD behavior.

## Preserved functionality
- Load materials from `materials`.
- Add and edit material name, total quantity, storage location, and description.
- Activate/deactivate materials.
- Add and activate/deactivate storage locations.
- Add and activate/deactivate field zones.
- Existing role gate and RLS behavior remain unchanged.

## UI/UX changes
- New ScoutSVM equipment-management hero matching the latest approved visual direction.
- Four real-data KPI cards: total units, active material types, inactive material types, and active storage locations.
- Search, status filter, and storage-location filter.
- Main inventory table with row selection.
- Right-side selected-material detail card.
- Inventory alerts derived only from existing data: items without a storage location and inactive material types.
- Client-side pagination for long inventories.
- Existing add/edit form retained and reorganized beneath the inventory workspace.
- Storage Locations and Field Zones remain as dedicated tabs with the same existing actions.
- Responsive mobile/tablet layouts and restrained motion with `prefers-reduced-motion` support.

## Database
No SQL migration is required.
