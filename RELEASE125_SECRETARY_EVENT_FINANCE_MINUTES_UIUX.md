# Release 125 — Secretary, Event Finance & Meeting Minutes UI/UX

## Scope
Redesigns the real application pages without changing their database contracts, route permissions, or CRUD logic:

- `/app/AdminSecretary` → `src/pages/AdminSecretary.tsx`
- `/app/financeEvent` → `src/pages/financeEvent.tsx`
- `/app/meeting-minutes` → `src/pages/MeetingMinutesList.tsx`

## AdminSecretary
The actual page is a member/secretary operations page rather than a document archive. The redesign therefore keeps and reorganizes its real data:

- Team and term selectors.
- Chef list with rank, current-year roles and phone.
- Equipier list with editable name, guardian name, guardian phone and birth date.
- Existing save/delete actions.
- Existing attendance counts for the selected term.
- New visual KPIs and attendance summary derived only from already loaded attendance data.

No new query or mutation was added.

## financeEvent
Keeps the existing finance-event workflow:

- Select an event.
- Create a new event.
- Edit/delete the selected event.
- Budget lines: add/edit/delete.
- Expenses: add/edit/delete.
- Existing budget / spent / remaining calculations.
- Existing XLSX export for one event or a whole year.

UX improvement: the existing `updateEvent()` function now has a clear **Save event changes** button in the UI. No new database operation was introduced.

## Meeting Minutes
Keeps the existing meeting-minute summary source and navigation:

- Current Scout Year range.
- Optional from/to filters.
- Title search.
- Attendance count.
- Task totals and states (pending, in progress, done, overdue).
- Open minute.
- Open related tasks.
- Create new minute.

The cards were reorganized into a denser operations table for faster scanning while retaining the same source rows and routes.

## Visual system
- ScoutSVM navy / blue / green / gold palette.
- Scout camp hero treatment matching Releases 119–124.
- Real KPI cards from existing page data.
- Consistent rounded panels, filters, tables and action treatments.
- Responsive behavior for tablet/mobile.
- `prefers-reduced-motion` respected.

## Database
No SQL migration required.

## PWA
Service Worker cache version: `v1.2.0-r125`.
