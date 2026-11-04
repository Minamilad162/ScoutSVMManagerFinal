# Release 95 — Post-Fix QA Results

## PASS
- Static security regression checks.
- All static `/app/...` route targets resolve to registered routes.
- No missing relative TypeScript/TSX imports.
- No missing referenced public assets in the static QA scope.
- No unrestricted `WITH CHECK (true)` remains in the bundled base RLS policy file.
- Hardened Evaluation Answer write policy present.
- Correct global-role `user_roles` clean-install structure present.
- Safe Scout Year delete behavior present.
- TypeScript syntax/transpile pass across 92 source files.

## Requires live Supabase verification
The RLS changes cannot be considered active until `supabase/14_security_hardening_phase1.sql` is run against the live/staging database and role-based CRUD is tested with representative accounts.

Recommended live test matrix after SQL14:
- Admin: member/role/material/evaluation-question CRUD.
- Chef de Legion: own-team meeting + attendance + evaluation + expense CRUD; deny other-team writes.
- Team Secretary: own-team Equipier attendance on meeting days; deny Chef/preparation attendance writes.
- Responsable Finance: own-team expense CRUD; deny other-team writes.
- Normal authenticated member: deny direct writes to admin-managed tables and evaluation answers.
- Evaluated Chef: read only their own evaluation/answers.
