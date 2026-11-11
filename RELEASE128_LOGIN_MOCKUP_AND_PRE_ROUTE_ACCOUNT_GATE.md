# Release 128 — Login Mockup Parity + Pre-Route Current-Year Account Gate

## Login UI
The login experience was rebuilt to match the approved visual mockup rather than the Release 127 group-photo form.

- Uses the real ScoutSVM group logo already bundled in the project: `src/assets/brand/scout-svm-official-logo.webp`.
- Camp/sunset visual direction with mountains, trees, tent, lantern and compass/scarf decoration.
- Large white rounded authentication card.
- Arabic + English ScoutSVM branding.
- Arabic + English field captions.
- Large navy bilingual Sign In button.
- Gold / royal-blue / navy wave treatment at the bottom of the card.
- Responsive mobile layout and reduced-motion support.

## Inactive account UI
Inactive current-year accounts now use the exact same authentication visual system instead of an application-page warning.

The card switches to:
- warning graphic,
- `هذا الحساب غير نشط للسنة الحالية.`
- `This account is not active for the current year.`
- Return to Login button.

## Login behavior fix
Previously, Supabase emitted `SIGNED_IN` immediately after valid credentials, so the router could briefly open `/app` before the current-year membership check completed. Old accounts could therefore flash the Home page and then be logged out.

Release 128 changes the sequence to:

1. Validate email/password with Supabase Auth.
2. Hold the `SIGNED_IN` UI event while credential admission is pending.
3. Read the user's current-year membership and current-year roles.
4. Permanent Admin remains allowed even without a seasonal member row.
5. If the user belongs to the active current scout year, expose the user to the app and route to `/app`.
6. If the account was not transferred / is inactive for the current year, immediately clear the local session and keep the user on the Login experience with the inactive-account card.

The same gate is also applied to an existing saved session on initial application load before a user object is exposed to protected routes.

## Database
No SQL migration is required.
No database schema/RLS changes were made.
