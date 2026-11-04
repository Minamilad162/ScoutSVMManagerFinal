# Release 91 — Home Mobile Mascot Visibility Fix

## Scope
This release fixes the scout mascot visibility on the existing Home page in mobile view only. No new page, data query, route, role, permission, Supabase logic, or calculation was changed.

## Issue
Release 90 intentionally reduced the mascot on smaller screens and fully hid it below 520px. As a result, the approved scout boy was not visible on normal mobile phones.

## Fix
- Removed the mobile `display: none` behavior for the Home scout mascot.
- Restored near-full opacity on mobile instead of the previous very faint `0.18` opacity.
- Repositioned the mascot inside the lower edge of the welcome panel so the face/body remain visible without covering the main text.
- Added extra bottom space to the mobile welcome panel to reserve room for the mascot instead of overlapping actions/content.
- Added a narrower-phone rule (`<=390px`) that reduces mascot size slightly while keeping it visible.
- Kept the compass decoration hidden on mobile to avoid visual crowding.

## Mobile behavior
- `<=760px`: mascot visible at 112px, near-full opacity.
- `<=520px`: mascot visible at 96px.
- `<=390px`: mascot visible at 86px.

## Regression boundary
No changes were made to Home data loading, navigation destinations, permissions, authentication, database, RLS, Supabase, Best Chefs, alerts, or notification behavior.
