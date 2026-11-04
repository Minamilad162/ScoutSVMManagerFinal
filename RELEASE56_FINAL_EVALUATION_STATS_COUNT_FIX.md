# Release 56 — Final Evaluation Rank Statistics Count Fix

## Scope
Fixes the rank statistics cards in the Final Evaluation page.

## Changes
- Rank statistics are now calculated from the selected team scope only, not from display filters such as:
  - Search
  - Promoted / Meilleurs
  - Potential
  - Excluded filter
  - Rank display filter
- Current rank counts exclude members marked as `exclude_from_next_year_stats`.
- After-promise counts now start from the current excluded-adjusted rank counts, then move each promoted member from the current rank to the next rank.
- Added `Chef de mouvement` as the top promotion target after `Chef de legion`.
- The after-promise cards now show:
  - Before promise count
  - Incoming promoted members
  - Outgoing promoted members
  - System count after promise
  - Manual extra count
  - Total
- Manual rank stat adjustments remain visible and are added separately to totals.

## Database
No SQL changes required.
