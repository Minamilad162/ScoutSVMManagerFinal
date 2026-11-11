# Release 127 — QA Results

- Static QA: **PASS — 96 source files / 55 registered routes**
- TypeScript/TSX transpile: **PASS — 95 executable files**
- CSS parse: **PASS — 0 errors**
- Service Worker syntax: **PASS**
- Release 127 team-page UI marker guards: **PASS**
- Official-logo login guard: **PASS**
- Inactive-account branded gate guard: **PASS**

## Database call regression vs Release 126

- `.from()`: 578 → 578
- `.rpc()`: 25 → 25
- `.insert()`: 49 → 49
- `.update()`: 57 → 57
- `.upsert()`: 43 → 43
- `.delete()`: 28 → 28

No SQL migration is required.

A full Vite production build was not run in this workspace because project `node_modules` are not installed. Static QA, TS/TSX transpilation, CSS parsing, and service-worker syntax all passed.
