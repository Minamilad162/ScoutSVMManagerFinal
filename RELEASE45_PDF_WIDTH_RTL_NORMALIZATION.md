# Release 45 - PDF Page Width and RTL Normalization

## Scope
Fixes the generated Camp Program PDF layout after reviewing the exported day PDF.

## Changes

### Unified page/table width
- Forced every PDF render page to use the exact same capture size: 1280 x 892 px.
- Updated the hidden iframe used for PDF generation to match the same fixed page size.
- PDF pages now render into the same A4 landscape usable area with a fixed width and height.
- Removed the previous behavior where html2canvas could capture variable page heights/scroll heights, causing some pages to visually scale differently.
- The first page table now uses the same full layout width as continuation pages.

### PDF layout compactness
- Slightly reduced top header height, page padding, theme banner height, leadership card height, notes panel height, and row padding.
- Kept text readable and bold enough for printing.

### Arabic / RTL text handling
- Changed PDF text wrapper from `dir="auto"` to fixed `dir="rtl"` with `lang="ar"`.
- Added stronger CSS direction and unicode-bidi handling for PDF cells.
- This stabilizes Arabic text order while keeping English names/words readable inside the same cells.

## Files changed
- `src/pages/CampProgram.tsx`

## SQL
No SQL changes required.

## Build note
A local build could not be completed in this environment because npm install fails on the registry package `zip-stream@4.1.1` with 404 from the configured internal registry. The code changes are frontend-only and localized to PDF generation.
