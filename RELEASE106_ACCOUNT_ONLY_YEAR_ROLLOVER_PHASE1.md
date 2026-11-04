# Release 106 — Account-Only Scout Year Rollover (Phase 1)

## الهدف
تطبيق الـYear Rollover بالمنطق المعتمد:

1. Create a new Scout Year.
2. Load previous-year leader accounts.
3. Select only the accounts that will continue.
4. Transfer the same Auth account / email into the target year.
5. Do **not** inherit Team, Rank, Global Roles or Team Roles.
6. Configure every transferred account independently inside the selected target year.
7. New Supabase Auth accounts appear as unlinked accounts and can be attached to the selected year.
8. Activate the new year only after setup is complete.

## أهم التغييرات

### 1. Account-only transfer
Added SQL migration:
- `supabase/16_account_only_year_rollover.sql`

New RPC:
- `admin_replace_scout_year_account_roster(source_year, target_year, member_ids)`

Behavior:
- keeps the same `members.auth_user_id` / Supabase Auth user,
- removes any target-year roles for source-year accounts before rebuilding the target roster,
- creates target-year `member_season_assignments` only for selected accounts,
- initializes transferred accounts with:
  - `team_id = NULL`
  - `rank_id = NULL`
  - no `user_role_assignments`
- source-year history is untouched,
- source-year members not selected are not created in the target year.

The selection is authoritative for accounts originating from the chosen source year. New accounts already added directly to the target year are not removed.

### 2. Auth account visibility
SQL 16 also adds admin-only RPCs:
- `admin_list_auth_accounts(uuid[])` — resolves emails for rollover cards.
- `admin_list_unlinked_auth_accounts(limit)` — lists Supabase Auth users that are not yet linked to a Member.

This supports the agreed workflow where a new Auth account is created in Supabase Authentication first, then appears inside ScoutSVM for assignment.

### 3. Rollover UI
`AdminScoutYears.tsx` now:
- loads leader accounts with email,
- defaults new source accounts to **not selected**,
- preserves already-existing target-year selections,
- shows previous Team / Rank / Roles as reference only,
- makes it explicit that they are **not inherited**,
- supports Select All / Clear All,
- supports removing a previously transferred source account by deselecting it and reapplying the roster,
- defaults `Make Current` to OFF,
- links directly to target-year account setup after transfer.

The old full-structure clone control is removed from the normal UI path so users are not encouraged to clone members/roles automatically.

### 4. Manage Draft/Future Scout Years
`AdminMembers.tsx` can now manage a specific Scout Year using:

`/app/admin-members?year=<scout_year_id>`

The admin can select any Scout Year from the page and configure:
- Team
- Rank
- Active state
- Global roles
- Team-scoped roles

When editing a non-current year, legacy `members` / `user_roles` state is **not** synchronized, protecting the current operational year.

Transferred accounts with missing Team / Rank / Roles show:
- `Setup Required`

### 5. Add new accounts
The Add Chef section now includes `Unassigned Auth Accounts`.

Workflow:
1. Create the user in Supabase Authentication.
2. Refresh/open Admin Members.
3. Select the unlinked Auth account.
4. Enter name, Team and Rank.
5. Choose Global and/or Team roles.
6. Save into the selected Scout Year.

Existing Auth accounts already linked to a Member can still be found by email and attached to another Scout Year without creating a duplicate account.

## Important DB step
Run SQL 16 before using the new rollover flow:

`supabase/16_account_only_year_rollover.sql`

The frontend fails safely with a clear message if the new RPC has not been installed.

## Not included in Phase 1
The global Super Admin historical-year selector across every operational page is the next phase. Current operational screens continue to use the existing current-year model until that historical read-only context is implemented safely across all modules.
