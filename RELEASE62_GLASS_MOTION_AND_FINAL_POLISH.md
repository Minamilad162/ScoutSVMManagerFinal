# Release 62 — Glass Motion & Final UI Polish

## Scope
Continuation of the Scout SVM Apple-inspired glass UI upgrade after release 61.

This release is UI-only. It does not change:

- Permissions
- Role-based menu visibility
- Supabase queries
- Database logic
- PDF generation logic
- Evaluation calculations
- Camp booking validations

## Updates

### Application shell
- Added soft ambient background orbs to give the application a deeper Apple-like glass environment.
- Added print safety rules so the premium background and glass shell do not affect printed pages.
- Added browser fallback for devices that do not support `backdrop-filter`.

### Side menu
- Improved menu slide-in feel with smoother transition timing.
- Added subtle edge rail feedback for desktop hover opening.
- Kept mobile menu behavior unchanged to avoid hurting usability.
- Preserved the existing SideNav permission logic exactly.

### Components
- Improved `PageLoader` with a premium glass card and Scout SVM caption.
- Improved `EmptyState` visual treatment.
- Improved shared `Modal` styling with a clearer glass header and close button.

### Global UI polish
- Added tactile hover/active micro-interactions for buttons, cards, pills, and menu links.
- Improved segmented/filter chips styling.
- Improved web table zebra readability and hover behavior.
- Improved form section surfaces and focus visibility.
- Improved mobile modal header/footer consistency.

## Validation
- No SQL is required.
- Build was not executed in the assistant environment because dependencies were not available locally and installing them was not possible within the runtime.

Run locally:

```powershell
npm install
npm run build
```

Then deploy:

```powershell
npx wrangler pages deploy dist --project-name=scout-svm --branch=production
```
