# Release 44 - Remove Daily Room Booking Limit

## Scope
This release removes the previous rule that limited each team to a maximum of 3 room/hall bookings per day inside the Camp Program module.

## Changes
- Removed the frontend validation that blocked saving when a team had already booked rooms 3 times in the selected day.
- Updated the room booking metric card to show that there is no daily maximum booking count.
- Updated the room/location helper text to remove the old "3 bookings per day" note.
- Kept the existing room conflict rule: the same room cannot be booked by two teams at overlapping times.
- Kept existing fixed schedule restrictions and material quantity checks.

## Database
No SQL migration is required for this release.
