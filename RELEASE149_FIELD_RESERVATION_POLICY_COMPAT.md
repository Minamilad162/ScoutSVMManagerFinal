# ScoutSVM Release 149 — field-reservation RLS compatibility overlay

## Why Migration 31 stopped

Production contains four additional policies: `field_res admin write`, `field_res team upd`, `field_res team writers`, `fres_write_team`. Migration 31 intentionally rejected them. Because it ran inside a transaction, it did not apply the new functions or policies.

## Resolution

Migration **32** preserves all existing custom policies. PostgreSQL ORs PERMISSIVE policies and ANDs RESTRICTIVE policies; it adds new permissive read/insert/update policies for authorized current-year team staff and *mandatory restrictive* insert/update policies that enforce the year/team/role rules even if older permissive policies are broader. Existing reservation records and RLS remain intact.

**Do not rerun Migration 31 on this database.**

1. Run `supabase/FIELD_RESERVATION_POLICY_AUDIT_READ_ONLY.sql` on the production ScoutSVM Supabase project and inspect `permissive` for all policies. If any old INSERT/UPDATE/SELECT/ALL policy is RESTRICTIVE, stop and review its exact predicate.
2. Run `supabase/32_field_reservations_legacy_policy_compat.sql` in SQL Editor. It preflights required tables/columns, current-year state and unexpected restrictive policies; on failure transaction rolls back.
3. Run `supabase/FIELD_RESERVATION_POLICY_COMPAT_VERIFY_READ_ONLY.sql`: expect 5 added policies, 2 restrictive, 4 pre-existing custom policies retained.
4. Refresh the website and perform a booking with an active team Chef de Legion or Materials Responsible; test a different-team rejection and soft-cancel. The SQL Editor runs with elevated credentials and cannot substitute for a real authenticated client test.

This repo's Supabase connections don't include ScoutSVM, so the production database migration was not executed or verified from this conversation. Do not indiscriminately DROP policies.
