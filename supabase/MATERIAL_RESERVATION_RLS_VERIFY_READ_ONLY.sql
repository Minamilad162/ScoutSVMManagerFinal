-- ScoutSVM Release 147: read-only POST migration checks.
SELECT
  to_regprocedure('public.material_booking_can_write(uuid)') IS NOT NULL AS booking_helper_exists,
  has_table_privilege('authenticated','public.material_reservations','INSERT') AS can_insert,
  has_table_privilege('authenticated','public.material_reservations','UPDATE') AS can_soft_cancel,
  (SELECT COUNT(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'material_reservations'
     AND policyname IN (
       'material bookings active role insert',
       'material bookings active role update',
       'material bookings active role select'
     )) AS expected_policy_count,
  (SELECT COUNT(*) FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'material_reservations'
     AND policyname = 'matres modify by team') AS legacy_write_policy_count;

-- Additional permission checks must run as the actual signed-in user via the app.
-- Supabase SQL Editor uses an administrative context and cannot prove end-user RLS access.
