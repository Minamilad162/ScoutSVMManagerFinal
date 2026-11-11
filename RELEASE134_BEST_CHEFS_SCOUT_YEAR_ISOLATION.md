# ScoutSVM — Release 134: Best Chefs Scout Year isolation

**Baseline:** The complete Release 133 ZIP. This change targets `/app/best-chefs`, `/app/admin-best-chefs`, and the Best Chefs section of `/app` (Home), preserving all other workflows.

## Reported symptom

The header displays Scout Year **2026/2027**, Term 1 is empty, but Term 2 (February–June 2027) shows eight Best Chefs. The screenshot proves the page displays eight entries; **it does not prove whether the underlying rows belong to the old year or were saved under 2026/2027**. Do not delete or reassign records based on the screenshot.

## Code changes

1. Selections require **both** `scout_year_id` equal to the selected Scout Year **and** `term_id` in that year's term IDs. A second in-memory guard rejects mismatches even if a view returns them.
2. Gallery and Home receive the **selected** Scout Year ID from `ScoutYearProvider`, clear stale data when the year changes, and ignore late responses from a prior year.
3. The Admin Best Chefs picker filters terms to the selected year, resets stale selections on term/year change, and ignores outdated requests.
4. Admin writes reject terms from a different year, member IDs that are not valid active candidates for the selected year, and archived read-only year context.
5. The **الترم الحالي** badge is displayed only when today's date falls within that term's actual date bounds; the presence of selections never makes a future term 'current'.

## SQL files (not applied)

- `supabase/BEST_CHEFS_YEAR_AUDIT_READ_ONLY.sql`: **read-only** queries showing counts, year/term mismatches, selection times, and recorded actor IDs. Run this first in the **ScoutSVM** database to determine the source of the eight names.
- `supabase/25_best_chefs_year_integrity.sql`: optional defense-in-depth integrity migration. It rejects **future** writes where a Best Chef selection year mismatches its term year; it also restricts the readable view to matching year/term links. **It never deletes or reassigns existing rows.** Review the remote migration ledger and current view definition before applying, and test on a safe environment first. Since no ScoutSVM Supabase account is connected, this migration has **not** been applied.

If the eight rows are already stored with the 2026/2027 Scout Year ID and Term 2 ID, this code **intentionally keeps them**: they appear to be current-year data to the database. The audit must establish their origin, followed by a separately approved, narrowly scoped correction if they were mistakenly seeded or copied.

## QA performed

- 7/7 new Best Chefs year isolation tests passed, including the scenario where new year has no selections but old year does.
- 4/4 Scout Year scope tests passed.
- 5/5 Budget/year contract tests passed.
- 7/7 Secretary forms/navigation tests passed.
- Static QA passed (101 source files, 55 registered routes).
- TypeScript syntax parsing passed (100 files).
- Full TypeScript typecheck and Vite Build **not validated**: dependencies could not be installed (`npm ci` exited with `Exit handler never called!`). No deployment or production database mutation was performed.

## Manual verification before production

1. On the real ScoutSVM DB, run the read-only audit. Review the selection records for Term 2 of 2026/2027 (including `selected_by`, `created_at`, and the year IDs).
2. With 2026/2027 selected, open `/app/best-chefs`, `/app/admin-best-chefs`, and `/app`. They should show **only entries explicitly linked to that year and its terms**.
3. Switch as Super Admin to 2025/2026; historical results should appear if saved for that year, without being writable.
4. Try creating a Best Chef selection with a term from another year; the app should reject it. After approved migration 25, the DB trigger also rejects it.
5. Run `npm ci`, `npm run typecheck`, `npm run build` and the end-to-end browser tests in a working dependency environment.
