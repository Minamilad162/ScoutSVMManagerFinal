# Release 129 — QA Results

- Static QA: **PASS — 96 source files / 55 registered routes**
- TS/TSX transpile: **PASS — 95 executable files**
- CSS parse: **PASS — 0 errors**
- Service Worker syntax: **PASS**
- Database call regression vs Release 128: **PASS**
  - `.from()`: 578 → 578
  - `.rpc()`: 25 → 25
  - `.insert()`: 49 → 49
  - `.update()`: 57 → 57
  - `.upsert()`: 43 → 43
  - `.delete()`: 28 → 28

No SQL migration required.

Note: a full `tsc` project typecheck could not run in this unpacked artifact because local npm dependencies are not installed in the execution environment. The repository-wide TypeScript `transpileModule` pass succeeded for all 95 executable TS/TSX files.
