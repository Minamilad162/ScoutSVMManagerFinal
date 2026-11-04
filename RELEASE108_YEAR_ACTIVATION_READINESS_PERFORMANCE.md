# Release 108 — Year Activation Readiness & Performance

## Goal
Complete Year Management Phase 3: a Scout Year can no longer become current until its roster is configured and reviewed, while reducing the number of database round-trips during year setup.

## Activation flow
The only supported activation path is now:

1. Create/draft the new Scout Year.
2. Transfer selected Auth accounts only.
3. Configure Team + Rank + Global/Team Roles in Admin Members.
4. Click **Review readiness and activate**.
5. Resolve blocking issues.
6. Activate the year.

The New Year wizard and account-transfer section no longer provide a direct “make current” shortcut.

## Blocking checks
A year cannot become current when any of these conditions are true:
- no active members;
- no active teams;
- active member without Team;
- active member without Rank;
- active non-equipier/leader without Auth account;
- active non-equipier/leader with an Auth account but no active Role for the target year.

Equipiers do not require an Auth account or system Role, but still require Team and Rank when active.

## Non-blocking warnings
The readiness review also reports:
- no Terms;
- no planned meeting dates;
- active Roles not linked to an active roster member;
- Team-scoped Roles pointing at a team that is not active in that Scout Year.

## Database safety
`supabase/18_scout_year_activation_readiness.sql` adds:
- `admin_scout_year_activation_readiness(...)`;
- `admin_list_scout_year_overview()`;
- performance indexes for year-scoped roster/roles/terms queries;
- a hardened replacement for `set_current_scout_year_atomic(...)`.

The database validates readiness again inside the activation transaction. This means an old/stale browser or a direct RPC call cannot bypass the readiness gate.

## Performance improvements
### Scout Year administration
Before Release 108, the page loaded the years list and then requested each year's summary separately. Each year could require 6–7 database requests.

With SQL18 installed, the page now loads all years and their counters using **one RPC**: `admin_list_scout_year_overview()`.

### Readiness review
- Readiness is lazy and runs only when the admin opens the review for a specific year.
- One RPC returns all blocking counts/warnings.
- Member-level issues are bounded to at most 50 rows in the UI by default, avoiding large payloads.

### Admin Members
Reference catalogs (Teams / Ranks / Roles) now use a 5-minute in-memory cache with concurrent-request coalescing.

Expected database requests for the main roster load:
- Previous pattern: about 10 requests.
- First Release 108 load: about 6 requests.
- Reloads while the reference cache is warm: about 3 requests.

## UI changes
Each year card now shows:
- Configured members;
- Needs Setup members;
- a **Review readiness and activate** button.

The readiness panel shows:
- active members;
- configured / needs setup;
- missing Team / Rank / Auth / Role counts;
- critical blockers;
- non-blocking warnings;
- up to 50 affected members;
- direct link to Admin Members for the selected year.

## Preserved
- routes;
- permission model;
- account-only rollover behavior;
- existing insert/update/delete/upsert flows;
- historical year context;
- current production business workflows.

## Required deployment step
Run:

`supabase/18_scout_year_activation_readiness.sql`

before using the new readiness/activation flow.
