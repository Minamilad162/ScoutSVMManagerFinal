# Release 38 — Day Theme & PDF Pagination

## Added
- Optional `Theme اليوم` field for every camp day.
- Existing day notes remain optional and are shown separately.
- Theme and notes can be entered while creating a day or edited later.
- Theme and notes are displayed at the beginning of each day in the generated PDF.

## PDF layout fix
- Every camp day is rendered as an independent PDF page.
- A new day never starts at the bottom of the previous page.
- The previous whole-document canvas slicing was removed to prevent headers and table rows from being cut across pages.
- Each day is scaled to fit its own landscape A4 page while preserving the premium branding, row colors, Arabic/English content, and direct download behavior.

## Database
Run the updated `supabase/07_camp_program.sql` once. It adds:

```sql
alter table public.camp_daily_plans
  add column if not exists day_theme text;
```
