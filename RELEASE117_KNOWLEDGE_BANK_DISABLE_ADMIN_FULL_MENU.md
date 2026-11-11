# Release 117 — Disable Knowledge Bank + Full Admin Navigation

## Requested changes

1. Remove **Knowledge Bank** from the product navigation and prevent users from opening it.
2. Fix the Admin navigation so an Admin account sees the full operational menu, not only administration shortcuts.

## Knowledge Bank

The Knowledge Bank implementation files are intentionally retained as dormant source code, but there is no active product entry point:

- Removed from desktop/sidebar navigation.
- Removed from the mobile bottom navigation.
- Removed from Home shortcuts for Admin and normal users.
- Removed the lazy page import from `App.tsx`.
- Direct access to `/app/knowledge-bank` now redirects to `/app`.

This means no user, including Admin, can open the Knowledge Bank through the live application.

## Admin full navigation

The previous navigation used an `if (isAdmin) ... else ...` structure. As a result, Admin received the administration list but skipped operational/team items that were added only in the `else` branch.

Release 117 explicitly adds the operational menu to Admin as well, including:

- Team evaluations
- Team cases
- Team statistics
- Team attendance
- Field reservations
- Team finance
- Materials reservations
- Team secretary
- Secretary attendance
- Reports Center
- Camp collections

Admin still receives all existing administration pages and the common items such as Home, Profile, Evaluation, Storage and Notifications.

## Database / permissions

No database schema, RLS policy, role assignment, or mutation logic was changed.

## PWA

Service Worker cache version: `v1.2.0-r117`.
