# ScoutSVM Release 96 — Phase 2 Access, Reliability & Performance

## Scope
Built directly on Release 95. This phase focuses on defense-in-depth access control, current Scout Year reliability, PWA cache freshness, and Knowledge Bank performance.

## 1) Route-level permission guards
Added `src/components/RouteAccessGuard.tsx` and applied it to sensitive routes.

Guarded categories include:
- Admin-only pages: attendance admin, reservations admin, evaluations admin, Scout Year management, member/role administration, audit log, admin setup, term/meeting setup, admin events, admin evaluation questions.
- Global-scope pages: global finance and global secretary administration.
- Team-role pages: Chef de Legion, finance, materials, secretary, reports, meetings, camp installments and related team workflows.
- Same-team requirement for `AdminFieldReservations`: `responsable_materials` + `chef_de_legion` must belong to the same team (unless admin).

Dynamic access pages such as Camp Program delegated access and My Camp Collections remain page/database controlled because access can come from dedicated DB assignments rather than static role slugs.

## 2) Finance navigation scope corrected
- Global budget administration now appears only for Admin or a global `responsable_finance`.
- Team finance remains available to users with finance/leader permissions.
- Home no longer shows the Team Finance quick action to normal users without finance/leader permissions.

## 3) Materials navigation scope aligned
- Global inventory administration is shown only to global materials managers/admin.
- Field administration requires materials + Chef de Legion on the same team (or admin).
- Return approval remains available according to materials responsibility scope.

## 4) Atomic current Scout Year activation
Added:
- `supabase/15_scout_year_atomic_activation.sql`
- RPC: `public.set_current_scout_year_atomic(uuid)`
- partial unique index: `uq_scout_years_single_current`

The RPC:
- requires Admin permission;
- serializes competing switches with an advisory transaction lock;
- locks relevant Scout Year rows;
- resets the old current year and activates the target inside one DB transaction;
- guarantees rollback if activation fails;
- enforces at most one current Scout Year at DB level.

Frontend `setScoutYearAsCurrent()` now calls only this RPC and fails safely if SQL15 has not been deployed.

## 5) PWA cache freshness
Updated `public/sw.js`:
- cache version: `v1.2.0-r96`;
- release-specific core/runtime cache names;
- old ScoutSVM caches deleted on activation;
- Vite fingerprinted `/assets/` remain cache-first;
- stable public images/fonts use stale-while-revalidate;
- other same-origin resources prefer network-first;
- navigation remains network-first with offline fallback.

Service worker registration now uses `updateViaCache: 'none'` so the browser checks the worker script itself without relying on stale HTTP cache.

## 6) Knowledge Bank performance
Runtime Knowledge Bank artwork was resized and converted from PNG to WebP.

Before: approximately 7.9 MB of decorative artwork.
After: approximately 491 KB total across the six runtime Knowledge Bank assets.

Secondary side artwork now uses lazy loading and async decoding. The main visible background/mascot assets keep normal eager behavior for visual stability.

## 7) Page title consistency
Added labels for legacy/utility routes including attendance, finance, materials, reservations, team secretary attendance and legacy evaluation.

## Deployment requirement
Release 96 frontend is intentionally fail-safe for Scout Year activation until SQL15 is deployed.

Run after SQL14:
`supabase/15_scout_year_atomic_activation.sql`

## Not changed in this phase
- Business data structures and normal CRUD logic outside the above scope.
- Camp Program delegated-access mechanism.
- Collection assignment logic.
- Supabase production data.
