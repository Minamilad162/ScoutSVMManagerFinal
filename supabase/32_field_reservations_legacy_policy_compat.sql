-- ScoutSVM Release 149 / Migration 32: preserve pre-existing field-reservation policies.
-- Migration 31 intentionally blocked the four existing custom write policies:
--   field_res admin write, field_res team upd, field_res team writers, fres_write_team
-- PostgreSQL: permissive policies OR together; restrictive policies AND together.
-- This compatibility overlay ADDS an authenticated allow policy plus a mandatory
-- restrictive guard, without dropping or changing any unknown production policies.
-- It does not remove or modify any reservation rows. Read first:
-- FIELD_RESERVATION_RLS_POLICY_AUDIT_READ_ONLY.sql
BEGIN;

DO $preflight$
DECLARE
  missing_tables text;
  missing_columns text;
  other_restrictive_policies text;
BEGIN
  SELECT string_agg(t.tbl, ', ' ORDER BY t.tbl) INTO missing_tables
  FROM (VALUES
    ('field_reservations'), ('members'), ('member_season_assignments'),
    ('user_role_assignments'), ('scout_years'), ('roles')
  ) AS t(tbl)
  WHERE to_regclass('public.' || t.tbl) IS NULL;

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 32 blocked: required tables missing: %', missing_tables;
  END IF;
  IF to_regprocedure('public.has_role(text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Migration 32 blocked: public.has_role(text,uuid) function is missing';
  END IF;

  SELECT string_agg(t.tbl || '.' || t.col, ', ' ORDER BY t.tbl,t.col) INTO missing_columns
  FROM (VALUES
    ('field_reservations','team_id'), ('field_reservations','starts_at'),
    ('field_reservations','ends_at'), ('members','auth_user_id'),
    ('member_season_assignments','member_id'),
    ('member_season_assignments','scout_year_id'),
    ('member_season_assignments','team_id'), ('member_season_assignments','is_active'),
    ('user_role_assignments','user_id'),
    ('user_role_assignments','scout_year_id'),
    ('user_role_assignments','team_id'), ('user_role_assignments','is_active'),
    ('user_role_assignments','role_id'), ('roles','id'), ('roles','role_slug'),
    ('scout_years','id'), ('scout_years','is_current'),
    ('scout_years','start_date'), ('scout_years','end_date')
  ) AS t(tbl,col)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=t.tbl AND c.column_name=t.col
  );
  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 32 blocked: required columns missing: %', missing_columns;
  END IF;
  IF (SELECT count(*) FROM public.scout_years WHERE is_current IS TRUE) <> 1 THEN
    RAISE EXCEPTION 'Migration 32 blocked: expected exactly one current Scout Year';
  END IF;

  -- Unknown RESTRICTIVE policies may block valid users despite the new allow
  -- policies. Inspect them first, rather than deleting or bypassing them.
  SELECT string_agg(p.policyname || ' (' || p.cmd || ')', ', ' ORDER BY p.policyname)
    INTO other_restrictive_policies
  FROM pg_policies p
  WHERE p.schemaname='public' AND p.tablename='field_reservations'
    AND p.permissive='RESTRICTIVE'
    AND p.cmd IN ('ALL','SELECT','INSERT','UPDATE')
    AND p.policyname NOT IN (
      'field bookings compat mandatory insert 32',
      'field bookings compat mandatory update 32'
    );

  IF other_restrictive_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 32 blocked: inspect pre-existing restrictive policies: %', other_restrictive_policies;
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

-- Idempotently replace ONLY Release-149-owned policies. All four production
-- legacy/custom policies are deliberately preserved, regardless of their names.
DROP POLICY IF EXISTS "field bookings compat allow select 32" ON public.field_reservations;
DROP POLICY IF EXISTS "field bookings compat allow insert 32" ON public.field_reservations;
DROP POLICY IF EXISTS "field bookings compat allow update 32" ON public.field_reservations;
DROP POLICY IF EXISTS "field bookings compat mandatory insert 32" ON public.field_reservations;
DROP POLICY IF EXISTS "field bookings compat mandatory update 32" ON public.field_reservations;

-- INSERT ... RETURNING id must also see the new row.
CREATE POLICY "field bookings compat allow select 32" ON public.field_reservations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR (
      public.field_booking_can_write(team_id)
      AND public.field_booking_is_current_year(starts_at, ends_at)
    )
  );

-- Permissive allow policy lets current-year authorized users book even if
-- old policies still compare against a previous year's members.team_id.
CREATE POLICY "field bookings compat allow insert 32" ON public.field_reservations
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.field_booking_can_write(team_id)
    AND public.field_booking_is_current_year(starts_at, ends_at)
  );

CREATE POLICY "field bookings compat allow update 32" ON public.field_reservations
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    public.field_booking_can_write(team_id)
    AND public.field_booking_is_current_year(starts_at, ends_at)
  )
  WITH CHECK (
    public.field_booking_can_write(team_id)
    AND public.field_booking_is_current_year(starts_at, ends_at)
  );

-- Restrictive policies combine with ALL permissive policies via AND:
-- no old permissive INSERT/UPDATE policy can bypass this authorization.
-- TO PUBLIC also prevents an old public/anon policy from bypassing these checks.
CREATE POLICY "field bookings compat mandatory insert 32" ON public.field_reservations
  AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK (
    public.field_booking_can_write(team_id)
    AND public.field_booking_is_current_year(starts_at, ends_at)
  );

CREATE POLICY "field bookings compat mandatory update 32" ON public.field_reservations
  AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING (
    public.field_booking_can_write(team_id)
    AND public.field_booking_is_current_year(starts_at, ends_at)
  )
  WITH CHECK (
    public.field_booking_can_write(team_id)
    AND public.field_booking_is_current_year(starts_at, ends_at)
  );

GRANT SELECT, INSERT, UPDATE ON public.field_reservations TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
