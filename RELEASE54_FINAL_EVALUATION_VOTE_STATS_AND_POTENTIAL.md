# Release 54 — Final Evaluation Vote Persistence, Manual Stats & Potential Flags

## Scope
This release updates the final chefs evaluation page.

## Changes

### 1. Vote clearing persistence
- Admin vote choices can still be cleared by pressing the active `نعم` / `لا` pill again.
- Saving final evaluation as an admin now also persists vote changes quietly, so cleared votes are not lost if the admin presses `حفظ التقييم النهائي` instead of only `حفظ التصويت`.
- Vote loading now uses the current scout year key consistently.
- Vote reload after saving merges the refreshed member vote state without wiping unrelated loaded members.
- Added SQL policies to keep `final_votes` admin-only for insert/update/delete and allow admin delete, so empty/cleared votes can actually be removed.

### 2. Manual rank statistics additions
- Rank statistics cards now show:
  - System count
  - Manual extra count
  - Total
- Admin can enter the manual extra number per rank.
- Manual extra counts are added to both before-promise and after-promise statistics.
- Non-admin users can see the manual extra count but cannot edit it.

### 3. Excluded filter
- Added a top filter for members marked as excluded from next-year statistics.
- This can be combined with team/rank/search filters.

### 4. Potential flag
- Added an admin-controlled `Potential` flag on member cards and inside the member detail modal.
- Added a top filter to show Potential members only.
- Potential is visible as a badge for non-admin users but editable by admin only.

## SQL Required
Run this once in Supabase SQL Editor:

```sql
supabase/10_final_potential_and_rank_stat_adjustments.sql
```

## Files changed
- `src/pages/ChefsEvaluationOverview.tsx`
- `supabase/10_final_potential_and_rank_stat_adjustments.sql`
