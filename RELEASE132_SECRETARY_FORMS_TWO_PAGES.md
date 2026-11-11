# ScoutSVM Release 132 — Secretary PDF Forms

Source: **ScoutSVM Release 131** ZIP. Preserved existing member/attendance management.

## Frontend delivered

- `AdminSecretary`: new **استمارات الفرق** section is the default, with a left-side team selector; each team opens its own vertically stacked PDF accordion cards and iframe previews. Search, download, counter, active Scout Year information, and upload control for team-scoped secretaries are included. Previous members/attendance interface is retained as the **بيانات الفرق والحضور** tab for group admins.
- `TeamSecretary`: **الاستمارات** tab added beside existing management tab. It provides PDF uploads, search, inline preview, and download. The selected/assigned team is unchanged.
- The team secretary can access `AdminSecretary` but is restricted to **their own** team. The global secretary and super admin can view all teams; a global/admin entitlement does **not** automatically allow uploads.
- Scope of every query: exact `team_id` AND exact `scout_year_id`; historical admin year selections are read-only. No old-year records are copied or re-dated.
- Private PDF Storage. Supports multiple PDF files per team/year; 10 MB each. Upload header/size checked, Storage and DB enforce scope; on metadata failure client attempts orphan cleanup. No public links, signed short-lived preview, audited metadata insertion.

## IMPORTANT — migration needed before release is functional

1. Run `SCOUTSVM_SECRETARY_FORMS_PREFLIGHT_READ_ONLY.sql` in the **actual ScoutSVM** Supabase project. Inspect its real migration ledger; the remote ScoutSVM project was **not** connected in this session.
2. Review and apply `supabase/24_secretary_team_forms.sql` **once** after migration 23. This creates a private bucket, metadata table, season-aware security functions, RLS policies, grants, and an insert audit trigger. No existing data is modified.
3. Build and deploy the Release 132 frontend. Use existing `VITE_SUPABASE_URL` and publishable/anon key; never a service_role key in the browser.
4. Test a team secretary of Ashbal uploading a PDF; confirm the file appears in both `TeamSecretary` and `AdminSecretary`, but uploading or reading another team's file is blocked. Test group secretary's cross-team read and denied upload; test super admin viewing an archived year and uploads blocked.
5. Run `SCOUTSVM_SECRETARY_FORMS_VERIFY_READ_ONLY.sql` to confirm storage metadata + audit_log rows and each team's exact Scout Year link.

## QA performed

- Static QA: pass. All TS/TSX source files parsed without syntax errors.
- Existing Scout Year tests: 4 passed, existing budget/year contract tests: 5 passed.
- Release 132 scope/permissions tests: 4 passed.
- Full `npm ci` and `npm run build` **not executed**: required npm packages are not cached in the container. `npm ci --offline` reported missing `zip-stream-4.1.1.tgz`. Run CI on a network-enabled machine before production release.
- No real database queries or RLS impersonation test were run against ScoutSVM, and the migration was not applied remotely.

## Year deletion considerations

Do not delete any Scout Year containing uploaded secretary documents without a file-cleanup workflow that uses the Supabase Storage API. Existing year-deletion RPCs can remove metadata but may leave orphan objects in Storage. Treat that as a separate destructive operation requiring preflight/approval, not part of this feature.
