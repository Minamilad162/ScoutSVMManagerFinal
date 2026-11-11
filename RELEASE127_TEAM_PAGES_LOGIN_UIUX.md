# Release 127 — Team Pages + Login UI/UX Redesign

## Scope
Redesigned the existing ScoutSVM pages without changing their backend workflows, tables, permissions, or database mutations:

- `TeamCases`
- `LegionAttendance`
- `TeamStatistics`
- `FieldReservationsTeam`
- `TeamFinance`
- `Login`
- Current-year inactive-account gate

## TeamCases
- New Scout-themed dark hero using the existing project assets.
- Existing case/member/team filters and CRUD/archive/pin logic are unchanged.
- Existing case cards receive stronger visual hierarchy, severity/status emphasis, and responsive spacing.
- Existing add-case form and filters are retained and reorganized visually.

## LegionAttendance
- New visual system aligned with the redesigned admin pages.
- Uses the same current attendance data and save flow.
- Top KPI row now derives from the existing day state only:
  - total visible members
  - present
  - excused absence
  - absent
  - attendance percentage
- Existing term/day filters, uniform/agenda fields, absence reason, analysis table, and save logic remain unchanged.

## TeamStatistics
- Same meeting/term/member statistics workflows.
- KPI header now reuses the existing loaded statistics for member count, meetings, attendance ratio, record count, and current team.
- Existing tabs, tables, progress bars, member timeline, and refresh behavior are unchanged.

## FieldReservationsTeam
- Same field map, team/term/date/zone/time inputs, conflict handling, reservation creation, and cancellation logic.
- Updated hero, KPI cards, form hierarchy, map panel, and reservation tables.

## TeamFinance
- Same budget lookup, expense CRUD, delivered state, export flow, and permissions.
- Updated visual hierarchy to match the new ScoutSVM operations pages.
- Existing financial data and calculations remain authoritative.

## Login
- Rebuilt the login visual experience with the actual project asset:
  `src/assets/brand/scout-svm-official-logo.webp`
- Existing Supabase email/password sign-in behavior is unchanged.
- Existing password-recovery URL forwarding is preserved.
- Added a UI-only show/hide password control.

## Inactive current-year account
- The Release 126 current-year membership gate remains unchanged.
- Its blocked-account screen now uses the same branded login visual system and official group logo.
- Permanent Admin exception remains unchanged.

## Database
No SQL migration is required.
