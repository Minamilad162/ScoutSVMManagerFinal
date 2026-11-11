# Release 119 — Materials Booking + Inventory Redesign

## Scope
Redesigned the two materials workflows while preserving the existing Supabase business logic:

- `MaterialsTeamReservations.tsx` — tool/equipment booking
- `MaterialsAdmin.tsx` — materials, storage locations and field-zone administration

## Booking UX
- New scout-themed hero and compact KPI strip.
- Searchable visual equipment catalog with lightweight category filtering derived from existing material names only; no new database fields were introduced.
- Booking summary panel keeps the selected tool, team, term, quantity and date/time range together.
- Booking uses explicit `datetime-local` **From** and **To** inputs with `step=60`, so the user chooses day + hour + minute on both ends.
- Existing term start/end boundaries remain enforced.
- Existing term meeting dates remain available as optional quick-date shortcuts.
- Existing `material_available_qty` RPC still calculates availability for the exact selected range.
- Frontend now warns before save when the requested quantity is higher than the calculated available quantity; the database overlap trigger remains the final source of truth.
- Reservation history now displays date + time, important for ranges that span different days.
- All-team reservations remain available in an expandable section.
- Cancellation remains soft-delete based.

## Admin UX
- New hero and inventory KPI summary.
- Tabs separate:
  - Materials
  - Storage locations
  - Field zones
- Search and active/inactive filtering for materials.
- Add/edit form is visually separated from the inventory list.
- Existing CRUD calls and permission checks remain unchanged.
- Responsive cards and mobile layouts added.

## Motion / Accessibility
- Subtle hover lift, selected-card pulse and scout-hero float animation.
- Full `prefers-reduced-motion` fallback.
- No animation changes data or workflow state.

## Database
No SQL migration is required.

The database already supports minute-level reservation precision:
- `starts_at` / `ends_at` are `timestamptz`.
- normalization trigger truncates reservations to minute precision.
- overlap trigger checks intersecting ranges at minute precision and blocks overbooking.

## PWA
Service Worker cache bumped to `v1.2.0-r119`.
