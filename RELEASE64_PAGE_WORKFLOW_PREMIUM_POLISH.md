# Release 64 — Page Workflow Premium Polish

## Scope
This release continues the Glassy Apple-inspired UI direction after Release 63. It focuses on page-by-page workflow density, forms, tables, action areas, evaluation cards, camp-program screens, finance/materials surfaces, reports/minutes, and the shared PageHero / SectionCard / MetricCard components.

## Safety rule
No permission logic, Supabase query, RLS/database logic, calculation logic, PDF generation logic, or camp booking rule was changed.

## Changes

### Shared components
- Added stable styling hooks to `PageHero`:
  - `page-hero-layout`
  - `page-hero-copy`
  - `page-hero-eyebrow`
  - `page-hero-eyebrow-dot`
  - `page-hero-title-row`
  - `page-hero-description`
  - `page-hero-actions`
- Added stable styling hooks to `SectionCard`:
  - `section-card-header`
  - `section-card-heading`
  - `section-card-title`
  - `section-card-description`
  - `section-card-actions`
  - `section-card-content`
- Added stable styling hooks to `MetricCard`:
  - `metric-card-topline`
  - `metric-card-value`
  - `metric-card-hint`

### Premium UI polish
- Enhanced PageHero hierarchy and action area spacing.
- Improved SectionCard header separation with a soft gold/sky hairline.
- Added extra glass layering to metric cards.
- Improved file inputs and multiple selects.
- Improved table wrappers, sticky table headers, footer styling, and first-column hierarchy.
- Standardized danger/success/warning action gradients while preserving all click handlers.
- Added route-targeted polish for:
  - Admin Dashboard
  - Team Statistics
  - Chefs Evaluation Overview
  - Camp Program
  - Camp Installments
  - Reports Center
  - Meeting Minutes / Tasks
  - Materials / Storage
  - Finance screens
  - Evaluation screens
- Improved Voice Notes visual depth without changing recording, saving, or playback logic.
- Improved mobile action zones and full-width action buttons in hero/section headers.

## Files changed
- `src/index.css`
- `src/components/ui/PageHero.tsx`
- `src/components/ui/SectionCard.tsx`
- `src/components/ui/MetricCard.tsx`

## Database
No new SQL is required for this release.

## Suggested smoke test
1. Open with Admin account and confirm the menu still shows admin-only pages.
2. Open with Chef account and confirm the menu still shows only role-allowed pages.
3. Test:
   - Camp Program
   - Term Evaluations + Voice Notes
   - Final Evaluation
   - Materials
   - Finance
   - Reports Center
   - Meeting Minutes
4. Confirm PDFs still generate with their own layout and are not affected by glass styles.
5. Test mobile layout for menu, modals, filters, and action buttons.

## Remaining UI roadmap after Release 64
1. Release 65 — Visual QA from live screenshots and small alignment fixes.
2. Release 66 — Final production cleanup, documentation, and handover package.
