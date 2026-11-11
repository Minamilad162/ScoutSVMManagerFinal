import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { SHOW_EVALUATION_QUESTIONS } from '../features/evaluations/config'
import { useAuth } from './AuthProvider'
import { useScoutYear } from './ScoutYearProvider'
import { supabase } from '../lib/supabase'
import scoutSvmOfficialLogo from '../assets/brand/scout-svm-official-logo.webp'

type Item = { to: string; label: string }
type RoleRow = { role_slug: string; team_id?: string | null }

const PROGRAM_URL = 'https://drive.google.com/drive/folders/10Sr1dGAQLXKfz7ZauyPymnxEC_kaN6FO?usp=sharing'
const IMAGES_URL = 'https://drive.google.com/drive/folders/13wB3GMbm8CTxKLNomKB_Jr38OD1XjeR2?usp=sharing'

type Props = { onNavigate?: () => void }

export default function SideNav({ onNavigate }: Props) {
  const { roles, user } = useAuth()
  const { currentScoutYear } = useScoutYear()
  const location = useLocation()

  // ===== Avatar =====
  const [avatar, setAvatar] = useState<string | null>(null)
  useEffect(() => {
    ;(async () => {
      try {
        if (!user?.id) return
        const { data, error } = await supabase
          .from('v_members_current')
          .select('avatar_url')
          .eq('auth_user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()

        if (error) throw error

        const raw = data?.avatar_url ?? null
        if (!raw) {
          setAvatar(null)
          return
        }

        if (/^https?:\/\//i.test(raw)) {
          setAvatar(raw)
        } else {
          const { data: pub } = supabase.storage.from('avatars').getPublicUrl(raw)
          setAvatar(pub?.publicUrl ?? null)
        }
      } catch {
        setAvatar(null)
      }
    })()
  }, [user?.id])

  const initials = (() => {
    const base = (user?.name || user?.email || '').trim()
    if (!base) return ''
    const parts = base.split(/\s+/).filter(Boolean)
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
  })().toUpperCase()

  // ===== Unread notifications (Realtime + event bridge + fallback polling) =====
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const handler = (e: any) => {
      if (typeof e?.detail === 'number') setUnread(e.detail)
    }
    window.addEventListener('app:notif-unread', handler as any)
    return () => window.removeEventListener('app:notif-unread', handler as any)
  }, [])

  useEffect(() => {
    if (!user?.id) return

    let isMounted = true
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const fetchCount = async () => {
      try {
        const { count, error } = await supabase
          .from('v_my_notifications')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)

        if (error) throw error
        if (!isMounted) return
        setUnread(count ?? 0)
      } catch {}
    }

    fetchCount()

    const ch = supabase
      .channel(`notif_count_sidebar_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchCount()
        }
      )
      .subscribe()

    pollTimer = setInterval(fetchCount, 30000)

    return () => {
      isMounted = false
      if (pollTimer) clearInterval(pollTimer)
      supabase.removeChannel(ch)
    }
  }, [user?.id])

  useEffect(() => {
    if (location.pathname === '/app/notifications') {
      setUnread(0)
    }
  }, [location.pathname])

  // ===== Auto show camp collections menu =====
  const [showCollectorCollections, setShowCollectorCollections] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadCollectorMenu = async () => {
      try {
        if (!user?.id) {
          if (mounted) setShowCollectorCollections(false)
          return
        }

        const scopedTeamIds = Array.from(
          new Set(
            roles
              .filter((role: RoleRow) =>
                ['chef_de_legion', 'responsable_finance'].includes(role.role_slug) && Boolean(role.team_id)
              )
              .map((role: RoleRow) => role.team_id as string)
          )
        )

        const { data: me, error: meError } = await supabase
          .from('v_members_current')
          .select('id')
          .eq('auth_user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()

        if (meError) throw meError

        let count = 0

        if (scopedTeamIds.length) {
          const { count: teamCount, error } = await supabase
            .from('camp_installment_teams')
            .select('id', { head: true, count: 'exact' })
            .in('team_id', scopedTeamIds)

          if (error) throw error
          count += teamCount ?? 0
        }

        if (me?.id) {
          const { count: collectorCount, error } = await supabase
            .from('camp_installment_teams')
            .select('id', { head: true, count: 'exact' })
            .eq('collector_member_id', me.id)

          if (error) throw error
          count += collectorCount ?? 0
        }

        if (mounted) {
          setShowCollectorCollections(count > 0)
        }
      } catch {
        if (mounted) setShowCollectorCollections(false)
      }
    }

    loadCollectorMenu()
    return () => {
      mounted = false
    }
  }, [roles, user?.id])

  // ===== Delegated Camp Program access =====
  const [showDelegatedCampProgram, setShowDelegatedCampProgram] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadCampProgramAccess = async () => {
      if (!user?.id) {
        if (mounted) setShowDelegatedCampProgram(false)
        return
      }

      try {
        const { count, error } = await supabase
          .from('camp_program_team_access')
          .select('id', { head: true, count: 'exact' })
          .eq('user_id', user.id)
          .eq('is_active', true)

        if (error) throw error
        if (mounted) setShowDelegatedCampProgram((count || 0) > 0)
      } catch {
        if (mounted) setShowDelegatedCampProgram(false)
      }
    }

    void loadCampProgramAccess()
    return () => {
      mounted = false
    }
  }, [user?.id])

  // ===== Roles / Nav items =====
  const isAdmin = roles.some((r: RoleRow) => r.role_slug === 'admin')
  const has = (slug: string) => roles.some((r: RoleRow) => r.role_slug === slug)

  const isGlobalSecretary = roles.some(
    (r: RoleRow) =>
      r.role_slug === 'responsable_secretary' &&
      (r.team_id === null || r.team_id === undefined)
  )

  const isGlobalFinance = roles.some(
    (r: RoleRow) =>
      r.role_slug === 'responsable_finance' &&
      (r.team_id === null || r.team_id === undefined)
  )

  const isGlobalMaterials = roles.some(
    (r: RoleRow) =>
      r.role_slug === 'responsable_materials' &&
      (r.team_id === null || r.team_id === undefined)
  )

  const hasTeamSecretary = roles.some(
    (r: RoleRow) =>
      r.role_slug === 'responsable_secretary' &&
      (r.team_id !== null && r.team_id !== undefined)
  )

  const pushUnique = (arr: Item[], to: string, label: string) => {
    if (!to) return
    if (!arr.some((i) => i.to === to)) arr.push({ to, label })
  }

  const items = useMemo<Item[]>(() => {
    if (!user) return []

    const res: Item[] = [{ to: '/app', label: 'الرئيسية' }, { to: '/app/member-profile', label: 'ملفي الشخصي' }, { to: '/app/best-chefs', label: 'أفضل الـ chefs' }]

    if (isAdmin) {
      pushUnique(res, '/app/AdminDashboard', 'لوحة التحكم')

      pushUnique(res, '/app/AdminReservationsAll', 'الحجوزات')
      pushUnique(res, '/app/reservation', 'إدارة الحجوزات المباشرة')
      pushUnique(res, '/app/AdminFieldReservations', 'ادارة الارض')
      pushUnique(res, '/app/AdminAttendance', 'إدارة الحضور')
      pushUnique(res, '/app/AdminFinance', 'ادارة الميزانية')
      pushUnique(res, '/app/MaterialAdmin', 'ادارة الأدوات ')
      pushUnique(res, '/app/materials', 'الأدوات')
      pushUnique(res, '/app/AdminEvaluations', 'التقييم (أدمن)')
      pushUnique(res, '/app/admin', 'لوحة الإدارة')
      pushUnique(res, '/app/admin-scout-years', 'السنة الكشفية')
      pushUnique(res, '/app/year-responsibilities', 'مسؤوليات السنة')
      pushUnique(res, '/app/admin-terms-meetings', 'الترمات والاجتماعات')
      pushUnique(res, '/app/admin-members', 'الأعضاء والأدوار')
      pushUnique(res, '/app/admin-best-chefs', 'أفضل الـ chefs')
      pushUnique(res, '/app/admin-audit-log', 'سجل العمليات')
      pushUnique(res, '/app/AdminSecretary', 'إدارة السكرتارية')
      pushUnique(res, '/app/AdminEvents', 'فعاليات')
      if (SHOW_EVALUATION_QUESTIONS) pushUnique(res, '/app/AdminEvalQuestions', 'أسئلة التقييم')
      pushUnique(res, '/app/financeEvent', 'ميزانية المجموعة')
      pushUnique(res, '/app/MaterialsReturnApprove', 'استلام واسترجاع الأدوات')
      pushUnique(res, '/app/meeting-minutes', 'المحاضر')
      pushUnique(res, '/app/meeting-tasks', 'متابعة التاسكات')
      pushUnique(res, '/app/camp-installments', 'التقسيط')
      pushUnique(res, '/app/camp-program', 'نظام المعسكر')
      pushUnique(res, '/app/ChefsEvaluationOverview', 'التقييم النهائى ')

      // Super Admin should see the complete operational navigation as well,
      // not only the administration shortcuts.
      pushUnique(res, '/app/LegionEvaluations', 'تقييم فريقي')
      pushUnique(res, '/app/TeamCases', 'ملاحظات الفريق')
      pushUnique(res, '/app/TeamStatistics', 'إحصائيات الفريق')
      pushUnique(res, '/app/LegionAttendance', 'غياب فريقي')
      pushUnique(res, '/app/FieldReservationsTeam', 'حجز الارض')
      pushUnique(res, '/app/TeamFinance', 'ميزانية الفريق')
      pushUnique(res, '/app/MaterialTeamReservation', 'حجز الأدوات')
      pushUnique(res, '/app/TeamSecretary', 'سكرتارية فريقي')
      pushUnique(res, '/app/TeamSecretaryAttendance', 'غياب فريقي (سكرتارية)')
      pushUnique(res, '/app/reports-center', 'مركز التقارير')
      pushUnique(res, '/app/my-camp-collections', 'تحصيل المعسكرات')
    } else {
      if (has('chef_de_legion')) {
        pushUnique(res, '/app/LegionEvaluations', 'تقييم فريقي')
        pushUnique(res, '/app/TeamCases', 'ملاحظات الفريق')
        pushUnique(res, '/app/TeamStatistics', 'إحصائيات الفريق')
        pushUnique(res, '/app/meeting-minutes', 'المحاضر')
        pushUnique(res, '/app/meeting-tasks', 'متابعة التاسكات')
        pushUnique(res, '/app/camp-installments', 'التقسيط')
        pushUnique(res, '/app/camp-program', 'نظام المعسكر')
        pushUnique(res, '/app/LegionAttendance', 'غياب فريقي')
        pushUnique(res, '/app/FieldReservationsTeam', 'حجز الارض')
        pushUnique(res, '/app/TeamFinance', 'ميزانية الفريق')
        pushUnique(res, '/app/MaterialTeamReservation', 'حجز الأدوات')
        pushUnique(res, '/app/TeamSecretary', 'سكرتارية فريقي')
        pushUnique(res, '/app/ChefsEvaluationOverview', 'التقييم النهائى ')
        pushUnique(res, '/app/reports-center', 'مركز التقارير')
      }

      if (isGlobalFinance) {
        pushUnique(res, '/app/AdminFinance', 'ادارة الميزانية')
        pushUnique(res, '/app/financeEvent', 'ميزانية المجموعة')
      }

      if (has('responsable_finance')) {
        pushUnique(res, '/app/TeamFinance', 'ميزانية فريقى')
      }

      if (has('responsable_materials')) {
        pushUnique(res, '/app/FieldReservationsTeam', 'حجز الارض')
        pushUnique(res, '/app/MaterialTeamReservation', 'حجز الأدوات')
      }

      const materialTeamIds = new Set(
        roles
          .filter((r: RoleRow) => r.role_slug === 'responsable_materials' && r.team_id)
          .map((r: RoleRow) => String(r.team_id))
      )
      const hasMaterialChefSameTeam = roles.some(
        (r: RoleRow) => r.role_slug === 'chef_de_legion' && r.team_id && materialTeamIds.has(String(r.team_id))
      )
      const showMaterialsApprove = isGlobalMaterials || hasMaterialChefSameTeam

      if (showMaterialsApprove) {
        pushUnique(res, '/app/MaterialsReturnApprove', 'استلام واسترجاع الأدوات')
      }
      if (hasMaterialChefSameTeam) {
        pushUnique(res, '/app/AdminFieldReservations', 'ادارة الارض')
      }
      if (isGlobalMaterials) {
        pushUnique(res, '/app/MaterialAdmin', 'ادارة الأدوات ')
      }

      if (isGlobalSecretary) {
        pushUnique(res, '/app/AdminSecretary', 'إدارة السكرتارية')
        pushUnique(res, '/app/TeamSecretary', 'سكرتارية فريقي')
        pushUnique(res, '/app/TeamSecretaryAttendance', 'غياب فريقي')
      } else if (hasTeamSecretary) {
        pushUnique(res, '/app/AdminSecretary', 'متابعة سكرتارية الفريق')
        pushUnique(res, '/app/TeamSecretary', 'سكرتارية فريقي')
        pushUnique(res, '/app/TeamSecretaryAttendance', 'غياب فريقي')
        pushUnique(res, '/app/TeamCases', 'ملاحظات الفريق')
        pushUnique(res, '/app/TeamStatistics', 'إحصائيات الفريق')
      }
    }

    if (showDelegatedCampProgram) {
      pushUnique(res, '/app/camp-program', 'نظام المعسكر')
    }

    // يظهر لمسؤول التحصيل المباشر أو لأي Chef de legion/مسؤول مالية على فريق له معسكرات
    if (showCollectorCollections) {
      pushUnique(res, '/app/my-camp-collections', 'تحصيل المعسكرات')
    }

    pushUnique(res, '/app/evaluation', 'تقييمي')
    pushUnique(res, '/app/storage', 'اماكن العهدة')
    pushUnique(res, '/app/notifications', 'الإشعارات')

    return res
  }, [
    roles,
    isAdmin,
    user,
    isGlobalSecretary,
    isGlobalFinance,
    isGlobalMaterials,
    hasTeamSecretary,
    showCollectorCollections,
    showDelegatedCampProgram,
  ])


  const IconSvg = ({ name }: { name: string }) => {
    const common = {
      width: 18,
      height: 18,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      'aria-hidden': true,
    }

    switch (name) {
      case 'home':
        return <svg {...common}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>
      case 'dashboard':
        return <svg {...common}><rect x="3" y="3" width="7" height="8" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="15" width="7" height="6" rx="2"/></svg>
      case 'profile':
        return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
      case 'members':
        return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      case 'award':
        return <svg {...common}><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5"/></svg>
      case 'attendance':
        return <svg {...common}><path d="M9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      case 'finance':
        return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/><path d="M7 15h3"/><path d="M15 15h2"/></svg>
      case 'materials':
        return <svg {...common}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
      case 'reservations':
        return <svg {...common}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      case 'evaluation':
        return <svg {...common}><path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6-4.36-4.25 6.03-.88Z"/></svg>
      case 'notes':
        return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>
      case 'tasks':
        return <svg {...common}><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="m3 6 1 1 2-2"/><path d="m3 12 1 1 2-2"/><path d="m3 18 1 1 2-2"/></svg>
      case 'collections':
        return <svg {...common}><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>
      case 'camp':
        return <svg {...common}><path d="M3 20 12 4l9 16"/><path d="M9 20 12 9l3 11"/><path d="M4 20h16"/></svg>
      case 'reports':
        return <svg {...common}><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="5" rx="1"/><rect x="12" y="8" width="3" height="9" rx="1"/><rect x="17" y="5" width="3" height="12" rx="1"/></svg>
      case 'notifications':
        return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      case 'gallery':
        return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 15-4.5-4.5L5 22"/></svg>
      case 'curriculum':
        return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z"/><path d="M8 7h8"/><path d="M8 11h6"/></svg>
      case 'events':
        return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>
      case 'year':
        return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>
      case 'audit':
        return <svg {...common}><path d="M9 12h6"/><path d="M9 16h6"/><path d="M8 2h8l2 3v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5Z"/><path d="M9 6h6"/></svg>
      case 'secretary':
        return <svg {...common}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>
      case 'logout':
        return <svg {...common}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
      default:
        return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>
    }
  }

  const navIcon = (to: string, label: string) => {
    const normalized = `${to} ${label}`.toLowerCase()
    if (normalized.includes('admindashboard') || label.includes('لوحة التحكم')) return <IconSvg name="dashboard" />
    if (to === '/app' || label.includes('الرئيسية')) return <IconSvg name="home" />
    if (label.includes('ملفي')) return <IconSvg name="profile" />
    if (label.includes('الأعضاء') || label.includes('الأدوار')) return <IconSvg name="members" />
    if (label.includes('أفضل')) return <IconSvg name="award" />
    if (label.includes('الحضور') || label.includes('غياب')) return <IconSvg name="attendance" />
    if (label.includes('الميزانية') || normalized.includes('finance')) return <IconSvg name="finance" />
    if (label.includes('الأدوات') || label.includes('العهدة') || normalized.includes('material')) return <IconSvg name="materials" />
    if (label.includes('الحجوزات') || label.includes('الارض') || label.includes('الأرض') || normalized.includes('reservation')) return <IconSvg name="reservations" />
    if (label.includes('التقييم') || normalized.includes('evaluation')) return <IconSvg name="evaluation" />
    if (label.includes('مسؤوليات السنة')) return <IconSvg name="tasks" />
    if (label.includes('السنة الكشفية') || label.includes('الترمات')) return <IconSvg name="year" />
    if (label.includes('سجل العمليات')) return <IconSvg name="audit" />
    if (label.includes('السكرتارية') || label.includes('سكرتارية')) return <IconSvg name="secretary" />
    if (label.includes('فعاليات') || normalized.includes('events')) return <IconSvg name="events" />
    if (label.includes('المحاضر')) return <IconSvg name="notes" />
    if (label.includes('التاسكات')) return <IconSvg name="tasks" />
    if (label.includes('التقسيط') || label.includes('تحصيل')) return <IconSvg name="collections" />
    if (label.includes('المعسكر')) return <IconSvg name="camp" />
    if (label.includes('التقارير')) return <IconSvg name="reports" />
    if (label.includes('الإشعارات')) return <IconSvg name="notifications" />
    if (label.includes('الصور')) return <IconSvg name="gallery" />
    if (label.includes('المنهج')) return <IconSvg name="curriculum" />
    if (label.includes('اماكن') || label.includes('أماكن')) return <IconSvg name="reservations" />
    return <IconSvg name="default" />
  }

  const handleNavigate = () => {
    onNavigate?.()
  }

  // ===== Local sign out to avoid 403 =====
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await supabase.auth.signOut({ scope: 'local' })
      handleNavigate()
      window.location.replace('/')
    } catch {
      handleNavigate()
      window.location.replace('/')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <aside className="sidenav">
      <div className="sidenav-close-row">
        <span className="sidenav-kicker">القائمة الرئيسية</span>
        <button type="button" className="sidenav-close" onClick={handleNavigate} aria-label="إغلاق القائمة">×</button>
      </div>
      <div className="sidenav-header">
        <div className="sidenav-brand-lockup">
          <img src={scoutSvmOfficialLogo} alt="" aria-hidden="true" className="sidenav-brand-logo" />
          <div>
            <div className="brand">ScoutSVM</div>
            <div className="sidenav-brand-subtitle">Scouts &amp; Guides Saint Vincent Miami</div>
          </div>
        </div>

        <NavLink to="/app/member-profile" className="mt-3 flex items-center gap-3 rounded-[22px] border border-white/0 p-2 transition hover:border-white/60 hover:bg-white/55 hover:shadow-sm" onClick={handleNavigate}>
          {avatar ? (
            <img
              src={avatar}
              alt="صورة الحساب"
              className="w-12 h-12 rounded-full object-cover border"
              onError={() => setAvatar(null)}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-white flex items-center justify-center font-semibold select-none">
              {initials || '👤'}
            </div>
          )}

          <div>
            <div className="user-name">{user?.name}</div>
            <div className="user-email">{user?.email}</div>
            <div className="user-teamname">{user?.teamName}</div>
            {currentScoutYear?.name && (
              <div className="mt-1 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                {currentScoutYear.name}
              </div>
            )}
          </div>
        </NavLink>
      </div>

      <nav className="sidenav-nav">
        {items.map((i) => {
          const isNotif = i.to === '/app/notifications'
          return (
            <NavLink
              key={i.to}
              to={i.to}
              end
              className={({ isActive }) => `snav ${isActive ? 'snav-active' : ''}`}
              onClick={handleNavigate}
            >
              <span className="snav-content">
                <span className="snav-icon" aria-hidden="true">{navIcon(i.to, i.label)}</span>
                <span className="snav-label">{i.label}</span>
                {isNotif && unread > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full text-[11px] font-bold text-white shadow-sm shadow-red-500/20"
                    style={{ backgroundColor: '#ef4444' }}
                    aria-label={`لديك ${unread} إشعار غير مقروء`}
                  >
                    {unread}
                  </span>
                )}
              </span>
            </NavLink>
          )
        })}

        <a
          className="snav"
          href={PROGRAM_URL}
          target="_blank"
          rel="noreferrer"
          onClick={handleNavigate}
        >
          <span className="snav-content"><span className="snav-icon" aria-hidden="true"><IconSvg name="curriculum" /></span><span className="snav-label">المنهج</span></span>
        </a>

        <a
          className="snav"
          href={IMAGES_URL}
          target="_blank"
          rel="noreferrer"
          onClick={handleNavigate}
        >
          <span className="snav-content"><span className="snav-icon" aria-hidden="true"><IconSvg name="gallery" /></span><span className="snav-label">الصور</span></span>
        </a>
      </nav>

      <div className="sidenav-footer">
        <button
          type="button"
          className="btn border w-full"
          onClick={handleSignOut}
          disabled={signingOut}
        >
          <span className="snav-icon" aria-hidden="true"><IconSvg name="logout" /></span>
          {signingOut ? 'جارٍ تسجيل الخروج...' : 'تسجيل الخروج'}
        </button>
      </div>
    </aside>
  )
}