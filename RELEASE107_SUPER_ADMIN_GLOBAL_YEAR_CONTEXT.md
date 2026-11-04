# Release 107 — Super Admin Global Scout Year Context

## Goal
Implement the second phase of Scout Year management:

- normal users always see the database year marked `is_current = true`,
- Super Admin (`admin`) can switch the entire application into another Scout Year from the global header,
- changing the viewed year does **not** change the real current year for any other user,
- historical/non-current year mode is read-only from the application UI,
- current-year authentication and permission resolution stay unchanged.

## Global Year Selector
The application header now shows a Scout Year selector only for Super Admin.

Behavior:
- Current year is the default.
- Selecting another year changes the application **view context** only for that browser session.
- The selected year is stored in `sessionStorage`, not as the database current year.
- A prominent banner shows:
  - the year being viewed,
  - the physical/current Scout Year used by all normal users,
  - a one-click **Return to current year** action.
- The routed page is remounted when the viewed year changes so page-level data loaders refresh immediately.

## Security-year vs View-year separation
Two concepts are now intentionally separate:

### Security Year
Authentication, current user roles, current team context and navigation permissions remain tied to the real current Scout Year.

This prevents an old-year view from changing the Super Admin's present-day permissions or navigation.

### View Year
Operational data can use the Super Admin-selected Scout Year for historical browsing.

## Historical seasonal reads
Added SQL migration:

`supabase/17_super_admin_historical_year_context.sql`

It creates Admin-only, season-aware read views:
- `v_members_context`
- `v_user_roles_context`
- `v_terms_context`

The frontend switches to these views only when a non-current year is selected. During normal current-year operation it continues using the existing current-year views.

The historical views are:
- `security_invoker = true`,
- limited by `public.has_role('admin')`,
- filtered by exact `scout_year_id` from the frontend query layer.

## Read-only historical mode
While a non-current year is selected:
- direct PostgREST table mutations are blocked by the application client,
- known read-only RPCs remain available,
- mutation RPCs are blocked,
- a user must return to the current year before adding, editing or deleting operational data.

This is an application safety guard; database RLS remains the authoritative security boundary.

## Data coverage updated
Historical Scout Year context was wired into the seasonal read paths used by:
- Home/member context
- Attendance
- Admin Attendance
- Legion Attendance
- Secretary attendance and member lists
- Team Statistics / Team Cases
- Evaluations / Legion Evaluations / Admin Evaluations
- Chef evaluation overview
- Camp Program
- Camp installment forms/details/collections
- Terms-driven Finance pages
- Reservations and material return approval term selection
- Reports and Best Chefs through shared reference APIs
- Member 360 profile seasonal data
- Year Responsibilities
- Knowledge Bank seasonal member/term reads
- Admin Events by Scout Year date range
- Group Finance Events by Scout Year date range
- Meeting/notification/audit/report pages already using the central current-year hook now inherit the selected year automatically.

## Intentionally kept on the physical current year
The following are deliberately **not** switched to historical role/member context:
- `AuthProvider` user role resolution
- `SideNav` permission/navigation resolution
- current-user identity helpers used for authorization

This ensures historical viewing never changes current access control.

## Admin maintenance pages
- `AdminScoutYears` always uses the physical current Scout Year for activation/rollover management.
- `AdminMembers` still supports its own explicit `?year=<id>` management flow for preparing Draft/Future years.
- Its `isSelectedCurrentYear` check now compares against the physical current year, not the historical view context.

## PWA
Service Worker cache version bumped to:

`v1.2.0-r107`

## Required database step
Before using the global historical selector, run:

`supabase/17_super_admin_historical_year_context.sql`

Current-year operation remains on the existing current views. If SQL17 is not installed, historical mode will fail safely because the historical views do not exist.
