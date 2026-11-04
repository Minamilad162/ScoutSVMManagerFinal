# Release 92 — Home C4D-Inspired Motion Phase 1

## Scope
Applied a lightweight C4D-inspired motion layer to the existing Home page only. No business logic, Supabase queries, permissions, routes, or data behavior were changed.

## What changed
- Hero image now has a slow cinematic depth drift, subtle light sweep, tiny ambient light particles, and desktop-only perspective hover.
- Welcome mascot now has a gentle 3D floating/idle motion while remaining visible on mobile.
- Compass has slow floating/rotation depth motion on larger screens.
- Orange/gold glow layers softly pulse to create depth behind the welcome content.
- Neckerchief color stripes animate subtly across the welcome strip, metric cards, and section accents.
- Metric cards use shallow perspective lift on desktop hover.
- Quick Action cards now have 3D lift plus a controlled light sheen on hover.
- Existing decorative assets receive individual motion behavior:
  - Clipboard: slow float/tilt.
  - Backpack: slow float/depth pulse.
  - Scarf knot: soft drift.
  - Campfire: subtle float, brightness, and glow flicker.
- Buttons receive a brief reflective sweep on hover.

## Mobile / performance behavior
- No Three.js / WebGL / external 3D runtime was added.
- Uses CSS transforms and opacity/filter effects only.
- Expensive hover perspective effects are disabled on mobile.
- Hero particles/sheen are hidden on mobile.
- Decorative continuous animations are reduced on mobile; the mascot and campfire retain lightweight motion.
- `prefers-reduced-motion: reduce` is respected and disables continuous motion/transitions.

## Regression protection
- Home page JSX data flow remains unchanged except for non-interactive decorative layers inside `HomeSvmBanner`.
- Existing navigation buttons and Supabase loading logic are unchanged.
- Release 91 mobile mascot visibility rules remain in place.
