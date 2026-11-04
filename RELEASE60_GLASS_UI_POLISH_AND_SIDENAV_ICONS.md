# Release 60 — Glass UI Polish & SideNav Icons

## Scope
This release continues the Apple-inspired glass UI upgrade started in Release 59, while preserving all existing navigation permission logic and route visibility rules.

## Changes

### Side navigation
- Replaced fallback/emoji-only navigation markers with consistent inline SVG icons for all known menu items.
- Added icons for dashboard, profile, members, attendance, finance, materials, reservations, evaluations, scout year, audit log, secretary, events, meeting minutes, tasks, installments, camp program, reports, notifications, curriculum, gallery, storage, and logout.
- Kept the existing item construction and role/permission checks unchanged.
- Added a desktop hover rail on the right edge so the side menu can slide in smoothly without requiring a click.
- Kept the burger button and mobile drawer behavior for mobile usability.
- Added a clearer close action inside the drawer.

### Premium glass polish
- Added a second global glass-polish layer for common page surfaces.
- Improved tables, toolbars, filters, badges, inputs, selects, checkboxes, scrollbars, cards, modals, and login surfaces.
- Added smoother hover/focus states and softer shadows.
- Improved dense grid/card screens without changing the underlying data or actions.

## Guardrails
- No database tables or SQL changed.
- No Supabase queries changed.
- No role checks changed.
- No route permissions changed.
- PDF export styling was not intentionally changed.

## Test notes
Run locally:

```powershell
npm install
npm run build
```

Then review:
- Sidebar menu for Admin and non-Admin accounts.
- Mobile drawer.
- Camp Program.
- Final Evaluation.
- Term Evaluation + Voice Notes.
- Materials and reservations screens.
