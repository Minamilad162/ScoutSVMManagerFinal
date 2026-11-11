# Release 138 — material photos in inventory + reservation cards

- Scope: `MaterialAdmin` edit/create and `MaterialTeamReservation` booking catalogue, booking summary and reservation list.
- Dedicated `material-images` Storage bucket (public catalogue media; 3 MB JPG/PNG/WebP uploads only).
- New nullable `materials.image_path` field links each material to its latest immutable object path.
- Inventory admins (`admin` or global `responsable_materials`) can upload, replace and remove photos. Other authenticated users may see the image URLs, but cannot change files.
- Existing materials/reservations and inventory logic are unchanged. Missing images preserve the existing fallback glyphs.
- Graceful pre-migration behavior: existing inventory/booking remains usable; editor warns that SQL migration 26 must be applied before photos can be uploaded.
- Image upload happens after basic metadata save and reports partial success if the media upload fails; previous image stays if replacement upload fails. New uploads are cleaned up if material row cannot be updated.
- Historical Scout Year pages retain read-only behavior via existing guards; this feature does not modify year data.

## Database deployment — separate approval and verification

1. In the *actual ScoutSVM Supabase* project, read migration ledger and run `supabase/MATERIAL_IMAGES_PREFLIGHT_READ_ONLY.sql`.
2. Review the result. If the `image_path` field and bucket/policies are missing, apply `supabase/26_material_images.sql` once (additive and idempotent).
3. Verify column, bucket allowed MIME types/size, and three Storage policies using the read-only queries at the end of migration.
4. Test with a real inventory-admin account: upload JPEG, verify photo appears on `MaterialAdmin` and `/app/MaterialTeamReservation`, replace, remove and verify fallback glyph; test non-admin cannot upload.

**Not applied to live Supabase:** the account connection available to ChatGPT does not include ScoutSVM.

## QA

- `npm run qa:static`
- `node --experimental-strip-types --test tests/material-image-contract.test.mjs`
- Combined existing suite: 36/36 passing locally.
- TypeScript syntax parsing: 4 changed TS/TSX files clean.
- Full npm-based typecheck/build: requires CI dependencies.
