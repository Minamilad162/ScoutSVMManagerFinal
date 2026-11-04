# Release 61 — Key Pages & Mobile Glass Polish

## Scope
This release continues the Apple-inspired glass UI upgrade after Release 59/60.

## Changes
- Added route-aware UI polish via `data-route` on the app main container. This is presentation-only and does not change route permissions or data access.
- Enhanced PageHero with an additional premium glow layer.
- Enhanced SectionCard and MetricCard depth, highlights, and glass consistency.
- Added support for the existing `violet` MetricCard accent to avoid styling/type drift.
- Polished key operational screens through CSS-only route targeting:
  - Camp Program
  - Final Evaluation / Chefs Evaluation Overview
  - Materials
  - Evaluations
  - Attendance
  - Finance
  - Reports / Meetings
- Improved tabs/chips, filters, tables, inputs, selects, textareas, buttons, badges, and common card rhythm.
- Improved Term Voice Notes presentation:
  - Premium glass recorder panel
  - Stronger progress/timer styling
  - Cleaner audio note cards
- Improved mobile experience:
  - Larger touch targets
  - Full-screen modal behavior
  - Sticky modal action footer
  - Scrollable chips/tabs
  - Better table scroll handling
  - Better card spacing and typography

## Guardrails
- No Supabase queries were changed.
- No role/permission logic was changed.
- No database schema changes were added.
- No PDF generation logic was changed.
- Sidebar item visibility logic was preserved exactly.

## Files Changed
- `src/App.tsx`
- `src/index.css`
- `src/components/ui/PageHero.tsx`
- `src/components/ui/SectionCard.tsx`
- `src/components/ui/MetricCard.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/PageLoader.tsx`
- `src/features/evaluations/TermVoiceNotes.tsx`

## Deployment
No SQL is required for this release.
Run:

```powershell
npm install
npm run build
npx wrangler pages deploy dist --project-name=scout-svm --branch=production
```

## Build Note
The build could not be completed in the assistant environment because `node_modules` is not present and `vite` is unavailable. The changed code was reviewed for syntax consistency, and the release is primarily UI/CSS focused.
