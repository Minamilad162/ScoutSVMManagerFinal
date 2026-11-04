# Scout SVM — Deployment Checklist Release 66

## 1. Before deployment

- Confirm Supabase URL and anon key are correct.
- Confirm required SQL scripts were applied.
- Confirm `evaluation-voice-notes` bucket exists and remains private.
- Confirm no `node_modules` folder is included in the deployment ZIP.

## 2. Build

```powershell
npm install
npm run build
```

## 3. Deploy to Cloudflare Pages

```powershell
npx wrangler pages deploy dist --project-name=scout-svm --branch=production
```

Fallback if needed:

```powershell
npx --yes wrangler@3.114.17 pages deploy .\dist --project-name=scout-svm --branch=production
```

## 4. Post-deploy checks

### Must pass

- Login works.
- Menu permissions still match each account role.
- Admin pages do not appear for non-admin users.
- Camp Program loads and PDF downloads.
- Term evaluations load and save.
- Term voice notes record, save, play, and delete according to permissions.
- Final evaluations remain written only.
- Final evaluation stats still calculate correctly.
- Mobile layout is usable.

### Recommended role test accounts

- Admin / General leader.
- Chef de legion.
- Normal evaluated member.

## 5. Rollback

Keep the previous stable ZIP available before deploy. If production has any issue, redeploy the last stable `dist` generated from the previous release.
