# Release 53 — Final Evaluation Statistics Exclusions

## Scope
Adds Admin-only flags to exclude selected chiefs from next-year rank statistics while keeping them fully visible and evaluable in the final evaluation page.

## Changes

- Added a new Admin-only flag: **غير موجود السنة القادمة / لا يدخل في الإحصائيات**.
- The flag appears on each chief card and inside the details modal for Admin users only.
- Non-admin users can see a status badge when a chief is excluded, but cannot edit it.
- Rank statistics **before promotion** and **after promotion** now exclude flagged names.
- Flagged chiefs still:
  - appear in the evaluation page,
  - can be evaluated normally,
  - can have attendance/final scores reviewed,
  - remain visible in promoted/Meilleur grouped results.
- Added a small statistics banner showing how many visible names are excluded from the rank statistics.

## Database
Run:

```sql
supabase/09_final_next_year_exclusions.sql
```

This adds:

- `public.final_next_year_exclusions`
- RLS policies:
  - team/Admin can read status,
  - Admin only can insert/update/delete.

## Notes
No existing records are deleted or modified. The flag affects statistics only.
