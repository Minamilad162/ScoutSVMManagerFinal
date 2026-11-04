# Release 35 — Camp Locations Map, Shared-Place Warnings, and Direct PDF Download

## Scope
This release extends the Camp Program module without changing the Supabase schema.

## Changes

### 1. Location selection from the camp ground map
- Replaced free-text location entry with a grouped dropdown.
- Added the supplied camp ground map beside the location selector.
- The map can be opened in a full-screen preview.
- The dropdown includes the named halls, fields, open areas, and service landmarks shown on the map.

### 2. Hall/resource integration
- Selecting a hall automatically creates the related hall resource booking.
- Halls keep the existing restrictions:
  - maximum one-hour resource booking;
  - no overlapping hall booking;
  - no back-to-back hall booking for the same team;
  - maximum three hall bookings per team per day across all halls.
- Added support for the three named halls on the supplied map:
  - قاعة كبيرة
  - قاعة صغيرة ٢
  - قاعة صغيرة ٣

### 3. Shared-place conflict notification
- For non-hall locations, overlapping use by another team is a warning only and does not block saving.
- A visible amber conflict panel shows the team, time, and activity.
- A toast notification is also shown when a new overlap is detected.
- Existing hall and material availability rules remain blocking where required.

### 4. Direct PDF download
- Replaced the browser print-window workflow with direct PDF generation and download.
- Added `html2canvas` and `jspdf` as lazy-loaded dependencies.
- Arabic and mixed Arabic/English content is rendered from the browser output to preserve visual text rendering.
- Supports downloading one selected day or the full camp plan for the selected team.

### 5. Program and PDF layout
- Unified the previous separate “hall” and “location” display into one “المكان / القاعة” field.
- Legacy activities with saved room data remain readable.

## Files changed
- `src/pages/CampProgram.tsx`
- `package.json`
- `package-lock.json`
- `public/field-maps/camp-ground-map.png`

## Database
No new SQL migration is required for this release.

## Verification
- `npm ci`
- `npm run build`
