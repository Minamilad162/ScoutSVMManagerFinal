# Release 59 — Glass UI Foundation

## Scope

This release applies the first global visual upgrade for the Scout SVM application using an Apple-inspired glassmorphism direction.

## What changed

- Added a premium global background with soft navy/sky/gold gradients.
- Upgraded the application topbar to a frosted glass header.
- Upgraded the sidebar drawer with smoother motion, blur, shadow, active-state glow, and icons.
- Converted the shared `.card`, `.card-soft`, `.btn`, `.toolbar`, `.chip`, and detail surfaces into reusable glass UI elements.
- Improved focus states for inputs/selects/textareas with softer gold-accent rings.
- Improved common modals, toast notifications, page loader, page hero, section cards, alerts, metric cards, and empty states.
- Preserved existing data logic, permissions, Supabase queries, evaluation rules, camp booking checks, PDF export logic, and database structure.

## Files changed

- `src/index.css`
- `src/components/SideNav.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/Toaster.tsx`
- `src/components/ui/PageLoader.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/PageHero.tsx`
- `src/components/ui/SectionCard.tsx`
- `src/components/ui/LoadingButton.tsx`
- `src/components/ui/AppErrorBoundary.tsx`
- `src/components/ui/InlineAlert.tsx`
- `src/components/ui/MetricCard.tsx`

## Database

No SQL changes required.

## Notes

This is Phase 1 of the UI refresh. It is intentionally focused on the design foundation and reusable shell components only. Page-specific redesigns should follow in later releases.
