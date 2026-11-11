-- Read only: run BEFORE migration 26, on the REAL ScoutSVM Supabase project.
SELECT 'image_path_column' AS check_name, count(*)::text AS current_value
FROM information_schema.columns
WHERE table_schema='public' AND table_name='materials' AND column_name='image_path'
UNION ALL
SELECT 'material_images_bucket', count(*)::text FROM storage.buckets WHERE id='material-images'
UNION ALL
SELECT 'material_images_policies', count(*)::text FROM pg_policies
WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'material images%';

-- Avoid selecting image_path before migration 26; it may not exist.
