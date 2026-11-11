-- ScoutSVM Release 132 — READ ONLY preflight. Run against intended ScoutSVM DB only.
-- Confirm correct project before applying supabase/24_secretary_team_forms.sql.
SELECT current_database() AS database_name, current_schema() AS schema_name;

SELECT sy.id, sy.name, sy.status, sy.is_current, sy.start_date, sy.end_date
FROM public.scout_years sy ORDER BY sy.start_date DESC LIMIT 10;

-- Check the migration ledger in the Supabase Dashboard / CLI before applying.
-- If your project uses Supabase's standard migration ledger:
-- SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;

SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN
 ('scout_years','teams','members','member_season_assignments',
  'user_role_assignments','roles','audit_log','secretary_forms')
ORDER BY table_name;

SELECT column_name,data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='user_role_assignments'
ORDER BY ordinal_position;

SELECT bucket_id, count(*) AS existing_files
FROM storage.objects
WHERE bucket_id='secretary-forms' GROUP BY bucket_id;
