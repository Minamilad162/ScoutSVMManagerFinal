# Release 46 — Camp Overnight Day & PDF Width Fix

## Changes

### PDF width normalization
- Enforced one fixed PDF page canvas size for every generated page.
- Added a fixed inner PDF content width so first pages and continuation pages render with the same table width.
- Explicitly locks each exported `.pdf-day` element to `1280 × 892` before canvas capture.

### Room booking count
- Removed the remaining room booking continuity restriction from the room validation path.
- No daily maximum is enforced for hall/room bookings.
- The only hard hall conflict kept is overlapping use of the exact same hall by another activity/team.

### Camp operational day
- Camp day now starts at **6:00 ص**.
- Camp day ends at **4:00 ص** the following morning.
- Times from midnight to 4:00 ص are treated as the end of the same camp day.
- The blocked gap from 4:00 ص to 6:00 ص is not valid for new activities.
- Overnight activities such as `11:00 م - 2:00 ص` are now valid in frontend validation and database validation.

## SQL required
Run `supabase/07_camp_program.sql` again in Supabase SQL Editor.
This updates the database time constraint so overnight activities can be saved.

## Build note
If dependencies are not installed locally, run:

```powershell
npm install
npm run build
```
