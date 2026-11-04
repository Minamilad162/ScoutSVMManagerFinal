# Release 112 — Transferred Accounts Visibility / Review UX Fix

## What was confusing
The `Unassigned Auth Accounts` selector intentionally lists only authentication users that are not linked to any `members` record. Accounts transferred from a previous Scout Year are already linked to members, so they correctly do not appear there.

This made the page look as if only the unassigned/new auth accounts existed.

## What changed
- Added a prominent **Accounts in the selected Scout Year** selector directly after the year metrics.
- The selector is populated from `member_season_assignments` for the selected Scout Year.
- It shows transferred/existing leaders with their setup state: **Configured / Needs Setup / Inactive**.
- Selecting a person jumps directly to the existing Team / Rank / Roles review panel.
- Added quick buttons for **Needs Setup** and **Configured** counts.
- Renamed `Unassigned Auth Accounts` to **New auth accounts not linked to a member** and clarified that this section is only for new Supabase Authentication accounts.
- Added a warning if the selected Scout Year has zero linked auth accounts, including guidance to verify that the final rollover approval was completed.

## Database / business logic
No database mutation, rollover RPC, role logic, or permission behavior changed.

## Performance
The new selector uses the already-loaded seasonal roster and existing `setupByMemberId` map. No additional network request is introduced.
