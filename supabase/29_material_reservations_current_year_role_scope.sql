-- ScoutSVM Release 142 — align material booking RLS with active role assignments.
-- Preflight the production schema and migration ledger before applying.
-- Existing reservations, inventory, and historical Scout Years are untouched.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.material_reservations') IS NULL
    OR to_regclass('public.scout_years') IS NULL
    OR to_regclass('public.user_role_assignments') IS NULL
    OR to_regclass('public.member_season_assignments') IS NULL
    OR to_regclass('public.roles') IS NULL THEN
    RAISE EXCEPTION 'Required ScoutSVM tables missing; do not apply migration 29';
  END IF;
  IF to_regprocedure('public.has_role(text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Existing admin authorization function missing; do not apply migration 29';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.material_booking_can_write(p_team uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND p_team IS NOT NULL AND (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.scout_years sy
      JOIN public.user_role_assignments ura
        ON ura.scout_year_id = sy.id AND ura.user_id = auth.uid() AND ura.is_active IS TRUE
      JOIN public.roles r ON r.id = ura.role_id
      WHERE sy.is_current IS TRUE
        AND r.role_slug IN ('responsable_materials', 'chef_de_legion')
        AND (ura.team_id = p_team OR (r.role_slug = 'responsable_materials' AND ura.team_id IS NULL))
        AND EXISTS (
          SELECT 1 FROM public.member_season_assignments msa
          JOIN public.members m ON m.id = msa.member_id
          WHERE m.auth_user_id = auth.uid() AND msa.scout_year_id = sy.id AND msa.is_active IS TRUE
        )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.material_booking_can_write(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.material_booking_can_write(uuid) TO authenticated;

ALTER TABLE public.material_reservations ENABLE ROW LEVEL SECURITY;
-- Replace the legacy member.team_id write policy; preserve existing read policies.
DROP POLICY IF EXISTS "matres modify by team" ON public.material_reservations;
DROP POLICY IF EXISTS "material bookings active role select" ON public.material_reservations;
DROP POLICY IF EXISTS "material bookings active role insert" ON public.material_reservations;
DROP POLICY IF EXISTS "material bookings active role update" ON public.material_reservations;

CREATE POLICY "material bookings active role select" ON public.material_reservations
  FOR SELECT TO authenticated USING (public.material_booking_can_write(team_id));
CREATE POLICY "material bookings active role insert" ON public.material_reservations
  FOR INSERT TO authenticated WITH CHECK (public.material_booking_can_write(team_id));
CREATE POLICY "material bookings active role update" ON public.material_reservations
  FOR UPDATE TO authenticated
  USING (public.material_booking_can_write(team_id))
  WITH CHECK (public.material_booking_can_write(team_id));
COMMIT;
