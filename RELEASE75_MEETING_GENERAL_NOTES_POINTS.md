# Release 75 — Meeting Minutes General Notes as Saved Points

## Scope
Update the Meeting Minutes form so the **General Notes** section is no longer one large textarea.

## Implemented
- Replaced the old `general_notes` textarea with a point-by-point workflow.
- Added a single input for writing one note at a time.
- Added a **حفظ النقطة** button.
- Each saved note appears as a separate numbered card.
- Existing notes are parsed from the old text value and displayed as separate points.
- Notes are still stored in the existing `meeting_minutes.general_notes` column as bullet-style lines, so no database migration is required.
- Existing minutes: adding/deleting a note updates `general_notes` immediately.
- New minutes: notes are held locally and saved with the main **حفظ المحضر** action.
- Existing note text can still be edited inline and is persisted with the main **حفظ المحضر** action.

## Files changed
- `src/pages/MeetingMinuteForm.tsx`

## Safety
- No SQL changes.
- No permissions changes.
- No routing changes.
- No Supabase schema changes.
- No PDF logic changes.

## QA checklist
1. Open Meeting Minutes.
2. Create a new minute.
3. Add more than one general note using **حفظ النقطة**.
4. Click **حفظ المحضر**.
5. Reopen the minute and verify notes appear as separate cards.
6. Add/delete a note on an existing minute and verify the change remains after refresh.
