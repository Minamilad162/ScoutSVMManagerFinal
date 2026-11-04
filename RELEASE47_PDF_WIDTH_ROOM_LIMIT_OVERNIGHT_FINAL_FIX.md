# Release 47 — PDF Width, Room Limit, and Overnight Day Final Fix

This release applies three targeted fixes requested after testing release 46.

## 1. PDF page width normalization

- Strengthened the generated PDF layout so every rendered page is captured from the exact same fixed 1280 × 892 canvas.
- Forced `.pdf-day`, `.day-block`, `.table-wrap`, and the table itself to keep the same width on first pages and continuation pages.
- Removed the jsPDF outer scaling margin and exported each rendered canvas to the full landscape A4 page, relying on the internal PDF design margins instead.
- Added an `html2canvas` clone-time width reset to stop page 1 from being captured at a smaller effective width.

## 2. Room booking daily limit fully removed

- Confirmed the frontend has no max-3 room booking validation.
- Added SQL cleanup to drop any old room daily limit/quota triggers from earlier deployments if they still exist in Supabase.
- The only hard room rule remains: the same exact room cannot be booked by two activities at overlapping times.

## 3. Overnight camp day support fixed in the frontend and database

- Fixed the frontend save guard that was still comparing times as plain strings and blocked overnight ranges like `11:00 PM → 2:00 AM`.
- The operational camp day is now consistently treated as:
  - Start: `06:00`
  - End: `04:00` next morning
- Added robust SQL cleanup to remove old `end_time > start_time` check constraints even if their generated constraint name differs.

## Required Supabase step

Run the updated file again:

```sql
supabase/07_camp_program.sql
```

This is required to remove any old database check/trigger still enforcing the old same-day or max-3 room rules.

## Build note

No dependency changes were added in this release.
