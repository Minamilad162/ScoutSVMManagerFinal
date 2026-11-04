# Release 90 — Home Scout Theme Items

## Scope
This release updates the existing Home page only. It does not create a new page and does not change the current Home data queries, roles, routes, permissions, Supabase logic, Best Chefs logic, or notification logic.

## Visual direction
The Home page now uses the SVM scout neckerchief palette as its visual system:
- Deep navy
- Warm orange
- Pale yellow / gold
- Warm off-white supporting surfaces

## New reusable visual assets
Optimized transparent WebP assets were added under `src/assets/scout-theme/`:
- `scout-mascot-welcome.webp`
- `scout-compass-scarf.webp`
- `scout-clipboard.webp`
- `scout-backpack.webp`
- `scout-campfire.webp`
- `scout-scarf-knot.webp`

These were converted from the approved generated PNG resources to smaller WebP assets with transparency to reduce Home page payload.

## Home page changes
- Preserved the approved SVM 2027 hero/banner image and layout.
- Added a subtle neckerchief-color stripe to the Home hero/banner edge.
- Redesigned the existing welcome panel using the scarf palette.
- Added the approved navy-uniform scout mascot as a decorative Home item.
- Added a low-opacity scout compass/scarf decoration without blocking content.
- Re-themed Home action buttons to navy/orange/gold.
- Added new Home-only MetricCard accents: `navy`, `orange`, `gold`.
- Restyled existing quick-action cards using the neckerchief palette.
- Added contextual decorative items to existing sections only:
  - Clipboard for admin shortcuts.
  - Backpack for user shortcuts.
  - Scarf knot for Best Chefs spotlight.
  - Campfire for alert/tips areas.
- Added responsive rules so decorative assets become subtle or hidden on smaller screens.

## Shared component changes
### `MetricCard`
Added three optional accent values only. Existing accent values and behavior remain unchanged.

### `SectionCard`
Added an optional `className` prop so Home can apply page-specific visual styling without affecting existing pages.

### `BestChefCard`
Added a stable `best-chef-card` CSS class to allow Home-scoped styling. Existing behavior and layout remain unchanged outside Home.

## Validation
- TypeScript/TSX syntax validation completed for all modified TS/TSX files using the TypeScript compiler API.
- CSS parsed successfully with `tinycss2` with zero stylesheet parse errors.
- All six new asset imports were verified to exist locally.
- Full `npm ci` / Vite build could not complete in this environment because package downloads from the npm registry timed out and the required cache is incomplete. No build result is being claimed.

## Regression boundary
No database SQL, Supabase schema, RLS, authentication, permissions, navigation destinations, or data calculation logic was changed in this release.
