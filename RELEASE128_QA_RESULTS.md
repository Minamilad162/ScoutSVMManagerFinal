# Release 128 — QA Results

- Static QA: **PASS — 96 source files / 55 registered routes**
- TS/TSX transpile: **PASS — 95 executable files**
- CSS parse: **PASS — 0 errors**
- Service Worker syntax: **PASS**
- Login page direct Supabase sign-in bypass guard: **PASS**
- Credential `SIGNED_IN` pre-routing admission guard: **PASS**
- Inactive account immediate local sign-out guard: **PASS**
- Protected-route inactive UI reuses Login visual experience: **PASS**
- Official group-logo guard: **PASS**
- Database operation call counts: **unchanged from Release 127**
  - `.from()`: 578 → 578
  - `.rpc()`: 25 → 25
  - `.insert()`: 49 → 49
  - `.update()`: 57 → 57
  - `.upsert()`: 43 → 43
  - `.delete()`: 28 → 28

A clean Vite build was not run in this sandbox because project `node_modules` are not installed; source-level TypeScript transpilation and static/runtime syntax checks passed.

No SQL migration is required.
