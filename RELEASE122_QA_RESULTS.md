# Release 122 — QA Results

- Static QA: **PASS — 96 source files / 55 registered routes**
- TS/TSX transpile: **PASS — 95 executable files**
- CSS parse: **PASS — 0 errors**
- Service Worker syntax: **PASS**
- AdminReservationsAll route regression guard: **PASS**
- Compatibility component regression guard: **PASS**

Database mutation calls are unchanged vs Release 121:
- `.rpc()`: 25 → 25
- `.insert()`: 49 → 49
- `.update()`: 57 → 57
- `.upsert()`: 43 → 43
- `.delete()`: 28 → 28

Read `.from()` references decreased from **580 → 577** because the duplicate legacy `AdminReservationsAll` data loader was removed and the route now reuses the canonical modern reservations screen.

No SQL migration is required.
