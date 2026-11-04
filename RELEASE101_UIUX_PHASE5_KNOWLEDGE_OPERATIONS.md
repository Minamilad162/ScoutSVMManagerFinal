# Release 101 — UI/UX Phase 5: Knowledge Bank + Operational Workspaces

## Scope
Visual/UI continuation of the approved ScoutSVM design system. This phase intentionally avoids business-logic, permission, database, and workflow changes.

## Knowledge Bank
- Unified the page with the approved ScoutSVM palette: navy, royal blue, orange, warm yellow/gold, cream and white.
- Reworked chat header, input area, suggestion chips, answer cards and side panels.
- Replaced generic robot emoji avatars with the existing Scout emblem asset.
- Kept the existing Scout boy and camp setting.
- On mobile, reduced the character animation to the entrance animation only; continuous movement is not required.
- Improved mobile spacing around the chat composer and bottom navigation.

## Operational workspace consistency layer
Applied a shared route-scoped visual layer to the remaining operational areas, including:
- Attendance / admin attendance / legion attendance.
- Evaluations and evaluation administration.
- Materials, inventory and reservations.
- Field reservations and daily reservation administration.
- Meeting minutes and meeting tasks.
- Team Secretary screens and secretary attendance.
- Team cases and team statistics.
- Notifications.
- Selected admin operational screens such as terms/meetings, scout years, year responsibilities, audit and events.

### Shared changes
- Branded navy page heroes with orange/gold accents.
- Cleaner white SectionCard surfaces with the neckerchief three-color stripe.
- More consistent KPI card geometry and shadows.
- Unified form controls/focus states.
- Clearer table headers and row scanning.
- Mobile horizontal table scrolling where needed, with sticky first column for context.
- Larger mobile inputs and reduced density.
- Semantic status colors were preserved; the design layer does not redefine business status meaning.

## Preserved
- Existing routes and RouteAccessGuard behavior.
- Existing role and permission checks.
- Existing Supabase/RPC calls.
- Existing attendance/evaluation/notification logic.
- Existing reservation conflict logic.
- Existing meeting/task state logic.
- Knowledge Bank answering logic and guardrails.
- No new runtime dependency.
- No SQL migration.
