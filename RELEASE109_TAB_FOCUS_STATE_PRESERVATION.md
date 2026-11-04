# Release 109 — Tab Focus / State Preservation Fix

## Problem
When the user left ScoutSVM for another browser tab/window and returned, Supabase could emit same-user auth events such as `SIGNED_IN` or `TOKEN_REFRESHED`.

`AuthProvider` previously replaced the user object on those events. Because the profile-loading effect depended on the whole `user` object, this triggered `loading=true` again. `ProtectedLayout` then temporarily replaced the current page with the global loader, unmounting the active page and losing local UI state. To the user this looked like a full refresh.

## Fix
- Same-user `SIGNED_IN`, `TOKEN_REFRESHED`, and `INITIAL_SESSION` events are treated as session-maintenance events.
- They no longer reinitialize the application.
- Role/profile loading now depends on `user.id`, not the full Supabase user object.
- `USER_UPDATED` can still update user metadata without reloading role/profile data unnecessarily.
- The active page remains mounted while switching browser tabs.
- Added route/year scroll-position memory in `sessionStorage`.
- Scroll is saved only when the page becomes hidden or during `pagehide`, minimizing work.
- The saved scroll position is restored after a real browser reload/tab discard when possible.

## Expected behavior
When switching to another tab/browser window and returning:
- no full-page loader,
- no apparent application refresh,
- same route remains open,
- local React form/modal/filter state remains intact because the page is not unmounted,
- scroll position remains unchanged.

If the browser itself fully discards/reloads the tab because of OS memory pressure, the route and scroll position can be restored, but arbitrary unsaved form values are not persisted across a true process-level reload.

## Regression protection
Static QA now checks that:
- auth profile loading depends on `user.id`,
- same-user token/sign-in refresh events are ignored for app initialization,
- route scroll/session memory remains installed.

## Business logic
No database mutation behavior changed.
Release 108 and Release 109 have identical counts for:
- `from`
- `rpc`
- `insert`
- `update`
- `upsert`
- `delete`

## PWA
Service Worker cache version: `v1.2.0-r109`.
