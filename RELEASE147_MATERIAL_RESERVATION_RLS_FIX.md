# ScoutSVM Release 147 — Material reservation RLS repair

## Symptom
Confirming a tool booking returns `new row violates row-level security policy for table "material_reservations"`.

## Cause
The booking UI uses current-year role assignments, while older database policies can still check legacy `members.team_id` (Migration 29 may not be deployed). Even after Migration 29, a global Chef de legion with a current-year team was not handled. This release aligns UI and RLS using `material_booking_can_write`.

## Procedure
1. Run `supabase/MATERIAL_RESERVATION_RLS_PREFLIGHT_READ_ONLY.sql` against the **ScoutSVM** project; inspect the actual policies, helper, privileges, and current year. No production access is connected here, so live schema status is unverified.
2. After confirming the schema, run `supabase/30_material_reservations_insert_rls_fix.sql` once in the Supabase SQL Editor. This script is repeatable and does not modify reservation rows. It replaces only the known old material-reservations authorization policies.
3. Run `supabase/MATERIAL_RESERVATION_RLS_VERIFY_READ_ONLY.sql` and confirm helper exists, policy count 3, legacy write policy count 0, grants true.
4. Refresh the live site, then confirm a test reservation as a team Chef or Materials Responsible and verify it appears. Test different-team rejection and soft cancellation.

## Scope
- Authenticated admin: all teams.
- Global Materials Responsible with current-year active member record: all teams.
- Team-scoped Materials Responsible and Chef de legion: the assigned team only.
- Global Chef de legion: only their active-year member team.
- Other users and archived years: no booking.

No reservation or inventory records are deleted; RLS remains enabled. Deployment of the frontend alone cannot resolve production policy errors until migration is applied. Existing custom restrictive policies must be inspected separately via the preflight.
