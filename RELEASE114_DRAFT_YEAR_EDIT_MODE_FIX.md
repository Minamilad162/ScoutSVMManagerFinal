# Release 114 — Draft Year Edit Mode Fix

## Problem
While configuring a future Draft scout year (for example 2026/2027), saving Team / Rank / Roles failed with:

`عرض السنة غير الحالية للقراءة فقط...`

The global year protection treated every non-current year as historical read-only, including future Draft years that are intentionally being prepared.

## Fix
Scout year context now has two distinct non-current modes:

- **Planning / Draft mode**
  - Super Admin can prepare the future year.
  - Team / Rank / Roles and other setup data can be written.
  - A dedicated planning banner is displayed.

- **Historical / Read-only mode**
  - Previous/archived years remain protected.
  - Mutations are blocked by the Supabase fetch guard.

`AdminMembers` also independently enforces that writes are allowed only when the selected year is:
- the physical Current year, or
- a Draft year.

This keeps archived years protected even if they are selected through the page's local year selector.

## Database
No SQL migration is required.

## PWA
Service Worker cache: `v1.2.0-r114`.
