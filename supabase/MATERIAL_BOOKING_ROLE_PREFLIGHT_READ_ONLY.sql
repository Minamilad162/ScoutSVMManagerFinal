-- Read-only. Run on ScoutSVM BEFORE changing the reservation policies.
SELECT
  to_regclass('public.material_reservations') IS NOT NULL AS reservations_exist,
  to_regclass('public.user_role_assignments') IS NOT NULL AS seasonal_roles_exist,
  to_regclass('public.member_season_assignments') IS NOT NULL AS seasonal_members_exist,
  to_regprocedure('public.has_role(text,uuid)') IS NOT NULL AS admin_role_helper_exists,
  to_regprocedure('public.material_booking_can_write(uuid)') IS NOT NULL AS migration_29_helper_exists;

SELECT sy.id, sy.name, sy.is_current,
 COUNT(*) FILTER (WHERE ura.is_active IS TRUE AND r.role_slug = 'chef_de_legion') AS leaders,
 COUNT(*) FILTER (WHERE ura.is_active IS TRUE AND r.role_slug = 'responsable_materials') AS materials_responsibles
FROM public.scout_years sy
LEFT JOIN public.user_role_assignments ura ON ura.scout_year_id = sy.id
LEFT JOIN public.roles r ON r.id = ura.role_id
WHERE sy.is_current IS TRUE
GROUP BY sy.id, sy.name, sy.is_current;

SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'material_reservations'
ORDER BY policyname;
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'material_reservations'
AND grantee IN ('authenticated', 'anon') ORDER BY grantee, privilege_type;
