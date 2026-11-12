# Release 140 — AdminSecretary cross-team PDF upload

The AdminSecretary sidebar already selects a team; the Forms tab already renders
SecretaryFormsWorkspace scoped by that selected team and selected Scout Year.

## Changes
- Client permissions: admin and global responsable_secretary can upload PDFs
  for any sidebar-selected team; team-scoped secretaries still upload for their
  own assigned team, not another team.
- Upload UI explicitly names the destination team and Scout Year.
- Existing private Storage bucket, paths (<year>/<team>/<id>.pdf), preview,
  download, PDF-only and 10 MB rules remain unchanged.
- Migration 28 replaces only the SQL helper already called by metadata INSERT
  and private Storage INSERT policies; seasonal membership for scoped
  secretaries and physical current Scout Year for all uploads remain enforced.
- Archived years are never writable, even for managers.

## Deployment / database rollout
1. Check ScoutSVM production migration ledger, tables/functions and Storage
   policies (Migration 24 must already be present). Do not replay old migrations.
2. Review and run supabase/28_secretary_manager_cross_team_upload.sql on the
   correct ScoutSVM database only if this update is not already present.
3. Verify authenticated global secretary can upload a test PDF to a chosen team,
   that it appears in that team's forms tab, and that a team secretary cannot
   upload to a different team. Archived Scout Years remain read-only.

No production database was modified in this code release: the ScoutSVM
Supabase project is not among the available connected projects. Deploying
frontend without Migration 28 makes the upload control visible to managers,
but backend RLS will still refuse upload attempts until it is applied.
