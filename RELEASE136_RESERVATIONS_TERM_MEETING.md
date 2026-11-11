# ScoutSVM Release 136 — Reservations: Scout Year → Term → Meeting

## Screens
- `/app/AdminReservationsAll` — read-only shared reservations register.
- `/app/reservation` — direct booking management, preserving privileged edit/cancel/soft-delete actions.

Both screens now use an **existing term and its registered meeting dates** instead of manual `From date` / `To date` register filters. Available terms are queried with the selected `scout_year_id`; meetings come from `term_meeting_dates.term_id` and are constrained to the intersection of the term and Scout Year boundaries. The current meeting is selected when available, otherwise the nearest upcoming date, then the latest previous date. The "whole term" option supports viewing all bookings in that term, including records made before the meeting schedule was created. Team filters remain; management retains resource-type and free-text search filters.

## Safeguards
- No fallback to terms from prior years.
- No manufactured meetings, arbitrary date entries, or cross-term meeting selections.
- Stale asynchronous year/term loads are ignored; stale reservation snapshots are dropped.
- Historical years remain read-only and unchanged.
- No SQL migration or production data changes.
- Editing a booking still requires explicit start/end *times* for actual availability, conflict and duration checks; this release changes the reservation **register filter**, not the booking execution period.

## Validation
- `npm run qa:static`
- `npm run test:scout-year`
- `npm run test:budget-year`
- `npm run test:secretary-forms`
- `npm run test:best-chefs-year`
- `npm run test:reservations` (includes Release 136 tests)
- `npm run typecheck` and `npm run build` in CI
