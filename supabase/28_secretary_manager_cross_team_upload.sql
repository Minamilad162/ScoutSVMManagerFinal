-- Release 140: allow the active global secretary and permanent Super Admin
-- to upload private team forms to ANY explicitly selected team in the PHYSICAL
-- current Scout Year. Team-scoped secretaries retain own-team-only access.
--
-- Requires Migration 24 (table, private bucket, object and metadata policies).
-- Replaces ONLY the permission predicate already used by those RLS policies;
-- existing PDFs, metadata, policies and archived Scout Years are unchanged.
-- IMPORTANT: preflight the actual ScoutSVM database and migration ledger first.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.secretary_forms') IS NULL
     OR to_regclass('public.user_role_assignments') IS NULL
     OR to_regclass('public.member_season_assignments') IS NULL THEN
    RAISE EXCEPTION 'ScoutSVM Migration 24 / seasonal role tables required before 28';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.secretary_forms_can_upload(p_team uuid, p_year uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.scout_years sy
      JOIN public.teams t ON t.id = p_team
      WHERE sy.id = p_year AND sy.is_current IS TRUE
        AND (
          -- Permanent Super Admin can manage forms for all teams.
          public.has_role('admin')
          OR EXISTS (
            SELECT 1
            FROM public.user_role_assignments ura
            JOIN public.roles r ON r.id = ura.role_id
            WHERE ura.user_id = auth.uid()
              AND ura.scout_year_id = sy.id
              AND ura.is_active IS TRUE
              AND r.role_slug = 'responsable_secretary'
              AND (
                -- Global secretary manager can upload for any chosen team.
                ura.team_id IS NULL
                OR (
                  -- Scoped secretary can upload ONLY to their own team,
                  -- provided their seasonal member account remains active.
                  ura.team_id = p_team
                  AND EXISTS (
                    SELECT 1
                    FROM public.member_season_assignments msa
                    JOIN public.members m ON m.id = msa.member_id
                    WHERE m.auth_user_id = auth.uid()
                      AND msa.scout_year_id = sy.id
                      AND msa.is_active IS TRUE
                  )
                )
              )
          )
        )
    );
$$;

-- Keep definer execution accessible only to signed-in callers; the function
-- checks auth.uid and current physical Scout Year internally.
REVOKE ALL ON FUNCTION public.secretary_forms_can_upload(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.secretary_forms_can_upload(uuid, uuid) TO authenticated;

-- Existing INSERT/RLS policies on public.secretary_forms and storage.objects
-- call secretary_forms_can_upload / secretary_forms_can_upload_path; therefore
-- they inherit the new scope WITHOUT replacement and WITHOUT broad grants.
COMMIT;

-- Non-mutating verification examples (run separately, not as service_role):
-- SELECT pg_get_functiondef('public.secretary_forms_can_upload(uuid,uuid)'::regprocedure);
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
-- WHERE (schemaname='public' AND tablename='secretary_forms')
--    OR (schemaname='storage' AND tablename='objects' AND policyname LIKE 'secretary forms%');
