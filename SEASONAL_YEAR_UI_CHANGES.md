# Seasonal Year UI Changes

## What was added
- `src/components/ScoutYearProvider.tsx`
- `src/features/scoutYears/api.ts`
- `src/pages/AdminScoutYears.tsx`

## Main updates
- Added a central current scout year provider and hook usage in the app shell.
- Added admin page to:
  - create/update scout years
  - set one year as current
  - clone seasonal structure from one year to another
  - sync legacy tables (`members`, `user_roles`) from a selected scout year
- Added current scout year display in:
  - `SideNav`
  - `Home`
  - `Admin`
  - `AdminMembers`
- Added a direct admin menu entry to the scout year management page.

## Important note
This phase keeps legacy write paths intact so the current app logic continues to work, while giving the admin a controlled UI to start a new year and align the legacy tables with the active seasonal data.
