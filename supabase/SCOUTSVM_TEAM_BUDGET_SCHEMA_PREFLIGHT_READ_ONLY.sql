-- ScoutSVM /AdminFinance compatibility preflight (READ ONLY).
-- Run against the ScoutSVM project, NOT any other Supabase project.
-- Inspect the schema and migration ledger BEFORE applying SQL 23; no changes here.

SELECT 'public.team_budgets' AS object_name, wanted.column_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns c
         WHERE c.table_schema = 'public' AND c.table_name = 'team_budgets'
           AND c.column_name = wanted.column_name
       ) AS exists_in_database
FROM (VALUES ('scout_year_id'), ('confirmed_at'), ('confirmed_by')) AS wanted(column_name)
ORDER BY wanted.column_name;

SELECT 'public.v_team_budgets_effective' AS object_name,
       to_regclass('public.v_team_budgets_effective') IS NOT NULL AS exists_in_database;

SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'team_budgets'
ORDER BY trigger_name, event_manipulation;

-- Historical/current team and term counts; does not expose member personal data.
SELECT sy.name AS scout_year, sy.is_current, COUNT(b.id) AS budget_rows,
       COUNT(DISTINCT b.team_id) AS teams_with_budgets
FROM public.scout_years sy
JOIN public.terms t ON t.scout_year_id = sy.id
LEFT JOIN public.team_budgets b ON b.term_id = t.id AND b.soft_deleted_at IS NULL
GROUP BY sy.name, sy.is_current
ORDER BY sy.name DESC;

-- If the three columns + view are already present, but the API still reports a
-- missing column, the PostgREST schema cache might be stale. Recheck after a
-- cache reload; do not rerun the whole SQL 23 migration blindly.
