# RELEASE 68 — Hero Spacing Compact Fix

## Summary
This release reduces the oversized empty vertical space inside the large glass hero cards that appeared at the top of pages (notably Home and similar pages using `PageHero`).

## What changed
- Removed forced hero stretching behavior.
- Reduced internal hero spacing/gaps.
- Aligned hero content to the top instead of dropping it toward the bottom.
- Kept actions aligned more naturally so the hero feels compact and consistent with the other cards.
- Applied the improvement globally to the shared `PageHero` styling so all pages using the same component benefit.

## Files changed
- `src/index.css`

## Notes
- No database changes.
- No permissions logic changed.
- No routing logic changed.
