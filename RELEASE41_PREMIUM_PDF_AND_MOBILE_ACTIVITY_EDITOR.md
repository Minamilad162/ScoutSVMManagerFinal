# Release 41 — Premium PDF & Mobile Activity Editor

## Scope
This release improves the Camp Program PDF output and the mobile workflow for adding and editing activities. No database migration is required.

## PDF improvements
- Day Theme is presented as a full-width premium navy/gold banner.
- Assistant Day Leader and First Sergeant are presented in clear visual cards.
- Increased header, table-header, and row font sizes.
- Increased font weight, row padding, cell spacing, and border clarity for printing.
- All PDF content remains centered.
- Text rendering now uses PNG output and a higher html2canvas scale for sharper printed text.
- Long days are split into continuation pages instead of shrinking all content into a single unreadable page.
- Every new day still starts on a separate PDF page.
- Continuation pages repeat the day identity and table headers.

## Mobile improvements
- Added a fixed “Add New Activity” button at the bottom of mobile screens.
- Add/Edit Activity opens as a full-screen mobile editor.
- Added a sticky mobile header with a clear close action.
- Added a sticky Save/Cancel bar at the bottom of the editor.
- Enlarged time inputs for touch use.
- Existing card-based multi-person and multi-team selection is preserved.
- Added mobile day navigation with swipe gestures and Previous/Next buttons.

## Files changed
- `src/pages/CampProgram.tsx`

## Validation
- `npm ci` completed.
- `npm run build` completed successfully.
- `npx tsc --noEmit` still reports pre-existing TypeScript issues in unrelated legacy files; no CampProgram error was reported.
