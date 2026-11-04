# Release 55 — Final Evaluation Modal Reload Fix

## Scope
This release fixes the final evaluation modal data refresh issue in `ChefsEvaluationOverview`.

## Changes
- Added a fresh data reload every time a member evaluation modal is opened.
- Reloads the selected member's final evaluation, admin vote rows, and attendance override/calculated attendance without requiring a full page refresh.
- Clears stale modal state immediately when switching from one member to another.
- Adds a small loading message inside the modal while the selected member's data is being refreshed.
- After saving the final evaluation or admin votes, the modal refreshes itself from Supabase so the saved values remain consistent.

## Notes
- No SQL changes required.
- This is a frontend-only fix.
