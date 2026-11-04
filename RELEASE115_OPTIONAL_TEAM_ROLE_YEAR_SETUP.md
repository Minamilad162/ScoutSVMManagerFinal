# Release 115 — Optional Team / Optional System Role

## Business rule
During new Scout Year setup, not every account must belong to a Team and not every account must have a System Role.

Required setup:
- Active member: Rank is required.
- Chef/leader account: Auth account remains required.
- Equipier: Auth account is not required.

Optional:
- Team
- System Role

A Team is required only when adding a team-scoped role. A global role can be assigned without a Team. A person with no special system permission can remain with zero roles; there is no need to assign `Normal Chef` only to satisfy setup validation.

## UI changes
- New account form now includes `— بدون فريق —`.
- Team is labeled optional.
- Roles are labeled optional.
- Setup status no longer reports Team/Role as missing blockers.
- Readiness metrics show `بدون فريق (مسموح)` and `بدون Role (مسموح)`.

## Activation/readiness
Migration `supabase/21_optional_team_role_year_setup.sql` updates the database readiness logic:
- missing Team => warning only
- missing System Role => warning only
- missing Rank => blocking
- Chef/leader missing Auth account => blocking

The overview query is also lighter because configured-member counting no longer needs a per-member roles join.

## Deployment
Run SQL 21 after the previous year-management migrations, then deploy Release 115.
