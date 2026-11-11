-- ScoutSVM Release 139: fix material photo uploads rejected by storage.objects RLS.
-- This is a focused FOLLOW-UP to Migration 26. Do NOT replay 26, drop the bucket,
-- edit storage.objects rows, or change any existing material / reservation data.
-- Read-only preflight: MATERIAL_IMAGES_RLS_PREFLIGHT_READ_ONLY.sql
-- Apply only to the confirmed ScoutSVM project after checking the migration ledger.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'materials'
                   AND column_name = 'image_path') THEN
    RAISE EXCEPTION 'Migration 26 is missing: public.materials.image_path does not exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'material-images') THEN
    RAISE EXCEPTION 'Migration 26 is missing: material-images Storage bucket does not exist';
  END IF;
END $$;

-- The old policy required an existing visible materials row in storage.objects
-- INSERT. That extra cross-table check caused legitimate uploads to fail and
-- prevented a photo-first save for newly-created materials. Only a signed-in
-- global materials manager / admin can still write, and the path must consist
-- of two UUIDs plus a safe image extension. Bucket size and MIME restrictions
-- remain unchanged (3MB; JPG, PNG, WebP).
DROP POLICY IF EXISTS "material images admin upload" ON storage.objects;
CREATE POLICY "material images admin upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'material-images'
  AND (SELECT public.has_role('admin') OR public.has_role('responsable_materials'))
  AND name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
);
-- Keep existing material-images SELECT and DELETE policies from Migration 26.
-- Do not create an UPDATE policy: uploads use upsert=false (unique object names).
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Verification (READ ONLY):
-- SELECT policyname, cmd, roles, with_check FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname LIKE 'material images%';
