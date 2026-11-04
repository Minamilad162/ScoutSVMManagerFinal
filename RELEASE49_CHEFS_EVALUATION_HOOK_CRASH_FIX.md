# Release 49 — Chefs Evaluation Hook Crash Fix

## Fixed
- Fixed the Chefs Evaluation Overview page crash that showed: `Cannot read properties of null (reading 'useState')`.
- Added a safe wrapper around the page component so route/lazy loading cannot accidentally execute hooks outside the React render lifecycle.
- Kept Release 48 fixes: Yes/No selections can be cleared, empty votes are deleted, and attendance validation continues to include present/absent totals.

## SQL
- No SQL changes required.
