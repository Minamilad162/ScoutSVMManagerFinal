# Seasonal Phase — Evaluations and Final Evaluations

## What changed
- Evaluation pages now surface the current scout year context more clearly.
- Final evaluations overview now uses the **current scout year** as the default/fixed season scope.
- Attendance summaries inside final evaluations now use the **current scout year date range** instead of the Gregorian calendar year when available.
- Terms shown in evaluation flows remain limited to the current scout year through `fetchTerms()`.

## Updated files
- `src/pages/Evaluation.tsx`
- `src/pages/LegionEvaluations.tsx`
- `src/pages/MyEvaluation.tsx`
- `src/pages/AdminEvaluations.tsx`
- `src/pages/ChefsEvaluationOverview.tsx`
- `src/lib/scoutYear.ts`

## Notes
- No core business logic was replaced; the changes mainly deepen the seasonal scoping and make the current scout year explicit in evaluation workflows.
- Final evaluation rows still use the legacy numeric `year` field, but this is now derived from the current scout year's start date instead of the plain calendar year fallback whenever possible.
