# Scout SVM Release 33 — Camp Resource Restrictions

## Scope
This release enhances the Camp Program module so room and material booking checks happen while creating or editing the daily plan activity.

## Main changes
- Rooms are now independent camp resources:
  - `large_hall` = القاعة الكبيرة
  - `small_hall` = القاعة الصغيرة
- Added `camp_program_item_rooms` table to keep room bookings separate from materials and separate from the general system reservation module.
- Materials now support requested quantities per activity instead of always saving quantity = 1.
- Added a Resource Availability Panel inside the activity form.
- Added a visual day timeline for the selected room/material.
- Added suggested alternative time windows within a 10-hour camp day window.

## Rules enforced in the UI before saving
- Any room/material booking cannot exceed 60 minutes.
- Room bookings cannot overlap with another team/activity for the same room and day.
- Material bookings check total available quantity from `materials.total_qty`.
- If `total_qty` is empty, the material is treated as quantity 1.
- A team can book rooms a maximum of 3 times per day, across both rooms combined.
- A team cannot book a room directly back-to-back with another room booking on the same day.
- A team cannot book the same material directly back-to-back on the same day.
- Editing an existing activity excludes that same activity from conflict checks.
- Deleting an activity cancels its linked room/material bookings through cascade relations.
- Duplicating an activity fills the form only; the copied booking must pass checks before saving.

## Notes
- Manual tools are shown in the plan and PDF only. They are not included in quantity/conflict checks.
- The availability timeline currently uses a 10-hour visual window from 09:00 to 19:00. The activity time inputs remain free-form and are not restricted to slots.
- Apply `supabase/07_camp_program.sql` again in Supabase SQL Editor to add the new room booking table and policies.
