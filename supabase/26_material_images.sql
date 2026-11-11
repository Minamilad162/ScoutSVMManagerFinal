-- Release 138: image for each inventory material, visible in material reservation cards.
-- Apply ONLY after read-only checking the migration ledger and the actual remote schema.
-- Additive: does not alter existing reservation/quantity logic or pre-existing images.
BEGIN;

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS image_path text;

-- Public product catalogue imagery, with private write rights. Do not store member photos here.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('material-images', 'material-images', true, 3145728, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "material images admin upload" ON storage.objects;
CREATE POLICY "material images admin upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'material-images'
  AND (SELECT public.has_role('admin') OR public.has_role('responsable_materials'))
  AND EXISTS (
    SELECT 1 FROM public.materials m
    WHERE m.id::text = split_part(name, '/', 1)
  )
  AND name ~* '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$'
);

-- Images are public; only inventory admins can list and delete objects.
DROP POLICY IF EXISTS "material images admin list" ON storage.objects;
CREATE POLICY "material images admin list" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'material-images'
  AND (SELECT public.has_role('admin') OR public.has_role('responsable_materials'))
);

DROP POLICY IF EXISTS "material images admin remove" ON storage.objects;
CREATE POLICY "material images admin remove" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'material-images'
  AND (SELECT public.has_role('admin') OR public.has_role('responsable_materials'))
);

-- Public `materials` table already has RLS and a SELECT policy; no new table grants needed.
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Read-only verification after applying:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='materials' AND column_name='image_path';
-- SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='material-images';
-- SELECT policyname, cmd FROM pg_policies WHERE schemaname='storage'
-- AND tablename='objects' AND policyname LIKE 'material images%';
