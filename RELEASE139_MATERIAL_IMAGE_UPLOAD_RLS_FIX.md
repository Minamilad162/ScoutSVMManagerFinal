# ScoutSVM Release 139 — Material image upload RLS fix

## Symptom

`new row violates row-level security policy` when adding an image in MaterialAdmin.
Metadata changes were saved before photo upload, causing partial success.

## Changes

- Migration 27 replaces **only** `storage.objects` INSERT policy for `material-images`;
  the uploader still must be an authenticated global materials manager or admin,
  and paths must match two canonical UUIDs and JPG/PNG/WebP extension.
- Does not touch existing materials, photos, stock, bookings, public read, or delete policies.
- New image uploaded before an existing material record is changed; name/qty/description/image_path
  saved in one `materials.update`. If image upload fails, record is unchanged and file selection remains.
- For new materials, generate a UUID first, upload, then create the material row with that UUID and
  image path; best-effort removal of newly uploaded images if DB insert/update fails.
- Old image is deleted only after successful DB save. Image extensions and size limit remain unchanged.

## Deployment

1. Check actual Supabase project & remote migration ledger, then run
   `supabase/MATERIAL_IMAGES_RLS_PREFLIGHT_READ_ONLY.sql` (read only).
2. If Migration 26 already created `image_path` and the bucket, apply ONLY
   `supabase/27_material_images_upload_rls_fix.sql`. If absent, reconcile Migration 26 first.
3. Test saving an existing material with a new image while logged in as global materials manager
   or admin; inspect the Storage bucket and `materials.image_path` to verify.
4. Test deliberately unauthorized uploader: no object created, record unchanged.
5. Deploy frontend. Database update and browser smoke test required before declaring fix live.

This release does not run production SQL automatically. It preserves current data.
