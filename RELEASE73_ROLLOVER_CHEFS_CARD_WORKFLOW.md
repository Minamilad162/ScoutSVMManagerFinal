# Release 73 — Rollover Chefs Card Workflow

## Scope
Refine the New Year Rollover Wizard so it focuses on existing chef/leader accounts only instead of loading the full yearly member roster.

## Implemented

### 1) Load chefs/leaders only
- The detailed rollover loader now filters the source list to active members who:
  - have an existing `auth_user_id`
  - are not `is_equipier`
- Equipiers / children are excluded from this rollover workflow.
- Existing account IDs remain unchanged.

### 2) Card-based review UI
- Replaced the long wide table with responsive cards.
- Each card shows:
  - member name
  - current/source team
  - current/source rank
  - same account preserved badge
  - keep/remove toggle
  - new target team
  - new target rank
  - new responsibilities

### 3) Easier role editing
- Replaced the bulky multi-select role list with role cards.
- Every role can be toggled on/off.
- Every selected role can be scoped as:
  - Global
  - Team-scoped using the selected target team
- When target team changes, team-scoped responsibilities move with the new target team.
- `equipier` role is excluded from the responsibility options.

### 4) Better filters
- Added role/responsibility filter.
- Kept search and team filter.
- Kept “changes only” filter.

### 5) Safer default
- The old full-structure clone option is now off by default, to avoid accidentally copying all members/equipiers when the intended workflow is chef account rollover.

## Files changed
- `src/pages/AdminScoutYears.tsx`

## Database impact
- No new SQL is required for this release.
- Continue to keep SQL 12 from Release 72 if using delete-year support.

## Build note
- Build was attempted, but this container does not have local `vite` installed in `node_modules/.bin`, so the environment could not complete `npm run build` here.
- Run locally after extracting:
  - `npm install`
  - `npm run build`
