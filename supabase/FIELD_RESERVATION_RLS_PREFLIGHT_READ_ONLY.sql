-- ScoutSVM field reservation RLS preflight — READ ONLY.
-- Run on the same Supabase project used by the live ScoutSVM site.
-- This first query lists missing tables by exact name without referencing them.
WITH required(name) AS (
 VALUES ('field_reservations'), ('members'),
        ('member_season_assignments'), ('user_role_assignments'),
        ('scout_years'), ('roles')
)
SELECT name, CASE WHEN to_regclass('public.' || name) IS NULL
 THEN 'MISSING' ELSE 'OK' END AS status
FROM required ORDER BY name;

-- Inspect the live policies and their SQL predicates.
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='field_reservations'
ORDER BY policyname;

-- Inspect table-level Data API grants; no data is modified.
SELECT
 to_regprocedure('public.has_role(text,uuid)') IS NOT NULL AS admin_helper_exists,
 to_regprocedure('public.field_booking_can_write(uuid)') IS NOT NULL AS field_helper_exists,
 has_table_privilege('authenticated','public.field_reservations','SELECT') AS authenticated_select,
 has_table_privilege('authenticated','public.field_reservations','INSERT') AS authenticated_insert,
 has_table_privilege('authenticated','public.field_reservations','UPDATE') AS authenticated_update
WHERE to_regclass('public.field_reservations') IS NOT NULL;

-- Verify schema shape, including current-year team links.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('field_reservations','member_season_assignments',
                     'user_role_assignments','scout_years')
  AND column_name IN ('team_id','scout_year_id','user_id','member_id',
                      'starts_at','ends_at','is_current','start_date',
                      'end_date','is_active')
ORDER BY table_name,column_name;
