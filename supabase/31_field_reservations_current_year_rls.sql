-- ScoutSVM Release 148 — Field reservation booking RLS
-- Apply only to the correct ScoutSVM Supabase project after reviewing
-- FIELD_RESERVATION_RLS_PREFLIGHT_READ_ONLY.sql.
-- All reservation records and historical Scout Years are preserved.
BEGIN;

DO $preflight$
DECLARE
  v_missing text;
  v_custom text;
  v_columns text;
BEGIN
  SELECT string_agg(t.name, ', ' ORDER BY t.name) INTO v_missing
  FROM (VALUES
     ('field_reservations'), ('members'), ('member_season_assignments'),
     ('user_role_assignments'), ('scout_years'), ('roles')
  ) AS t(name)
  WHERE to_regclass('public.' || t.name) IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'ScoutSVM field booking migration blocked; missing tables: %', v_missing;
  END IF;

  IF to_regprocedure('public.has_role(text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Missing authorization function public.has_role(text,uuid)';
  END IF;

  SELECT string_agg(t.tbl || '.' || t.col, ', ' ORDER BY t.tbl, t.col) INTO v_columns
  FROM (VALUES
    ('field_reservations','team_id'), ('field_reservations','starts_at'),
    ('field_reservations','ends_at'), ('members','auth_user_id'),
    ('member_season_assignments','member_id'),
    ('member_season_assignments','scout_year_id'),
    ('member_season_assignments','team_id'),
    ('member_season_assignments','is_active'),
    ('user_role_assignments','user_id'),
    ('user_role_assignments','scout_year_id'),
    ('user_role_assignments','team_id'),
    ('user_role_assignments','is_active'),
    ('scout_years','is_current'), ('scout_years','start_date'),
    ('scout_years','end_date'), ('roles','role_slug')
  ) AS t(tbl,col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=t.tbl AND c.column_name=t.col
  );
  IF v_columns IS NOT NULL THEN
    RAISE EXCEPTION 'ScoutSVM field booking migration blocked; missing columns: %', v_columns;
  END IF;

  IF (SELECT count(*) FROM public.scout_years WHERE is_current IS TRUE) <> 1 THEN
    RAISE EXCEPTION 'ScoutSVM field booking: expected exactly one current Scout Year';
  END IF;

  -- Refuse to silently bypass or delete custom write policies.
  SELECT string_agg(policyname, ', ' ORDER BY policyname) INTO v_custom
  FROM pg_policies
  WHERE schemaname='public' AND tablename='field_reservations'
    AND cmd IN ('ALL','INSERT','UPDATE')
    AND policyname NOT IN (
      'field_res modify by team',
      'field bookings active role insert',
      'field bookings active role update'
    );
  IF v_custom IS NOT NULL THEN
    RAISE EXCEPTION 'Review unexpected field reservation write policies before applying: %', v_custom;
  END IF;
END;
$preflight$;

-- Role and membership checks use trusted current-year database assignments,
-- never user-editable JWT metadata or a previous year's member.team_id.
CREATE OR REPLACE FUNCTION public.field_booking_can_write(p_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $role$
 SELECT auth.uid() IS NOT NULL AND p_team IS NOT NULL AND
 (
   public.has_role('admin')
   OR EXISTS (
     SELECT 1
     FROM public.scout_years sy
     JOIN public.member_season_assignments msa
       ON msa.scout_year_id = sy.id
      AND msa.is_active IS TRUE
      AND msa.team_id = p_team
     JOIN public.members m
       ON m.id = msa.member_id
      AND m.auth_user_id = auth.uid()
     JOIN public.user_role_assignments ura
       ON ura.user_id = auth.uid()
      AND ura.scout_year_id = sy.id
      AND ura.is_active IS TRUE
     JOIN public.roles r ON r.id = ura.role_id
     WHERE sy.is_current IS TRUE
       AND r.role_slug IN ('chef_de_legion','responsable_materials')
       AND (ura.team_id = p_team OR ura.team_id IS NULL)
   )
 );
$role$;

REVOKE ALL ON FUNCTION public.field_booking_can_write(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.field_booking_can_write(uuid) TO authenticated;

-- Restrict write operations to the physical current Scout Year in Cairo,
-- even if an API client tries to bypass the application's historical view.
CREATE OR REPLACE FUNCTION public.field_booking_is_current_year(p_start timestamptz, p_end timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $dates$
 SELECT auth.uid() IS NOT NULL AND p_start IS NOT NULL AND p_end IS NOT NULL
    AND p_end > p_start
    AND EXISTS (
      SELECT 1 FROM public.scout_years sy
      WHERE sy.is_current IS TRUE
        AND (p_start AT TIME ZONE 'Africa/Cairo')::date >= sy.start_date
        AND (p_end AT TIME ZONE 'Africa/Cairo')::date <= sy.end_date
    );
$dates$;

REVOKE ALL ON FUNCTION public.field_booking_is_current_year(timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.field_booking_is_current_year(timestamptz,timestamptz) TO authenticated;

ALTER TABLE public.field_reservations ENABLE ROW LEVEL SECURITY;

-- Replace only the original, known field reservation access rules.
DROP POLICY IF EXISTS "field_res modify by team" ON public.field_reservations;
DROP POLICY IF EXISTS "field_res read by team" ON public.field_reservations;
DROP POLICY IF EXISTS "field bookings active role select" ON public.field_reservations;
DROP POLICY IF EXISTS "field bookings active role insert" ON public.field_reservations;
DROP POLICY IF EXISTS "field bookings active role update" ON public.field_reservations;

-- SELECT is required for .insert(...).select('id').single() to return the new row.
-- Admin can review historical records, others only their current-year team's bookings.
CREATE POLICY "field bookings active role select" ON public.field_reservations
 FOR SELECT TO authenticated
 USING (
    public.has_role('admin')
    OR (
      public.field_booking_can_write(team_id)
      AND public.field_booking_is_current_year(starts_at,ends_at)
    )
 );

CREATE POLICY "field bookings active role insert" ON public.field_reservations
 FOR INSERT TO authenticated
 WITH CHECK (
   public.field_booking_can_write(team_id)
   AND public.field_booking_is_current_year(starts_at,ends_at)
 );

CREATE POLICY "field bookings active role update" ON public.field_reservations
 FOR UPDATE TO authenticated
 USING (
   public.field_booking_can_write(team_id)
   AND public.field_booking_is_current_year(starts_at,ends_at)
 )
 WITH CHECK (
   public.field_booking_can_write(team_id)
   AND public.field_booking_is_current_year(starts_at,ends_at)
 );

-- PostgreSQL Data API grants are separate from RLS. No DELETE permission is
-- granted here; cancellation uses a scoped soft-delete UPDATE.
GRANT SELECT, INSERT, UPDATE ON public.field_reservations TO authenticated;
COMMIT;

NOTIFY pgrst, 'reload schema';
