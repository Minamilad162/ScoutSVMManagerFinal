# Release 71 — New Year Rollover Wizard V2

## Purpose
Add a detailed year rollover review step inside **Admin Scout Years / إدارة السنة الكشفية**.

The goal is to let the admin decide before activating the new scout year:
- Who continues into the new year.
- Who is removed / marked inactive for the new year.
- Who changes team.
- Who changes rank.
- Who changes responsibilities / roles.
- Which existing login accounts remain linked to the same member.

## What changed

### 1. Detailed rollover section
A new section was added to `AdminScoutYears.tsx`:

**معالج النقل التفصيلي للسنة الجديدة**

The admin must select a source year and a target year from the existing year wizard, then click:

`تحميل قائمة السنة المصدر`

The screen then loads every member assignment from the source year and shows a review table.

### 2. Member-level decisions
For every source-year member, the admin can now control:
- Continue or remove from the new year.
- Target team.
- Target rank.
- Equipier flag.
- Role/responsibility assignments for members who already have an auth account.

### 3. Account preservation
If a member already has `auth_user_id`, the UI shows that the same account is preserved.
No new auth user is created in this release.

### 4. Fixed teams per year
When the detailed rollover is applied, the app ensures all existing teams are available in the target year via `team_seasons`.

### 5. Target-year writes
When the admin clicks `اعتماد النقل التفصيلي`, the app writes only to the target year:
- `team_seasons`
- `member_season_assignments`
- `user_role_assignments`

Removed members are written as inactive inside the target year, so they do not appear in current active views but remain traceable.

### 6. Optional activation and legacy sync
The admin can choose whether to:
- Make the target year current after applying.
- Sync legacy tables (`members`, `user_roles`) after applying.

## Files changed
- `src/pages/AdminScoutYears.tsx`

## Database changes
No new SQL file is required for this release if the existing seasonal schema is already applied.

Required existing tables/views from earlier seasonal work:
- `scout_years`
- `team_seasons`
- `member_season_assignments`
- `user_role_assignments`
- `v_current_scout_year`
- `v_members_current`
- `v_user_roles_current`

## Not included yet
- Creating new Supabase Auth users from inside the wizard.
- Bulk automatic promotion rules by rank.
- Importing new members from Excel.

These can be added as a next phase.

## Safety notes
- Existing permissions/menu logic was not changed.
- Existing operational data is not copied or changed by this release.
- Existing accounts are preserved through `members.auth_user_id`.
- Changes are scoped to the selected target scout year.
