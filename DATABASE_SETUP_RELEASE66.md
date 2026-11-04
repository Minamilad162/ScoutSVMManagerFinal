# Scout SVM — Database Setup for Release 66

## Fresh database setup

Run the files below in Supabase SQL Editor in this exact order:

```text
supabase/01_schema.sql
supabase/02_policies.sql
supabase/03_functions_triggers.sql
supabase/04_seed.sql
supabase/05_best_term_chefs.sql
supabase/06_member_avatar_profile_fix.sql
supabase/07_camp_program.sql
supabase/08_final_attendance_overrides.sql
supabase/09_final_next_year_exclusions.sql
supabase/10_final_potential_and_rank_stat_adjustments.sql
supabase/11_term_evaluation_voice_notes.sql
```

## Existing database setup

If the current Supabase database already has the project tables and all previous migrations up to `10`, run only:

```text
supabase/11_term_evaluation_voice_notes.sql
```

## No SQL required for UI releases

The following releases are UI/UX only and require no SQL:

```text
Release 59
Release 60
Release 61
Release 62
Release 63
Release 64
Release 65
Release 66
```

## Voice notes storage

`supabase/11_term_evaluation_voice_notes.sql` creates/configures:

```text
evaluation-voice-notes
```

Keep it private.

## Important safety notes

- Run SQL in order.
- Back up production database before applying new SQL.
- Do not expose service-role keys in frontend code.
- After SQL, test voice-note upload/play/delete using Admin, Chef, and evaluated-person accounts.
