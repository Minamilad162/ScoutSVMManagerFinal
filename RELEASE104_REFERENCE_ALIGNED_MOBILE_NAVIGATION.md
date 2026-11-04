# Release 104 — Reference-Aligned White Mobile Navigation

## Why this release exists
Release 97–103 adopted the ScoutSVM brand identity, but the mobile navigation still did not match the supplied premium mobile UI reference closely enough.

This release corrects that direction.

## Reference adopted
From `UI_COMPONENT_REFERENCE_GUIDE.md` Section 30 — Workspace Booking premium mobile visual reference:
- light surfaces,
- rounded cards and soft shadows,
- fixed four-item mobile bottom navigation,
- safe-area padding,
- large touch targets,
- RTL/mobile accessibility,
- preserve real data, routes and permissions.

## Implemented

### Mobile navigation
- Changed the mobile bottom navigation from 5 items to **4 fixed items**:
  1. Home
  2. Knowledge Bank
  3. Notifications
  4. More
- Removed the mobile hamburger trigger.
- `More` now opens the full application menu **from the bottom**, not from the side.
- The mobile menu is now a **white bottom sheet** with:
  - top grab handle,
  - rounded top corners,
  - dimmed backdrop,
  - safe-area padding,
  - two-column touch-friendly menu cards,
  - sticky close/header area,
  - sticky sign-out footer.
- Existing permission-filtered SideNav content is reused; no routes or access rules were duplicated.

### Menu / navigation colors
- Changed the menu background from dark navy to **white**.
- Navigation text is navy/dark slate.
- Active item uses the ScoutSVM neckerchief orange/warm-yellow palette.
- Icons use light neutral surfaces with orange active treatment.
- Profile card and year badge are light-surface cards.

### App surfaces
- Page heroes and shared section cards were made lighter and quieter:
  - white surface,
  - restrained border,
  - soft shadow,
  - warm orange/yellow accents.
- This makes the application closer to the supplied mobile reference instead of relying on a dark enterprise shell.

## Preserved
- All routes.
- All role and permission logic.
- All Supabase queries and RPCs.
- All workflows and calculations.
- All notification behavior.
- SideNav still generates its menu from the same permission-aware data.
- No new dependency.
- No database migration.

## PWA
Service Worker cache version bumped to `v1.2.0-r104` so users receive the corrected navigation styling after deployment.
