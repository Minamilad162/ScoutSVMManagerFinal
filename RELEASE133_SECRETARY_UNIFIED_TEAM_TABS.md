# ScoutSVM Release 133 — Secretary team navigation + all functional tabs

Baseline: **Release 132** folder; no new project scaffold. Updated only three UI/logic files, the stylesheet, package test script, and a focused contract test. Existing database migration **24** for secure PDF forms is unchanged.

## `AdminSecretary`

- Left-side team list is a **persistent page-level selector**, no longer nested inside the forms tab. Sidebar counts reflect the selected scout year.
- Default tab is **الأولاد** (instead of **الاستمارات**). Four inner tabs are always visible in the team workspace: **الأولاد**, **الشيفات**, **الحضور**, **الاستمارات**.
- **الأولاد**: searchable table with member name, guardian name, guardian phone, birth date, attended/total, and excused/unexcused absences. Existing admin edit/save/delete actions are preserved for admins/group secretaries on current year only; team-scoped secretaries see information read-only from this page and manage their own boys in `TeamSecretary`.
- **الشيفات**: searchable table with chief's name, rank, role/responsibilities, personal phone, birth date; common role slugs have human-readable Arabic labels.
- **الحضور**: term selector, summary KPIs, per-boy attendance table, and term summary ring; no new writes in this tab.
- **الاستمارات**: reuses existing `SecretaryFormsWorkspace` with PDF cards, secure preview/download and team-scoped upload. No changes to bucket or storage policies.
- Tabs and team buttons are responsive, RTL, and stay in the existing ScoutSVM visual style. The selected team is not duplicated in a separate dropdown.
- Teams are restricted via `visibleSecretaryTeams` (group secretaries/admins see all, team secretary only own team). Changing team clears previous member records, roles, attendance, unsaved edits, and search. Stale member query responses are ignored. Current Scout Year in header scopes all views; past years remain read-only.

## `TeamSecretary`

- Keeps the original **إدارة الأولاد** screen and its **add, edit, delete** logic and personal/guardian fields.
- Keeps the PDF **الاستمارات** tab and its permitted scoped upload flow.
- Restores the already implemented but previously hidden **حضور الاجتماعات** tab, retaining its existing meeting date, selection, absence reasons, and save logic; also available separately in the dedicated attendance page.
- No existing table, user workflow, or route was removed.

## Permissions, database, validation

- Form upload still requires both a team-scoped `responsable_secretary` assignment and the physical current Scout Year, plus backend RLS and private Storage policies from migration 24.
- Admin cross-team view does **not** grant form-upload permissions; archived years are read-only.
- **No new SQL migration for Release 133**; migration 24 from Release 132 must still be applied to the actual ScoutSVM database (after read-only preflight), if not already installed.
- QA static checks passed: 100 source files, 55 routes.
- Existing year tests: 4 passed. Budget/year contract tests: 5 passed. Forms/permissions and UI contract tests: 7 passed. TypeScript/TSX files parsed successfully via TypeScript transpiler.
- Full dependency-backed typecheck and Vite production build could not run: npm dependency installation failed in this environment. Before deploying run `npm ci`, `npm run typecheck`, `npm run build` and browser tests with appropriate permissions/team/year.
- No Supabase production data or policies were modified. No deployment was attempted.
