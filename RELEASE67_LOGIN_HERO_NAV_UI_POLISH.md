# Release 67 — Login Premium Refresh, Hero Density Fix, and Menu Trigger Cleanup

## Scope
Polish the remaining UI points requested by the user without changing business logic, permissions, or database structure.

## Implemented changes

### 1) Login page premium refresh
- Removed the large right-side marketing copy block.
- Rebuilt the login page around a single centered premium glass card.
- Added a calmer premium background with layered ambient glow effects.
- Improved card hierarchy:
  - branded chip
  - centered logo
  - stronger heading
  - cleaner helper text
  - refined inputs
  - stronger primary CTA button
- Preserved the existing login logic and password recovery redirect behavior.

### 2) Hero/first-section density improvement
- Refined the shared `PageHero` component to be more compact and visually balanced.
- Reduced oversized first-section feel by tightening:
  - padding
  - layout spacing
  - action zone behavior
  - desktop hero density
- Adjusted global shell top padding slightly so page content starts sooner.
- This improves the "large empty top space" issue seen on the camp installments screen and any other pages using the same hero pattern.

### 3) Menu trigger cleanup
- Removed the left-side quick-open rail trigger from the app shell.
- Kept menu opening through the main header burger button only.
- Preserved drawer behavior and overlay close behavior.

## Files changed
- `src/pages/Login.tsx`
- `src/components/ui/PageHero.tsx`
- `src/App.tsx`
- `src/index.css`

## Data / backend impact
- No database changes.
- No Supabase schema or policy changes.
- No change to permissions logic.
- No change to routing structure other than UI trigger cleanup.

## QA focus
- Login layout on desktop and mobile.
- Drawer opens from the main header button only.
- Left-side floating/edge trigger is gone.
- Camp installments page hero appears tighter with less unused top space.
