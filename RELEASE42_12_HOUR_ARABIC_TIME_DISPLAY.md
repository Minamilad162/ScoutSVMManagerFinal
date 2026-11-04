# Release 42 — 12-Hour Arabic Time Display

## Change
Camp Program time presentation now uses a clear 12-hour Arabic format in all user-facing views and generated PDFs.

Examples:
- `16:00` → `4:00 م`
- `10:30` → `10:30 ص`
- `22:00` → `10:00 م`

## Scope
- Daily program table
- Generated day and full-camp PDFs
- Resource availability timeline
- Booking/conflict notifications
- Suggested alternative times
- Fixed meal/ROVO schedule labels
- Activity color preview

## Technical note
Times continue to be stored and compared internally in 24-hour format to preserve reliable sorting, overlap checks, resource availability calculations, and database compatibility.

No SQL migration is required.
