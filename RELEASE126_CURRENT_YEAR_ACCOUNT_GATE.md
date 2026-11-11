# Release 126 — Current Scout Year Account Gate

## Goal
Accounts that were not transferred/assigned to the current scout year must not continue using ScoutSVM with their old account.

## Behaviour
- A non-admin user must have an active member row in `v_members_current` for the physical current scout year.
- If the account was left behind in the previous year and has no active current-year membership, the application is blocked after authentication.
- The user sees a clear message: **الحساب غير نشط للسنة الكشفية الحالية**.
- The screen shows the current scout year and provides **إعادة التحقق** and **تسجيل الخروج** actions.
- Permanent Admin/Super Admin access remains available across years, consistent with the existing admin model.
- No account or historical member data is deleted. Re-adding/transferring the account to the current year makes it usable again.

## Database
No SQL migration is required. The gate uses the existing `v_members_current` current-year context plus the existing permanent Admin entitlement.
