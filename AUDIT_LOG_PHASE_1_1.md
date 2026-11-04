# Audit Log Phase 1.1

## What improved
- Actor names now resolve more reliably from current user/member context.
- Audit details page now shows a clearer before/after comparison table.
- Changed fields are displayed with friendly Arabic labels where possible.
- Audit writes now support structured inputs:
  - `before`
  - `after`
  - `changedFields`
  - `context`
- Key modules now log richer details:
  - current season member assignment updates
  - role add/remove in current season
  - camp payments and participation changes
  - scout year updates and current-year activation

## Notes
- This phase assumes the database view `v_audit_log_readable` was updated to resolve actor names using `actor_user_id`, `actor_member_id`, and `actor_display`.
- Existing old logs can only show as much detail as was stored originally.
