-- ScoutSVM Release 147: READ ONLY inspection, no schema or data modifications.
-- Run in the exact Supabase project backing scout-svm.pages.dev.
SELECT
  to_regclass('public.material_reservations') IS NOT NULL AS reservations_table,
  to_regclass('public.member_season_assignments') IS NOT NULL AS seasonal_members_table,
  to_regclass('public.user_role_assignments') IS NOT NULL AS seasonal_roles_table,
  to_regprocedure('public.has_role(text,uuid)') IS NOT NULL AS admin_helper,
  to_regprocedure('public.material_booking_can_write(uuid)') IS NOT NULL AS booking_helper,
  has_table_privilege('authenticated','public.material_reservations','INSERT') AS authenticated_can_insert,
  has_table_privilege('authenticated','public.material_reservations','SELECT') AS authenticated_can_select,
  has_table_privilege('authenticated','public.material_reservations','UPDATE') AS authenticated_can_soft_cancel;

SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'material_reservations'
ORDER BY policyname;

SELECT id, name, start_date, end_date, is_current
FROM public.scout_years
WHERE is_current IS TRUE;

-- View the currently deployed helper; compare it to the migration.
SELECT pg_get_functiondef(to_regprocedure('public.material_booking_can_write(uuid)'))
WHERE to_regprocedure('public.material_booking_can_write(uuid)') IS NOT NULL;
