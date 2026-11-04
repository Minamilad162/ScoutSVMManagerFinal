# Staging / Test Environment Setup

## Recommended layout
- `main` -> Netlify production site -> Supabase production project
- `staging` branch -> Netlify staging site -> Supabase staging project

## 1) Create a separate Supabase project
Create a second project for staging/test and apply the same SQL files in order:
1. `supabase/01_schema.sql`
2. `supabase/02_policies.sql`
3. `supabase/03_functions_triggers.sql`
4. `supabase/04_seed.sql` (optional)

## 2) Create a separate Netlify site
Create a second Netlify site connected to the same repository and point it to the `staging` branch.

## 3) Set environment variables
On the staging site set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`

Use the staging Supabase keys, not production keys.

## 4) Keep production isolated
Production site should remain connected to the production Supabase project only.

## 5) Recommended future improvement
Move database changes to versioned Supabase migrations via CLI so both production and staging stay aligned safely.
