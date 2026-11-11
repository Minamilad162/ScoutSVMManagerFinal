# Release 125 — QA Results

- Static QA: **PASS — 96 source files / 55 registered routes**
- TS/TSX transpile syntax validation: **PASS — 95 executable files**
- CSS parse: **PASS — 0 errors**
- Service Worker syntax: **PASS**
- Release 125 route/workflow regression guards: **PASS**
- Database-call count regression vs Release 124: **PASS**

Database-call counts (Release 124 → Release 125):

- `.from()`: 578 → 578
- `.rpc()`: 25 → 25
- `.insert()`: 49 → 49
- `.update()`: 57 → 57
- `.upsert()`: 43 → 43
- `.delete()`: 28 → 28

No SQL migration required.

Note: a full clean Vite build was not run in this container because `node_modules` is not installed; source-level static QA, TS/TSX transpile validation, CSS parsing and Service Worker syntax checks passed.
