# Release 37 — PDF Branding, Row Colors & Delegated Camp Access

## What changed

### 1. Premium PDF identity
- Removed the `Scout SVM Camp Plan` text badge from the PDF header.
- Added the supplied Scouts & Guides Saint Vincent Miami logo to the left side of the PDF header.
- Refined the header with a premium navy/gold visual treatment.
- The logo is bundled locally in `src/assets/scout-svm-logo.png` and is loaded before PDF capture.

### 2. Per-activity PDF colors
- Every camp activity now has:
  - Row background color.
  - Row text color.
- Added ready-made palettes plus custom color pickers.
- Default remains white background with dark text.
- Colors are previewed in the activity form, shown in the on-screen schedule table, and exported to PDF.
- Edit and Duplicate preserve the selected colors.

### 3. Delegated Camp Program access
- A Chef de legion can select non-equipier Chefs from their own team and grant them access to the Camp Program module.
- Admin can manage access for any team.
- Delegated users:
  - See `نظام المعسكر` in the sidebar.
  - Can create/edit/delete days and activities for the delegated team.
  - Can export that team's PDF.
  - Can view other teams' plans in read-only mode.
- Delegated users cannot grant access to other users.
- This permission is isolated to the Camp Program module and does not create any system role.
- Chefs without a linked login account are shown but cannot be selected.

### 4. Database alignment fix
- Added `small_hall_3` to the room key database constraint, matching the third small hall already available in the UI.

## Database step required
Run the updated file in Supabase SQL Editor:

```text
supabase/07_camp_program.sql
```

The file is idempotent and includes the previous Camp Program setup plus the Release 37 additions.

## Main files changed
- `src/pages/CampProgram.tsx`
- `src/components/SideNav.tsx`
- `src/assets/scout-svm-logo.png`
- `supabase/07_camp_program.sql`

## Validation
- `npm ci` completed.
- `npm run build` completed successfully.
- No TypeScript errors were reported for `CampProgram.tsx` or `SideNav.tsx`.
