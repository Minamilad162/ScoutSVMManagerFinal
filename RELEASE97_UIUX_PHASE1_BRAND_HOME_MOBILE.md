# Release 97 — UI/UX Phase 1: Brand, Home, Mobile Shell

## Scope
Visual/UI-only implementation based on the approved ScoutSVM concept and the provided UI reference guide. Existing routes, Supabase queries, permissions, role logic, and workflows are preserved.

## Implemented
- Added the official Scouts & Guides Saint Vincent Miami logo to the app shell and navigation.
- Replaced the Home hero artwork with the provided real SVM group photo.
- Added the approved hero message: **معًا أفضل — Better Together**.
- Derived the new UI palette from the provided logo and neckerchief: deep navy, royal blue, orange, warm yellow/gold, cream and white.
- Reworked Home surfaces, KPI cards, quick actions and buttons into a cleaner, lower-noise visual hierarchy.
- Restyled the side drawer to a premium dark navy navigation with orange active state.
- Added a lightweight mobile bottom navigation for universally available pages: Home, Knowledge Bank, Notifications, Profile and More.
- Created responsive desktop/mobile hero assets in WebP.
- Added the supplied UI reference guide to the project root as `UI_COMPONENT_REFERENCE_GUIDE.md`.
- Preserved reduced-motion behavior and avoided new UI/runtime dependencies.

## Not changed
- No Supabase query changes.
- No permissions/RLS changes.
- No route changes.
- No workflow/state-machine changes.
- No database migration in this release.

## Next proposed visual phase
Apply the same approved system to: Members & Roles → Finance/Reports → Camp Program → Knowledge Bank, reviewing each page before moving to the next.
