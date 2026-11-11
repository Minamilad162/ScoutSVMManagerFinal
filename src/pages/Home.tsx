import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { useScoutYear } from '../components/ScoutYearProvider'
import { MetricCard } from '../components/ui/MetricCard'
import { SectionCard } from '../components/ui/SectionCard'
import { InlineAlert } from '../components/ui/InlineAlert'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { fetchBestChefsHomeShowcase, type BestChefHomeShowcase } from '../features/bestChefs/api'
import { BestChefCard } from '../features/bestChefs/BestChefCard'
import scoutMascotWelcome from '../assets/scout-theme/scout-mascot-welcome.webp'
import scoutCompassScarf from '../assets/scout-theme/scout-compass-scarf.webp'
import scoutClipboard from '../assets/scout-theme/scout-clipboard.webp'
import scoutBackpack from '../assets/scout-theme/scout-backpack.webp'
import scoutCampfire from '../assets/scout-theme/scout-campfire.webp'
import scoutScarfKnot from '../assets/scout-theme/scout-scarf-knot.webp'
import heroGroupDesktop from '../assets/brand/svm-group-hero-desktop.webp'
import heroGroupMobile from '../assets/brand/svm-group-hero-mobile.webp'
import scoutSvmOfficialLogo from '../assets/brand/scout-svm-official-logo.webp'

type AdminMetrics = {
  teams: number
  members: number
  roleAssignments: number
  camps: number
  openCamps: number
}

export default function Home() {
  const { user, myTeamId, roles } = useAuth()
  const { currentScoutYear } = useScoutYear()
  const nav = useNavigate()

  const [unread, setUnread] = useState(0)
  const [teamName, setTeamName] = useState<string>('')
  const [fullName, setFullName] = useState<string>('')
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics>({
    teams: 0,
    members: 0,
    roleAssignments: 0,
    camps: 0,
    openCamps: 0,
  })

  const [bestChefsShowcase, setBestChefsShowcase] = useState<BestChefHomeShowcase | null>(null)

  const hasRole = (slug: string) => roles.some((r) => r.role_slug === slug)
  const isAdmin = hasRole('admin')
  const isFinanceAdmin = roles.some((r) => r.role_slug === 'responsable_finance' || r.role_slug === 'admin')
  const isLeader = hasRole('chef_de_legion')

  useEffect(() => {
    void load()
  }, [myTeamId, user?.id, currentScoutYear?.id, isAdmin])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel('notif_count_home')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => void loadCount()
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  async function load() {
    await Promise.allSettled([
      loadCount(),
      loadName(),
      loadTeam(),
      isAdmin ? loadAdminMetrics() : Promise.resolve(),
    ])
  }

  async function loadCount() {
    const { count } = await supabase
      .from('v_my_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
    setUnread(count ?? 0)
  }

  async function loadName() {
    let name = ''
    if (user?.id) {
      const { data: m } = await scoutYearFrom('v_members_current', 'v_members_context')
        .select('full_name')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()
      name = m?.full_name || ''
    }
    if (!name) {
      const meta: any = (user as any)?.user_metadata || {}
      name = meta.full_name || meta.name || (user?.email ?? '')
    }
    setFullName(name)
  }

  async function loadTeam() {
    if (!myTeamId) {
      setTeamName('')
      return
    }
    const { data: t } = await supabase.from('teams').select('name').eq('id', myTeamId).maybeSingle()
    setTeamName(t?.name ?? '')
  }

  useEffect(() => {
    const yearId = currentScoutYear?.id ?? null
    let cancelled = false
    setBestChefsShowcase(null)
    if (yearId) {
      void fetchBestChefsHomeShowcase(yearId)
        .then((showcase) => { if (!cancelled) setBestChefsShowcase(showcase) })
        .catch(() => { if (!cancelled) setBestChefsShowcase(null) })
    }
    return () => { cancelled = true }
  }, [currentScoutYear?.id])

  async function loadAdminMetrics() {
    if (!currentScoutYear?.id) {
      setAdminMetrics({ teams: 0, members: 0, roleAssignments: 0, camps: 0, openCamps: 0 })
      return
    }

    const scoutYearId = currentScoutYear.id
    const [teamsRes, membersRes, rolesRes, campsRes, openCampsRes] = await Promise.all([
      supabase.from('team_seasons').select('id', { count: 'exact', head: true }).eq('scout_year_id', scoutYearId).eq('is_active', true),
      supabase.from('member_season_assignments').select('id', { count: 'exact', head: true }).eq('scout_year_id', scoutYearId).eq('is_active', true),
      supabase.from('user_role_assignments').select('id', { count: 'exact', head: true }).eq('scout_year_id', scoutYearId).eq('is_active', true),
      supabase.from('camp_installments').select('id', { count: 'exact', head: true }).eq('scout_year_id', scoutYearId),
      supabase.from('camp_installments').select('id', { count: 'exact', head: true }).eq('scout_year_id', scoutYearId).eq('status', 'open'),
    ])

    setAdminMetrics({
      teams: teamsRes.count ?? 0,
      members: membersRes.count ?? 0,
      roleAssignments: rolesRes.count ?? 0,
      camps: campsRes.count ?? 0,
      openCamps: openCampsRes.count ?? 0,
    })
  }

  const adminActions = useMemo(
    () => [
      { label: 'Member 360', desc: 'ملفك الشخصي الكامل داخل السنة الحالية، مع الأدوار والحضور والمعسكرات والصورة الشخصية.', to: '/app/member-profile', tag: 'Profile' },
      { label: 'إدارة السنة الكشفية', desc: 'تفعيل سنة جديدة أو نسخ هيكل سنة سابقة.', to: '/app/admin-scout-years', tag: 'Setup' },
      { label: 'مسؤوليات السنة', desc: 'توزيع الشيفات على Events وتنظيمات السنة ومتابعة من لم يتم تكليفه.', to: '/app/year-responsibilities', tag: 'Events' },
      { label: 'الترمات والاجتماعات', desc: 'إدارة ترمات السنة الحالية وخطة الاجتماعات المخططة والتنفيذ الفعلي.', to: '/app/admin-terms-meetings', tag: 'Terms' },
      { label: 'أفضل الـ chefs', desc: 'اختيار أفضل الـ chefs لكل ترم ليظهروا في الصفحة الرئيسية ولكل الحسابات.', to: '/app/admin-best-chefs', tag: 'Spotlight' },
      { label: 'الأعضاء والأدوار', desc: 'إدارة الفريق والرتبة والنوع والأدوار الحالية.', to: '/app/admin-members', tag: 'People' },
      { label: 'لوحة الإدارة', desc: 'تابع التشغيل العام والإحصاءات التنفيذية بسرعة.', to: '/app/AdminDashboard', tag: 'Overview' },
      { label: 'التقسيط والمعسكرات', desc: 'إدارة المعسكرات ومتابعة نسب التحصيل الحالية.', to: '/app/camp-installments', tag: 'Finance' },
      { label: 'الإشعارات', desc: 'راجع ما يحتاج تدخلًا سريعًا أو متابعة من الإدارة.', to: '/app/notifications', tag: 'Ops' },
      { label: 'سجل العمليات', desc: 'تابع من عدّل الحضور والأدوار والدفعات وعمليات السنة الحالية بشكل واضح.', to: '/app/admin-audit-log', tag: 'Audit' },
      { label: 'الميزانية العامة', desc: 'مراجعة المصروفات والتقارير المالية حسب الترم.', to: '/app/AdminFinance', tag: 'Budget' },
    ],
    []
  )

  const userActions = useMemo(() => {
    const items: Array<{ label: string; desc: string; to: string; tag: string }> = [
      { label: 'ملفي الشخصي', desc: 'ملف 360 يضم حضورك وأدوارك ومعسكراتك وصورتك الشخصية.', to: '/app/member-profile', tag: 'Profile' },
      { label: 'أفضل الـ chefs', desc: 'شاهد أفضل الـ chefs لكل ترم داخل السنة الحالية.', to: '/app/best-chefs', tag: 'Spotlight' },
      { label: 'الإشعارات', desc: 'راجع الجديد أو المتبقي عليك بسرعة.', to: '/app/notifications', tag: 'Inbox' },
    ]

    if (isLeader) {
      items.push({ label: 'حضور فريقي', desc: 'تابع الغياب والاجتماعات داخل فريقك.', to: '/app/LegionAttendance', tag: 'Attendance' })
      items.push({ label: 'مهام الاجتماعات', desc: 'راجع المهام المفتوحة والمغلقة لفريقك.', to: '/app/meeting-tasks', tag: 'Tasks' })
      items.push({ label: 'مركز التقارير', desc: 'تقارير واضحة ومنظمة للميزانيات والحضور والتحصيل والحالات داخل فريقك.', to: '/app/reports-center', tag: 'Reports' })
    }

    if (isFinanceAdmin) {
      items.push({ label: 'التقسيط والمعسكرات', desc: 'فتح المعسكرات ومراجعة التحصيل والمدفوعات.', to: '/app/camp-installments', tag: 'Finance' })
    }

    if (isLeader || isFinanceAdmin) {
      items.push({ label: 'الميزانية', desc: 'سجّل المصروفات وراجع موقف الترم الحالي.', to: '/app/TeamFinance', tag: 'Budget' })
    }
    return items.slice(0, 6)
  }, [isLeader, isFinanceAdmin])

  if (isAdmin) {
    return (
      <div className="home-scout-page space-y-6">
        <HomeSvmBanner fullName={fullName} yearName={currentScoutYear?.name || 'السنة غير محددة'} teamName={teamName} />
        <HomeWelcomePanel
          eyebrow="🛠️ لوحة البداية — الإدارة"
          title={`أهلًا ${fullName || 'بك'} في مركز القيادة`}
          yearName={currentScoutYear?.name || 'السنة غير محددة'}
          description={
            <>
              هذه الصفحة مخصصة للإدارة فقط، وتعرض لك ملخصًا تنفيذيًا للسنة الحالية، مع أسرع الاختصارات لإدارة الفرق والأعضاء والأدوار
              والمعسكرات.
            </>
          }
          actions={
            <>
              <button className="home-scout-btn home-scout-btn--secondary" onClick={() => nav('/app/AdminDashboard')}>
                فتح لوحة الإدارة
              </button>
              <button className="home-scout-btn home-scout-btn--primary" onClick={() => nav('/app/admin-scout-years')}>
                إدارة السنة الحالية
              </button>
            </>
          }
        />

        <div className="home-scout-metrics grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="الفرق النشطة" value={adminMetrics.teams} hint="مأخوذة من team_seasons للسنة الحالية" accent="navy" />
          <MetricCard label="الأعضاء النشطون" value={adminMetrics.members} hint="الأعضاء داخل السنة الحالية فقط" accent="orange" />
          <MetricCard label="توزيعات الأدوار" value={adminMetrics.roleAssignments} hint="أدوار الإدارة والفرق الحالية" accent="gold" />
          <MetricCard label="المعسكرات" value={adminMetrics.camps} hint="كل المعسكرات داخل السنة الحالية" accent="navy" />
          <MetricCard label="المعسكرات المفتوحة" value={adminMetrics.openCamps} hint={`إشعارات غير مقروءة: ${unread}`} accent={adminMetrics.openCamps > 0 ? 'orange' : 'gold'} />
        </div>

        <SectionCard
          title="اختصارات الإدارة"
          description="ابدأ من هنا أسرع العمليات التي تحتاجها الإدارة طوال السنة الحالية."
          className="home-scout-section home-scout-section--actions"
        >
          <img src={scoutClipboard} alt="" aria-hidden="true" loading="lazy" decoding="async" className="home-section-art home-section-art--clipboard" />
          <div className="relative z-[1] grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {adminActions.map((item) => (
              <QuickActionTile key={item.to} {...item} onClick={() => nav(item.to)} />
            ))}
          </div>
        </SectionCard>


        {bestChefsShowcase ? (
          <SectionCard
            title={`⭐ أفضل الـ chefs — ${bestChefsShowcase.term.name}`}
            description="المختارون من الإدارة لهذا الترم داخل السنة الحالية، ويظهرون لكل الحسابات في الصفحة الرئيسية."
            className="home-scout-section home-scout-section--spotlight"
            actions={
              <button
                type="button"
                onClick={() => nav('/app/best-chefs')}
                className="home-scout-btn home-scout-btn--secondary home-scout-btn--small"
              >
                عرض كل الترمات
              </button>
            }
          >
            <img src={scoutScarfKnot} alt="" aria-hidden="true" loading="lazy" decoding="async" className="home-section-art home-section-art--scarf" />
            <div className="relative z-[1] grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {bestChefsShowcase.items.map((item, index) => (
                <BestChefCard key={item.id} item={item} rank={index} />
              ))}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard title="تنبيهات الإدارة" description="هذه الخطوات هي الترتيب الأفضل قبل بدء تشغيل سنة جديدة أو تعديل هيكل قائم." tone="subtle" className="home-scout-section home-scout-section--tips">
          <img src={scoutCampfire} alt="" aria-hidden="true" loading="lazy" decoding="async" className="home-section-art home-section-art--campfire" />
          <div className="relative z-[1] grid grid-cols-1 gap-3 xl:grid-cols-3">
            <InlineAlert tone="info" title="حدّد السنة الحالية أولًا">
              قبل تعديل الأعضاء أو الأدوار أو الفرق، تأكد أن السنة المراد العمل عليها مُفعّلة كـ Current حتى تُحفظ كل التغييرات في المكان الصحيح.
            </InlineAlert>
            <InlineAlert tone="info" title="راجِع الأعضاء والأدوار بعد النسخ">
              بعد نسخ الهيكل من سنة سابقة، راجع الفِرق والرتب والنوع والأدوار حتى لا تنتقل صلاحيات أو توزيعات لم تعد مناسبة لهذه السنة.
            </InlineAlert>
            <InlineAlert tone={unread > 0 ? 'error' : 'success'} title={unread > 0 ? 'يوجد ما يحتاج متابعة' : 'الوضع هادئ الآن'}>
              {unread > 0
                ? `لديك ${unread} إشعار غير مقروء، ويُستحسن مراجعتها قبل بدء التشغيل اليومي.`
                : 'لا توجد إشعارات غير مقروءة حاليًا، ويمكنك البدء في إدارة السنة براحة أكبر.'}
            </InlineAlert>
          </div>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="home-scout-page space-y-6">
      <HomeSvmBanner fullName={fullName} yearName={currentScoutYear?.name || 'السنة غير محددة'} teamName={teamName} />
      <HomeWelcomePanel
        eyebrow="👋 بداية سريعة"
        title={`أهلًا ${fullName || 'بك'}`}
        yearName={currentScoutYear?.name || 'السنة غير محددة'}
        description={
          <>
            السنة الحالية: <span className="font-bold text-slate-800">{currentScoutYear?.name || 'غير محددة'}</span>
            {' • '}
            لديك الآن <span className="font-bold text-slate-800">{unread}</span> إشعار غير مقروء.
            {teamName ? <span> {' • '}الفريق: <span className="font-bold text-slate-800">{teamName}</span></span> : null}
          </>
        }
        actions={
          <>
            <button className="home-scout-btn home-scout-btn--secondary" onClick={() => nav('/app/notifications')}>
              فتح الإشعارات
            </button>
            {isLeader ? (
              <button className="home-scout-btn home-scout-btn--primary" onClick={() => nav('/app/LegionAttendance')}>
                حضور فريقي
              </button>
            ) : isFinanceAdmin ? (
              <button className="home-scout-btn home-scout-btn--primary" onClick={() => nav('/app/TeamFinance')}>
                متابعة الميزانية
              </button>
            ) : (
              <button className="home-scout-btn home-scout-btn--primary" onClick={() => nav('/app/member-profile')}>
                فتح ملفي الشخصي
              </button>
            )}
          </>
        }
      />

      <div className="home-scout-metrics grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="الإشعارات الجديدة" value={unread} hint={unread > 0 ? 'يستحسن مراجعتها الآن' : 'أنت على اطلاع كامل'} accent={unread > 0 ? 'orange' : 'gold'} />
        <MetricCard label="السنة الحالية" value={currentScoutYear?.name || '—'} hint="تُستخدم كمرجع افتراضي لكل الشاشات" accent="navy" />
        <MetricCard label="الفريق الحالي" value={teamName || '—'} hint={myTeamId ? 'يظهر في صلاحياتك وصفحاتك' : 'لا يوجد فريق مرتبط'} accent="gold" />
        <MetricCard label="الأدوار المسندة" value={roles.length} hint="عدد الأدوار المسندة لك حاليًا" accent="orange" />
      </div>


      {bestChefsShowcase ? (
        <SectionCard
          title={`⭐ أفضل الـ chefs — ${bestChefsShowcase.term.name}`}
          description="المختارون للترم المحدد حاليًا للعرض في الصفحة الرئيسية داخل السنة الحالية."
          className="home-scout-section home-scout-section--spotlight"
          actions={
            <button
              type="button"
              onClick={() => nav('/app/best-chefs')}
              className="home-scout-btn home-scout-btn--secondary home-scout-btn--small"
            >
              عرض كل الترمات
            </button>
          }
        >
          <img src={scoutScarfKnot} alt="" aria-hidden="true" loading="lazy" decoding="async" className="home-section-art home-section-art--scarf" />
          <div className="relative z-[1] grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {bestChefsShowcase.items.map((item, index) => (
              <BestChefCard key={item.id} item={item} rank={index} />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="اختصارات مفيدة"
        description="اختصر الوصول إلى أكثر الصفحات استخدامًا حسب صلاحياتك الحالية."
        className="home-scout-section home-scout-section--actions"
      >
        <img src={scoutBackpack} alt="" aria-hidden="true" loading="lazy" decoding="async" className="home-section-art home-section-art--backpack" />
        <div className="relative z-[1] grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {userActions.map((item) => (
            <QuickActionTile key={item.to} {...item} onClick={() => nav(item.to)} compact />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="تنبيه سريع"
        description="لو بدأت سنة كشفية جديدة، حدّث السنة الحالية أولًا قبل تعديل الأعضاء أو الأدوار أو الفرق حتى تظل البيانات متسقة."
        tone="subtle"
        className="home-scout-section home-scout-section--tips"
      >
        <img src={scoutCampfire} alt="" aria-hidden="true" loading="lazy" decoding="async" className="home-section-art home-section-art--campfire" />
        <div className="relative z-[1] grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="home-scout-tip-card rounded-2xl p-4">
            <div className="text-sm font-bold text-slate-800">1) راقب الإشعارات أولًا</div>
            <div className="home-quick-action-desc mt-2 text-sm leading-6">ابدأ يومك بمراجعة الإشعارات الجديدة حتى لا يفوتك ما يحتاج متابعة أو رد سريع.</div>
          </div>
          <div className="home-scout-tip-card rounded-2xl p-4">
            <div className="text-sm font-bold text-slate-800">2) تحرك داخل سنة واحدة</div>
            <div className="home-quick-action-desc mt-2 text-sm leading-6">كل الشاشات الحديثة تقرأ السنة الحالية افتراضيًا، لذلك لن تختلط عليك بيانات سنوات سابقة أثناء التشغيل.</div>
          </div>
          <div className="home-scout-tip-card rounded-2xl p-4">
            <div className="text-sm font-bold text-slate-800">3) استخدم الاختصارات</div>
            <div className="home-quick-action-desc mt-2 text-sm leading-6">الوصول السريع يقلل التنقل داخل القوائم ويجعل الشغل اليومي أسرع وأوضح خاصة على الموبايل.</div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function HomeSvmBanner({ fullName, yearName, teamName }: { fullName: string; yearName: string; teamName?: string }) {
  return (
    <section className="home-svm-photo-banner home-brand-hero relative overflow-hidden" aria-label="ScoutSVM — Better Together">
      <picture className="home-brand-hero-picture">
        <source media="(max-width: 640px)" srcSet={heroGroupMobile} />
        <img
          src={heroGroupDesktop}
          alt="مجتمع Scouts & Guides Saint Vincent Miami"
          className="home-svm-photo-banner-img home-brand-hero-img"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      <div className="home-brand-hero-overlay" aria-hidden="true" />
      <div className="home-brand-hero-copy">
        <div className="home-brand-hero-lockup">
          <img src={scoutSvmOfficialLogo} alt="شعار Scouts & Guides Saint Vincent Miami" className="home-brand-hero-logo" />
          <div className="home-brand-hero-org">Scouts &amp; Guides Saint Vincent Miami</div>
        </div>
        <div className="home-brand-hero-kicker">{fullName ? `أهلًا ${fullName}` : 'أهلًا بك في ScoutSVM'}</div>
        <div className="home-brand-hero-meta">
          <span>{yearName}</span>
          {teamName ? <span>{teamName}</span> : null}
        </div>
      </div>
      <div className="home-brand-scarf-ribbon" aria-hidden="true"><i /><i /><i /></div>
    </section>
  )
}

function HomeWelcomePanel({
  eyebrow,
  title,
  yearName,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  yearName: string
  description: ReactNode
  actions: ReactNode
}) {
  return (
    <section className="home-welcome-panel relative overflow-hidden rounded-[30px] p-4 shadow-lg backdrop-blur-2xl md:p-5 lg:p-6">
      <div className="home-welcome-scarf-stripe" aria-hidden="true" />
      <div className="home-welcome-glow home-welcome-glow--orange" aria-hidden="true" />
      <div className="home-welcome-glow home-welcome-glow--gold" aria-hidden="true" />
      <img src={scoutCompassScarf} alt="" aria-hidden="true" className="home-welcome-compass" />
      <img src={scoutMascotWelcome} alt="" aria-hidden="true" className="home-welcome-mascot" />
      <div className="home-welcome-content relative z-[2] grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="space-y-2.5">
          <div className="home-welcome-eyebrow inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold shadow-sm backdrop-blur">
            <span className="home-welcome-eyebrow-dot h-2 w-2 rounded-full" aria-hidden="true" />
            {eyebrow}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="home-welcome-title text-2xl font-black tracking-tight md:text-[2rem]">{title}</h1>
            <span className="home-welcome-year inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm">
              {yearName}
            </span>
          </div>
          <div className="home-welcome-description max-w-4xl text-sm leading-7 md:text-[15px]">{description}</div>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">{actions}</div>
      </div>
    </section>
  )
}

function QuickActionTile({
  label,
  desc,
  tag,
  onClick,
  compact = false,
}: {
  label: string
  desc: string
  tag: string
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`home-quick-action-tile group rounded-[24px] p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${compact ? '' : 'min-h-[150px]'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="home-quick-action-title text-base font-bold">{label}</div>
        <div className="flex items-center gap-2">
          <div className="home-quick-action-tag rounded-2xl px-2 py-1 text-xs font-bold transition">{tag}</div>
          <span className="home-quick-action-arrow" aria-hidden="true">←</span>
        </div>
      </div>
      <div className="home-quick-action-desc mt-2 text-sm leading-6">{desc}</div>
    </button>
  )
}
