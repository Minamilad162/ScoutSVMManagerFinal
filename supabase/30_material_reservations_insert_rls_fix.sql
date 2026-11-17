-- ScoutSVM Release 147 / Migration 30
-- Fix material_reservations INSERT/UPDATE RLS for active-year Chef de legion and Materials Responsible.
-- Safe whether Migration 29 was skipped or previously applied. No reservation data changes.
-- FIRST inspect MATERIAL_RESERVATION_RLS_PREFLIGHT_READ_ONLY.sql against the target ScoutSVM project.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.material_reservations') IS NULL
    OR to_regclass('public.members') IS NULL
    OR to_regclass('public.member_season_assignments') IS NULL
    OR to_regclass('public.user_role_assignments') IS NULL
    OR to_regclass('public.scout_years') IS NULL
    OR to_regclass('public.roles') IS NULL
  THEN
    RAISE EXCEPTION 'Required ScoutSVM reservation/year/role tables are missing';
  END IF;

  IF to_regprocedure('public.has_role(text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Missing admin authorization function public.has_role(text,uuid)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'member_season_assignments'
      AND column_name = 'team_id'
  ) THEN
    RAISE EXCEPTION 'member_season_assignments.team_id is missing; inspect Scout Year schema before proceeding';
  END IF;

  IF (SELECT COUNT(*) FROM public.scout_years WHERE is_current IS TRUE) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one current Scout Year; resolve this first';
  END IF;
END
$preflight$;

-- Explicitly limit the helper to authenticated users. The function reads active-year
-- assignments under a fixed search_path, not user-editable JWT metadata.
CREATE OR REPLACE FUNCTION public.material_booking_can_write(p_team uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $authorize$
  SELECT auth.uid() IS NOT NULL
     AND p_team IS NOT NULL
     AND (
       public.has_role('admin')
       OR EXISTS (
         SELECT 1
         FROM public.scout_years sy
         JOIN public.member_season_assignments msa
           ON msa.scout_year_id = sy.id
          AND msa.is_active IS TRUE
         JOIN public.members m
           ON m.id = msa.member_id
          AND m.auth_user_id = auth.uid()
         JOIN public.user_role_assignments ura
           ON ura.scout_year_id = sy.id
          AND ura.user_id = auth.uid()
          AND ura.is_active IS TRUE
         JOIN public.roles r
           ON r.id = ura.role_id
         WHERE sy.is_current IS TRUE
           AND (
             -- General Materials Responsible can book for every team.
             (r.role_slug = 'responsable_materials'
               AND (ura.team_id IS NULL OR ura.team_id = p_team))
             OR
             -- Team-scoped leader books their assigned team. A global leader
             -- can only book the team on their current-year member assignment.
             (r.role_slug = 'chef_de_legion'
               AND (ura.team_id = p_team
                 OR (ura.team_id IS NULL AND msa.team_id = p_team)))
           )
       )
     );
$authorize$;

REVOKE ALL ON FUNCTION public.material_booking_can_write(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.material_booking_can_write(uuid) TO authenticated;

ALTER TABLE public.material_reservations ENABLE ROW LEVEL SECURITY;
-- Only replace known legacy and Migration 29 write policies. Keep existing read
-- policies and reservation records untouched.
DROP POLICY IF EXISTS "matres modify by team" ON public.material_reservations;
DROP POLICY IF EXISTS "material bookings active role select" ON public.material_reservations;
DROP POLICY IF EXISTS "material bookings active role insert" ON public.material_reservations;
DROP POLICY IF EXISTS "material bookings active role update" ON public.material_reservations;

CREATE POLICY "material bookings active role select" ON public.material_reservations
  FOR SELECT TO authenticated
  USING (public.material_booking_can_write(team_id));

CREATE POLICY "material bookings active role insert" ON public.material_reservations
  FOR INSERT TO authenticated
  WITH CHECK (public.material_booking_can_write(team_id));

CREATE POLICY "material bookings active role update" ON public.material_reservations
  FOR UPDATE TO authenticated
  USING (public.material_booking_can_write(team_id))
  WITH CHECK (public.material_booking_can_write(team_id));

-- Table grants and RLS are separate; INSERT/SELECT/UPDATE are required for
-- confirmations and soft-cancellation. RLS still controls the permitted rows.
GRANT SELECT, INSERT, UPDATE ON TABLE public.material_reservations TO authenticated;
COMMIT;

-- Refresh PostgREST RPC metadata after introducing/replacing the helper.
NOTIFY pgrst, 'reload schema';
