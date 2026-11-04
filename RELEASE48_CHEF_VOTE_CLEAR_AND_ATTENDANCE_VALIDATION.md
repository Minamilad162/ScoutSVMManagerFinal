# Release 48 — Chef Vote Clear & Attendance Validation

## Scope
This release updates the Chefs Evaluation Overview screen.

## Changes

### 1. Nullable Yes/No votes
- The Yes/No pills now support clearing a mistaken selection.
- Clicking the active selected pill again returns the value to blank/null.
- This applies to:
  - Admin named votes for promotion.
  - Admin named votes for exceptional/distinction.
  - Chef self-vote.
  - Evaluation Q&A Yes/No answers.

### 2. Vote counting fix
- Majority calculations now ignore blank/null votes.
- A person who has not voted no longer increases the denominator.
- When a vote is cleared completely, the related `final_votes` row is deleted instead of being saved as an empty/null vote.

### 3. Attendance percentage validation
- Attendance summary now counts both present and absent rows.
- The modal now shows present, absent, total, and percentage.
- Attendance loading now prefers the active Scout Year through `meetings.scout_year_id` when available.
- It also merges date-range attendance rows to support older meeting records that may not have a `scout_year_id` populated.
- Attendance is filtered to the member's current team to avoid stale cross-team records.
- If term evaluation auto attendance counts are more complete than raw attendance rows, the overview uses them as a fallback.

## SQL
No SQL changes are required for this release.

## Notes
Run `npm install` and `npm run build` locally before deployment.
