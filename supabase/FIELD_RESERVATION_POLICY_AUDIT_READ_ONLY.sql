-- ScoutSVM Release 149: READ-ONLY policy audit; no DDL or data writes.
-- Run in the Supabase project actually used by scout-svm.pages.dev.
SELECT
  policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'field_reservations'
ORDER BY CASE permissive WHEN 'RESTRICTIVE' THEN 0 ELSE 1 END, cmd, policyname;

-- All four reported policies should appear, including their full expressions.
SELECT
  policyname, cmd, permissive, roles,
  COALESCE(qual,'—') AS using_expression,
  COALESCE(with_check,'—') AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'field_reservations'
  AND policyname IN (
    'field_res admin write','field_res team upd',
    'field_res team writers','fres_write_team'
  )
ORDER BY policyname;

SELECT to_regclass('public.field_reservations') AS reservation_table,
       to_regprocedure('public.has_role(text,uuid)') AS admin_helper,
       to_regprocedure('public.field_booking_can_write(uuid)') AS booking_helper,
       (SELECT count(*) FROM public.scout_years WHERE is_current IS TRUE) AS current_year_count,
       has_table_privilege('authenticated','public.field_reservations','INSERT') AS insert_granted,
       has_table_privilege('authenticated','public.field_reservations','SELECT') AS select_granted,
       has_table_privilege('authenticated','public.field_reservations','UPDATE') AS update_granted;
