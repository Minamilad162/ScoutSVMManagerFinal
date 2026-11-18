-- ScoutSVM Release 149: READ-ONLY post-migration verification.
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies WHERE schemaname='public' AND tablename='field_reservations'
  AND policyname LIKE 'field bookings compat % 32'
ORDER BY policyname;

SELECT
  (SELECT count(*) FROM pg_policies
   WHERE schemaname='public' AND tablename='field_reservations'
     AND policyname IN (
       'field bookings compat allow select 32',
       'field bookings compat allow insert 32',
       'field bookings compat allow update 32',
       'field bookings compat mandatory insert 32',
       'field bookings compat mandatory update 32'
     )) AS expected_policy_count,
  (SELECT count(*) FROM pg_policies
   WHERE schemaname='public' AND tablename='field_reservations'
     AND permissive='RESTRICTIVE' AND policyname LIKE 'field bookings compat mandatory % 32'
   ) AS expected_restrictive_count,
  (SELECT count(*) FROM pg_policies
   WHERE schemaname='public' AND tablename='field_reservations'
     AND policyname IN ('field_res admin write','field_res team upd',
       'field_res team writers','fres_write_team')) AS original_custom_policy_count,
  has_table_privilege('authenticated','public.field_reservations','INSERT') AS insert_granted,
  has_table_privilege('authenticated','public.field_reservations','SELECT') AS select_granted,
  has_table_privilege('authenticated','public.field_reservations','UPDATE') AS update_granted;

-- Next: using a real signed-in Chef de Legion or Materials Responsible,
-- test one authorized booking, cross-team denial, and soft cancellation.
