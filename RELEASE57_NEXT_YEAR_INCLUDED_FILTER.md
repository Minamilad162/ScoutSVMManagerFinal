# Release 57 — Next Year Included Filter

## Scope
Adds a new filter to the Final Chefs Evaluation page so admins/leaders can view the expected next-year lineup by hiding members marked as excluded from next-year statistics.

## Changes
- Added a new filter chip: **السنة القادمة**.
- When enabled, the page shows only members who are **not** marked as `exclude_from_next_year_stats`.
- The filter works together with:
  - Team filter
  - Rank filter
  - Search
  - وعد
  - Meilleurs
  - Potential
- The existing **المستبعدون** filter still shows excluded members only.
- The two filters are mutually exclusive:
  - Selecting **السنة القادمة** turns off **المستبعدون**.
  - Selecting **المستبعدون** turns off **السنة القادمة**.

## Files Changed
- `src/pages/ChefsEvaluationOverview.tsx`

## Database
No SQL changes required.
