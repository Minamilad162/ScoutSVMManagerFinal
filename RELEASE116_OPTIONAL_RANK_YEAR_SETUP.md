# Release 116 — Optional Rank for New Scout Year Setup

## Change
Rank is now optional during new Scout Year preparation, matching the already-optional Team and System Role behavior.

An active member can therefore be saved with:
- no Team,
- no Rank,
- no System Role.

A missing Rank is still counted and shown as a review warning so the Super Admin can find it later, but it no longer blocks activation.

## Frontend
`AdminMembers` now:
- labels Rank as optional when adding a new leader;
- allows `— بدون رتبة —`;
- saves `rank_id = null` cleanly;
- does not classify a member as `Needs Setup` solely because Rank is empty.

## Activation Readiness
Migration `supabase/22_optional_rank_year_setup.sql` updates:
- `admin_list_scout_year_overview()`;
- `admin_scout_year_activation_readiness()`.

Rank is moved from a critical blocker to warning:
`أعضاء بدون رتبة — مسموح`

## Still blocking
The year can still be blocked by genuinely required access/setup conditions such as a leader account that is expected to have an Auth account, or no active roster/teams where the activation rules require them.

## Deployment
Run SQL22 after SQL21, then click **إعادة الفحص** in the activation readiness dialog.
