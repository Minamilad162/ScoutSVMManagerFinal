# ScoutSVM Release 148 — Field booking permission repair

The existing database policy `field_res modify by team` checks the old `members.team_id`, which may differ from the active 2026/2027 member assignment. The booking inserts a row and requests its ID back; both the INSERT and SELECT policies must authorize the new row.

## Rollout
1. Run the read-only `supabase/FIELD_RESERVATION_RLS_PREFLIGHT_READ_ONLY.sql` in the **actual ScoutSVM production database**. Confirm required tables, policy predicates and privileges.
2. Check custom/RESTRICTIVE policies and migrations already applied. Do not blindly replay other migrations.
3. Apply `supabase/31_field_reservations_current_year_rls.sql` only when the preflight proves the schema and authorization contract. It replaces only known field reservation policies and does not touch reservation rows.
4. Run `supabase/FIELD_RESERVATION_RLS_VERIFY_READ_ONLY.sql`. Expected: helpers true, new_policy_count 3, old_policy_count 0, grants true.
5. Test a new booking, soft cancellation, an archived year (must reject), and different-team booking (must reject), using a real authenticated test account. Check overlap exclusion stays in force.

If preflight reports MISSING tables/columns or custom policies, do not run the migration: inspect the correct project/schema first. The Supabase integration connected in this chat has no ScoutSVM database, so production SQL was **not** applied.
