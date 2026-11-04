# Release 72 — Rollover Load Fix and Delete Scout Year Button

## Scope
Fix the detailed new-year rollover loading issue and add a safe delete action for scout years.

## Fixes

### Detailed rollover list loading
- The **تحميل قائمة السنة المصدر** button no longer requires selecting a target year first.
- You can now load and review the source-year members first.
- Target year is required only when pressing **اعتماد النقل التفصيلي**.
- Added source/target selectors directly inside the detailed rollover section to make the workflow clearer.
- Added fallback loading from the legacy `members` table if the selected source year has no `member_season_assignments` rows yet.
- Added fallback loading from legacy `user_roles` when the fallback members list is used, so existing responsibilities are not lost.

### Delete scout year
- Added a **حذف السنة** button on each scout-year card.
- The current active scout year cannot be deleted.
- Delete requires:
  1. normal confirmation
  2. typing the scout year name exactly
- The UI clears source/target selections and rollover rows if the deleted year was selected.

## Database
A new optional SQL helper was added:

```text
supabase/12_scout_year_rollover_and_delete_fix.sql
```

Run this file to enable the safe RPC delete path:

```text
admin_delete_scout_year(p_scout_year_id uuid)
```

The frontend will try the RPC first. If the RPC is not installed, it falls back to the normal `scout_years` delete. For years with linked data, the RPC is recommended.

## Files changed
- `src/pages/AdminScoutYears.tsx`
- `src/features/scoutYears/api.ts`
- `supabase/12_scout_year_rollover_and_delete_fix.sql`

## Safety
- No changes to menu permissions.
- No changes to role visibility logic.
- Current scout year delete is blocked.
- Existing Auth accounts are preserved during detailed rollover.
