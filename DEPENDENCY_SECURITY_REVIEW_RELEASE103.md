# ScoutSVM — Dependency Security Review (Release 103)

## Applied fixes
- Removed direct dependency `xlsx@0.18.5`.
- Replaced its remaining export paths with the existing Excel export stack.
- Patched Vite from `5.4.20` to `5.4.21`.
- Added `engines.node >= 20`.
- Added a locked CI workflow using Node 22.

## Residual Excel export dependency
`exceljs@4.4.0` remains because ScoutSVM has several existing Excel-export workflows.

Published 2026 security reports against ExcelJS 4.4.0 primarily concern:
- reading/decompressing attacker-supplied XLSX files,
- prototype pollution through cell-note serialization,
- filesystem path traversal through `Workbook.addImage()` on Node.

ScoutSVM currently uses ExcelJS only to create workbooks in the browser and write primitive worksheet values. Static review found no Excel workbook read/load APIs, no `WorkbookReader`, no ExcelJS `addImage()` usage, and no cell-note serialization in `src`.

This reduces practical exposure for the current implementation, but the dependency should still be replaced or upgraded when a maintained compatible release is selected and regression-tested.

## Supabase client
The locked client is `@supabase/supabase-js@2.57.4`. It is materially behind current releases. It was not upgraded in Release 103 because that is a large dependency jump and the current environment could not complete a clean dependency install/build. Treat a staged Supabase client upgrade as a separate tested release.

## Audit limitation
`npm audit` could not reach the npm audit endpoint from this execution environment, so this review combines package-lock inspection, code-path inspection, and current public advisory review rather than claiming a complete npm-registry audit.
