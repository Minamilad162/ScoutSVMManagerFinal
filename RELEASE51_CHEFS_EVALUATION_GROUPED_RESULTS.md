# Release 51 — Chefs Evaluation Grouped Results

## Scope
Enhances the Chefs Evaluation Overview filtered results for promoted and exceptional chefs.

## Changes
- When filtering promoted chefs, results are grouped by current rank and the next promotion rank.
- When filtering exceptional chefs, results are grouped separately by current rank.
- When both promoted and exceptional filters are enabled, the page displays both sections independently instead of hiding records that do not match both conditions.
- Team filtering remains active, so selecting one team shows exactly who in that team is promoted and who is exceptional.
- Each grouped card clearly shows:
  - Chef name
  - Team
  - Current rank
  - Promotion target rank when applicable
  - Attendance summary
  - Final evaluation score
  - Edit/view action

## Notes
- No database changes are required.
- No SQL script needs to be executed for this release.
