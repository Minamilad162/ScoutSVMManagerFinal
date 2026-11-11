-- ScoutSVM Release 132 — private team secretary PDF forms
-- Run AFTER preflight on the correct ScoutSVM database and its migration ledger.
-- Additive only: does not touch existing secretary members, meetings, or attachments.
BEGIN;

CREATE TABLE IF NOT EXISTS public.secretary_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  scout_year_id uuid NOT NULL REFERENCES public.scout_years(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  file_name text NOT NULL CHECK (length(btrim(file_name)) BETWEEN 1 AND 255),
  storage_path text NOT NULL UNIQUE,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 10485760),
  uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT secretary_forms_path_matches_scope CHECK (
    storage_path = scout_year_id::text || '/' || team_id::text || '/' || id::text || '.pdf'
  )
);
CREATE INDEX IF NOT EXISTS idx_secretary_forms_year_team_created
  ON public.secretary_forms (scout_year_id, team_id, created_at DESC);

-- Keep an audit entry for every successful document registration.
DROP TRIGGER IF EXISTS trg_audit_secretary_forms ON public.secretary_forms;
CREATE TRIGGER trg_audit_secretary_forms AFTER INSERT
ON public.secretary_forms FOR EACH ROW EXECUTE FUNCTION public.audit_on_change();

-- Only a team-scoped secretary in the PHYSICAL current Scout Year may upload.
-- Global secretary / admin can view across teams, but do not receive write
-- permission merely because they can open AdminSecretary.
-- Current-year season roles are authoritative, not stale legacy user_roles.
CREATE OR REPLACE FUNCTION public.secretary_forms_can_upload(p_team uuid, p_year uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.scout_years sy
    JOIN public.user_role_assignments ura ON ura.scout_year_id = sy.id
    JOIN public.roles r ON r.id = ura.role_id
    WHERE sy.id = p_year AND sy.is_current IS TRUE
      AND ura.user_id = auth.uid() AND ura.team_id = p_team
      AND ura.is_active IS TRUE AND r.role_slug = 'responsable_secretary'
      AND EXISTS (
        SELECT 1 FROM public.member_season_assignments msa
        JOIN public.members m ON m.id = msa.member_id
        WHERE m.auth_user_id = auth.uid() AND msa.scout_year_id = sy.id
          AND msa.is_active IS TRUE
      )
  );
$$;
REVOKE ALL ON FUNCTION public.secretary_forms_can_upload(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.secretary_forms_can_upload(uuid,uuid) TO authenticated;

-- Team-scoped secretary / team lead can read own team, global secretary and
-- permanent admin can read across teams (including an archived Scout Year).
CREATE OR REPLACE FUNCTION public.secretary_forms_can_read(p_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      JOIN public.roles r ON r.id = ura.role_id
      JOIN public.scout_years sy ON sy.id = ura.scout_year_id AND sy.is_current IS TRUE
      WHERE ura.user_id = auth.uid() AND ura.is_active IS TRUE
        AND r.role_slug IN ('responsable_secretary', 'chef_de_legion')
        AND (ura.team_id = p_team OR (r.role_slug = 'responsable_secretary' AND ura.team_id IS NULL))
    )
  );
$$;
REVOKE ALL ON FUNCTION public.secretary_forms_can_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.secretary_forms_can_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.secretary_forms_can_upload_path(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    AND EXISTS (
      SELECT 1 FROM public.scout_years sy
      JOIN public.teams tm ON tm.id::text = split_part(p_path, '/', 2)
      WHERE sy.id::text = split_part(p_path, '/', 1)
        AND public.secretary_forms_can_upload(tm.id, sy.id)
    );
$$;
REVOKE ALL ON FUNCTION public.secretary_forms_can_upload_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.secretary_forms_can_upload_path(text) TO authenticated;

ALTER TABLE public.secretary_forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "secretary forms read" ON public.secretary_forms;
CREATE POLICY "secretary forms read" ON public.secretary_forms
FOR SELECT TO authenticated USING (public.secretary_forms_can_read(team_id));
DROP POLICY IF EXISTS "secretary forms team secretary insert" ON public.secretary_forms;
CREATE POLICY "secretary forms team secretary insert" ON public.secretary_forms
FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid()
  AND public.secretary_forms_can_upload(team_id, scout_year_id)
);

-- Private Storage; no public URL and never use service_role in client.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('secretary-forms', 'secretary-forms', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "secretary forms object upload" ON storage.objects;
CREATE POLICY "secretary forms object upload" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'secretary-forms' AND public.secretary_forms_can_upload_path(name)
);
DROP POLICY IF EXISTS "secretary forms object read" ON storage.objects;
CREATE POLICY "secretary forms object read" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'secretary-forms'
  AND (
    EXISTS (SELECT 1 FROM public.secretary_forms form WHERE form.storage_path = name)
    OR (owner_id = auth.uid()::text AND public.secretary_forms_can_upload_path(name))
  )
);
-- Only own newly uploaded orphan objects can be cleaned up. No general delete UI.
DROP POLICY IF EXISTS "secretary forms orphan cleanup" ON storage.objects;
CREATE POLICY "secretary forms orphan cleanup" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'secretary-forms'
  AND owner_id = auth.uid()::text
  AND public.secretary_forms_can_upload_path(name)
);

-- Explicit Data API grants: grants and RLS are separate enforcement layers.
GRANT SELECT, INSERT ON public.secretary_forms TO authenticated;
REVOKE ALL ON public.secretary_forms FROM anon;

COMMIT;
