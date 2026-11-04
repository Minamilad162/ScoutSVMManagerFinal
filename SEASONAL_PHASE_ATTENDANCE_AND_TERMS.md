# Seasonal Phase — Attendance, Terms, and Current-Year Operations

This phase continues the seasonal refactor path before the UI/UX work.

## What changed

### Current-year scoping for operations
The following pages now scope meetings and attendance reads to the current scout year when it exists:
- `src/pages/Attendance.tsx`
- `src/pages/AdminAttendance.tsx`
- `src/pages/LegionAttendance.tsx`
- `src/pages/TeamSecretaryAttendance.tsx`
- `src/pages/TeamSecretary.tsx`
- `src/pages/TeamStatistics.tsx`
- `src/pages/AdminDashboard.tsx`

### Terms management
- `src/pages/Admin.tsx`
  - terms are now loaded from `v_terms_with_scout_year`
  - only current-year terms are shown in the admin terms section
  - new/updated terms carry `scout_year_id` from the current scout year

### Dashboard / analytics support
- `src/pages/OpsDashboardBlocks.tsx`
  - latest term lookup now prefers current scout year

## Compatibility
- Existing write paths were preserved
- Meeting upserts now pass `scout_year_id` and `term_id` where appropriate
- Legacy sync and existing DB triggers remain compatible

## Expected DB prerequisites
This phase expects the previously added DB layer to already exist:
- `scout_years`
- `team_seasons`
- `member_season_assignments`
- `user_role_assignments`
- `v_current_scout_year`
- `v_members_current`
- `v_user_roles_current`
- `v_terms_with_scout_year`
- `meetings.scout_year_id`
- `meetings.term_id`
