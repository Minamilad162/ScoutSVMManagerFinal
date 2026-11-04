# Release 36 — PDF Dependency Setup Fix

## Issue
Vite could show:

`Failed to resolve import "html2canvas" from "src/pages/CampProgram.tsx"`

This happens when the source code and `package.json` are updated but the existing local `node_modules` folder was created before the PDF libraries were added.

## Resolution
- Confirmed `html2canvas` and `jspdf` are declared in both `package.json` and `package-lock.json`.
- Added `INSTALL_PDF_DEPENDENCIES.bat` for a one-click installation of the two PDF libraries.
- Added `START_LOCAL.bat` to install/update all project dependencies before starting Vite.
- Verified a clean installation using `npm ci`.
- Verified `npm run build` completes successfully and emits separate `html2canvas` and `jspdf` bundles.

## Existing project quick fix
From PowerShell in the project folder, run:

```powershell
npm install
npm run dev
```

Or install only the new PDF dependencies:

```powershell
npm install html2canvas jspdf
npm run dev
```

No Supabase SQL changes are required for this release.
