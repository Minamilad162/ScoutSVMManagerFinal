# Release 58 — Term Evaluation Voice Notes

## Scope
Added voice-note support for term evaluations only. Final evaluations remain written-only.

## Functional changes
- Added a reusable `TermVoiceNotes` component.
- Voice notes are available inside:
  - Chef de legion term evaluation page.
  - Admin term evaluation page.
  - My Evaluation page as listen-only.
- Maximum active voice notes per evaluated person per term: 2.
- Maximum duration per voice note: 3 minutes.
- The recorder automatically stops at 3 minutes.
- Saved voice notes show:
  - Audio player.
  - Duration.
  - Creation date/time.
  - Evaluator display name from the linked member profile, not email/account name.
- Add/delete permissions:
  - Admin can add/delete.
  - Chef de legion can add/delete for own team.
  - Evaluated member can only listen to saved notes.

## Database / Supabase changes
Run this SQL file once:

```text
supabase/11_term_evaluation_voice_notes.sql
```

It creates:
- Private Supabase Storage bucket: `evaluation-voice-notes`.
- Table: `public.evaluation_voice_notes`.
- RLS policies for read/add/delete permissions.
- Storage policies for private signed playback.
- Trigger enforcing max 2 active notes and max 180 seconds.

## Notes
- No voice notes were added to final evaluation.
- Audio files are stored privately and played via signed URLs.
- If upload fails with bucket/policy errors, rerun `supabase/11_term_evaluation_voice_notes.sql` in Supabase SQL Editor.
