# Release 76 — Evaluation Popup Name + Hide Questions Temporarily

## Done
- Added the evaluated member name at the top of the leader evaluation popup.
- Added rank/context under the evaluated member name for clearer confirmation.
- Applied the same header clarity to the admin evaluation popup and legacy evaluation popup.
- Temporarily hid the questions section from evaluation forms using a single UI flag:
  - `src/features/evaluations/config.ts`
  - `SHOW_EVALUATION_QUESTIONS = false`
- While questions are hidden, saving the evaluation no longer overwrites `evaluation_answers`.
- Temporarily hid the `أسئلة التقييم` item from the sidebar menu.
- Hid question answers from the personal `تقييمي` view while the flag is disabled.

## Files changed
- `src/features/evaluations/config.ts`
- `src/pages/LegionEvaluations.tsx`
- `src/pages/AdminEvaluations.tsx`
- `src/pages/Evaluation.tsx`
- `src/pages/MyEvaluation.tsx`
- `src/components/SideNav.tsx`

## Safety
- No SQL changes.
- No database schema changes.
- No permissions logic changes.
- No routing changes.
- Existing question data is preserved.
