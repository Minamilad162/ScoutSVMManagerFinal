# Release 111 — Member Setup Review Filters

## What changed
The **Admin Members / Roles** page now supports a review workflow for preparing a new Scout Year:

- Setup status filter: **All / Configured / Needs Setup**.
- Quick counters for:
  - all members,
  - configured,
  - needs setup,
  - inactive.
- Direct **specific-person selector** for reviewing one member without leaving the page.
- Selecting a person immediately shows their Team, Rank, active status, existing Roles, role scopes, and edit controls.
- Setup status follows the same readiness rules used before year activation:
  - every active member needs Team + Rank;
  - a Chef also needs an Auth Account + at least one active Role;
  - an Equipier does not need Auth/Role.
- Detail panel now explains exactly what is missing: Team / Rank / Auth Account / Role.
- Configured members get an explicit green **تم الإعداد** status.

## Unassigned Auth Accounts
Replaced the large chip/button list with a scalable searchable picker:

- debounced email search,
- server-side bounded results,
- maximum 50 rendered options,
- refresh button,
- single-account dropdown selection.

Migration added:

`supabase/20_search_unlinked_auth_accounts.sql`

The frontend gracefully falls back to SQL16 behavior if SQL20 has not yet been installed, but SQL20 is recommended for large account lists.

## Performance
- Active Role counts are precomputed once in a `Map` instead of filtering all roles for every member row.
- Setup readiness is precomputed once per loaded roster.
- All setup/team/type/status/search filters are client-side over already-loaded season data — no extra DB request per filter change.
- Unassigned Auth search is debounced by 280ms and returns at most 50 rows.

## Business logic
No insert/update/upsert/delete flow was changed.

DB call counts in app source:
- Release 110: `{'from': 578, 'rpc': 23, 'insert': 49, 'update': 57, 'upsert': 43, 'delete': 28}`
- Release 111: `{'from': 578, 'rpc': 24, 'insert': 49, 'update': 57, 'upsert': 43, 'delete': 28}`

The additional RPC call is read-only search for unlinked Auth accounts.
