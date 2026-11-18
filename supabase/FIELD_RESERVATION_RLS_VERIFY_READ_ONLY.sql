-- ScoutSVM field reservation RLS verification — READ ONLY.
-- Run after successfully applying Migration 31 in the ScoutSVM project.
SELECT
 to_regprocedure('public.field_booking_can_write(uuid)') IS NOT NULL AS booking_helper_ready,
 to_regprocedure('public.field_booking_is_current_year(timestamptz,timestamptz)') IS NOT NULL AS date_helper_ready,
 (SELECT count(*) FROM pg_policies
   WHERE schemaname='public' AND tablename='field_reservations'
   AND policyname IN ('field bookings active role select',
       'field bookings active role insert','field bookings active role update')) AS new_policy_count,
 (SELECT count(*) FROM pg_policies
   WHERE schemaname='public' AND tablename='field_reservations'
   AND policyname IN ('field_res read by team','field_res modify by team')) AS old_policy_count,
 has_table_privilege('authenticated','public.field_reservations','INSERT') AS grant_insert,
 has_table_privilege('authenticated','public.field_reservations','UPDATE') AS grant_update;
-- SQL Editor uses an elevated role: this cannot verify a real signed-in
-- chef's authorization. Test as a user in the application afterward.
