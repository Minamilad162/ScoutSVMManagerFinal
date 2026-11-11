-- Release 130: read-only data quality inspection; DO NOT change production data.
-- Scout Year boundaries come from scout_years.start_date/end_date, NOT Jan-Dec.
-- Run in Supabase SQL Editor if you want to examine records that were linked to
-- the selected current year's terms but dated outside that year or term.

WITH current_year AS (
  SELECT id, name, start_date, end_date
  FROM public.scout_years
  WHERE is_current = TRUE
),
scoped_terms AS (
  SELECT t.id AS term_id, t.name AS term_name, t.start_date AS term_start,
         t.end_date AS term_end, y.name AS scout_year,
         y.start_date AS year_start, y.end_date AS year_end
  FROM public.terms t
  JOIN current_year y ON y.id = t.scout_year_id
)
SELECT st.scout_year, st.term_name, e.team_id, e.id AS expense_id,
       e.expense_date, e.total,
       CASE
         WHEN e.expense_date < st.year_start OR e.expense_date > st.year_end
           THEN 'OUTSIDE_SCOUT_YEAR'
         WHEN st.term_start IS NOT NULL AND e.expense_date < st.term_start
           THEN 'BEFORE_TERM'
         WHEN st.term_end IS NOT NULL AND e.expense_date > st.term_end
           THEN 'AFTER_TERM'
         ELSE 'IN_RANGE'
       END AS date_quality
FROM public.expenses e
JOIN scoped_terms st ON st.term_id = e.term_id
WHERE e.soft_deleted_at IS NULL
  AND (e.expense_date < st.year_start OR e.expense_date > st.year_end
       OR (st.term_start IS NOT NULL AND e.expense_date < st.term_start)
       OR (st.term_end IS NOT NULL AND e.expense_date > st.term_end))
ORDER BY e.expense_date, st.term_name;
