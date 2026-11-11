# Release 118 — Permanent Admin + Full Management Menu

## Problem
The application menu was built from `v_user_roles_current` only. When the permanent Super Admin did not have a seasonal `admin` row in the current-year role view, the UI stopped recognizing the account as Admin. This hid management pages such as Scout Years, Terms & Meetings, Budget, Members & Roles, Responsibilities, Audit Log, etc.

## Fix
- `fetchCurrentUserRoles()` still reads the seasonal role view first.
- If no seasonal `admin` role is returned, it now checks the canonical database permission using `public.has_role('admin')`.
- When that permanent permission is true, an Admin role is injected into the in-memory auth context.
- This makes both:
  - `SideNav`
  - `RouteAccessGuard`
  recognize the same permanent Super Admin permission used by RLS.
- Added two accessible management routes that were not listed in the admin menu:
  - direct reservations
  - materials
- Knowledge Bank remains hidden and direct access remains disabled.

## Important
No database schema or RLS change is required. The release reuses the existing `has_role('admin')` RPC already used by database policies.

## PWA
Service Worker cache: `v1.2.0-r118`.
