# Release 123 — Attendance / Finance / Field Admin UI/UX Redesign

## Scope
This release redesigns three existing admin pages while preserving their current workflows and database behavior:

1. **Admin Attendance**
   - Keeps the existing stats filters: team, range/year/term.
   - Keeps the Chef de legion statistics table and its present/excused/unexcused totals.
   - Keeps the existing daily attendance write flow: team, date, meeting/preparation, present/absent, excused, excuse note, save.
   - Adds visual KPI summaries computed from the already loaded stats only.

2. **Admin Finance**
   - Keeps the page focused on setting `team_budgets` per team/term.
   - Keeps current `expenses` aggregation for spent amount.
   - Keeps the same budget save action.
   - Adds a visual budget-health panel and usage percentage derived from the existing budget/spend data.
   - Does **not** invent a transactions ledger or new financial workflow.

3. **Admin Field Reservations**
   - Keeps the existing FieldMaps component.
   - Keeps term/date/team filtering.
   - Keeps day summary per team.
   - Keeps same-day material reservations with edit/cancel.
   - Keeps field reservation edit/save/cancel controls.
   - Adds visual KPIs and a cleaner information hierarchy using the same loaded data.

## Safety / backend
- No database migration.
- No new insert/update/delete/upsert/RPC calls.
- Database operation call counts are identical to Release 122.
- Service Worker cache bumped to `v1.2.0-r123`.
