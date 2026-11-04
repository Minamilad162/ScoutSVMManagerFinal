# Member 360 Profile — Phase 1

## What was added
- New page: `src/pages/MemberProfile360.tsx`
- New feature API: `src/features/memberProfile/api.ts`
- New routes:
  - `/app/member-profile`
  - `/app/member-profile/:memberId`

## Highlights
- Current-year profile view for the member
- Current roles inside the active scout year
- Attendance summary scoped to the current scout year
- Camp installment summary + latest payments
- Current-year cases
- Current-year evaluations + final evaluation summary
- Avatar upload from inside the profile page

## Navigation updates
- Added profile entry to `SideNav`
- Added quick action to `Home`
- Added shortcut link from `AdminMembers` to open Member 360

## Notes
- Avatar upload uses the `avatars` storage bucket
- The page reads from the current-year views and tables already introduced in prior seasonal phases
