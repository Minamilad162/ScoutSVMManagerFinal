# Release 89 — Home Hero Clean Image No Buttons

## Change
- Replaced the Home page top hero asset with a clean hero-only image.
- Removed the two embedded buttons from the hero image area.
- Removed the accidental full-page mockup look from the hero asset so the Home page uses only the intended hero/banner image.
- Kept the existing Home page layout, metrics, shortcuts, permissions, and logic unchanged.

## Responsive behavior
- Desktop hero height is capped and uses `object-fit: cover`.
- Tablet/mobile hero height is reduced to avoid breaking the layout.
- The image remains rounded and aligned with the existing ScoutSVM glass UI.

## Safety
- No SQL changes.
- No routing changes.
- No Supabase/auth changes.
- No permissions changes.
