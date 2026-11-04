# Release 43 - Camp PDF Compact RTL Layout Fix

## Scope
This release fixes the Camp Program PDF export layout based on the generated sample PDF review.

## Changes
- Reduced PDF vertical spacing and row padding to decrease the number of printed pages.
- Kept the font bold and readable while using a compact print layout.
- Standardized PDF page canvas dimensions so all exported pages have the same visual width and scale.
- Changed PDF rendering to a fixed A4-landscape ratio page container to avoid inconsistent page widths.
- Added content-aware pagination that estimates row height based on long Arabic/English text, materials, assignees, and notes.
- Improved RTL/BiDi handling by wrapping PDF text in isolated `dir="auto"` spans and removing `unicode-bidi: plaintext` from table cells.
- Preserved Arabic/English mixed content support while keeping table cells centered.
- Kept direct PDF download behavior.

## Notes
- No Supabase SQL changes are required.
- The internal stored times and data structures are unchanged.
- If a single row contains extremely long notes/materials, the pagination estimator will place fewer rows on that page to avoid clipping.
