# Seasonal Phase — Meeting Minutes, Tasks, Cases, Notifications

## What changed
- Scoped meeting minutes list to the current scout year via `meeting_date`
- Scoped meeting tasks list and minute picker to the current scout year
- Added current scout year validation when creating/editing meeting minutes
- Scoped team cases list to records effective within the current scout year
- Added current scout year validation when creating new team cases
- Scoped notifications list to the current scout year based on `created_at`

## Files touched
- `src/hooks/useCurrentScoutYear.ts`
- `src/pages/MeetingMinutesList.tsx`
- `src/pages/MeetingMinuteForm.tsx`
- `src/pages/MeetingTasks.tsx`
- `src/pages/TeamCases.tsx`
- `src/pages/Notifications.tsx`

## Notes
- This phase keeps the existing business logic intact.
- Reads are now more tightly scoped to the active scout year.
- Legacy write paths remain unchanged.
