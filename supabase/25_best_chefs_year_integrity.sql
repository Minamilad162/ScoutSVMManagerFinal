-- Release 134 - Best-chefs year/term integrity.
-- APPLY ONLY after a read-only audit and remote migration-ledger check.
-- Does not delete, reassign, or modify any existing term_best_chefs rows.
BEGIN;

-- Reject future cross-year writes even if a caller submits the wrong IDs.
CREATE OR REPLACE FUNCTION public.validate_term_best_chefs_year()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_term_scout_year_id uuid;
BEGIN
  SELECT scout_year_id INTO v_term_scout_year_id
  FROM public.terms
  WHERE id = NEW.term_id;

  IF v_term_scout_year_id IS NULL OR NEW.scout_year_id IS DISTINCT FROM v_term_scout_year_id THEN
    RAISE EXCEPTION 'Best-chefs Scout Year must match the selected term'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_term_best_chefs_year ON public.term_best_chefs;
CREATE TRIGGER trg_term_best_chefs_year
BEFORE INSERT OR UPDATE ON public.term_best_chefs
FOR EACH ROW EXECUTE FUNCTION public.validate_term_best_chefs_year();

-- Keep original view fields and access behavior; reject records whose stored
-- Scout Year disagrees with their term. Never silently relocate old records.
CREATE OR REPLACE VIEW public.v_term_best_chefs_readable AS
SELECT
  btc.id,
  btc.scout_year_id,
  btc.term_id,
  t.name AS term_name,
  btc.member_id,
  m.full_name,
  msa.team_id,
  tm.name AS team_name,
  m.avatar_url,
  btc.sort_order,
  btc.note,
  btc.selected_by,
  btc.created_at,
  btc.updated_at
FROM public.term_best_chefs btc
JOIN public.terms t
  ON t.id = btc.term_id AND t.scout_year_id = btc.scout_year_id
JOIN public.members m
  ON m.id = btc.member_id
LEFT JOIN public.member_season_assignments msa
  ON msa.member_id = btc.member_id
  AND msa.scout_year_id = btc.scout_year_id
  AND msa.is_active = true
LEFT JOIN public.teams tm
  ON tm.id = msa.team_id;

COMMIT;
