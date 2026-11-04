# Baseline Improvements Included

## Performance / structure
- Route-level lazy loading remains in `src/App.tsx`
- Added lazy loading for `SideNav` inside the protected layout
- Vendor/manual chunk splitting kept in `vite.config.ts`
- Moved Excel libraries to **lazy runtime imports** in:
  - `src/pages/TeamFinance.tsx`
  - `src/pages/financeEvent.tsx`
  - `src/pages/CampInstallmentDetails.tsx`
- Build verified successfully after the changes

## Unified error handling baseline
- Added centralized error helpers in `src/lib/errors.ts`
- Added global render fallback via `src/components/ui/AppErrorBoundary.tsx`
- Added reusable inline alert component in `src/components/ui/InlineAlert.tsx`
- Improved auth/session error resilience in `src/components/AuthProvider.tsx`

## Queries organized into api / hooks
- Added shared reference-data API layer:
  - `src/features/reference/api.ts`
- Added reusable reference hooks:
  - `src/hooks/useReferenceData.ts`
- Refactored repeated bootstrap queries in these pages to use shared API functions:
  - `src/pages/Attendance.tsx`
  - `src/pages/Finance.tsx`
  - `src/pages/TeamFinance.tsx`
  - `src/pages/LegionAttendance.tsx`
  - `src/pages/TeamSecretaryAttendance.tsx`
  - `src/pages/TeamCases.tsx`
  - `src/pages/TeamStatistics.tsx`
  - `src/pages/TeamSecretary.tsx`

## Camp installments / collections
- Updated `CampInstallmentForm.tsx` for separate Equipier / Chef pricing
- Updated `CampInstallmentDetails.tsx`
- Updated `CampInstallmentsList.tsx`
- Updated `MyCampCollections.tsx` for:
  - role-based price handling
  - better payment flow UX
  - scroll-to-payment section
  - local payment success/error messages

## Attendance fixes
- Updated `LegionAttendance.tsx`
- Updated `TeamSecretaryAttendance.tsx`

## Project hygiene
- Added `.gitignore`
- Added `.env.example`
- Added `docs/STAGING_TEST_SETUP.md`
- Removed `.env.local` and `.git` from the delivered package
- Generated app icons under `public/icons/`
