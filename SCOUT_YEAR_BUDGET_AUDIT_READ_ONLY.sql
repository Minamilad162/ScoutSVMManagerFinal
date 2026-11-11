-- Release 131 / READ ONLY. Run BEFORE migration 23 to learn where budgets came from.
-- No INSERT, UPDATE, DELETE or schema mutation here.
-- 1. Each team budget's term and actual Scout Year; created_by and audit evidence.
SELECT
  sy.name AS scout_year, sy.is_current,
  sy.start_date AS year_start, sy.end_date AS year_end,
  t.name AS term_name, t.year AS term_label_year,
  tm.name AS team_name,
  b.id AS budget_id, b.amount_total,
  b.created_at AS budget_first_created_at,
  b.created_by AS budget_created_by,
  (b.created_at::date < sy.start_date) AS entered_before_scout_year_start,
  a.action AS last_logged_action,
  a.actor_user_id AS last_logged_actor,
  a.created_at AS last_logged_at,
  a.delta AS last_logged_change
FROM public.team_budgets b
JOIN public.terms t ON t.id = b.term_id
JOIN public.scout_years sy ON sy.id = t.scout_year_id
JOIN public.teams tm ON tm.id = b.team_id
LEFT JOIN LATERAL (
  SELECT action, actor_user_id, created_at, delta
  FROM public.audit_log al
  WHERE al.entity_type = 'team_budgets' AND al.entity_id = b.id
  ORDER BY created_at DESC LIMIT 1
) a ON TRUE
WHERE b.soft_deleted_at IS NULL
ORDER BY sy.start_date DESC, t.name, tm.name;

-- 2. Current-year budgets which will REQUIRE Super Admin confirmation in SQL23.
SELECT sy.name AS scout_year, t.name AS term, tm.name AS team,
       b.id AS budget_id, b.amount_total, b.created_at, b.created_by
FROM public.team_budgets b
JOIN public.terms t ON t.id = b.term_id
JOIN public.scout_years sy ON sy.id = t.scout_year_id
JOIN public.teams tm ON tm.id = b.team_id
WHERE sy.is_current IS TRUE AND b.soft_deleted_at IS NULL
ORDER BY t.name, tm.name;

-- 3. Terms assigned to no Scout Year (cannot be safely budgeted).
SELECT id, name, year, start_date, end_date
FROM public.terms WHERE scout_year_id IS NULL
ORDER BY year DESC, name;

-- 4. Actual financial records that might have been recorded under a term whose
--    date range does not include their expense_date.
SELECT sy.name, t.name AS term, e.id, e.expense_date, e.total,
       e.created_at, e.created_by
FROM public.expenses e
JOIN public.terms t ON t.id = e.term_id
JOIN public.scout_years sy ON sy.id = t.scout_year_id
WHERE e.soft_deleted_at IS NULL AND
      (e.expense_date < sy.start_date OR e.expense_date > sy.end_date OR
       (t.start_date IS NOT NULL AND e.expense_date < t.start_date) OR
       (t.end_date IS NOT NULL AND e.expense_date > t.end_date))
ORDER BY e.expense_date DESC;
