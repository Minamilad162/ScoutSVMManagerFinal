# Release 94 — Home Static Colors + Performance Pass

## Changes
- Stopped the moving scarf-color bars above/around Home cards. They are now fixed navy/orange/yellow bands.
- Removed continuous Hero drift, sheen sweep, and orbit particles.
- Removed continuous floating/rotating animations from the Home compass, decorative items, backpack, clipboard, scarf, and campfire.
- Replaced animated blur glows with static radial gradients to reduce paint/GPU cost.
- Kept only a short one-time mascot entrance animation, then the mascot stays still.
- Simplified card/section hover effects from 3D rotations to lightweight translate/shadow feedback.
- Removed permanent `will-change` layer promotion from Home elements.
- Removed reflective sweeps from buttons and quick-action cards.
- Added lazy loading + async decoding for lower-page decorative images.
- Added `content-visibility: auto` to Home sections so off-screen sections cost less to render.
- Converted the Home hero image from PNG to optimized WebP.

## Functional scope
No Supabase calls, routes, permissions, role logic, metrics logic, or navigation behavior were changed.
