# Release 70 — Remove PageHero Relative Position Rule

## Change
Removed `position: relative;` from the global selector:

```css
.page-hero > *:not(.page-hero-glow)
```

The rule now keeps only:

```css
z-index: 1;
```

## Scope
This applies globally to the shared `PageHero` styling, so the same fix affects all pages that use `PageHero`.

## Safety
- No database changes.
- No permissions changes.
- No routing changes.
- No Supabase logic changes.
- No PDF logic changes.
