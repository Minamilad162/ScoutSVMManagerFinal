# Seasonal Admin Members / Roles Phase

## What changed
- Enhanced `AdminMembers.tsx` to manage **current scout year members and roles** directly.
- Added `src/features/scoutYears/adminRosterApi.ts` for seasonal roster/role operations.
- Added `src/hooks/useSeasonAdminData.ts` to centralize current-year admin data loading.
- Updated admin navigation labels to reflect members + roles scope.

## Key behaviors
- Admin can still add Chef / Equipier using legacy-safe flows.
- Admin can now:
  - browse current-year members
  - filter by team / status / type
  - edit current-year team / rank / equipier status / active status
  - manage current-year roles for members linked to auth users
- Operations update both:
  - current-year seasonal tables
  - legacy tables needed by existing runtime logic

## Notes
- This phase assumes the seasonal SQL bridge already exists and is working.
- Runtime keeps legacy compatibility while shifting admin workflows toward the seasonal model.
