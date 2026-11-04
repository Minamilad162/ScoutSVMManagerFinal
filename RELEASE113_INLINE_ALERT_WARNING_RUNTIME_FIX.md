# Release 113 — InlineAlert Warning Runtime Fix

## Fixed
The Members & Roles page could crash with:

`Cannot read properties of undefined (reading 'wrapper')`

Cause: Release 112 used `tone="warning"` in `InlineAlert`, while the shared component only supported:
- error
- success
- info

## Changes
- Added first-class `warning` tone to `InlineAlert`.
- Added defensive fallback to `info` if an unexpected tone reaches the component.
- Added a static QA regression guard.
- Service Worker cache bumped to `v1.2.0-r113`.

## Scope
No database, routing, permissions, year-transfer logic, or business logic changes.
