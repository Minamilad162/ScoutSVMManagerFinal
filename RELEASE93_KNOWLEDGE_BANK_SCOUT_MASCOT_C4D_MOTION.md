# RELEASE 93 — Knowledge Bank Scout Mascot Refresh + C4D Motion

## Done
- Replaced the Knowledge Bank scout boy with the new mascot version.
- Applied the requested outfit:
  - navy scout shirt
  - the provided navy/orange/yellow neckerchief
  - blue jeans
- Connected the new mascot directly inside the Knowledge Bank page.
- Added lightweight C4D-style motion using CSS animations:
  - mascot entrance animation on page load
  - subtle floating idle motion
  - signpost entrance + gentle sway
  - speech bubble pop-in animation
  - animated accent rays
- Preserved accessibility with `prefers-reduced-motion` fallback.

## Files changed
- `public/knowledge/scout-boy-knowledge-navy.png`
- `src/pages/KnowledgeBank.tsx`
- `src/index.css`

## Notes
- This is code-based motion inside the site, not a video file.
- The effect is lightweight and suitable for web performance.
