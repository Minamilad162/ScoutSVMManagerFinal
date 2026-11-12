-- ScoutSVM Release 140; READ ONLY. Execute on the intended ScoutSVM database.
SELECT to_regclass('public.secretary_forms') IS NOT NULL AS forms_table_exists,
       to_regclass('public.user_role_assignments') IS NOT NULL AS seasonal_roles_exist,
       to_regclass('public.member_season_assignments') IS NOT NULL AS seasonal_members_exist,
       to_regprocedure('public.secretary_forms_can_upload(uuid,uuid)') IS NOT NULL AS upload_function_exists,
       to_regprocedure('public.secretary_forms_can_upload_path(text)') IS NOT NULL AS path_function_exists;

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id = 'secretary-forms';

SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE (schemaname='public' AND tablename='secretary_forms')
   OR (schemaname='storage' AND tablename='objects' AND policyname LIKE 'secretary forms%')
ORDER BY schemaname, tablename, policyname;

SELECT pg_get_functiondef(to_regprocedure('public.secretary_forms_can_upload(uuid,uuid)'));
