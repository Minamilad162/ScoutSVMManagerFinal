# Release 63 — Accessibility & UX Quality Pass

## Scope
This release continues the Apple-inspired Glass UI upgrade with a quality pass focused on navigation comfort, accessibility, keyboard behavior, and polished feedback components.

## Changes

### Application shell
- Added a visible-on-focus “skip to content” link for keyboard users.
- Added a dynamic route label under the main topbar title so the current page is clear.
- Added browser document title updates per route.
- Added `Escape` key support to close the side navigation drawer.
- Added `role="navigation"` and an accessible label to the side navigation drawer.
- Added a floating “back to top” glass button that appears after scrolling down.

### Modal UX
- Shared `Modal` now uses `role="dialog"` and `aria-modal="true"`.
- `Escape` closes shared modals.
- Body scroll is locked while a shared modal is open, then restored on close.
- Shared modal keeps RTL direction.

### Toast UX
- Toasts now have a clear status/error role.
- Added a glassy icon area per toast type.
- Added a dismiss button so alerts can be closed manually.
- Improved toast spacing, visual hierarchy, and mobile presentation.

### Accessibility and readability
- Added stronger `focus-visible` treatment for buttons, links, inputs, side navigation, and floating actions.
- Added high-contrast support via `prefers-contrast: more`.
- Added reduced-transparency fallback via `prefers-reduced-transparency: reduce`.
- Preserved reduced-motion behavior from earlier releases.

### Printing safety
- Skip link, floating top button, and toast zone are hidden in print.
- PDF generation styling was not changed.

## Non-goals / preserved behavior
- No permission logic changed.
- No menu visibility logic changed.
- No Supabase query or RLS logic changed.
- No database migration added.
- No PDF generation logic changed.
- No evaluation, attendance, camp booking, or finance calculation changed.

## Files changed
- `src/App.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/Toaster.tsx`
- `src/index.css`

## Deployment notes
No SQL is required for this release.
Run:

```powershell
npm install
npm run build
```

Then deploy the generated `dist` folder.
