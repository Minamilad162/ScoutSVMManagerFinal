-- Read-only checks. Run in the ScoutSVM SQL editor BEFORE applying Migration 27.
-- SQL Editor uses a privileged SQL session, not the logged-in application's JWT:
-- the role catalog is informational; it cannot establish the user's runtime auth.uid().
SELECT 'image_path_column' AS check_name, EXISTS (
  SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND table_name='materials' AND column_name='image_path'
)::text AS result
UNION ALL
SELECT 'material_images_bucket', EXISTS (
  SELECT 1 FROM storage.buckets WHERE id='material-images'
)::text
UNION ALL
SELECT 'upload_policy', EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname='material images admin upload' AND cmd='INSERT'
)::text;

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id='material-images';

SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
  AND policyname LIKE 'material images%'
ORDER BY policyname;

-- Also verify the migration ledger in your project before any production write.
-- Never assume the SQL filename alone proves the remote migration was applied.
