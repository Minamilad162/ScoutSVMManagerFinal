# Release 32 - Camp Program Module

## New module
Added a new sidebar module:

- **نظام المعسكر**
- Route: `/app/camp-program`

## Business logic
- Camp program is scoped by **Camp + Team**.
- Each team can build its own daily plan inside the selected camp.
- Admin can view and edit all teams' plans.
- Chef de legion can view all teams' plans but can only edit their own team plan.
- PDF export is available for the user's own team plan; Admin can export any team plan.

## Daily plan fields
Each camp day can include:
- Day title, for example: اليوم الأول / اليوم الثاني.
- Date.
- General notes.

## Activity / round fields
Each activity can include:
- Start time.
- End time.
- Activity or round title.
- Location.
- Materials from the existing `materials` table.
- Manual materials text.
- Assigned chefs from the same team.
- Assigned helper teams.
- Manual assignee names.
- Notes.

## Material conflict warning
When the user selects a material for an activity, the screen checks other teams' plans in the same camp/day/time window and shows a warning if the same material is already used by another team.

This is intentionally a warning only. It does not block saving.

## PDF / print export
The module provides:
- Export selected day to PDF.
- Export the full camp program for the selected team to PDF.

The implementation uses a browser print window so the user can save as PDF. The sheet is RTL-friendly and supports mixed Arabic/English text through `dir="auto"` and printable table formatting.

## Database migration
New SQL file added:

- `supabase/07_camp_program.sql`

This file creates:
- `camp_daily_plans`
- `camp_program_items`
- `camp_program_item_materials`
- `camp_program_item_members`
- `camp_program_item_teams`
- RLS policies for Admin and Chef de legion access.

## Changed files
- `src/pages/CampProgram.tsx`
- `src/App.tsx`
- `src/components/SideNav.tsx`
- `supabase/07_camp_program.sql`
- `RELEASE32_CAMP_PROGRAM_MODULE.md`

## Validation
- `npm run build` completed successfully.
