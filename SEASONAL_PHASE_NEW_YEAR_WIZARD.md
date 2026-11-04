# Seasonal Phase — New Scout Year Wizard

## What changed
- Expanded `AdminScoutYears.tsx` into a fuller setup wizard for the next scout year.
- Added ability to:
  - suggest the next scout year dates and label from the current year
  - run a one-click setup flow
  - optionally clone structure (teams / member assignments / role assignments)
  - optionally clone `terms`
  - optionally clone `term_meeting_dates`
  - optionally make the new year current
  - optionally sync legacy tables after setup
- Extended scout year summaries with:
  - `terms_count`
  - `meeting_dates_count`
- Added API helper to clone terms and meeting-date templates between scout years.

## Files changed
- `src/pages/AdminScoutYears.tsx`
- `src/features/scoutYears/api.ts`
- `SEASONAL_PHASE_NEW_YEAR_WIZARD.md`

## Notes
- This phase keeps the current business logic intact.
- It builds on the SQL already added earlier for `scout_years`, `team_seasons`, `member_season_assignments`, `user_role_assignments`, `terms.scout_year_id`, and meeting/camp year linkage.
