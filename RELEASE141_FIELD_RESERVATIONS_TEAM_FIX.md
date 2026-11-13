# ScoutSVM Release 141 — Field Reservations Team

## Problem
On `/app/FieldReservationsTeam`, the booking form was silently disabled by a CSS wrapper when a role/team did not match. Global materials managers could see the page in navigation but failed the UI gate. The meeting dropdown selected the first date even if already expired, and booking attempted to upsert a meeting record that materials staff may not have permission to edit.

## Fix
- Preserve active form controls; clearly explain missing team, permission, meeting, sector, or archived-year restrictions.
- Allow a global materials manager to reserve for their own current-year member team only; administrator permissions remain unchanged. No cross-team privilege is added for non-admins.
- Use the selected Scout Year and term to filter registered meetings. Select the nearest upcoming meeting, and retain past meetings for viewing history only.
- Use Africa/Cairo time conversion, including DST; reject reservations whose start time already passed.
- Only link an existing meeting row if one exists; do not create or update meetings while booking a sector.
- Guard late async responses against switching dates/terms/years.
- Keep DB overlap protection and existing bookings unchanged. No new migration is required.

## Tests
- 8 new role/date/error-message tests passed.
- 39 regression tests and Static QA passed locally on release baseline.
- GitHub CI is required for full TypeScript/production build verification.

## Production smoke test
Login as a current-year team leader or global materials manager; choose the upcoming scheduled meeting, active field zone and future time. Confirm a non-overlapping reservation appears, and archived years are read-only.
