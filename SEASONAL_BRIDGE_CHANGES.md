# Seasonal Bridge Code Changes

This package contains the code-side bridge for the new scout year model that was added in the database.

## Assumptions
These frontend changes assume the database work has already been applied:
- `scout_years`
- `team_seasons`
- `member_season_assignments`
- `user_role_assignments`
- `v_current_scout_year`
- `v_terms_with_scout_year`
- `v_members_current`
- `v_user_roles_current`
- `meetings.scout_year_id`
- `camp_* .scout_year_id`

## Main changes

### 1) Central seasonal reference layer
- `src/features/reference/api.ts`
- `src/hooks/useReferenceData.ts`

Added helpers for:
- current scout year
- current-year terms
- current user current-year context
- current-year role resolution
- current-year member reads

### 2) Auth + navigation now use current-year views
- `src/components/AuthProvider.tsx`
- `src/components/SideNav.tsx`
- `src/pages/Home.tsx`

### 3) Attendance and team/member operational pages read from current-year member data
- `src/pages/Attendance.tsx`
- `src/pages/LegionAttendance.tsx`
- `src/pages/TeamSecretaryAttendance.tsx`
- `src/pages/TeamStatistics.tsx`
- `src/pages/TeamCases.tsx`
- `src/pages/TeamSecretary.tsx`
- `src/pages/AdminAttendance.tsx`
- `src/pages/AdminSecretary.tsx`

### 4) Evaluations now use current-year terms + members + roles
- `src/pages/Evaluation.tsx`
- `src/pages/LegionEvaluations.tsx`
- `src/pages/MyEvaluation.tsx`
- `src/pages/AdminEvaluations.tsx`
- `src/pages/ChefsEvaluationOverview.tsx`

### 5) Operational reservations/finance term pickers use current-year terms
- `src/pages/FieldReservationsTeam.tsx`
- `src/pages/MaterialsTeamReservations.tsx`
- `src/pages/AdminFinance.tsx`
- `src/pages/TeamFinance.tsx`
- `src/pages/AdminReservationsAll.tsx`
- `src/pages/OpsDashboardBlocks.tsx`

### 6) Camp/installment module is now current-year scoped in reads
- `src/pages/CampInstallmentsList.tsx`
- `src/pages/CampInstallmentForm.tsx`
- `src/pages/CampInstallmentDetails.tsx`
- `src/pages/MyCampCollections.tsx`

## Notes
- Existing write paths on `members` and `user_roles` were intentionally kept to avoid breaking existing logic.
- The code now prefers current-year reads through the seasonal views while relying on DB sync triggers for compatibility.
- `Admin.tsx` and `AdminMembers.tsx` were intentionally left mostly global because they behave as master/admin maintenance pages.
