import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const exists = (p) => fs.existsSync(path.join(root, p))
const failures = []
const assert = (ok, message) => { if (!ok) failures.push(message) }

const app = read('src/App.tsx')
const side = read('src/components/SideNav.tsx')
const reports = read('src/pages/ReportsCenter.tsx')
const policies = read('supabase/02_policies.sql')
const schema = read('supabase/01_schema.sql')
const scoutYearsApi = read('src/features/scoutYears/api.ts')
const routeGuard = read('src/components/RouteAccessGuard.tsx')
const home = read('src/pages/Home.tsx')
const sw = read('public/sw.js')
const main = read('src/main.tsx')
const knowledge = read('src/pages/KnowledgeBank.tsx')
const notifications = read('src/pages/Notifications.tsx')
const pushNotifications = read('src/lib/pushNotifications.ts')
const packageJson = JSON.parse(read('package.json'))
const packageLock = JSON.parse(read('package-lock.json'))
const sql15 = read('supabase/15_scout_year_atomic_activation.sql')
const sql16 = read('supabase/16_account_only_year_rollover.sql')
const sql17 = read('supabase/17_super_admin_historical_year_context.sql')
const sql18 = read('supabase/18_scout_year_activation_readiness.sql')
const adminScoutYears = read('src/pages/AdminScoutYears.tsx')
const adminMembers = read('src/pages/AdminMembers.tsx')

// Known regression guards.
assert(app.includes('<Route path="AdminEvaluations"'), 'AdminEvaluations route missing')
assert(side.includes("'/app/AdminEvaluations'"), 'SideNav still points to wrong AdminEvaluations route')
assert(!side.includes("'/app/AdminEvaluation'"), 'Legacy /app/AdminEvaluation link still exists')
assert(reports.includes("nav('/app/TeamStatistics')"), 'Reports Center back button does not target TeamStatistics')
assert(!reports.includes("nav('/app/TeamDashboard')"), 'Reports Center still targets missing TeamDashboard route')

// RLS regression guards.
assert(!/with\s+check\s*\(\s*true\s*\)/i.test(policies), 'Unrestricted WITH CHECK (true) remains in policies')
assert(policies.includes('using (user_id = auth.uid())'), 'user_roles self-read policy is not corrected')
assert((policies.match(/security definer/gi) || []).length >= 2, 'RLS helper functions are not SECURITY DEFINER')
assert(policies.includes('eval_answers write authorized'), 'Hardened evaluation_answers write policy missing')
assert(policies.includes("public.has_role('chef_de_legion', team_id)"), 'Chef de Legion team-scoped permission hardening missing')
assert(schema.includes('uq_user_roles_global'), 'global user role uniqueness index missing')
assert(schema.includes('uq_user_roles_team_scoped'), 'team-scoped user role uniqueness index missing')
assert(scoutYearsApi.includes('حذف السنة متوقف بأمان'), 'Unsafe scout-year direct-delete fallback still present')
assert(exists('supabase/14_security_hardening_phase1.sql'), 'Release 95 security migration is missing')


// Release 96 route/access hardening.
assert(routeGuard.includes('sameTeamRoles'), 'RouteAccessGuard same-team role support missing')
for (const sensitiveRoute of ['AdminAttendance', 'AdminEvaluations', 'admin-scout-years', 'admin-members', 'admin-audit-log']) {
  const guardedRoute = `<Route path="${sensitiveRoute}" element={<RouteAccessGuard`
  assert(app.includes(guardedRoute), `Sensitive route ${sensitiveRoute} is not protected by RouteAccessGuard`)
}
assert(app.includes("globalRoles={['responsable_finance']}><AdminFinance"), 'AdminFinance is not limited to admin/global finance')
assert(app.includes("sameTeamRoles={['responsable_materials', 'chef_de_legion']}><AdminFieldReservations"), 'AdminFieldReservations same-team guard missing')
assert(side.includes('if (isGlobalFinance)'), 'Global finance navigation scope is not enforced')
assert(side.includes('hasMaterialChefSameTeam'), 'Materials/chef same-team navigation check missing')
assert(home.includes('if (isLeader || isFinanceAdmin)'), 'Home finance quick action is still shown to users without finance/leader permission')

// Atomic Scout Year activation.
assert(exists('supabase/15_scout_year_atomic_activation.sql'), 'Release 96 SQL15 atomic Scout Year migration is missing')
assert(sql15.includes('set_current_scout_year_atomic'), 'Atomic Scout Year RPC missing from SQL15')
assert(sql15.includes('pg_advisory_xact_lock'), 'Atomic Scout Year RPC does not serialize concurrent switches')
assert(sql15.includes('uq_scout_years_single_current'), 'Single-current-year database invariant missing')
assert(scoutYearsApi.includes("supabase.rpc('set_current_scout_year_atomic'"), 'Frontend still switches current Scout Year with non-atomic client updates')
assert(!scoutYearsApi.includes(".update({ is_current: false"), 'Legacy non-atomic current-year reset remains in Scout Year API')

// PWA cache invalidation.
assert(sw.includes("const VERSION = 'v1.2.0-r116'"), 'Service worker release cache version was not bumped')
assert(sw.includes('staleWhileRevalidate'), 'Service worker stable public assets are not refreshed')
assert(main.includes("updateViaCache: 'none'"), 'Service worker registration can still be satisfied from stale HTTP cache')

// Release 106 account-only year rollover.
assert(exists('supabase/16_account_only_year_rollover.sql'), 'Release 106 SQL16 account-only rollover migration is missing')
assert(sql16.includes('admin_replace_scout_year_account_roster'), 'Account-only rollover RPC missing from SQL16')
assert(sql16.includes('admin_list_auth_accounts'), 'Auth account email lookup RPC missing from SQL16')
assert(sql16.includes('admin_list_unlinked_auth_accounts'), 'Unlinked Auth account listing RPC missing from SQL16')
assert(adminScoutYears.includes("supabase.rpc('admin_replace_scout_year_account_roster'"), 'Scout Year UI is not using the account-only rollover RPC')
assert(adminScoutYears.includes('roleKeys: targetRoleKeys'), 'Target-year roles are not loaded independently')
assert(!adminScoutYears.includes('targetRoleKeys.length ? targetRoleKeys : sourceRoleKeys'), 'Source-year roles can still be inherited by default')
assert(adminMembers.includes("searchParams.get('year')"), 'Admin Members cannot manage a selected Scout Year')
assert(adminMembers.includes('admin_list_unlinked_auth_accounts'), 'Admin Members does not surface new unlinked Auth accounts')
assert(adminMembers.includes('syncLegacy: isSelectedCurrentYear'), 'Draft-year member/role edits can still leak into legacy current-year state')

// Release 107 Super Admin historical Scout Year context.
assert(exists('supabase/17_super_admin_historical_year_context.sql'), 'Release 107 SQL17 historical context migration is missing')
assert(sql17.includes("where public.has_role('admin')"), 'Historical context views are not restricted to Admin')
assert(sql17.includes('v_members_context'), 'Historical member context view missing from SQL17')
assert(sql17.includes('v_user_roles_context'), 'Historical role context view missing from SQL17')
assert(sql17.includes('v_terms_context'), 'Historical terms context view missing from SQL17')
assert(app.includes('super-admin-year-switcher'), 'Super Admin global Scout Year selector missing from app header')
assert(app.includes('historical-year-banner'), 'Historical Scout Year banner missing')
assert(app.includes('resetViewedScoutYear'), 'Historical view cannot return to the physical current year')
const scoutYearProvider = read('src/components/ScoutYearProvider.tsx')
const supabaseClient = read('src/lib/supabase.ts')
assert(scoutYearProvider.includes('actualCurrentScoutYear'), 'Scout Year provider does not distinguish physical current year from viewed year')
assert(scoutYearProvider.includes('sessionStorage'), 'Super Admin viewed year is not session-scoped')
assert(supabaseClient.includes('scoutYearFrom'), 'Historical Scout Year queries do not inject the selected scout_year_id')

// Release 108 — readiness gate + performance
assert(exists('supabase/18_scout_year_activation_readiness.sql'), 'Release 108 SQL18 activation readiness migration is missing')
assert(sql18.includes('admin_scout_year_activation_readiness'), 'Activation readiness RPC missing from SQL18')
assert(sql18.includes('admin_list_scout_year_overview'), 'Single-query Scout Year overview RPC missing from SQL18')
assert(sql18.includes('idx_member_season_assignments_year_active'), 'Year/member performance index missing from SQL18')
assert(sql18.includes('Scout Year is not ready for activation'), 'Database activation readiness guard missing from SQL18')
assert(scoutYearsApi.includes('listScoutYearOverview'), 'Scout Year admin page API is missing the optimized overview loader')
assert(scoutYearsApi.includes('fetchScoutYearActivationReadiness'), 'Scout Year readiness API is missing')
assert(adminScoutYears.includes('مراجعة الجاهزية والتفعيل'), 'Scout Year activation UI bypasses readiness review')
assert(supabaseClient.includes('HISTORICAL_READ_ONLY'), 'Historical REST write guard is missing')

// Release 103 notification consent + dependency hardening.
assert(!app.includes('Notification.requestPermission'), 'App shell still triggers notification permission directly')
assert(pushNotifications.includes('requestPermission?: boolean'), 'Push subscription helper does not support explicit consent mode')
assert(pushNotifications.includes('if (!options.requestPermission) return'), 'Push helper can still prompt without explicit user action')
assert(notifications.includes('تفعيل إشعارات الجهاز'), 'Notifications page explicit push opt-in action missing')
assert(!packageJson.dependencies?.xlsx, 'Known-vulnerable xlsx dependency still exists in package.json')
assert(!packageLock.packages?.['node_modules/xlsx'], 'Known-vulnerable xlsx dependency still exists in package-lock.json')
assert(packageLock.packages?.['node_modules/vite']?.version === '5.4.21', 'Vite is not pinned to the patched 5.4.21 release')
assert(exists('.github/workflows/ci.yml'), 'Production CI workflow is missing')

// Knowledge Bank asset optimization.
assert(!knowledge.includes('/knowledge/camp-background.png'), 'Knowledge Bank still references heavy PNG background')
assert(knowledge.includes('/knowledge/camp-background.webp'), 'Knowledge Bank optimized WebP background missing')
assert(knowledge.includes('loading="lazy"'), 'Knowledge Bank secondary artwork is not lazy-loaded')
const knowledgeDir = path.join(root, 'public', 'knowledge')
const knowledgeBytes = fs.readdirSync(knowledgeDir)
  .map((name) => path.join(knowledgeDir, name))
  .filter((file) => fs.statSync(file).isFile())
  .reduce((sum, file) => sum + fs.statSync(file).size, 0)
assert(knowledgeBytes < 1024 * 1024, `Knowledge Bank runtime assets exceed 1 MB (${Math.round(knowledgeBytes / 1024)} KB)`)

// Static route/link scan for exact /app/... string literals.
const registered = new Set(['/app'])
for (const match of app.matchAll(/<Route\s+path="([^"]+)"/g)) {
  const routePath = match[1]
  if (routePath === '/') registered.add('/')
  else if (routePath.startsWith('/')) registered.add(routePath)
  else registered.add(`/app/${routePath}`)
}

const sourceRoot = path.join(root, 'src')
const sourceFiles = []
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const stat = fs.statSync(p)
    if (stat.isDirectory()) walk(p)
    else if (/\.(ts|tsx)$/.test(name)) sourceFiles.push(p)
  }
}
walk(sourceRoot)

const allSourceText = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
assert(!allSourceText.includes("import('xlsx')"), 'Legacy xlsx dynamic import still exists in source')
assert(!allSourceText.includes('from \'xlsx\''), 'Legacy xlsx static import still exists in source')
assert(!/\.xlsx\.(read|load)\s*\(/.test(allSourceText), 'ExcelJS workbook-reading path is present; Release 103 export policy is write-only')
assert(!/WorkbookReader/.test(allSourceText), 'ExcelJS streaming reader path is present; Release 103 export policy is write-only')

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8')
  for (const match of content.matchAll(/['"](\/app\/[A-Za-z0-9_\-/]+)['"]/g)) {
    const target = match[1]
    const exact = registered.has(target)
    const parameterMatch = [...registered].some((route) => route.includes('/:') && target.startsWith(`${route.split('/:')[0]}/`))
    assert(exact || parameterMatch, `Broken static route target ${target} in ${path.relative(root, file)}`)
  }
}

// Public asset references that use an absolute /... path in src.
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8')
  for (const match of content.matchAll(/['"](\/(?:knowledge|home|icons|field-maps)\/[^'"`]+)['"]/g)) {
    const assetPath = `public${match[1]}`
    assert(exists(assetPath), `Missing public asset ${match[1]} referenced by ${path.relative(root, file)}`)
  }
}

if (failures.length) {
  console.error(`QA static checks FAILED (${failures.length})`)
  for (const item of failures) console.error(`- ${item}`)
  process.exit(1)
}


// Release 109 regression guards: background tab auth events must not remount the app.
{
  const authProvider = read('src/components/AuthProvider.tsx')
  assert(
    authProvider.includes("event === 'TOKEN_REFRESHED'") &&
      authProvider.includes("event === 'SIGNED_IN'") &&
      authProvider.includes("nextUserId === currentUserId"),
    'AuthProvider must ignore same-user background token/sign-in refresh events'
  )
  assert(
    authProvider.includes("}, [user?.id])") && !authProvider.includes("}, [user])"),
    'Auth profile loading must depend on user.id, not the full user object'
  )

  const appSource = read('src/App.tsx')
  assert(
    appSource.includes('useRouteScrollMemory(routeStateKey)'),
    'Route scroll/session memory guard is missing'
  )
}


// Release 113 guard: warning InlineAlert tone must be supported.
{
  const inlineAlert = read('src/components/ui/InlineAlert.tsx')
  assert(
    inlineAlert.includes("'warning'") &&
      inlineAlert.includes("warning:") &&
      inlineAlert.includes("toneMap[tone] ?? toneMap.info"),
    'InlineAlert warning tone/fallback is missing'
  )
}


// Release 114 guards: draft planning years are editable, historical years remain read-only.
{
  const supabaseSource = read('src/lib/supabase.ts')
  assert(
    supabaseSource.includes('scoutYearViewReadOnly') &&
      supabaseSource.includes('options?.readOnly') &&
      supabaseSource.includes('if (scoutYearViewReadOnly && scoutYearViewOverrideId'),
    'Scout year write guard must distinguish draft planning from historical read-only mode'
  )

  const provider = read('src/components/ScoutYearProvider.tsx')
  assert(
    provider.includes("viewedYear.status === 'draft'") &&
      provider.includes("storedYear.status !== 'draft'") &&
      provider.includes('isPlanningView') &&
      provider.includes('isReadOnlyView'),
    'ScoutYearProvider planning/read-only mode split is missing'
  )

  const members = read('src/pages/AdminMembers.tsx')
  assert(
    members.includes("selectedYear?.status === 'draft'") &&
      members.includes('canEditSelectedYear') &&
      members.includes('ensureSelectedYearEditable'),
    'AdminMembers must allow Current/Draft only and keep old years read-only'
  )
}


// Release 115 guards: Team and System Role are optional for year setup.
{
  const members = read('src/pages/AdminMembers.tsx')
  assert(
    !members.includes("missing.push('team')") &&
      !members.includes("missing.push('role')") &&
      members.includes('الفريق والـRole اختياريان') &&
      members.includes('— بدون فريق —'),
    'AdminMembers must allow optional Team/Role setup'
  )

  const years = read('src/pages/AdminScoutYears.tsx')
  assert(
    years.includes('بدون فريق (مسموح)') &&
      years.includes('بدون Role (مسموح)') &&
      years.includes('Team وSystem Role اختياريان'),
    'Scout Year readiness UI must treat Team/Role as optional'
  )
}


// Release 116 guards: Team, Rank and Role are optional during year setup.
{
  const members = read('src/pages/AdminMembers.tsx')
  assert(
    !members.includes("missing.push('rank')") &&
      members.includes("الرتبة <span className=\"text-slate-400\">(اختياري)</span>") &&
      members.includes("rankId: chefRankId === '' ? null : Number(chefRankId)"),
    'Rank must be optional in AdminMembers year setup'
  )

  const sql22 = read('supabase/22_optional_rank_year_setup.sql')
  assert(
    sql22.includes('missing_rank_optional') &&
      !sql22.includes("'code','missing_rank','label','أعضاء بدون رتبة'") &&
      !sql22.includes('and v_missing_rank = 0'),
    'Rank must be a warning, not an activation blocker'
  )
}

console.log(`QA static checks PASS — ${sourceFiles.length} source files, ${registered.size} registered routes`)
