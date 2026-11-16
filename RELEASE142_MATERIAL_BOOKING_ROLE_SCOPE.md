# Release 142 — Material Booking Role Scope

Fixed the discrepancy between route access and the material booking button.

- Team leaders (chef_de_legion) and team materials responsibles can reserve for the team assigned by their active current-year role.
- Global materials managers and permanent admins can select a team.
- The default team is chosen from actual booking entitlements, not a stale members.team_id.
- Archived Scout Years remain read-only. Reserve and cancel callbacks also verify scope.
- Added 10 regression tests to the existing GitHub CI workflow.
- Migration 29 aligns material reservation RLS with active year/team role assignments and does not modify existing booking rows.

## Before enabling production writes
Inspect the real ScoutSVM migration ledger and run MATERIAL_BOOKING_ROLE_PREFLIGHT_READ_ONLY.sql. Reconcile existing policies, then apply Migration 29 to ScoutSVM only if needed. Verify team lead, team materials, global materials, admin, unauthorized roles, archive behavior, and overlap protection. No production DB changes were made in this PR.
