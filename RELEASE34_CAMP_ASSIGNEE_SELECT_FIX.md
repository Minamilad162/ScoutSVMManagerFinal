# Release 34 — Camp Program Assignee Multi-Select Fix

## Fixed
- Fixed the runtime crash that occurred when selecting one or more chefs in a new camp-program activity.
- Fixed the same issue when selecting one or more assisting teams.
- Selected values are now copied from the DOM event immediately, before the React state updater runs, so `event.currentTarget` is never read after React has released the event.

## Affected screen
- `/app/camp-program`
- New/Edit activity form → "اختيار Chefs من نفس الفريق"
- New/Edit activity form → "اختيار فريق مساعد"
