# Release 129 — TeamFinance mockup alignment

## Scope
Redesigned `/app/TeamFinance` to match the approved ScoutSVM finance visual direction while preserving all existing TeamFinance data and behavior.

## UI/UX changes
- Replaced the washed-out hero with a dark Scout-themed finance hero.
- Added four real-data KPI cards: operations count, term budget, total expenses, and remaining balance.
- Added a period summary with budget-consumption progress.
- Added a monthly expense chart derived only from the existing `expenses` rows.
- Added a delivery-status visualization derived from the existing `is_delivered` field.
- Reorganized team/term selection into a compact toolbar.
- Rebuilt the expenses table using the same rows and existing delete/delivery actions.
- Kept the existing add-expense workflow, term-date constraints, Excel export, role gates, and soft-delete behavior.
- Added responsive/mobile styling and reduced-motion support.

## Data / backend
No SQL migration. No Supabase query/mutation behavior was changed. No invented income data was added; the approved mockup was adapted to the actual TeamFinance data model.

## PWA
Service Worker cache version: `v1.2.0-r129`.
