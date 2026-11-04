# Release 65 — Visual QA & Alignment Fixes

## Scope
This release continues the Apple-inspired glass UI work with a visual QA pass focused on alignment, density, readable controls, safer responsive behaviour, and final polish of shared UI surfaces.

## What changed
- Standardized page width and alignment for old and new page wrappers.
- Added safer `min-width: 0` behaviour to prevent card/grid/table overflow.
- Improved button and icon alignment in Arabic RTL labels.
- Prevented disabled buttons from moving on hover.
- Improved table readability, sticky headers, and first-column visibility on desktop scroll tables.
- Improved modal content scrolling, footer wrapping, and long-form usability.
- Improved media/audio/file display inside glass cards.
- Added route-specific fine tuning for Camp Program, evaluations, reports, and meeting pages.
- Refined desktop side drawer spacing and roundness while preserving mobile behaviour.
- Reduced topbar crowding on mobile by hiding the route chip on very small screens.
- Isolated generated PDF nodes from web UI animations/transitions.

## Safety
- No permission logic changed.
- No menu visibility logic changed.
- No Supabase queries changed.
- No database logic changed.
- No PDF generation logic changed.
- No evaluation or attendance calculations changed.
- No camp booking rules changed.

## Database
No SQL migration is required for this release.

## Recommended test checklist
1. Build the project with `npm run build`.
2. Check menu visibility with Admin and Chef accounts.
3. Check desktop side drawer open/close/hover behaviour.
4. Check mobile menu remains usable.
5. Open Camp Program and confirm table/action alignment.
6. Open Term Evaluations and confirm voice notes still record/play/delete based on role.
7. Open Final Evaluation and confirm filters/cards/stats are still functional.
8. Generate/download camp PDF and confirm PDF layout was not visually affected by the web glass layer.
