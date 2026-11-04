# ScoutSVM — Canonical Database Coverage Audit (Release 103)

This report compares frontend Supabase usage with the SQL objects actually created by the bundled `supabase/01`–`15` migration chain. A missing item means **the bundled migrations do not define it**; it does not prove the live Supabase project is missing it.

- Frontend table/view references: **81**
- Table/view objects detected in bundled migrations: **40**
- Referenced table/views not created by bundled migrations: **44**
- Frontend RPC references: **15**
- Functions detected in bundled migrations: **30**
- Referenced RPCs not created by bundled migrations: **12**

## Missing table/view definitions

| Object | Frontend refs | Referencing files |
|---|---:|---|
| `avatars` | 3 | AdminBestChefs.tsx, BestChefCard.tsx, SideNav.tsx |
| `camp_installment_members` | 5 | CampInstallmentDetails.tsx, MyCampCollections.tsx, api.ts |
| `camp_installment_payments` | 4 | CampInstallmentDetails.tsx, MyCampCollections.tsx |
| `camp_installment_teams` | 8 | CampInstallmentForm.tsx, MyCampCollections.tsx, SideNav.tsx |
| `camp_installment_teams_summary` | 1 | CampInstallmentDetails.tsx |
| `camp_installments` | 12 | CampInstallmentDetails.tsx, CampInstallmentForm.tsx, CampInstallmentsList.tsx, CampProgram.tsx, Home.tsx, MyCampCollections.tsx, api.ts |
| `camp_installments_summary` | 2 | CampInstallmentDetails.tsx, CampInstallmentsList.tsx |
| `events` | 3 | AdminEvents.tsx |
| `final_evaluations` | 4 | ChefsEvaluationOverview.tsx, api.ts |
| `finance_event_budgets` | 7 | api.ts, financeEvent.tsx |
| `finance_event_expenses` | 7 | api.ts, financeEvent.tsx |
| `finance_events` | 7 | api.ts, financeEvent.tsx |
| `material_return_approvals` | 3 | MaterialsReturnApprove.tsx |
| `materials_reservations` | 1 | AdminFieldReservations.tsx |
| `meeting_minute_tasks` | 7 | MeetingMinuteForm.tsx, MeetingTasks.tsx, api.ts |
| `meeting_minutes` | 5 | MeetingMinuteForm.tsx, MeetingTasks.tsx |
| `meeting_minutes_summary` | 1 | MeetingMinutesList.tsx |
| `member_cases` | 6 | TeamCases.tsx, api.ts |
| `member_season_assignments` | 11 | AdminScoutYears.tsx, Home.tsx, adminRosterApi.ts, api.ts |
| `scout_years` | 7 | api.ts |
| `storage_locations` | 8 | Materials.tsx, MaterialsAdmin.tsx, StorageInventory.tsx, api.ts |
| `team_seasons` | 7 | AdminScoutYears.tsx, Home.tsx, adminRosterApi.ts, api.ts |
| `term_meeting_dates` | 18 | Admin.tsx, AdminFieldReservations.tsx, AdminReservationsAll.tsx, FieldReservationsTeam.tsx, LegionAttendance.tsx, MaterialsReturnApprove.tsx, MaterialsTeamReservations.tsx, TeamFinance.tsx, TeamSecretaryAttendance.tsx, api.ts, api.ts |
| `tools_reservations` | 1 | AdminFieldReservations.tsx |
| `user_role_assignments` | 12 | AdminScoutYears.tsx, Home.tsx, adminRosterApi.ts, api.ts |
| `v_audit_log_readable` | 1 | api.ts |
| `v_chefs_high_absence` | 1 | Admin.tsx |
| `v_current_scout_year` | 1 | api.ts |
| `v_equipier_term_stats` | 3 | TeamSecretary.tsx, TeamSecretaryAttendance.tsx, TeamStatistics.tsx |
| `v_eval_coverage` | 1 | Admin.tsx |
| `v_evaluations_full` | 1 | MyEvaluation.tsx |
| `v_field_reservations_detailed` | 2 | AdminFieldReservations.tsx |
| `v_finance_summary` | 2 | Admin.tsx, OpsDashboardBlocks.tsx |
| `v_material_items_due_today` | 1 | OpsDashboardBlocks.tsx |
| `v_materials_reservations_detailed` | 1 | AdminFieldReservations.tsx |
| `v_members_current` | 30 | AdminAttendance.tsx, AdminDashboard.tsx, AdminEvaluations.tsx, AdminSecretary.tsx, Attendance.tsx, CampInstallmentDetails.tsx, CampInstallmentForm.tsx, CampProgram.tsx, ChefsEvaluationOverview.tsx, Evaluation.tsx, Home.tsx, LegionAttendance.tsx, LegionEvaluations.tsx, MyCampCollections.tsx, SideNav.tsx, TeamCases.tsx, TeamSecretary.tsx, TeamSecretaryAttendance.tsx, TeamStatistics.tsx, TermVoiceNotes.tsx, adminRosterApi.ts, api.ts, api.ts, api.ts, api.ts |
| `v_my_camp_collection_members` | 1 | MyCampCollections.tsx |
| `v_my_camp_collection_payments` | 1 | MyCampCollections.tsx |
| `v_my_camp_collections_summary` | 1 | MyCampCollections.tsx |
| `v_my_notifications` | 3 | Home.tsx, Notifications.tsx, SideNav.tsx |
| `v_rank_counts_by_team` | 1 | Admin.tsx |
| `v_terms_with_scout_year` | 8 | Admin.tsx, AdminFieldReservations.tsx, MaterialsReturnApprove.tsx, OpsDashboardBlocks.tsx, api.ts, api.ts |
| `v_user_roles_current` | 6 | AdminSecretary.tsx, Attendance.tsx, ChefsEvaluationOverview.tsx, adminRosterApi.ts, api.ts, api.ts |
| `webpush_subscriptions` | 1 | pushNotifications.ts |

## Missing RPC definitions

| RPC | Frontend refs | Referencing files |
|---|---:|---|
| `admin_assign_roles_batch` | 1 | AdminMembers.tsx |
| `attendance_stats` | 1 | MyEvaluation.tsx |
| `mark_all_my_notifications_read` | 1 | Notifications.tsx |
| `mark_notifications_read` | 1 | Notifications.tsx |
| `material_available_qty` | 1 | MaterialsTeamReservations.tsx |
| `material_reservations_by_day_all` | 1 | MaterialsTeamReservations.tsx |
| `notify_team_roles` | 1 | AdminFieldReservations.tsx |
| `recompute_eval_presence` | 3 | AdminEvaluations.tsx, Evaluation.tsx, LegionEvaluations.tsx |
| `search_auth_users` | 1 | AdminMembers.tsx |
| `seed_camp_members_for_team` | 2 | CampInstallmentDetails.tsx, CampInstallmentForm.tsx |
| `send_overdue_material_returns` | 1 | MaterialsReturnApprove.tsx |
| `set_camp_member_participation` | 2 | CampInstallmentDetails.tsx, MyCampCollections.tsx |

## Production blocker

A clean database rebuild cannot currently be guaranteed from this repository alone. Before declaring database disaster-recovery readiness, export or reconstruct the canonical DDL/RLS/function definitions for the objects above, place them in ordered migrations, then validate them against a fresh Supabase project. Do **not** infer these schemas from frontend field usage alone because constraints, triggers, grants, RLS policies, and function security settings would be incomplete.