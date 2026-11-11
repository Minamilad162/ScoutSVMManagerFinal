-- Run AFTER applying the Release 132 migration (READ ONLY).
SELECT to_regclass('public.secretary_forms') AS forms_table;

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'secretary_forms'
ORDER BY policyname;

SELECT policyname, cmd
FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
  AND policyname LIKE 'secretary forms%'
ORDER BY policyname;

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id='secretary-forms';

SELECT f.scout_year_id, f.team_id, count(*) AS forms_count
FROM public.secretary_forms f GROUP BY f.scout_year_id, f.team_id
ORDER BY f.scout_year_id, f.team_id;

-- Run after a test upload. Both storage metadata and audit must exist for every new form.
SELECT f.id, f.scout_year_id, f.team_id, f.title,
  EXISTS (SELECT 1 FROM storage.objects o
          WHERE o.bucket_id='secretary-forms' AND o.name=f.storage_path) AS storage_metadata_exists,
  EXISTS (SELECT 1 FROM public.audit_log a
          WHERE a.entity_type='secretary_forms' AND a.entity_id=f.id AND a.action='INSERT') AS audit_exists
FROM public.secretary_forms f ORDER BY f.created_at DESC LIMIT 20;
