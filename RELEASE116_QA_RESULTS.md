# Release 116 — QA Results

- Static QA: **PASS — 96 source files / 55 registered routes**
- TypeScript/TSX transpile: **PASS — 95 executable files**
- CSS parse: **PASS — 0 errors**
- Service Worker syntax: **PASS**
- Optional Rank regression guard: **PASS**

Application operation counts vs Release 115:
- `.from()`: 578 → 578
- `.rpc()`: 24 → 24
- `.insert()`: 49 → 49
- `.update()`: 57 → 57
- `.upsert()`: 43 → 43
- `.delete()`: 28 → 28

Required DB migration: `supabase/22_optional_rank_year_setup.sql`.
