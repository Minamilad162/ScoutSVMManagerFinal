# Release 111 — QA Results

- Static QA: **PASS — 96 source files / 55 registered routes**
- TypeScript/TSX transpile: **PASS — 95 executable files**
- CSS parse: **PASS — 0 errors**
- Service Worker syntax: **PASS**
- Service Worker cache version: **v1.2.0-r111**

Changed TS/TSX files vs Release 110:
- - src/pages/AdminMembers.tsx

Database mutations are unchanged:
- insert: 49 → 49
- update: 57 → 57
- upsert: 43 → 43
- delete: 28 → 28

New migration:
- `supabase/20_search_unlinked_auth_accounts.sql`
