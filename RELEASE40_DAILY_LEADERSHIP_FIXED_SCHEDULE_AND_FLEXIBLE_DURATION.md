# Release 40 — Daily Leadership, Fixed Schedule & Flexible Booking Duration

## Scope

This release updates the Camp Program module with three coordinated improvements:

1. Resource/activity durations are no longer limited to one hour.
2. Each camp day stores its own day leadership assignments.
3. Four fixed daily periods are shown automatically and protected from overlapping activities/bookings.

## Flexible booking duration

- Removed the one-hour maximum duration validation for rooms and materials.
- Activities and resource bookings can now span two, three, four, or more hours.
- Existing conflict checks remain active:
  - Room double-booking prevention.
  - Material quantity availability.
  - Daily room-booking quota.
  - Existing consecutive-booking rules.
- Alternative-time suggestions now use the actual requested duration rather than capping it at 60 minutes.

## Daily leadership

New optional database fields were added to `camp_daily_plans` for:

- Assistant Day Leader member, stored display name, and note.
- First Sergeant of the Day member, stored display name, and note.

Application rules:

- **Assistant Day Leader is mandatory** when creating or saving a day.
- **First Sergeant of the Day is optional**.
- Both are selected from the chefs of the selected team.
- Each assignment has an optional multiline note.
- The assignments and notes appear in the day view and the generated PDF.
- PDF export is blocked until every exported day has an Assistant Day Leader.

## Fixed daily periods

The following rows are generated automatically for every camp day:

| Period | Time |
|---|---|
| Breakfast | 10:00–11:00 |
| Lunch | 16:00–17:00 |
| Rovo | 17:00–18:00 |
| Dinner | 22:00–23:00 |

Behavior:

- Fixed periods appear automatically in the on-screen day table and PDF.
- They are visually distinguished and marked as fixed.
- They cannot be edited, duplicated, or deleted.
- Any new or edited activity overlapping a fixed period is rejected before saving.
- Fixed rows are virtual system rows rather than duplicated database records, so they appear consistently for existing and new days without migration backfill.

## Database action required

Run the updated file:

`supabase/07_camp_program.sql`

The script adds the day-leadership fields and indexes idempotently.

## Server-side enforcement

The updated SQL also adds database triggers so the critical rules are not only UI validations:

- Active camp days cannot be inserted or updated without an Assistant Day Leader.
- Camp activities cannot be inserted or updated if they overlap a fixed period.
- Soft-deleting older conflicting rows remains allowed.
