# Release 115 — QA Results

- Static QA: **PASS — 96 source files / 55 registered routes**
- TypeScript/TSX transpile: **PASS — 95 executable files**
- CSS parse: **PASS — 0 errors**
- Service Worker syntax: **PASS**
- Release 115 optional Team/Role guards: **PASS**
- SQL migration structural checks: **PASS**

Database call counts vs Release 114:
- `.from()`: 578 → 578
- `.rpc()`: 24 → 24
- `.insert()`: 49 → 49
- `.update()`: 57 → 57
- `.upsert()`: 43 → 43
- `.delete()`: 28 → 28

New migration required: `supabase/21_optional_team_role_year_setup.sql`.
