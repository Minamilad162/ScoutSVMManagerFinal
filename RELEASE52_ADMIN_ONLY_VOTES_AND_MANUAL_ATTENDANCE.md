# Release 52 — Admin-only Votes & Manual Attendance Override

## Scope
This release updates `ChefsEvaluationOverview`.

## Changes

### 1. Voting is Admin-only
- Removed the personal vote block from Chef/Chef de legion accounts.
- Only Admin accounts can edit the vote matrix for promotion and exceptional selection.
- Non-admin leaders can still open their team chefs, review term evaluation details, edit final evaluation text/score as before, and view attendance.

### 2. Manual attendance override
- Added manual attendance correction inside the chef details modal.
- The user can enter: `present / total`.
- The percentage is calculated automatically.
- If a manual override exists, the overview cards use it instead of the calculated attendance.
- If the override is cleared, the system returns to the automatic attendance calculated from database records.

## Database
Run this once in Supabase SQL Editor:

```sql
supabase/08_final_attendance_overrides.sql
```

This creates `final_attendance_overrides` and RLS policies.

## Build
No other SQL changes are required.

```powershell
npm install
npm run build
```
