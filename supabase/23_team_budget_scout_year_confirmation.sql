-- Release 131: isolate team budgets per Scout Year; preserve old amounts and their audit history.
-- IMPORTANT: Apply ONCE only after checking the remote migration ledger/schema.
-- Current-year legacy rows remain stored, but require explicit Super Admin confirmation
-- before they are included in totals. Archived years keep their historical budgets.
BEGIN;

ALTER TABLE public.team_budgets
  ADD COLUMN IF NOT EXISTS scout_year_id uuid REFERENCES public.scout_years(id),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users(id);

-- The backfill is bookkeeping, not an administrator budget edit. Temporarily
-- suppress the existing audit and low-budget notifications for this UPDATE only;
-- restore only triggers that were enabled before the migration.
CREATE TEMP TABLE _r131_budget_triggers_restore ON COMMIT DROP AS
SELECT tgname FROM pg_catalog.pg_trigger
WHERE tgrelid = 'public.team_budgets'::regclass
  AND NOT tgisinternal AND tgenabled = 'O'
  AND tgname IN ('trg_audit_budget', 'trg_budget_notify');
DO $$ DECLARE v_name text; BEGIN
  FOR v_name IN SELECT tgname FROM _r131_budget_triggers_restore LOOP
    EXECUTE format('ALTER TABLE public.team_budgets DISABLE TRIGGER %I', v_name);
  END LOOP;
END $$;

-- Resolve ownership from each budget's TERM, never by created_at or calendar year.
UPDATE public.team_budgets b
SET scout_year_id = t.scout_year_id
FROM public.terms t
WHERE b.term_id = t.id
  AND t.scout_year_id IS NOT NULL
  AND b.scout_year_id IS DISTINCT FROM t.scout_year_id;

DO $$ DECLARE v_name text; BEGIN
  FOR v_name IN SELECT tgname FROM _r131_budget_triggers_restore LOOP
    EXECUTE format('ALTER TABLE public.team_budgets ENABLE TRIGGER %I', v_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_team_budgets_year_confirmed
  ON public.team_budgets (scout_year_id, confirmed_at)
  WHERE soft_deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_team_budget_scout_year()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE term_scout_year uuid;
BEGIN
  SELECT scout_year_id INTO term_scout_year
  FROM public.terms WHERE id = NEW.term_id;
  IF term_scout_year IS NULL THEN
    RAISE EXCEPTION 'Budget term has no Scout Year assignment' USING ERRCODE = '23514';
  END IF;
  IF NEW.scout_year_id IS NOT NULL AND NEW.scout_year_id <> term_scout_year THEN
    RAISE EXCEPTION 'Budget Scout Year must match its term' USING ERRCODE = '23514';
  END IF;
  NEW.scout_year_id := term_scout_year;
  IF TG_OP = 'INSERT' AND NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF NEW.confirmed_at IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.confirmed_by := auth.uid();
    ELSIF OLD.confirmed_at IS DISTINCT FROM NEW.confirmed_at THEN
      NEW.confirmed_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_team_budget_scout_year ON public.team_budgets;
CREATE TRIGGER trg_team_budget_scout_year BEFORE INSERT OR UPDATE
ON public.team_budgets FOR EACH ROW
EXECUTE FUNCTION public.validate_team_budget_scout_year();

-- Only Super Admin can assign/confirm a term budget (finance staff can read).
DROP POLICY IF EXISTS "budgets modify" ON public.team_budgets;
CREATE POLICY "budgets modify" ON public.team_budgets
FOR ALL TO authenticated
USING (public.has_role('admin'))
WITH CHECK (public.has_role('admin'));

-- Security-invoker means the base table's RLS is enforced for every viewer.
-- Pending legacy records from the CURRENT year are not counted anywhere.
-- Records from archived years are still visible in historical reports.
CREATE OR REPLACE VIEW public.v_team_budgets_effective
WITH (security_invoker = true) AS
SELECT b.id, b.team_id, b.term_id, b.amount_total, b.created_by,
       b.created_at, b.soft_deleted_at, b.scout_year_id,
       b.confirmed_at, b.confirmed_by
FROM public.team_budgets b
JOIN public.terms t ON t.id = b.term_id
JOIN public.scout_years sy ON sy.id = t.scout_year_id
WHERE b.soft_deleted_at IS NULL
  AND b.scout_year_id = t.scout_year_id
  AND (sy.is_current IS NOT TRUE OR b.confirmed_at IS NOT NULL);

GRANT SELECT ON public.v_team_budgets_effective TO authenticated;

-- Preserve existing 25% / 0% threshold behavior, but never notify on
-- unconfirmed legacy budgets or archived-year activity. This also restricts
-- spent to expenses inside the term AND current Scout Year.
CREATE OR REPLACE FUNCTION public.notify_budget_threshold()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t_team uuid;
  t_term uuid;
  total numeric;
  spent numeric;
  remaining numeric;
  chef_users uuid[];
  fin_users uuid[];
  period_start date;
  period_end date;
BEGIN
  IF TG_TABLE_NAME = 'expenses' OR TG_TABLE_NAME = 'team_budgets' THEN
    t_team := NEW.team_id;
    t_term := NEW.term_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT greatest(sy.start_date, coalesce(t.start_date, sy.start_date)),
         least(sy.end_date, coalesce(t.end_date, sy.end_date))
    INTO period_start, period_end
  FROM public.terms t
  JOIN public.scout_years sy ON sy.id = t.scout_year_id
  WHERE t.id = t_term AND sy.is_current IS TRUE;
  IF period_start IS NULL OR period_end IS NULL OR period_start > period_end THEN
    RETURN NEW;
  END IF;

  SELECT amount_total INTO total
  FROM public.v_team_budgets_effective
  WHERE team_id = t_team AND term_id = t_term;
  IF total IS NULL THEN RETURN NEW; END IF;

  SELECT coalesce(sum(e.total), 0) INTO spent
  FROM public.expenses e
  WHERE e.team_id = t_team AND e.term_id = t_term
    AND e.soft_deleted_at IS NULL
    AND e.expense_date BETWEEN period_start AND period_end;
  remaining := total - spent;

  SELECT array_agg(ur.user_id) INTO chef_users
  FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.team_id = t_team AND r.role_slug = 'chef_de_legion';
  SELECT array_agg(ur.user_id) INTO fin_users
  FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.team_id = t_team AND r.role_slug = 'responsable_finance';

  IF remaining <= 0 THEN
    PERFORM public.push_notification(chef_users, 'budget_depleted', jsonb_build_object('team_id', t_team, 'term_id', t_term, 'remaining', remaining));
    PERFORM public.push_notification(fin_users, 'budget_depleted', jsonb_build_object('team_id', t_team, 'term_id', t_term, 'remaining', remaining));
  ELSIF remaining <= total * 0.25 THEN
    PERFORM public.push_notification(chef_users, 'budget_low', jsonb_build_object('team_id', t_team, 'term_id', t_term, 'remaining', remaining));
    PERFORM public.push_notification(fin_users, 'budget_low', jsonb_build_object('team_id', t_team, 'term_id', t_term, 'remaining', remaining));
  END IF;
  RETURN NEW;
END $$;
COMMIT;

-- Verification (READ ONLY; run after applying the migration):
-- SELECT sy.name, sy.is_current,
--        COUNT(*) FILTER (WHERE b.confirmed_at IS NULL) AS pending,
--        COUNT(*) FILTER (WHERE b.confirmed_at IS NOT NULL) AS confirmed
-- FROM public.team_budgets b
-- JOIN public.terms t ON t.id = b.term_id
-- JOIN public.scout_years sy ON sy.id = t.scout_year_id
-- WHERE b.soft_deleted_at IS NULL
-- GROUP BY sy.name, sy.is_current;
