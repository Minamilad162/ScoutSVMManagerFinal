# Scout SVM — Release 66 Final Production Handover

Release: `release66-final-production-handover`  
Date: 2026-09-15  
Scope: Final handover package after Voice Notes + Premium Glass UI phases.

---

## 1. What this release contains

This release is the final handover package built on top of Release 65.

It includes:

- Full project source code.
- Latest Term Evaluation Voice Notes feature.
- Latest Apple-inspired Glass UI styling.
- Side navigation icon polish.
- Mobile UX polish.
- Accessibility and keyboard UX pass.
- Visual QA and alignment polish.
- Supabase SQL files required for a fresh database setup.
- Final deployment and smoke-test instructions.

No application logic was changed in this release. This handover release mainly adds documentation and final operating instructions.

---

## 2. Major features included up to this release

### Core System

- User authentication through Supabase.
- Role-based page visibility and route guarding.
- Admin dashboards.
- Team dashboards.
- Attendance modules.
- Members and seasonal membership handling.
- Materials and storage modules.
- Reservations and camp-related modules.
- Finance modules.
- Meeting minutes, tasks, cases, and notifications.
- Reports center.

### Camp Program

- Camp Program page per camp/team.
- Team-specific camp schedule.
- Daily themes and daily notes.
- Daily leadership fields.
- Fixed schedule blocks.
- Flexible activity duration.
- Camp location list based on field maps.
- Materials and room/resource restrictions.
- Direct PDF export with premium formatting.
- 12-hour Arabic time display.
- Overnight day handling.

### Evaluations

- Term evaluations.
- Final evaluations.
- Admin-only final vote control.
- Manual attendance override.
- Grouped final results.
- Next-year exclusion flag.
- Potential flag.
- Rank statistics before/after promise.
- Next Year Included filter.

### Term Evaluation Voice Notes

- Voice notes in term evaluations only.
- Maximum 2 voice notes per evaluated person per term.
- Maximum 3 minutes per voice note.
- Voice note playback for the evaluated person after save.
- Display evaluator person name, not account/email.
- Add/delete allowed for authorized leaders/admins.
- Private Supabase Storage bucket.
- Database-level validation triggers.

### Premium Glass UI

- Apple-inspired glassmorphism visual foundation.
- Premium gradient background.
- Glass cards, sections, modals, tables, badges, buttons, inputs, filters, and toasts.
- Smooth side navigation behavior.
- Consistent menu icons.
- Mobile modal and tab improvements.
- Accessibility pass.
- Visual QA/alignment pass.
- Print/PDF safety so website glass styling does not break print/PDF output.

---

## 3. Database files

For a fresh Supabase database, run the SQL files in the order below:

1. `supabase/01_schema.sql`
2. `supabase/02_policies.sql`
3. `supabase/03_functions_triggers.sql`
4. `supabase/04_seed.sql`
5. `supabase/05_best_term_chefs.sql`
6. `supabase/06_member_avatar_profile_fix.sql`
7. `supabase/07_camp_program.sql`
8. `supabase/08_final_attendance_overrides.sql`
9. `supabase/09_final_next_year_exclusions.sql`
10. `supabase/10_final_potential_and_rank_stat_adjustments.sql`
11. `supabase/11_term_evaluation_voice_notes.sql`

For an existing database that already has files `01` through `10`, run only:

- `supabase/11_term_evaluation_voice_notes.sql`

Releases 59 through 66 do not require new SQL files.

---

## 4. Supabase Storage

The latest database script creates/uses this bucket:

- `evaluation-voice-notes`

Purpose:

- Stores private term-evaluation voice note audio files.

Important:

- Keep this bucket private.
- Do not make voice-note recordings public.
- Access should remain controlled by database metadata and app permissions.

---

## 5. Environment variables

Confirm `.env.production` or Cloudflare environment variables include:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Do not commit service-role keys to the frontend.

---

## 6. Local run

From the project folder:

```powershell
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

---

## 7. Production build

```powershell
npm install
npm run build
```

Expected output folder:

```text
dist
```

---

## 8. Cloudflare Pages deploy

Preferred command:

```powershell
npx wrangler pages deploy dist --project-name=scout-svm --branch=production
```

Fallback used previously when the latest Wrangler/Node setup caused local issues:

```powershell
npx --yes wrangler@3.114.17 pages deploy .\dist --project-name=scout-svm --branch=production
```

If `dist` is missing, run `npm run build` first and confirm you are inside the folder containing `package.json`.

---

## 9. Final smoke test checklist

### Login and permissions

- Admin login works.
- Chef de legion login works.
- Normal evaluated member login works.
- Each role sees only the allowed menu items.
- Hidden pages remain hidden by permission.
- Direct URL access remains blocked where permissions do not allow access.

### Side navigation

- Menu icons appear for all items.
- Desktop slide-in / smooth behavior works.
- Mobile menu remains usable.
- Logout still works.

### Camp Program

- Camp Program page opens.
- Existing camp plans load.
- Add/edit/delete activity works.
- Fixed schedule blocks display correctly.
- Room/resource restrictions still work.
- Direct PDF export works.
- PDF remains readable and is not affected by glass UI styling.

### Term Evaluations

- Term evaluation page opens.
- Existing written evaluation fields still save.
- Voice note recording works.
- Voice note automatically stops at 3 minutes.
- Max 2 voice notes per person per term is enforced.
- Saved voice note plays back.
- Evaluator person name displays correctly.
- Evaluated person can listen after save.
- Evaluated person cannot add/delete voice notes.

### Final Evaluations

- Final evaluation page opens.
- Final written evaluations still work.
- Final evaluations do not show voice note recording controls.
- Admin-only vote controls still appear only for Admin.
- Vote clear/save still works.
- Manual attendance override still works.
- Rank statistics still calculate correctly.
- Excluded/Potential/Next Year Included filters still work.

### Materials / Finance / Reports / Meetings

- Main listing pages load.
- Tables are readable on desktop.
- Tables scroll properly on mobile.
- Save/delete workflows still work.
- Toast notifications appear correctly.

### Mobile

- Login screen fits mobile.
- Sidebar/drawer is usable.
- Modals fit screen.
- Save buttons remain accessible.
- Voice note controls are touch-friendly.

---

## 10. Known validation note

A full production build was not executed inside the handover environment because dependencies were not installed in that runtime. The code package includes `package.json` and `package-lock.json`, so the validation should be performed locally using:

```powershell
npm install
npm run build
```

The UI phases from Release 59 to Release 65 were intentionally scoped to styling/shared UI components and did not change database logic, route permission logic, evaluation calculations, attendance calculations, or camp booking rules.

---

## 11. Recommended final acceptance flow

1. Run all required SQL files in Supabase depending on whether this is a fresh or existing database.
2. Run `npm install`.
3. Run `npm run build`.
4. Test locally using `npm run dev`.
5. Smoke-test the roles and pages listed above.
6. Deploy to Cloudflare Pages.
7. Re-test login, permissions, camp PDF, term voice notes, and final evaluations on production.

