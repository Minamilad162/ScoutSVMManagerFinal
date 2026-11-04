import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { AuthProvider, useAuth } from './components/AuthProvider'
import { ScoutYearProvider, useScoutYear } from './components/ScoutYearProvider'
import { PageLoader } from './components/ui/PageLoader'
import { RouteAccessGuard } from './components/RouteAccessGuard'
import scoutSvmOfficialLogo from './assets/brand/scout-svm-official-logo.webp'
import { ensurePushSubscription } from './lib/pushNotifications'

const SideNav = lazy(() => import('./components/SideNav'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Finance = lazy(() => import('./pages/Finance'))
const Materials = lazy(() => import('./pages/Materials'))
const Evaluation = lazy(() => import('./pages/Evaluation'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Admin = lazy(() => import('./pages/Admin'))
const Login = lazy(() => import('./pages/Login'))
const Home = lazy(() => import('./pages/Home'))
const ReservationsAdmin = lazy(() => import('./pages/ReservationsAdmin'))
const AdminMembers = lazy(() => import('./pages/AdminMembers'))
const MaterialsTeamReservations = lazy(() => import('./pages/MaterialsTeamReservations'))
const MaterialsAdmin = lazy(() => import('./pages/MaterialsAdmin'))
const AdminAttendance = lazy(() => import('./pages/AdminAttendance'))
const AdminReservationsAll = lazy(() => import('./pages/AdminReservationsAll'))
const AdminFieldReservations = lazy(() => import('./pages/AdminFieldReservations'))
const FieldReservationsTeam = lazy(() => import('./pages/FieldReservationsTeam'))
const AdminEvaluations = lazy(() => import('./pages/AdminEvaluations'))
const LegionEvaluations = lazy(() => import('./pages/LegionEvaluations'))
const MyEvaluation = lazy(() => import('./pages/MyEvaluation'))
const LegionAttendance = lazy(() => import('./pages/LegionAttendance'))
const AdminFinance = lazy(() => import('./pages/AdminFinance'))
const TeamFinance = lazy(() => import('./pages/TeamFinance'))
const AdminSecretary = lazy(() => import('./pages/AdminSecretary'))
const TeamSecretary = lazy(() => import('./pages/TeamSecretary'))
const TeamSecretaryAttendance = lazy(() => import('./pages/TeamSecretaryAttendance'))
const AdminEvents = lazy(() => import('./pages/AdminEvents'))
const AdminEvalQuestions = lazy(() => import('./pages/AdminEvalQuestions'))
const FinanceEvent = lazy(() => import('./pages/financeEvent'))
const MaterialsReturnApprove = lazy(() => import('./pages/MaterialsReturnApprove'))
const ChefsEvaluationOverview = lazy(() => import('./pages/ChefsEvaluationOverview'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const StorageInventory = lazy(() => import('./pages/StorageInventory'))
const TeamCases = lazy(() => import('./pages/TeamCases'))
const TeamStatistics = lazy(() => import('./pages/TeamStatistics'))
const MeetingMinutesList = lazy(() => import('./pages/MeetingMinutesList'))
const MeetingMinuteForm = lazy(() => import('./pages/MeetingMinuteForm'))
const MeetingTasks = lazy(() => import('./pages/MeetingTasks'))
const CampInstallmentsList = lazy(() => import('./pages/CampInstallmentsList'))
const CampInstallmentForm = lazy(() => import('./pages/CampInstallmentForm'))
const CampInstallmentDetails = lazy(() => import('./pages/CampInstallmentDetails'))
const MyCampCollections = lazy(() => import('./pages/MyCampCollections'))
const AdminScoutYears = lazy(() => import('./pages/AdminScoutYears'))
const AdminTermsMeetings = lazy(() => import('./pages/AdminTermsMeetings'))
const MemberProfile360 = lazy(() => import('./pages/MemberProfile360'))
const AdminAuditLog = lazy(() => import('./pages/AdminAuditLog'))
const ReportsCenter = lazy(() => import('./pages/ReportsCenter'))
const AdminBestChefs = lazy(() => import('./pages/AdminBestChefs'))
const BestChefsGallery = lazy(() => import('./pages/BestChefsGallery'))
const CampProgram = lazy(() => import('./pages/CampProgram'))
const YearResponsibilities = lazy(() => import('./pages/YearResponsibilities'))
const KnowledgeBank = lazy(() => import('./pages/KnowledgeBank'))

function PageFallback() {
  return (
    <div className="p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        جاري تحميل الصفحة...
      </div>
    </div>
  )
}


const PAGE_LABELS: Record<string, string> = {
  '/app': 'الرئيسية',
  '/app/attendance': 'الحضور',
  '/app/finance': 'المالية',
  '/app/materials': 'الأدوات',
  '/app/reservation': 'الحجوزات',
  '/app/TeamSecretaryAttendance': 'غياب فريقي',
  '/app/legacy-evaluation': 'التقييم القديم',
  '/app/AdminDashboard': 'لوحة التحكم',
  '/app/member-profile': 'ملفي الشخصي',
  '/app/best-chefs': 'أفضل الـ chefs',
  '/app/AdminReservationsAll': 'الحجوزات',
  '/app/AdminFieldReservations': 'إدارة الأرض',
  '/app/AdminAttendance': 'إدارة الحضور',
  '/app/AdminFinance': 'إدارة الميزانية',
  '/app/MaterialAdmin': 'إدارة الأدوات',
  '/app/AdminEvaluations': 'التقييمات',
  '/app/admin': 'لوحة الإدارة',
  '/app/admin-scout-years': 'السنة الكشفية',
  '/app/year-responsibilities': 'مسؤوليات السنة',
  '/app/knowledge-bank': 'بنك المعرفة',
  '/app/admin-terms-meetings': 'الترمات والاجتماعات',
  '/app/admin-members': 'الأعضاء والأدوار',
  '/app/admin-best-chefs': 'أفضل الـ chefs',
  '/app/admin-audit-log': 'سجل العمليات',
  '/app/AdminSecretary': 'إدارة السكرتارية',
  '/app/AdminEvents': 'الفعاليات',
  '/app/AdminEvalQuestions': 'أسئلة التقييم',
  '/app/financeEvent': 'ميزانية المجموعة',
  '/app/MaterialsReturnApprove': 'تسليم العهدة',
  '/app/meeting-minutes': 'المحاضر',
  '/app/meeting-tasks': 'متابعة التاسكات',
  '/app/camp-installments': 'التقسيط',
  '/app/my-camp-collections': 'تحصيل المعسكرات',
  '/app/camp-program': 'نظام المعسكر',
  '/app/ChefsEvaluationOverview': 'التقييم النهائي',
  '/app/LegionEvaluations': 'تقييم فريقي',
  '/app/TeamCases': 'ملاحظات الفريق',
  '/app/TeamStatistics': 'إحصائيات الفريق',
  '/app/LegionAttendance': 'غياب فريقي',
  '/app/FieldReservationsTeam': 'حجز الأرض',
  '/app/TeamFinance': 'ميزانية الفريق',
  '/app/MaterialTeamReservation': 'حجز الأدوات',
  '/app/TeamSecretary': 'سكرتارية فريقي',
  '/app/reports-center': 'مركز التقارير',
  '/app/evaluation': 'تقييمي',
  '/app/storage': 'أماكن العهدة',
  '/app/notifications': 'الإشعارات',
}

function getPageLabel(pathname: string) {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname]
  const matched = Object.keys(PAGE_LABELS)
    .filter((key) => pathname === key || pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0]
  return matched ? PAGE_LABELS[matched] : 'Scout SVM'
}

function ScrollTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 520)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      className={`scroll-top-fab ${visible ? 'is-visible' : ''}`}
      aria-label="الرجوع لأعلى الصفحة"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      ↑
    </button>
  )
}

function MobileNavGlyph({ type }: { type: 'home' | 'knowledge' | 'bell' | 'profile' | 'more' }) {
  const common = { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (type === 'home') return <svg {...common}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>
  if (type === 'knowledge') return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z"/><path d="M8 7h8"/></svg>
  if (type === 'bell') return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
  if (type === 'profile') return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
  return <svg {...common}><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
}

function MobileBottomNav({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="التنقل الرئيسي على الموبايل">
      <NavLink to="/app" end className={({ isActive }) => `mobile-bottom-item ${isActive ? 'is-active' : ''}`}>
        <span className="mobile-bottom-icon"><MobileNavGlyph type="home" /></span>
        <span>الرئيسية</span>
      </NavLink>
      <NavLink to="/app/knowledge-bank" className={({ isActive }) => `mobile-bottom-item ${isActive ? 'is-active' : ''}`}>
        <span className="mobile-bottom-icon"><MobileNavGlyph type="knowledge" /></span>
        <span>المعرفة</span>
      </NavLink>
      <NavLink to="/app/notifications" className={({ isActive }) => `mobile-bottom-item ${isActive ? 'is-active' : ''}`}>
        <span className="mobile-bottom-icon"><MobileNavGlyph type="bell" /></span>
        <span>الإشعارات</span>
      </NavLink>
      <button
        type="button"
        className={`mobile-bottom-item ${moreOpen ? 'is-active' : ''}`}
        onClick={onMore}
        aria-label="فتح باقي القائمة"
        aria-expanded={moreOpen}
      >
        <span className="mobile-bottom-icon"><MobileNavGlyph type="more" /></span>
        <span>المزيد</span>
      </button>
    </nav>
  )
}

const ROUTE_SCROLL_STORAGE_PREFIX = 'scoutsvm:route-scroll:'

function useRouteScrollMemory(routeKey: string) {
  useEffect(() => {
    if (!routeKey) return

    const storageKey = `${ROUTE_SCROLL_STORAGE_PREFIX}${routeKey}`
    let savedY = 0
    try {
      savedY = Number(sessionStorage.getItem(storageKey) || 0)
    } catch {}

    const restoreFrame = window.requestAnimationFrame(() => {
      if (Number.isFinite(savedY) && savedY > 0) {
        window.scrollTo({ top: savedY, left: 0, behavior: 'auto' })
      }
    })

    const save = () => {
      try {
        sessionStorage.setItem(storageKey, String(Math.max(0, Math.round(window.scrollY))))
      } catch {}
    }

    // pagehide also covers a real browser refresh/tab discard. Normal tab switching
    // keeps the component mounted, so local form/modal state remains untouched.
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') save()
    }

    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', saveWhenHidden)

    return () => {
      window.cancelAnimationFrame(restoreFrame)
      save()
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', saveWhenHidden)
    }
  }, [routeKey])
}

function ProtectedLayout() {
  const { user, roles, loading } = useAuth()
  const {
    currentScoutYear,
    actualCurrentScoutYear,
    availableYears,
    viewedScoutYearId,
    isHistoricalView,
    isPlanningView,
    isReadOnlyView,
    setViewedScoutYearId,
    resetViewedScoutYear,
  } = useScoutYear()
  const isAdmin = roles.some((role) => role.role_slug === 'admin')
  const loc = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const pageTitle = useMemo(() => getPageLabel(loc.pathname), [loc.pathname])
  const routeStateKey = `${loc.pathname}${loc.search}|${currentScoutYear?.id || 'no-year'}`
  useRouteScrollMemory(routeStateKey)



  useEffect(() => {
    if (!user?.id) return
    // Never trigger the browser permission prompt automatically.
    // If permission was already granted, silently keep the subscription in sync.
    void ensurePushSubscription(user.id, { requestPermission: false })
  }, [user?.id])


  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    document.title = `${pageTitle} | Scout SVM`
  }, [pageTitle])

  if (loading) return <PageLoader visible text="جاري تجهيز التطبيق..." />
  if (!user) return <Navigate to="/" state={{ from: loc }} replace />

  return (
    <div className="app-grid">
      <a className="skip-link" href="#main-content">
        تخطي إلى المحتوى
      </a>
      <div className="app-ambient app-ambient-one" aria-hidden="true" />
      <div className="app-ambient app-ambient-two" aria-hidden="true" />
      <div className="app-ambient app-ambient-three" aria-hidden="true" />
      <header className="app-topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="burger"
            aria-label="فتح القائمة"
            onClick={() => setNavOpen(true)}
          >
            ☰
          </button>
          <div className="topbar-brand-lockup">
            <img src={scoutSvmOfficialLogo} alt="" aria-hidden="true" className="topbar-brand-logo" />
            <div className="topbar-title-wrap">
              <div className="topbar-title">ScoutSVM</div>
              <div className="topbar-route" aria-live="polite">{pageTitle}</div>
            </div>
          </div>
        </div>
        <div className="topbar-right">
          {isAdmin ? (
            <label className={`super-admin-year-switcher ${isReadOnlyView ? 'is-historical' : isPlanningView ? 'is-planning' : ''}`}>
              <span className="super-admin-year-label">Scout Year</span>
              <select
                value={viewedScoutYearId || actualCurrentScoutYear?.id || ''}
                onChange={(event) => setViewedScoutYearId(event.target.value || null)}
                aria-label="اختيار السنة الكشفية المعروضة"
              >
                {availableYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}{year.is_current ? ' — الحالية' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="topbar-year-chip">🗓️ {actualCurrentScoutYear?.name || currentScoutYear?.name || 'السنة غير محددة'}</div>
          )}
        </div>
      </header>

      {isAdmin && isHistoricalView && currentScoutYear && (
        <div className="historical-year-banner" role="status" aria-live="polite">
          <div className="historical-year-banner-copy">
            <strong>عرض سنة غير حالية: {currentScoutYear.name}</strong>
            <span>السنة الحالية للمستخدمين: {actualCurrentScoutYear?.name || 'غير محددة'} — أنت فقط ترى بيانات السنة المختارة.</span>
          </div>
          <button type="button" onClick={resetViewedScoutYear}>العودة للسنة الحالية</button>
        </div>
      )}

      {isAdmin && isPlanningView && currentScoutYear && (
        <div className="planning-year-banner" role="status" aria-live="polite">
          <div className="historical-year-banner-copy">
            <strong>وضع تجهيز السنة: {currentScoutYear.name}</strong>
            <span>هذه سنة Draft ويمكنك إعداد الأعضاء والفرق والرتب والأدوار قبل تفعيلها كسنة حالية.</span>
          </div>
          <button type="button" onClick={resetViewedScoutYear}>العودة للسنة الحالية</button>
        </div>
      )}

      <div
        className={`drawer-panel ${navOpen ? 'is-open' : ''}`}
        aria-hidden={!navOpen}
        role="navigation"
        aria-label="القائمة الرئيسية"
      >
        <div className="mobile-menu-sheet-handle" aria-hidden="true" />
        <Suspense fallback={<div className="p-4 text-sm text-slate-500">جاري تحميل القائمة...</div>}><SideNav onNavigate={() => setNavOpen(false)} /></Suspense>
      </div>
      {navOpen && (
        <button
          className="drawer-backdrop"
          aria-label="إغلاق القائمة"
          onClick={() => setNavOpen(false)}
        />
      )}

      <main
        key={currentScoutYear?.id || 'no-scout-year'}
        id="main-content"
        className="app-main"
        data-route={loc.pathname}
        tabIndex={-1}
        onClick={() => {
          if (navOpen) setNavOpen(false)
        }}
      >
        <Outlet />
      </main>
      <MobileBottomNav onMore={() => setNavOpen((open) => !open)} moreOpen={navOpen} />
      <ScrollTopButton />
    </div>
  )
}

function PublicOnly({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader visible text="جاري تجهيز التطبيق..." />
  if (user) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <ScoutYearProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/app" element={<ProtectedLayout />}>
              <Route index element={<Home />} />
              <Route path="attendance" element={<RouteAccessGuard adminOnly><Attendance /></RouteAccessGuard>} />
              <Route path="finance" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_finance']}><Finance /></RouteAccessGuard>} />
              <Route path="MaterialTeamReservation" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_materials']}><MaterialsTeamReservations /></RouteAccessGuard>} />
              <Route path="MaterialAdmin" element={<RouteAccessGuard globalRoles={['responsable_materials']}><MaterialsAdmin /></RouteAccessGuard>} />
              <Route path="AdminAttendance" element={<RouteAccessGuard adminOnly><AdminAttendance /></RouteAccessGuard>} />
              <Route path="AdminReservationsAll" element={<RouteAccessGuard adminOnly><AdminReservationsAll /></RouteAccessGuard>} />
              <Route path="AdminFieldReservations" element={<RouteAccessGuard sameTeamRoles={['responsable_materials', 'chef_de_legion']}><AdminFieldReservations /></RouteAccessGuard>} />
              <Route path="AdminEvaluations" element={<RouteAccessGuard adminOnly><AdminEvaluations /></RouteAccessGuard>} />
              <Route path="LegionEvaluations" element={<RouteAccessGuard anyRoles={['chef_de_legion']}><LegionEvaluations /></RouteAccessGuard>} />
              <Route path="LegionAttendance" element={<RouteAccessGuard anyRoles={['chef_de_legion']}><LegionAttendance /></RouteAccessGuard>} />
              <Route path="financeEvent" element={<RouteAccessGuard globalRoles={['responsable_finance']}><FinanceEvent /></RouteAccessGuard>} />
              <Route path="MaterialsReturnApprove" element={<RouteAccessGuard anyRoles={['responsable_materials']}><MaterialsReturnApprove /></RouteAccessGuard>} />
              <Route path="AdminDashboard" element={<RouteAccessGuard globalRoles={['responsable_secretary']}><AdminDashboard /></RouteAccessGuard>} />
              <Route path="storage" element={<StorageInventory />} />
              <Route path="TeamCases" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_secretary']}><TeamCases /></RouteAccessGuard>} />
              <Route path="TeamStatistics" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_secretary']}><TeamStatistics /></RouteAccessGuard>} />
              <Route path="meeting-minutes" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_secretary']}><MeetingMinutesList /></RouteAccessGuard>} />
              <Route path="meeting-minutes/new" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_secretary']}><MeetingMinuteForm /></RouteAccessGuard>} />
              <Route path="meeting-minutes/:id" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_secretary']}><MeetingMinuteForm /></RouteAccessGuard>} />
              <Route path="meeting-tasks" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_secretary']}><MeetingTasks /></RouteAccessGuard>} />
              <Route path="camp-installments" element={<RouteAccessGuard anyRoles={['chef_de_legion']}><CampInstallmentsList /></RouteAccessGuard>} />
              <Route path="camp-installments/new" element={<RouteAccessGuard adminOnly><CampInstallmentForm /></RouteAccessGuard>} />
              <Route path="camp-installments/:id/edit" element={<RouteAccessGuard adminOnly><CampInstallmentForm /></RouteAccessGuard>} />
              <Route path="camp-installments/:id" element={<RouteAccessGuard anyRoles={['chef_de_legion']}><CampInstallmentDetails /></RouteAccessGuard>} />
              <Route path="my-camp-collections" element={<MyCampCollections />} />
              <Route path="camp-program" element={<CampProgram />} />
              <Route path="admin-scout-years" element={<RouteAccessGuard adminOnly><AdminScoutYears /></RouteAccessGuard>} />
              <Route path="year-responsibilities" element={<RouteAccessGuard adminOnly><YearResponsibilities /></RouteAccessGuard>} />
              <Route path="knowledge-bank" element={<KnowledgeBank />} />
              <Route path="admin-terms-meetings" element={<RouteAccessGuard adminOnly><AdminTermsMeetings /></RouteAccessGuard>} />
              <Route path="member-profile" element={<MemberProfile360 />} />
              <Route path="member-profile/:memberId" element={<MemberProfile360 />} />
              <Route path="admin-audit-log" element={<RouteAccessGuard adminOnly><AdminAuditLog /></RouteAccessGuard>} />
              <Route path="reports-center" element={<RouteAccessGuard anyRoles={['chef_de_legion']}><ReportsCenter /></RouteAccessGuard>} />
              <Route path="admin-best-chefs" element={<RouteAccessGuard adminOnly><AdminBestChefs /></RouteAccessGuard>} />
              <Route path="best-chefs" element={<BestChefsGallery />} />
              <Route path="AdminEvalQuestions" element={<RouteAccessGuard adminOnly><AdminEvalQuestions /></RouteAccessGuard>} />
              <Route path="AdminFinance" element={<RouteAccessGuard globalRoles={['responsable_finance']}><AdminFinance /></RouteAccessGuard>} />
              <Route path="AdminSecretary" element={<RouteAccessGuard globalRoles={['responsable_secretary']}><AdminSecretary /></RouteAccessGuard>} />
              <Route path="TeamSecretaryAttendance" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_secretary']}><TeamSecretaryAttendance /></RouteAccessGuard>} />
              <Route path="AdminEvents" element={<RouteAccessGuard adminOnly><AdminEvents /></RouteAccessGuard>} />
              <Route path="ChefsEvaluationOverview" element={<RouteAccessGuard anyRoles={['chef_de_legion']} globalRoles={['responsable_secretary']}><ChefsEvaluationOverview /></RouteAccessGuard>} />
              <Route path="TeamSecretary" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_secretary']}><TeamSecretary /></RouteAccessGuard>} />
              <Route path="TeamFinance" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_finance']}><TeamFinance /></RouteAccessGuard>} />
              <Route path="evaluation" element={<MyEvaluation />} />
              <Route path="FieldReservationsTeam" element={<RouteAccessGuard anyRoles={['chef_de_legion', 'responsable_materials']}><FieldReservationsTeam /></RouteAccessGuard>} />
              <Route path="materials" element={<RouteAccessGuard anyRoles={['responsable_materials']}><Materials /></RouteAccessGuard>} />
              <Route path="reservation" element={<RouteAccessGuard adminOnly><ReservationsAdmin /></RouteAccessGuard>} />
              <Route path="admin-members" element={<RouteAccessGuard adminOnly><AdminMembers /></RouteAccessGuard>} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="admin" element={<RouteAccessGuard adminOnly><Admin /></RouteAccessGuard>} />
              <Route path="legacy-evaluation" element={<Evaluation />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </ScoutYearProvider>
    </AuthProvider>
  )
}
