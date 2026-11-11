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
assert(sw.includes("const VERSION = 'v1.2.0-r135'"), 'Service worker release cache version was not bumped')
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


// Release 117 guards: Knowledge Bank is hidden/disabled; Admin sees full navigation.
{
  const app = read('src/App.tsx')
  const nav = read('src/components/SideNav.tsx')
  const home = read('src/pages/Home.tsx')

  assert(!app.includes("import('./pages/KnowledgeBank')"), 'Knowledge Bank lazy import must stay disabled')
  assert(app.includes('<Route path="knowledge-bank" element={<Navigate to="/app" replace />} />'), 'Knowledge Bank direct URL must redirect to Home')
  assert(!home.includes("to: '/app/knowledge-bank'"), 'Home must not expose Knowledge Bank shortcuts')
  assert(!nav.includes("{ to: '/app/knowledge-bank'"), 'Side navigation must not expose Knowledge Bank')
  assert(!app.includes('MobileNavGlyph type="knowledge"'), 'Mobile bottom navigation must not expose Knowledge Bank')
  assert(
    nav.includes("if (isAdmin)") &&
      nav.includes("pushUnique(res, '/app/LegionEvaluations', 'تقييم فريقي')") &&
      nav.includes("pushUnique(res, '/app/TeamCases', 'ملاحظات الفريق')") &&
      nav.includes("pushUnique(res, '/app/TeamFinance', 'ميزانية الفريق')") &&
      nav.includes("pushUnique(res, '/app/MaterialTeamReservation', 'حجز الأدوات')") &&
      nav.includes("pushUnique(res, '/app/TeamSecretary', 'سكرتارية فريقي')") &&
      nav.includes("pushUnique(res, '/app/reports-center', 'مركز التقارير')"),
    'Admin navigation must include operational/team sections in addition to admin sections'
  )
}


// Release 118 guards: permanent Super Admin + complete management navigation.
{
  const referenceApi = read('src/features/reference/api.ts')
  assert(
    referenceApi.includes("supabase.rpc('has_role'") &&
      referenceApi.includes("_role: 'admin'") &&
      referenceApi.includes("role_slug: 'admin'") &&
      referenceApi.includes('permanent-admin'),
    'Permanent admin fallback is missing from fetchCurrentUserRoles'
  )

  const sideNav = read('src/components/SideNav.tsx')
  const requiredAdminNav = [
    '/app/AdminDashboard',
    '/app/admin-scout-years',
    '/app/year-responsibilities',
    '/app/admin-terms-meetings',
    '/app/admin-members',
    '/app/AdminFinance',
    '/app/financeEvent',
    '/app/AdminAttendance',
    '/app/MaterialAdmin',
    '/app/AdminSecretary',
    '/app/AdminEvents',
    '/app/admin-audit-log',
  ]
  for (const path of requiredAdminNav) {
    assert(sideNav.includes(path), `Admin navigation missing ${path}`)
  }
  assert(!sideNav.includes("'/app/knowledge-bank'"), 'Knowledge Bank must remain hidden from navigation')
}


// Release 119 materials redesign guards
{
  const booking = read('src/pages/MaterialsTeamReservations.tsx')
  const admin = read('src/pages/MaterialsAdmin.tsx')
  const css = read('src/index.css')

  assert(booking.includes('type="datetime-local"') && booking.includes('step={60}'), 'Material booking must keep minute-level from/to inputs')
  assert(booking.includes("supabase.rpc('material_available_qty'") && booking.includes(".from('material_reservations').insert"), 'Material booking availability/save logic must remain wired')
  assert(booking.includes('materials119-tool-grid') && booking.includes('materials119-booking-card'), 'Material booking redesign shell is missing')
  assert(admin.includes("supabase.from('materials')") && admin.includes('materials119-admin-tabs'), 'Materials admin redesign or CRUD wiring is missing')
  assert(css.includes('Release 119 — Materials booking + inventory redesign') && css.includes('@media (prefers-reduced-motion: reduce)'), 'Materials redesign CSS/reduced-motion guard is missing')
}



// Release 120 guards: storage relation fix + return workflow redesign.
{
  const reservationsAdmin = read('src/pages/ReservationsAdmin.tsx')
  const returns = read('src/pages/MaterialsReturnApprove.tsx')
  const css = read('src/index.css')

  assert(!reservationsAdmin.includes("select('id,name,storage')"), 'Legacy materials.storage query must not return')
  assert(
    reservationsAdmin.includes('storage_location_id') &&
      reservationsAdmin.includes('storage_locations:storage_location_id(name)') &&
      reservationsAdmin.includes(".is('soft_deleted_at', null)"),
    'Admin reservations must use storage location relation and exclude cancelled reservations'
  )
  assert(
    returns.includes(".from('material_return_approvals')") &&
      returns.includes('statusMeta(') &&
      returns.includes('materials120-return-row') &&
      returns.includes('Africa/Cairo'),
    'Materials return workflow must keep approval persistence, lifecycle statuses, and Cairo time handling'
  )
  assert(css.includes('Release 120 — materials return / hand-back workflow'), 'Release 120 return workflow styles are missing')
}


// Release 121 reservations redesign guards
{
  const reservationsAdmin = read('src/pages/ReservationsAdmin.tsx')
  assert(reservationsAdmin.includes("storage_locations:storage_location_id(name)"), 'Reservations admin must resolve storage locations through storage_location_id')
  assert(reservationsAdmin.includes("field_zones:field_zone_id(name)"), 'Reservations admin must resolve field zones through field_zone_id')
  assert(!reservationsAdmin.includes("select('id,name,storage')"), 'Legacy materials.storage query must stay removed')
  assert(!reservationsAdmin.includes('zone_name'), 'Reservations admin must not depend on legacy field_reservations.zone_name')
  assert(reservationsAdmin.includes("to=\"/app/MaterialsReturnApprove\""), 'Reservations details must link to the existing return workflow')
  assert(reservationsAdmin.includes('materials121-detail-panel'), 'Reservations detail panel is missing')
}


// Release 122 guards: AdminReservationsAll must render the modern reservations UI.
{
  const app = read('src/App.tsx')
  const adminAll = read('src/pages/AdminReservationsAll.tsx')
  const modern = read('src/pages/ReservationsAdmin.tsx')

  assert(
    app.includes('<Route path="AdminReservationsAll" element={<RouteAccessGuard adminOnly><ReservationsAdmin /></RouteAccessGuard>} />'),
    'AdminReservationsAll route must render ReservationsAdmin directly'
  )
  assert(
    adminAll.includes("import ReservationsAdmin from './ReservationsAdmin'") &&
      adminAll.includes('return <ReservationsAdmin />'),
    'AdminReservationsAll compatibility component must render the modern reservations UI'
  )
  assert(
    modern.includes('materials121-page') && modern.includes('materials121-detail-panel'),
    'Modern reservations dashboard shell/detail panel is missing'
  )
}


// Release 123 guards: redesigned Attendance / Finance / Field pages keep real workflows.
{
  const attendance = read('src/pages/AdminAttendance.tsx')
  assert(attendance.includes('attendance123-page') && attendance.includes('saveAttendance') && attendance.includes('loadStats'), 'Attendance redesign/workflow guard failed')

  const finance = read('src/pages/AdminFinance.tsx')
  assert(finance.includes('finance123-page') && finance.includes("from('team_budgets')") && finance.includes("from('expenses')") && finance.includes('saveBudget'), 'Finance redesign/workflow guard failed')

  const field = read('src/pages/AdminFieldReservations.tsx')
  assert(field.includes('field123-page') && field.includes('<FieldMaps') && field.includes('saveRow') && field.includes('saveEditMat') && field.includes('cancelMaterialReservation'), 'Field redesign/workflow guard failed')
}


// Release 125 guards — redesigned pages must stay on their real routes and preserve workflows.
{
  const secretary = read('src/pages/AdminSecretary.tsx')
  assert(secretary.includes('secretary125-page') && secretary.includes('saveEquipier') && secretary.includes('deleteEquipier'), 'AdminSecretary Release 125 UI or member actions missing')

  const financeEvent = read('src/pages/financeEvent.tsx')
  assert(financeEvent.includes('eventfinance125-page') && financeEvent.includes('updateEvent') && financeEvent.includes('addBudgetLine') && financeEvent.includes('addExpense') && financeEvent.includes('handleExport'), 'financeEvent Release 125 UI or finance workflows missing')

  const minutes = read('src/pages/MeetingMinutesList.tsx')
  assert(minutes.includes('minutes125-page') && minutes.includes('/app/meeting-minutes/new') && minutes.includes('/app/meeting-tasks?minuteId='), 'MeetingMinutes Release 125 UI or navigation workflows missing')

  const app = read('src/App.tsx')
  assert(app.includes('path="financeEvent"') && app.includes('path="meeting-minutes"') && app.includes('path="AdminSecretary"'), 'Release 125 target routes missing')
}


// Release 126 guards: accounts omitted from the active scout year are blocked from the app.
{
  const auth = read('src/components/AuthProvider.tsx')
  assert(
    auth.includes('accountInactive') &&
      auth.includes('hasActiveCurrentYearMembership') &&
      auth.includes("role.role_slug === 'admin'") &&
      auth.includes('Boolean(me?.member_id)'),
    'Current-year account activation gate is missing from AuthProvider'
  )

  const app = read('src/App.tsx')
  assert(
    app.includes('الحساب غير نشط للسنة الكشفية الحالية') &&
      app.includes('if (accountInactive)') &&
      app.includes('إعادة التحقق') &&
      app.includes('تسجيل الخروج'),
    'Inactive account blocking screen is missing from ProtectedLayout'
  )
}


// Release 127 guards: five team pages share the new visual system and login uses official brand asset.
{
  const pageGuards = [
    ['src/pages/TeamCases.tsx', 'teamcases127-page'],
    ['src/pages/LegionAttendance.tsx', 'legionattendance127-page'],
    ['src/pages/TeamStatistics.tsx', 'teamstatistics127-page'],
    ['src/pages/FieldReservationsTeam.tsx', 'fieldreservations127-page'],
    ['src/pages/TeamFinance.tsx', 'teamfinance127-page'],
  ]
  for (const [file, marker] of pageGuards) {
    const source = read(file)
    assert(source.includes(marker) && source.includes('teamops127-hero'), `${file} is missing Release 127 UI markers`)
  }

  const login = read('src/pages/Login.tsx')
  assert(
    login.includes("scout-svm-official-logo.webp") &&
      login.includes('login127-shell') &&
      login.includes('Scout Group Management System'),
    'Release 127 branded login is missing'
  )

  const app = read('src/App.tsx')
  assert(
    app.includes('inactive127-shell') &&
      app.includes('الحساب غير نشط للسنة') &&
      app.includes('scoutSvmOfficialLogo'),
    'Release 127 inactive-account experience is missing'
  )
}


// Release 128 — login mockup parity + current-year admission before routing.
{
  const login = read('src/pages/Login.tsx')
  const auth = read('src/components/AuthProvider.tsx')
  assert(login.includes('auth128-shell') && login.includes('auth128-card-wave'), 'Release 128 login design is missing')
  assert(login.includes('scout-svm-official-logo.webp'), 'Login must use the official ScoutSVM group logo')
  assert(!login.includes('supabase.auth.signInWithPassword'), 'Login page must not bypass the AuthProvider admission gate')
  assert(login.includes('accountInactive') && login.includes('هذا الحساب غير نشط للسنة الحالية'), 'Inactive-account login state is missing')
  assert(auth.includes('credentialSignInRef') && auth.includes('fetchAccessSnapshot'), 'Pre-routing account admission gate is missing')
  assert(auth.includes('if (!snapshot.allowed)') && auth.includes("signOut({ scope: 'local' })"), 'Inactive accounts must be signed out before application routing')
  assert(auth.includes("if (event === 'SIGNED_IN' && credentialSignInRef.current) return"), 'SIGNED_IN must not expose credential-login users before admission')
  const app = read('src/App.tsx')
  assert(app.includes('if (accountInactive) return <Login />'), 'Protected routes must reuse the exact Login inactive-account UI')
}

console.log(`QA static checks PASS — ${sourceFiles.length} source files, ${registered.size} registered routes`)

// Release 130: every financial screen/report must scope expenses to the Scout Year.
const yearScope = read('src/lib/scoutYearScope.ts')
const termApi = read('src/features/reference/api.ts')
const teamFinance = read('src/pages/TeamFinance.tsx')
const financeApi = read('src/features/reports/api.ts')
const adminStats = read('src/pages/Admin.tsx')
const knowledgeFinance = read('src/features/knowledgeBank/api.ts')
assert(yearScope.includes('getTermYearBounds') && yearScope.includes('belongsToScoutYear'), 'Year/term date helper missing')
assert(termApi.includes(".eq('scout_year_id', year.id)"), 'fetchTerms can show terms from other Scout Years')
assert(teamFinance.includes(".gte('expense_date', termMin).lte('expense_date', termMax)"), 'Team Finance expense list is not date-scoped')
assert(teamFinance.includes('validExpenses = (exps ?? []).filter'), 'Team Finance Excel export can leak old dates')
assert(financeApi.includes('filteredTermIds') && financeApi.includes(".gte('expense_date'"), 'Finance reports can show cross-year expenses')
assert(!adminStats.includes("supabase.from('v_finance_summary')"), 'Admin finance stats still read an unscoped view')
assert(knowledgeFinance.includes('getTermYearBounds(year, scopedFinanceTerms.find'), 'Knowledge Bank finance expenses are not scoped to term/year')
assert(exists('tests/scout-year-scope.test.mjs'), 'Scout Year date regression tests are missing')
