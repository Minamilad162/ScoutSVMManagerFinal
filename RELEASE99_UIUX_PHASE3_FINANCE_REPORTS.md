# Release 99 — UI/UX Phase 3: Finance + Reports

## Scope
Visual/UI-only continuation of the approved ScoutSVM design system from Releases 97–98.

## Pages refined
- `Finance.tsx`
- `AdminFinance.tsx`
- `TeamFinance.tsx`
- `ReportsCenter.tsx`

## Implemented
- Unified Finance and Reports with the approved ScoutSVM identity: deep navy, royal blue, orange, warm yellow/gold, cream/white surfaces.
- Restyled page heroes, filters, forms, KPI cards, report sections and tables.
- Added a lightweight budget-usage progress visualization on the Finance page using the existing `pct` value.
- Improved table density and readability.
- Improved mobile tables using horizontal scrolling and a sticky first column.
- Improved Finance mobile forms and report action layout.
- Refined Camp collection summary cards inside Reports Center.
- Removed the duplicated expense-date rendering in `TeamFinance.tsx` (visual duplicate only).

## Preserved
- Existing Supabase queries.
- Existing permission checks and role gates.
- Existing calculations and business logic.
- Existing Excel export behavior.
- Existing routes/navigation.
- Existing database schema and RLS.
- No new runtime dependencies.
- No database migration.

## Next proposed visual phase
Camp Program / camp workflows, followed by Knowledge Bank and remaining operational pages.
