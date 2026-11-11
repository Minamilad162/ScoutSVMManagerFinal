-- Read-only diagnosis for /app/best-chefs (run in ScoutSVM Supabase SQL Editor).
-- Does not delete or change any records, including historical selections.

-- 1. Count stored selections by ACTUAL term year and the year recorded on selection.
SELECT
  term_year.name AS term_scout_year,
  stored_year.name AS saved_scout_year,
  t.name AS term_name,
  t.start_date,
  t.end_date,
  COUNT(*) AS selected_count,
  COUNT(*) FILTER (WHERE b.scout_year_id IS DISTINCT FROM t.scout_year_id) AS mismatched_year_count,
  MIN(b.created_at) AS first_recorded_at,
  MAX(b.created_at) AS last_recorded_at
FROM public.term_best_chefs b
JOIN public.terms t ON t.id = b.term_id
LEFT JOIN public.scout_years term_year ON term_year.id = t.scout_year_id
LEFT JOIN public.scout_years stored_year ON stored_year.id = b.scout_year_id
GROUP BY term_year.name, stored_year.name, t.id, t.name, t.start_date, t.end_date
ORDER BY term_year.name DESC, t.start_date, stored_year.name;

-- 2. The exact source of the rows visible in the selected 2026/2027 year.
-- Review selected_by, created_at and whether the selection belongs to its term.
SELECT
  b.id AS selection_id,
  sy.name AS term_scout_year,
  stored_sy.name AS saved_scout_year,
  t.name AS term_name,
  m.full_name,
  b.selected_by AS recorded_actor_user_id,
  b.created_at,
  b.updated_at,
  (b.scout_year_id = t.scout_year_id) AS term_year_matches
FROM public.term_best_chefs b
JOIN public.terms t ON t.id = b.term_id
JOIN public.members m ON m.id = b.member_id
JOIN public.scout_years sy ON sy.id = t.scout_year_id
LEFT JOIN public.scout_years stored_sy ON stored_sy.id = b.scout_year_id
WHERE sy.name ILIKE '%2026%2027%'
ORDER BY t.start_date, b.sort_order, b.created_at;

-- 3. Any wrong-year links (preserved for review, never automatically moved/deleted).
SELECT
  b.id AS selection_id,
  b.term_id,
  b.scout_year_id AS saved_scout_year_id,
  t.scout_year_id AS expected_term_scout_year_id,
  b.member_id,
  b.created_at
FROM public.term_best_chefs b
JOIN public.terms t ON t.id = b.term_id
WHERE b.scout_year_id IS DISTINCT FROM t.scout_year_id
ORDER BY b.created_at DESC;
