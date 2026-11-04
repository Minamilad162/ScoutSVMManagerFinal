import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../components/AuthProvider'
import { useScoutYear } from '../components/ScoutYearProvider'
import { EmptyState } from '../components/ui/EmptyState'
import { InlineAlert } from '../components/ui/InlineAlert'
import { LoadingButton } from '../components/ui/LoadingButton'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { PageLoader } from '../components/ui/PageLoader'
import { SectionCard } from '../components/ui/SectionCard'
import { useToast } from '../components/ui/Toaster'
import { safeWriteAuditLog } from '../features/audit/api'
import { supabase } from '../lib/supabase'
import { getErrorMessage, logError } from '../lib/errors'
import {
  cloneScoutYearStructure,
  cloneScoutYearTermsAndMeetingDates,
  deleteScoutYear,
  fetchScoutYearActivationReadiness,
  listScoutYearOverview,
  listScoutYears,
  saveScoutYear,
  setScoutYearAsCurrent,
  syncLegacyStateFromScoutYear,
  type ScoutYearActivationReadiness,
  type ScoutYearRow,
  type ScoutYearSummary,
} from '../features/scoutYears/api'

function fmtDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

type ScoutYearStatus = ScoutYearRow['status']

const STATUS_OPTIONS: { value: ScoutYearStatus; label: string }[] = [
  { value: 'draft', label: 'مسودة' },
  { value: 'active', label: 'نشطة' },
  { value: 'archived', label: 'مؤرشفة' },
  { value: 'cancelled', label: 'ملغاة' },
]

type RolloverTeam = { id: string; name: string }
type RolloverRank = { id: number; rank_label: string; rank_slug?: string | null }
type RolloverRole = { id: number; role_slug: string; role_label: string | null }
type RolloverRoleAssignment = {
  id?: string
  user_id: string
  role_id: number
  team_id: string | null
  is_active?: boolean | null
  notes?: string | null
  created_by?: string | null
}

type RolloverMemberDraft = {
  memberId: string
  authUserId: string | null
  email: string
  fullName: string
  currentTeamId: string | null
  currentTeamName: string
  currentRankId: number | null
  currentRankLabel: string
  currentIsEquipier: boolean
  sourceIsActive: boolean
  sourceNotes: string | null
  hasTargetAssignment: boolean
  keep: boolean
  targetTeamId: string
  targetRankId: number | ''
  targetIsEquipier: boolean
  roleKeys: string[]
  sourceRoleKeys: string[]
}

function roleKey(roleId: number, teamId?: string | null) {
  return `${roleId}::${teamId || 'global'}`
}

function parseRoleKey(value: string) {
  const [roleIdRaw, teamIdRaw] = value.split('::')
  const roleId = Number(roleIdRaw)
  return {
    role_id: roleId,
    team_id: teamIdRaw && teamIdRaw !== 'global' ? teamIdRaw : null,
  }
}

function sameRoleKeys(a: string[], b: string[]) {
  const left = [...a].sort().join('|')
  const right = [...b].sort().join('|')
  return left === right
}

function stripRoleFromKeys(keys: string[], roleId: number) {
  return keys.filter((key) => parseRoleKey(key).role_id !== roleId)
}

function hasRoleKey(keys: string[], roleId: number) {
  return keys.some((key) => parseRoleKey(key).role_id === roleId)
}

function getRoleScope(keys: string[], roleId: number): 'global' | 'team' {
  const found = keys.map(parseRoleKey).find((item) => item.role_id === roleId)
  return found?.team_id ? 'team' : 'global'
}

function setRoleKeyScope(keys: string[], roleId: number, enabled: boolean, scope: 'global' | 'team', teamId: string) {
  const next = stripRoleFromKeys(keys, roleId)
  if (!enabled) return next
  next.push(roleKey(roleId, scope === 'global' ? null : teamId || null))
  return next
}

function moveTeamScopedRoleKeys(keys: string[], teamId: string) {
  return keys.map((key) => {
    const parsed = parseRoleKey(key)
    if (!parsed.team_id) return key
    return roleKey(parsed.role_id, teamId || parsed.team_id)
  })
}

function statusTone(status: ScoutYearStatus) {
  if (status === 'active') return 'green'
  if (status === 'draft') return 'yellow'
  if (status === 'archived') return 'blue'
  if (status === 'cancelled') return 'red'
  return 'slate'
}

function statusLabel(status: ScoutYearStatus) {
  return STATUS_OPTIONS.find((x) => x.value === status)?.label ?? status
}

function startOfNextDay(isoDate: string) {
  const dt = new Date(`${isoDate}T00:00:00`)
  dt.setDate(dt.getDate() + 1)
  return dt.toISOString().slice(0, 10)
}

function addDays(isoDate: string, days: number) {
  const dt = new Date(`${isoDate}T00:00:00`)
  dt.setDate(dt.getDate() + days)
  return dt.toISOString().slice(0, 10)
}

function diffDaysInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const ms = end.getTime() - start.getTime()
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)))
}

function suggestNextYearName(currentYearName?: string) {
  if (!currentYearName) return ''
  const match = currentYearName.match(/(\d{4})\s*\/\s*(\d{4})/)
  if (match) {
    const nextStart = Number(match[1]) + 1
    const nextEnd = Number(match[2]) + 1
    return `${nextStart}/${nextEnd}`
  }
  return `${currentYearName} - نسخة جديدة`
}

export default function AdminScoutYears() {
  const { roles, user } = useAuth()
  const { actualCurrentScoutYear: currentScoutYear, reload: reloadCurrentScoutYear } = useScoutYear()
  const toast = useToast()
  const isAdmin = roles.some((r) => r.role_slug === 'admin')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [switchingYearId, setSwitchingYearId] = useState<string | null>(null)
  const [syncingYearId, setSyncingYearId] = useState<string | null>(null)
  const [deletingYearId, setDeletingYearId] = useState<string | null>(null)
  const [cloning, setCloning] = useState(false)
  const [runningWizard, setRunningWizard] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [years, setYears] = useState<ScoutYearRow[]>([])
  const [summaries, setSummaries] = useState<Record<string, ScoutYearSummary>>({})

  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<ScoutYearStatus>('draft')
  const [notes, setNotes] = useState('')

  const [sourceYearId, setSourceYearId] = useState('')
  const [targetYearId, setTargetYearId] = useState('')
  const [wizardCloneStructure, setWizardCloneStructure] = useState(false)
  const [wizardCloneTerms, setWizardCloneTerms] = useState(true)
  const [wizardCloneMeetingDates, setWizardCloneMeetingDates] = useState(true)
  const [wizardSyncLegacy, setWizardSyncLegacy] = useState(false)
  const [rolloverLoading, setRolloverLoading] = useState(false)
  const [rolloverApplying, setRolloverApplying] = useState(false)
  const [rolloverTeams, setRolloverTeams] = useState<RolloverTeam[]>([])
  const [rolloverRanks, setRolloverRanks] = useState<RolloverRank[]>([])
  const [rolloverRoles, setRolloverRoles] = useState<RolloverRole[]>([])
  const [rolloverRows, setRolloverRows] = useState<RolloverMemberDraft[]>([])
  const [rolloverQuery, setRolloverQuery] = useState('')
  const [rolloverTeamFilter, setRolloverTeamFilter] = useState('')
  const [rolloverOnlyChanges, setRolloverOnlyChanges] = useState(false)
  const [rolloverRoleFilter, setRolloverRoleFilter] = useState('')
  const [rolloverSyncLegacy, setRolloverSyncLegacy] = useState(false)
  const [rolloverReviewOpen, setRolloverReviewOpen] = useState(false)
  const [activationReviewYearId, setActivationReviewYearId] = useState<string | null>(null)
  const [activationReadiness, setActivationReadiness] = useState<ScoutYearActivationReadiness | null>(null)
  const [activationReadinessLoading, setActivationReadinessLoading] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      // SQL18 returns every year + its counters in one DB round-trip.
      // A safe fallback remains inside listScoutYearOverview for databases not migrated yet.
      const overview = await listScoutYearOverview()
      setYears(overview.years)
      setSummaries(overview.summaries)
    } catch (error) {
      logError('AdminScoutYears.loadAll', error as any)
      setError(getErrorMessage(error as any, 'تعذر تحميل السنوات الكشفية'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    void loadAll()
  }, [isAdmin])

  const currentYearName = currentScoutYear?.name || 'غير محددة'

  const sortedYears = useMemo(() => years, [years])
  const sourceYear = useMemo(() => years.find((x) => x.id === sourceYearId) ?? currentScoutYear ?? null, [years, sourceYearId, currentScoutYear])
  const targetYear = useMemo(() => years.find((x) => x.id === targetYearId) ?? null, [years, targetYearId])

  const wizardTargetPreview = useMemo(() => {
    if (!startDate || !endDate) return null
    return {
      start: startDate,
      end: endDate,
      durationDays: diffDaysInclusive(startDate, endDate) + 1,
    }
  }, [startDate, endDate])

  const sourceSummary = sourceYear ? summaries[sourceYear.id] : null
  const targetSummary = targetYear ? summaries[targetYear.id] : null
  const activationReviewYear = activationReviewYearId ? years.find((year) => year.id === activationReviewYearId) ?? null : null

  const resetForm = () => {
    setEditId(null)
    setName('')
    setStartDate('')
    setEndDate('')
    setStatus('draft')
    setNotes('')
  }

  const fillFromCurrentYear = () => {
    if (!currentScoutYear?.start_date || !currentScoutYear?.end_date) return
    const nextStart = startOfNextDay(currentScoutYear.end_date)
    const duration = diffDaysInclusive(currentScoutYear.start_date, currentScoutYear.end_date)
    const nextEnd = addDays(nextStart, duration)
    setEditId(null)
    setName(suggestNextYearName(currentScoutYear.name))
    setStartDate(nextStart)
    setEndDate(nextEnd)
    setStatus('draft')
    setNotes(currentScoutYear.notes || '')
    setSourceYearId(currentScoutYear.id)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      if (!name.trim()) throw new Error('اسم السنة الكشفية مطلوب')
      if (!startDate) throw new Error('حدد تاريخ البداية')
      if (!endDate) throw new Error('حدد تاريخ النهاية')
      if (endDate < startDate) throw new Error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية')

      const saved = await saveScoutYear({
        id: editId ?? undefined,
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        status,
        notes: notes.trim() || null,
      })

      setSuccessMsg(editId ? 'تم تحديث السنة الكشفية' : 'تم إنشاء السنة الكشفية')
      toast.success(editId ? 'تم تحديث السنة الكشفية' : 'تم إنشاء السنة الكشفية')
      resetForm()
      await loadAll()

      if (!targetYearId && saved?.id) {
        setTargetYearId(saved.id)
      }
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر حفظ السنة الكشفية')
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleSetCurrent = async (scoutYearId: string) => {
    setActivationReviewYearId(scoutYearId)
    setActivationReadiness(null)
    setActivationReadinessLoading(true)
    setError(null)
    try {
      // Readiness is intentionally lazy: no member-level validation payload is loaded
      // until the admin asks to review a specific year.
      const readiness = await fetchScoutYearActivationReadiness(scoutYearId, 50)
      setActivationReadiness(readiness)
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر مراجعة جاهزية السنة')
      setError(msg)
      toast.error(msg)
    } finally {
      setActivationReadinessLoading(false)
    }
  }

  const confirmScoutYearActivation = async () => {
    if (!activationReviewYearId || !activationReadiness?.can_activate) return
    const year = years.find((x) => x.id === activationReviewYearId)
    const ok = window.confirm(`السنة ${year?.name || ''} اجتازت الفحوصات المطلوبة. هل تريد تفعيلها كسنة حالية الآن؟`)
    if (!ok) return

    setSwitchingYearId(activationReviewYearId)
    setError(null)
    setSuccessMsg(null)
    try {
      // SQL18 validates again inside the same atomic activation transaction,
      // preventing a stale review from bypassing the readiness gate.
      await setScoutYearAsCurrent(activationReviewYearId)
      await reloadCurrentScoutYear()
      await loadAll()
      setActivationReviewYearId(null)
      setActivationReadiness(null)
      setSuccessMsg(`تم تعيين السنة ${year?.name || ''} كسنة حالية بعد اجتياز مراجعة الجاهزية`)
      toast.success('تم تفعيل السنة الحالية')
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر تفعيل السنة الحالية')
      setError(msg)
      toast.error(msg)
      try {
        const refreshed = await fetchScoutYearActivationReadiness(activationReviewYearId, 50)
        setActivationReadiness(refreshed)
      } catch {}
    } finally {
      setSwitchingYearId(null)
    }
  }

  const handleSyncLegacy = async (scoutYearId: string) => {
    const year = years.find((x) => x.id === scoutYearId)
    const ok = window.confirm(`سيتم تحديث الجداول الحالية (members / user_roles) من السنة ${year?.name || ''}. هل تريد المتابعة؟`)
    if (!ok) return

    setSyncingYearId(scoutYearId)
    setError(null)
    setSuccessMsg(null)
    try {
      await syncLegacyStateFromScoutYear(scoutYearId)
      setSuccessMsg(`تمت مزامنة الجداول الحالية من السنة ${year?.name || ''}`)
      toast.success('تمت مزامنة الجداول الحالية بنجاح')
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر مزامنة الجداول الحالية')
      setError(msg)
      toast.error(msg)
    } finally {
      setSyncingYearId(null)
    }
  }

  const handleClone = async () => {
    if (!sourceYearId) {
      const msg = 'اختر السنة المصدر'
      setError(msg)
      toast.error(msg)
      return
    }
    if (!targetYearId) {
      const msg = 'اختر السنة الهدف'
      setError(msg)
      toast.error(msg)
      return
    }

    const sourceYear = years.find((x) => x.id === sourceYearId)
    const targetYear = years.find((x) => x.id === targetYearId)
    const ok = window.confirm(`سيتم نسخ الهيكل من ${sourceYear?.name || ''} إلى ${targetYear?.name || ''}. هل تريد المتابعة؟`)
    if (!ok) return

    setCloning(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await cloneScoutYearStructure(sourceYearId, targetYearId)
      setSuccessMsg(`تم نسخ الهيكل من ${sourceYear?.name || ''} إلى ${targetYear?.name || ''}`)
      toast.success('تم نسخ الهيكل السنوي')
      await loadAll()
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر نسخ الهيكل السنوي')
      setError(msg)
      toast.error(msg)
    } finally {
      setCloning(false)
    }
  }

  const handleRunWizard = async () => {
    setRunningWizard(true)
    setError(null)
    setSuccessMsg(null)

    try {
      let sourceId = sourceYearId || currentScoutYear?.id || ''
      if (!sourceId) throw new Error('اختر سنة مصدر أو عيّن سنة حالية أولًا')

      let targetId = targetYearId
      let targetLabel = targetYear?.name || name.trim()

      if (!targetId) {
        if (!name.trim()) throw new Error('أدخل اسم السنة الجديدة أو اختر سنة هدف موجودة')
        if (!startDate) throw new Error('حدد تاريخ بداية السنة الهدف')
        if (!endDate) throw new Error('حدد تاريخ نهاية السنة الهدف')
        if (endDate < startDate) throw new Error('تاريخ النهاية يجب أن يكون بعد تاريخ البداية')

        const savedYear = await saveScoutYear({
          name: name.trim(),
          start_date: startDate,
          end_date: endDate,
          status,
          notes: notes.trim() || null,
        })

        targetId = savedYear.id
        targetLabel = savedYear.name
        setTargetYearId(savedYear.id)
      }

      if (sourceId === targetId) {
        throw new Error('السنة المصدر والهدف لا يمكن أن تكونا نفس السنة')
      }

      if (wizardCloneStructure) {
        await cloneScoutYearStructure(sourceId, targetId)
      }

      let termCloneSummary: { termsCloned: number; meetingDatesCloned: number } | null = null
      if (wizardCloneTerms) {
        termCloneSummary = await cloneScoutYearTermsAndMeetingDates(sourceId, targetId, {
          cloneMeetingDates: wizardCloneMeetingDates,
        })
      }


      if (wizardSyncLegacy) {
        await syncLegacyStateFromScoutYear(targetId)
      }

      await loadAll()

      const messageParts = [
        `تم إعداد السنة ${targetLabel}`,
        wizardCloneStructure ? 'مع نسخ الهيكل الأساسي' : null,
        termCloneSummary ? `ونسخ ${termCloneSummary.termsCloned} ترم` : null,
        termCloneSummary && wizardCloneMeetingDates ? `و${termCloneSummary.meetingDatesCloned} موعد اجتماع` : null,
        'والتفعيل يتم لاحقًا بعد مراجعة الجاهزية',
        wizardSyncLegacy ? 'ومزامنة الجداول الحالية' : null,
      ].filter(Boolean)

      const finalMessage = messageParts.join(' ')
      setSuccessMsg(finalMessage)
      toast.success('تم تشغيل معالج السنة الجديدة بنجاح')
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر تشغيل معالج السنة الجديدة')
      setError(msg)
      toast.error(msg)
    } finally {
      setRunningWizard(false)
    }
  }


  const roleLabelsByKey = useMemo(() => {
    const teamsById = new Map(rolloverTeams.map((team) => [team.id, team.name]))
    const rolesById = new Map(rolloverRoles.map((role) => [role.id, role.role_label || role.role_slug]))
    return (key: string) => {
      const parsed = parseRoleKey(key)
      const roleLabel = rolesById.get(parsed.role_id) || `Role ${parsed.role_id}`
      const teamLabel = parsed.team_id ? teamsById.get(parsed.team_id) || 'فريق غير محدد' : 'عام'
      return `${roleLabel} — ${teamLabel}`
    }
  }, [rolloverTeams, rolloverRoles])

  const rolloverEditableRoles = useMemo(
    () => rolloverRoles.filter((role) => role.role_slug !== 'equipier'),
    [rolloverRoles]
  )

  const rolloverStats = useMemo(() => {
    const total = rolloverRows.length
    const keep = rolloverRows.filter((row) => row.keep).length
    const removed = total - keep
    const withAccount = rolloverRows.filter((row) => row.authUserId).length
    const alreadyTransferred = rolloverRows.filter((row) => row.hasTargetAssignment).length
    const needsSetup = rolloverRows.filter(
      (row) => row.keep && row.targetRankId === ''
    ).length
    const configured = Math.max(keep - needsSetup, 0)
    return { total, keep, removed, withAccount, alreadyTransferred, needsSetup, configured }
  }, [rolloverRows])

  const rolloverValidation = useMemo(() => {
    const sourceId = sourceYearId || currentScoutYear?.id || ''
    const critical: string[] = []
    const warnings: string[] = []
    const keptRows = rolloverRows.filter((row) => row.keep)

    const targetHasData = Boolean(
      targetYearId &&
      targetSummary &&
      ((targetSummary.members_count || 0) > 0 || (targetSummary.roles_count || 0) > 0)
    )

    if (!sourceId) critical.push('اختار السنة المصدر قبل النقل.')
    if (!targetYearId) critical.push('اختار السنة الهدف قبل النقل.')
    if (sourceId && targetYearId && sourceId === targetYearId) critical.push('السنة المصدر والهدف لا ينفع يكونوا نفس السنة.')
    if (!rolloverRows.length) critical.push('حمّل أكونتات السنة المصدر الأول.')
    if (!keptRows.length && rolloverRows.length) warnings.push('لم يتم اختيار أي أكونت للنقل إلى السنة الجديدة.')
    if (targetHasData) warnings.push('السنة الهدف تحتوي على بيانات بالفعل. إعادة النقل ستستبدل Roster الأشخاص القادمين من السنة المصدر فقط.')
    if (rolloverSyncLegacy) warnings.push('مزامنة الجداول القديمة مفعلة. يفضل تأجيلها لحد ما تخلص إعداد السنة الجديدة.')

    return { critical, warnings, targetHasData, canApply: critical.length === 0 }
  }, [currentScoutYear?.id, rolloverRows, rolloverSyncLegacy, sourceYearId, targetSummary, targetYearId])

  const filteredRolloverRows = useMemo(() => {
    const q = rolloverQuery.trim().toLowerCase()
    return rolloverRows.filter((row) => {
      if (rolloverTeamFilter && row.currentTeamId !== rolloverTeamFilter && row.targetTeamId !== rolloverTeamFilter) return false
      if (rolloverRoleFilter && !hasRoleKey(row.sourceRoleKeys, Number(rolloverRoleFilter))) return false
      if (q) {
        const hay = `${row.fullName} ${row.email} ${row.currentTeamName} ${row.currentRankLabel} ${row.sourceRoleKeys.map(roleLabelsByKey).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (rolloverOnlyChanges) {
        const changed = row.keep !== row.hasTargetAssignment
        if (!changed) return false
      }
      return true
    })
  }, [rolloverRows, rolloverQuery, rolloverTeamFilter, rolloverRoleFilter, rolloverOnlyChanges, roleLabelsByKey])

  const updateRolloverRow = (memberId: string, patch: Partial<RolloverMemberDraft>) => {
    setRolloverRows((prev) => prev.map((row) => (row.memberId === memberId ? { ...row, ...patch } : row)))
  }

  const updateRolloverTeam = (memberId: string, targetTeamId: string) => {
    setRolloverRows((prev) =>
      prev.map((row) =>
        row.memberId === memberId
          ? { ...row, targetTeamId, roleKeys: moveTeamScopedRoleKeys(row.roleKeys, targetTeamId) }
          : row
      )
    )
  }

  const updateRolloverRole = (memberId: string, roleId: number, enabled: boolean, scope: 'global' | 'team') => {
    setRolloverRows((prev) =>
      prev.map((row) =>
        row.memberId === memberId
          ? { ...row, roleKeys: setRoleKeyScope(row.roleKeys, roleId, enabled, scope, row.targetTeamId || row.currentTeamId || '') }
          : row
      )
    )
  }

  const loadDetailedRollover = async () => {
    const sourceId = sourceYearId || currentScoutYear?.id || ''
    const targetId = targetYearId || ''
    if (!sourceId) {
      const msg = 'اختر السنة المصدر أولًا'
      setError(msg)
      toast.error(msg)
      return
    }
    if (targetId && sourceId === targetId) {
      const msg = 'السنة المصدر والهدف لا يمكن أن تكونا نفس السنة'
      setError(msg)
      toast.error(msg)
      return
    }

    setRolloverLoading(true)
    setRolloverReviewOpen(false)
    setError(null)
    setSuccessMsg(null)
    try {
      const targetAssignmentsPromise = targetId
        ? supabase
            .from('member_season_assignments')
            .select('member_id,team_id,rank_id,is_equipier,is_active,notes')
            .eq('scout_year_id', targetId)
        : Promise.resolve({ data: [], error: null } as any)

      const targetRolesPromise = targetId
        ? supabase
            .from('user_role_assignments')
            .select('id,user_id,role_id,team_id,is_active,notes,created_by')
            .eq('scout_year_id', targetId)
            .eq('is_active', true)
        : Promise.resolve({ data: [], error: null } as any)

      const [teamsRes, ranksRes, rolesRes, sourceAssignmentsRes, sourceRolesRes, targetAssignmentsRes, targetRolesRes] = await Promise.all([
        supabase.from('teams').select('id,name').order('name'),
        supabase.from('ranks').select('id,rank_label,rank_slug').order('id'),
        supabase.from('roles').select('id,role_slug,role_label').order('id'),
        supabase
          .from('member_season_assignments')
          .select('member_id,team_id,rank_id,is_equipier,is_active,joined_at,left_at,notes')
          .eq('scout_year_id', sourceId),
        supabase
          .from('user_role_assignments')
          .select('id,user_id,role_id,team_id,is_active,notes,created_by')
          .eq('scout_year_id', sourceId)
          .eq('is_active', true),
        targetAssignmentsPromise,
        targetRolesPromise,
      ])

      if (teamsRes.error) throw teamsRes.error
      if (ranksRes.error) throw ranksRes.error
      if (rolesRes.error) throw rolesRes.error
      if (sourceAssignmentsRes.error) throw sourceAssignmentsRes.error
      if (sourceRolesRes.error) throw sourceRolesRes.error
      if (targetAssignmentsRes.error) throw targetAssignmentsRes.error
      if (targetRolesRes.error) throw targetRolesRes.error

      const teams = (teamsRes.data || []) as RolloverTeam[]
      const ranks = (ranksRes.data || []) as RolloverRank[]
      const allRolesCatalog = (rolesRes.data || []) as RolloverRole[]
      const rolesCatalog = allRolesCatalog.filter((role) => role.role_slug !== 'equipier')
      const roleSlugById = new Map(allRolesCatalog.map((role) => [role.id, role.role_slug]))
      const teamsById = new Map(teams.map((team) => [team.id, team.name]))
      const ranksById = new Map(ranks.map((rank) => [rank.id, rank.rank_label]))

      let sourceAssignments = ((sourceAssignmentsRes.data || []) as any[]).sort((a, b) => String(a.member_id).localeCompare(String(b.member_id)))
      let members: any[] = []
      let usedLegacyFallback = false

      if (sourceAssignments.length) {
        const memberIds = sourceAssignments.map((row) => row.member_id).filter(Boolean)
        if (memberIds.length) {
          const { data, error } = await supabase
            .from('members')
            .select('id,auth_user_id,full_name,team_id,rank_id,is_equipier,personal_phone,guardian_name,guardian_phone,birth_date,created_at')
            .in('id', memberIds)
          if (error) throw error
          members = data || []
        }
      } else {
        const { data, error } = await supabase
          .from('members')
          .select('id,auth_user_id,full_name,team_id,rank_id,is_equipier,personal_phone,guardian_name,guardian_phone,birth_date,created_at')
          .order('full_name', { ascending: true })
        if (error) throw error
        members = data || []
        usedLegacyFallback = members.length > 0
        sourceAssignments = members.map((member) => ({
          member_id: member.id,
          team_id: member.team_id,
          rank_id: member.rank_id,
          is_equipier: member.is_equipier ?? false,
          is_active: true,
          joined_at: null,
          left_at: null,
          notes: null,
        }))
      }

      const membersById = new Map(members.map((member) => [member.id, member]))
      const targetAssignmentByMember = new Map(((targetAssignmentsRes.data || []) as any[]).map((row) => [row.member_id, row]))

      let sourceRoleRows = (sourceRolesRes.data || []) as RolloverRoleAssignment[]
      if (!sourceRoleRows.length) {
        const { data: legacyRoles, error: legacyRolesError } = await supabase
          .from('user_roles')
          .select('user_id,role_id,team_id')
        if (legacyRolesError) throw legacyRolesError
        sourceRoleRows = ((legacyRoles || []) as any[]).map((role) => ({
          user_id: role.user_id,
          role_id: role.role_id,
          team_id: role.team_id ?? null,
          is_active: true,
        }))
      }

      const sourceRolesByUser = new Map<string, string[]>()
      sourceRoleRows.forEach((role) => {
        const list = sourceRolesByUser.get(role.user_id) || []
        list.push(roleKey(role.role_id, role.team_id))
        sourceRolesByUser.set(role.user_id, list)
      })

      const targetRolesByUser = new Map<string, string[]>()
      ;((targetRolesRes.data || []) as RolloverRoleAssignment[]).forEach((role) => {
        const list = targetRolesByUser.get(role.user_id) || []
        list.push(roleKey(role.role_id, role.team_id))
        targetRolesByUser.set(role.user_id, list)
      })

      const sourceAuthUserIds = Array.from(new Set(sourceAssignments.map((assignment) => membersById.get(assignment.member_id)?.auth_user_id).filter(Boolean))) as string[]
      const authEmailById = new Map<string, string>()
      if (sourceAuthUserIds.length) {
        const { data: authRows, error: authRowsError } = await supabase.rpc('admin_list_auth_accounts', { p_user_ids: sourceAuthUserIds }) as any
        if (!authRowsError) {
          ;((authRows || []) as any[]).forEach((row) => {
            if (row?.user_id) authEmailById.set(String(row.user_id), String(row.email || ''))
          })
        }
      }

      const allRows = sourceAssignments.map((assignment) => {
        const member = membersById.get(assignment.member_id)
        const targetAssignment = targetAssignmentByMember.get(assignment.member_id)
        const authUserId = member?.auth_user_id || null
        const sourceRoleKeys = authUserId
          ? (sourceRolesByUser.get(authUserId) || []).filter((key) => roleSlugById.get(parseRoleKey(key).role_id) !== 'equipier')
          : []
        const targetRoleKeys = authUserId
          ? (targetRolesByUser.get(authUserId) || []).filter((key) => roleSlugById.get(parseRoleKey(key).role_id) !== 'equipier')
          : []
        const hasTargetAssignment = Boolean(targetAssignment)
        const keep = hasTargetAssignment ? targetAssignment.is_active !== false : false
        return {
          memberId: assignment.member_id,
          authUserId,
          email: authUserId ? authEmailById.get(authUserId) || '' : '',
          fullName: member?.full_name || assignment.member_id,
          currentTeamId: assignment.team_id || null,
          currentTeamName: assignment.team_id ? teamsById.get(assignment.team_id) || '—' : '—',
          currentRankId: assignment.rank_id ?? null,
          currentRankLabel: assignment.rank_id ? ranksById.get(assignment.rank_id) || '—' : '—',
          currentIsEquipier: Boolean(assignment.is_equipier),
          sourceIsActive: assignment.is_active !== false,
          sourceNotes: assignment.notes ?? null,
          hasTargetAssignment,
          keep,
          targetTeamId: targetAssignment?.team_id || '',
          targetRankId: targetAssignment?.rank_id ?? '',
          targetIsEquipier: false,
          roleKeys: targetRoleKeys,
          sourceRoleKeys,
        } as RolloverMemberDraft
      })

      const rows = allRows.filter((row) => row.authUserId && !row.currentIsEquipier && row.sourceIsActive)

      setRolloverTeams(teams)
      setRolloverRanks(ranks)
      setRolloverRoles(rolesCatalog)
      setRolloverRows(rows.sort((a, b) => `${a.currentTeamName} ${a.fullName}`.localeCompare(`${b.currentTeamName} ${b.fullName}`, 'ar')))

      if (!rows.length) {
        setSuccessMsg(null)
        setError('لم يتم العثور على شيفات/قادة بأكونتات في السنة المصدر')
        toast.error('لم تظهر أي أكونتات قابلة للنقل')
      } else {
        const msg = usedLegacyFallback
          ? `تم تحميل ${rows.length} شيف/قائد من جدول الأعضاء العام لأن السنة المصدر لا تحتوي على بيانات موسمية مباشرة.`
          : `تم تحميل ${rows.length} شيف/قائد بأكونت من السنة المصدر للمراجعة التفصيلية.`
        setSuccessMsg(msg)
        toast.success('تم تحميل أكونتات السنة المصدر')
      }
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر تحميل قائمة النقل التفصيلي')
      setError(msg)
      toast.error(msg)
    } finally {
      setRolloverLoading(false)
    }
  }


  const openRolloverReview = () => {
    setRolloverReviewOpen(true)
    if (!rolloverRows.length) {
      const msg = 'حمّل أكونتات السنة المصدر الأول'
      setError(msg)
      toast.error(msg)
      return
    }
    if (rolloverValidation.critical.length) {
      toast.error('راجع التنبيهات الحمراء قبل الاعتماد')
      return
    }
    toast.success('المراجعة جاهزة للاعتماد النهائي')
  }

  const applyDetailedRollover = async () => {
    const sourceId = sourceYearId || currentScoutYear?.id || ''
    if (!sourceId || !targetYearId) { const msg = 'اختر السنة المصدر والسنة الهدف أولًا'; setError(msg); toast.error(msg); return }
    if (!rolloverRows.length) { const msg = 'حمّل قائمة الأكونتات أولًا'; setError(msg); toast.error(msg); return }
    if (rolloverValidation.critical.length) { const msg = `لا يمكن النقل قبل حل ${rolloverValidation.critical.length} نقطة مطلوبة`; setRolloverReviewOpen(true); setError(msg); toast.error(msg); return }

    const sourceLabel = sourceYear?.name || 'السنة المصدر'
    const targetLabel = targetYear?.name || 'السنة الهدف'
    const selectedRows = rolloverRows.filter((row) => row.keep)
    const ok = window.confirm(`سيتم نقل ${selectedRows.length} أكونت فقط من ${sourceLabel} إلى ${targetLabel} بدون أي Team / Rank / Roles موروثة. الأشخاص غير المختارين لن يكون لهم Assignment في السنة الجديدة. هل تريد المتابعة؟`)
    if (!ok) return

    setRolloverApplying(true); setError(null); setSuccessMsg(null)
    try {
      const { data: transferResult, error: transferError } = await supabase.rpc('admin_replace_scout_year_account_roster', {
        p_source_year_id: sourceId,
        p_target_year_id: targetYearId,
        p_member_ids: selectedRows.map((row) => row.memberId),
      }) as any
      if (transferError) {
        const message = String(transferError.message || '')
        if (transferError.code === 'PGRST202' || message.includes('admin_replace_scout_year_account_roster') || message.includes('schema cache')) {
          throw new Error('دالة النقل الجديدة غير موجودة. شغّل SQL رقم 16 ثم أعد المحاولة.')
        }
        throw transferError
      }
      if (rolloverSyncLegacy) await syncLegacyStateFromScoutYear(targetYearId)

      void safeWriteAuditLog({
        action: 'account_only_rollover', module: 'scout_years', entityType: 'scout_year', entityId: targetYearId, entityDisplay: targetLabel,
        summary: `نقل ${selectedRows.length} أكونت إلى ${targetLabel} بدون وراثة Team/Rank/Roles`, severity: 'warning', source: 'AdminScoutYears',
        scoutYearId: targetYearId, after: transferResult ?? { selected_accounts: selectedRows.length }, changedFields: ['member_season_assignments', 'user_role_assignments'],
        context: { source_year_id: sourceId, source_year_name: sourceLabel, target_year_id: targetYearId, target_year_name: targetLabel, account_only: true, roles_inherited: false, make_current: false, sync_legacy: rolloverSyncLegacy },
      })
      await loadAll(); await loadDetailedRollover()
      const msg = `تم نقل ${selectedRows.length} أكونت إلى ${targetLabel}. الفريق والرتبة والمسؤوليات اتصفّروا للسنة الجديدة ويحتاجوا Setup من إدارة الأعضاء.`
      setSuccessMsg(msg); toast.success('تم نقل الأكونتات بدون وراثة الأدوار')
    } catch (error) { const msg = getErrorMessage(error as any, 'تعذر نقل أكونتات السنة الجديدة'); setError(msg); toast.error(msg) }
    finally { setRolloverApplying(false) }
  }

  const handleDeleteYear = async (year: ScoutYearRow) => {
    if (year.is_current) {
      const msg = 'لا يمكن حذف السنة الحالية. عيّن سنة أخرى كحالية الأول.'
      setError(msg)
      toast.error(msg)
      return
    }

    const summary = summaries[year.id]
    const hasData = Boolean(
      (summary?.teams_count || 0) > 0 ||
      (summary?.members_count || 0) > 0 ||
      (summary?.roles_count || 0) > 0 ||
      (summary?.terms_count || 0) > 0 ||
      (summary?.meeting_dates_count || 0) > 0
    )

    const firstConfirm = window.confirm(
      `سيتم حذف السنة الكشفية "${year.name}"${hasData ? ' وكل البيانات المرتبطة بها إن كانت قاعدة البيانات مفعّلة على الحذف الآمن' : ''}. هل تريد المتابعة؟`
    )
    if (!firstConfirm) return

    const typed = window.prompt(`للتأكيد اكتب اسم السنة بالضبط:\n${year.name}`)
    if ((typed || '').trim() !== year.name) {
      toast.error('لم يتم الحذف لأن اسم السنة لم يطابق التأكيد')
      return
    }

    setDeletingYearId(year.id)
    setError(null)
    setSuccessMsg(null)
    try {
      await deleteScoutYear(year.id)
      if (editId === year.id) resetForm()
      if (sourceYearId === year.id) setSourceYearId('')
      if (targetYearId === year.id) setTargetYearId('')
      setRolloverRows([])
      setRolloverReviewOpen(false)
      await loadAll()
      setSuccessMsg(`تم حذف السنة الكشفية ${year.name}`)
      toast.success('تم حذف السنة الكشفية')
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر حذف السنة الكشفية')
      setError(`${msg}. لو السنة فيها بيانات مرتبطة، شغّل ملف SQL رقم 12 ثم جرّب مرة أخرى.`)
      toast.error('تعذر حذف السنة الكشفية')
    } finally {
      setDeletingYearId(null)
    }
  }

  if (!isAdmin) {
    return <div className="p-6">هذه الصفحة مخصصة للأدمن فقط.</div>
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري تحميل إدارة السنة الكشفية..." />

      <PageHero
        eyebrow="🗓️ إدارة السنة الكشفية"
        title="السنة الكشفية الحالية والسنوات القادمة"
        badge={
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
            الحالية الآن: {currentYearName}
          </span>
        }
        description="من هنا تقدر تنشئ سنة جديدة، تنسخ الهيكل من سنة سابقة، وتزامن الجداول الحالية حتى يظل التشغيل اليومي ثابتًا وواضحًا."
        actions={
          <div className="flex flex-wrap gap-2">
            <LoadingButton loading={saving} onClick={handleSave}>
              {editId ? 'حفظ التعديلات' : 'إنشاء سنة جديدة'}
            </LoadingButton>
            <LoadingButton variant="outline" onClick={resetForm}>
              تفريغ النموذج
            </LoadingButton>
            <LoadingButton variant="outline" onClick={fillFromCurrentYear}>
              اقتراح السنة التالية
            </LoadingButton>
          </div>
        }
      />

      {error && <InlineAlert tone="error" title="حدثت مشكلة">{error}</InlineAlert>}
      {successMsg && <InlineAlert tone="success" title="تمت العملية بنجاح">{successMsg}</InlineAlert>}
      <InlineAlert tone="info" title="كيف تستخدم هذه الشاشة؟">
        الترتيب الأسرع الآن: اختر سنة مصدر، حضّر السنة الجديدة، ثم شغّل المعالج. المعالج يقدر ينشئ السنة، ينسخ الهيكل، ينسخ الترمات
        ومواعيد الاجتماعات، يعيّنها كسنة حالية، ويزامن الجداول الحالية في خطوة واحدة.
      </InlineAlert>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <MetricCard label="إجمالي السنوات" value={sortedYears.length} hint="كل السنوات المعرفة داخل النظام" accent="indigo" />
        <MetricCard label="السنة الحالية" value={currentYearName} hint="تُستخدم افتراضيًا داخل التطبيق" accent="emerald" />
        <MetricCard label="سنوات نشطة" value={sortedYears.filter((year) => year.status === 'active').length} hint="صالح استخدامها مباشرة" accent="sky" />
        <MetricCard label="سنوات مؤرشفة" value={sortedYears.filter((year) => year.status === 'archived').length} hint="للمراجعة والتقارير فقط" accent="amber" />
        <MetricCard label="ترمات الحالية" value={currentScoutYear ? summaries[currentScoutYear.id]?.terms_count ?? 0 : 0} hint="عدد الترمات داخل السنة الحالية" accent="violet" />
        <MetricCard label="اجتماعات مخططة" value={currentScoutYear ? summaries[currentScoutYear.id]?.meeting_dates_count ?? 0 : 0} hint="من term_meeting_dates" accent="rose" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title={editId ? 'تعديل سنة كشفية' : 'إنشاء سنة كشفية جديدة'}
          description="حدّد اسم السنة وتواريخها بدقة. هذه التواريخ ستكون مرجعًا للفلترة والتشغيل خلال السنة كلها."
          actions={
            editId ? (
              <LoadingButton variant="outline" onClick={resetForm}>
                إلغاء التعديل
              </LoadingButton>
            ) : null
          }
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="اسم السنة">
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" placeholder="مثال: 2027/2028" />
            </Field>
            <Field label="الحالة">
              <select value={status} onChange={(e) => setStatus(e.target.value as ScoutYearStatus)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="تاريخ البداية">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
            </Field>
            <Field label="تاريخ النهاية">
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
            </Field>
            <Field label="ملاحظات" className="md:col-span-2">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" placeholder="ملاحظات تنظيمية أو داخلية تخص هذه السنة" />
            </Field>
          </div>

          {wizardTargetPreview ? (
            <div className="grid grid-cols-1 gap-3 rounded-3xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-slate-700 md:grid-cols-3">
              <MiniMetric label="بداية السنة الجديدة" value={fmtDate(wizardTargetPreview.start)} />
              <MiniMetric label="نهاية السنة الجديدة" value={fmtDate(wizardTargetPreview.end)} />
              <MiniMetric label="مدة السنة" value={`${wizardTargetPreview.durationDays} يوم`} />
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <LoadingButton variant="outline" onClick={resetForm}>إعادة تعيين</LoadingButton>
            <LoadingButton loading={saving} onClick={handleSave}>
              {editId ? 'حفظ التعديلات' : 'إنشاء السنة'}
            </LoadingButton>
          </div>
        </SectionCard>

        <SectionCard
          title="معالج بداية سنة جديدة"
          description="هيّز السنة الجديدة بدون نقل أعضاء أو Roles تلقائيًا. تقدر تنسخ الترمات ومواعيد الاجتماعات فقط، وبعدها تختار الأكونتات يدويًا من قسم النقل بالأسفل."
          tone="subtle"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="السنة المصدر">
              <select value={sourceYearId} onChange={(e) => setSourceYearId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                <option value="">— اختر —</option>
                {sortedYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="السنة الهدف (اختياري لو ستنشئها من النموذج)">
              <select value={targetYearId} onChange={(e) => setTargetYearId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
                <option value="">— من النموذج بالأعلى —</option>
                {sortedYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <WizardCheck label="نسخ الترمات" checked={wizardCloneTerms} onChange={setWizardCloneTerms} help="ينشئ ترمات السنة الجديدة بنفس ترتيب السنة المصدر مع إزاحة التواريخ." />
            <WizardCheck label="نسخ مواعيد الاجتماعات" checked={wizardCloneMeetingDates} onChange={setWizardCloneMeetingDates} disabled={!wizardCloneTerms} help="يستخدم term_meeting_dates من السنة المصدر لبناء جدول اجتماعات مبدئي للسنة الجديدة." />
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">التفعيل يتم فقط من مراجعة الجاهزية بعد استكمال البيانات الأساسية. Team وSystem Role اختياريان.</div>
            <WizardCheck label="مزامنة الجداول الحالية" checked={wizardSyncLegacy} onChange={setWizardSyncLegacy} help="اختياري. استخدمه فقط لو تريد عكس السنة الجديدة على members و user_roles فورًا." />
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <PreviewCard
              title="ملخص السنة المصدر"
              rows={[
                ['السنة', sourceYear?.name || '—'],
                ['المدى', sourceYear ? `${fmtDate(sourceYear.start_date)} — ${fmtDate(sourceYear.end_date)}` : '—'],
                ['الفرق', sourceSummary?.teams_count ?? 0],
                ['الأعضاء', sourceSummary?.members_count ?? 0],
                ['الأدوار', sourceSummary?.roles_count ?? 0],
                ['الترمات', sourceSummary?.terms_count ?? 0],
                ['مواعيد الاجتماعات', sourceSummary?.meeting_dates_count ?? 0],
              ]}
            />
            <PreviewCard
              title="ملخص الهدف"
              rows={[
                ['السنة', targetYear?.name || name || 'سيتم إنشاؤها من النموذج'],
                ['المدى', targetYear ? `${fmtDate(targetYear.start_date)} — ${fmtDate(targetYear.end_date)}` : wizardTargetPreview ? `${fmtDate(wizardTargetPreview.start)} — ${fmtDate(wizardTargetPreview.end)}` : '—'],
                ['ترمات حالية', targetSummary?.terms_count ?? 0],
                ['مواعيد اجتماعات حالية', targetSummary?.meeting_dates_count ?? 0],
                ['نقل الأعضاء والأدوار تلقائيًا', 'لا — يتم الاختيار يدويًا'],
                ['سيتم نسخ الترمات', wizardCloneTerms ? 'نعم' : 'لا'],
                ['التفعيل', 'بعد Review الجاهزية فقط'],
              ]}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <LoadingButton loading={runningWizard} onClick={handleRunWizard}>تجهيز السنة الجديدة</LoadingButton>
          </div>
        </SectionCard>
      </div>


      <SectionCard
        title="نقل الأكونتات للسنة الجديدة"
        description="اختار فقط الأكونتات التي ستستمر في السنة الجديدة. النقل يحافظ على نفس Auth Account والإيميل، لكنه لا يورّث Team أو Rank أو Roles."
        tone="subtle"
        actions={
          <div className="flex flex-wrap gap-2">
            <LoadingButton variant="outline" loading={rolloverLoading} onClick={loadDetailedRollover}>
              تحميل أكونتات السنة المصدر
            </LoadingButton>
            <LoadingButton loading={rolloverApplying} onClick={openRolloverReview} disabled={!rolloverRows.length}>
              مراجعة قبل النقل
            </LoadingButton>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <FlowStep step="1" title="اختار المصدر" desc="السنة اللي هننقل منها الشيفات." active />
          <FlowStep step="2" title="حمّل الأكونتات" desc="نفس Auth accounts والإيميلات." active={rolloverRows.length > 0} />
          <FlowStep step="3" title="اختار المستمرين" desc="حدد مين هيتنقل ومين لأ." active={rolloverStats.keep > 0} />
          <FlowStep step="4" title="انقل الأكونتات" desc="بدون Team / Rank / Roles." active={rolloverReviewOpen} />
          <FlowStep step="5" title="اعمل Setup" desc="حدد الرتبة، وأضف الفريق أو الأدوار فقط عند الحاجة." active={false} />
        </div>

        <InlineAlert tone="info" title="الفلو المختصر">
          1) اختار السنة المصدر والهدف، 2) حمّل الأكونتات، 3) اختار الناس اللي هتكمل فقط، 4) انقلهم بدون أي أدوار موروثة، 5) افتح إدارة الأعضاء وحدد Rank لكل شخص، واختار Team / Global Roles / Team Roles فقط لمن يحتاجها.
        </InlineAlert>

        <div className="grid grid-cols-1 gap-3 rounded-3xl border border-slate-200 bg-white/70 p-4 md:grid-cols-2">
          <Field label="السنة المصدر للنقل التفصيلي">
            <select value={sourceYearId} onChange={(e) => setSourceYearId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
              <option value="">— السنة الحالية افتراضيًا —</option>
              {sortedYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="السنة الهدف للاعتماد">
            <select value={targetYearId} onChange={(e) => setTargetYearId(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100">
              <option value="">— اختر السنة الهدف قبل الاعتماد —</option>
              {sortedYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">
          <MetricCard label="الأكونتات المحملة" value={rolloverStats.total} hint="قادة/شيفات لهم Auth account" accent="indigo" />
          <MetricCard label="مختارين للنقل" value={rolloverStats.keep} hint="سينتقل نفس الأكونت فقط" accent="emerald" />
          <MetricCard label="لن يتم نقلهم" value={rolloverStats.removed} hint="يبقوا فقط في تاريخ السنة القديمة" accent="rose" />
          <MetricCard label="Auth Accounts" value={rolloverStats.withAccount} hint="نفس User ID والإيميل محفوظ" accent="sky" />
          <MetricCard label="موجودين بالهدف" value={rolloverStats.alreadyTransferred} hint="سبق نقلهم للسنة الهدف" accent="amber" />
          <MetricCard label="يحتاج Setup" value={rolloverStats.needsSetup} hint="Rank أو البيانات الأساسية غير مكتملة" accent="violet" />
          <MetricCard label="Configured" value={rolloverStats.configured} hint="تم إعدادهم بالفعل في السنة الهدف" accent="gold" />
        </div>

        {rolloverReviewOpen && rolloverRows.length ? (
          <div className="rounded-[30px] border border-amber-200/70 bg-amber-50/65 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-black text-slate-950">مراجعة قبل النقل</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">راجع عدد الأكونتات المختارة قبل ما ننشئ Roster السنة الهدف.</div>
              </div>
              <button
                type="button"
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={() => setRolloverReviewOpen(false)}
              >
                إخفاء المراجعة
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
              <MiniMetric label="المصدر" value={sourceYear?.name || '—'} />
              <MiniMetric label="الهدف" value={targetYear?.name || '—'} />
              <MiniMetric label="مختارين للنقل" value={rolloverStats.keep} />
              <MiniMetric label="لن يتم نقلهم" value={rolloverStats.removed} />
              <MiniMetric label="أخطاء مانعة" value={rolloverValidation.critical.length} />
              <MiniMetric label="تحذيرات" value={rolloverValidation.warnings.length} />
            </div>

            {rolloverValidation.critical.length ? (
              <div className="mt-4">
                <InlineAlert tone="error" title="لا يمكن النقل قبل حل هذه النقاط">
                  <ul className="list-inside list-disc space-y-1">
                    {rolloverValidation.critical.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </InlineAlert>
              </div>
            ) : (
              <div className="mt-4">
                <InlineAlert tone="success" title="جاهز للاعتماد">
                  لا توجد أخطاء مانعة. راجع التحذيرات إن وجدت، ثم اضغط نقل الأكونتات.
                </InlineAlert>
              </div>
            )}

            {rolloverValidation.warnings.length ? (
              <div className="mt-3 rounded-3xl border border-amber-200 bg-white/78 p-4">
                <div className="mb-2 text-sm font-black text-amber-800">تنبيهات للمراجعة</div>
                <ul className="list-inside list-disc space-y-1 text-sm leading-6 text-slate-700">
                  {rolloverValidation.warnings.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white/75 p-3">
              <div className="text-sm leading-6 text-slate-600">
                النقل هيحافظ على نفس Auth Account والإيميل فقط. Team / Rank / Roles لن يتم وراثتها من السنة القديمة.
              </div>
              <LoadingButton loading={rolloverApplying} onClick={applyDetailedRollover} disabled={!rolloverValidation.canApply}>
                اعتماد نهائي
              </LoadingButton>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 rounded-3xl border border-slate-200 bg-white/70 p-4 md:grid-cols-[minmax(0,1fr)_220px_240px_auto]">
          <Field label="بحث">
            <input
              value={rolloverQuery}
              onChange={(e) => setRolloverQuery(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              placeholder="اسم، إيميل، فريق سابق، رتبة سابقة..."
            />
          </Field>
          <Field label="فلتر الفريق">
            <select
              value={rolloverTeamFilter}
              onChange={(e) => setRolloverTeamFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            >
              <option value="">كل الفرق</option>
              {rolloverTeams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </Field>
          <Field label="فلتر المسؤولية">
            <select
              value={rolloverRoleFilter}
              onChange={(e) => setRolloverRoleFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
            >
              <option value="">كل المسؤوليات</option>
              {rolloverEditableRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.role_label || role.role_slug}</option>
              ))}
            </select>
          </Field>
          <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={rolloverOnlyChanges} onChange={(e) => setRolloverOnlyChanges(e.target.checked)} />
            اختيار مختلف عن الموجود بالهدف
          </label>
        </div>

        {rolloverRows.length ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white/75 p-3">
              <div className="text-sm leading-6 text-slate-600">
                المعروض الآن: <span className="font-black text-slate-900">{filteredRolloverRows.length}</span> من {rolloverRows.length} أكونت.
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100" onClick={() => setRolloverRows((prev) => prev.map((row) => ({ ...row, keep: true })))}>
                  تحديد الكل للنقل
                </button>
                <button type="button" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm hover:bg-rose-100" onClick={() => setRolloverRows((prev) => prev.map((row) => ({ ...row, keep: false })))}>
                  إلغاء اختيار الكل
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              {filteredRolloverRows.map((row) => (
                <div key={row.memberId} className={`rounded-[28px] border bg-white/80 p-4 shadow-sm transition ${row.keep ? 'border-white/80 hover:border-amber-200' : 'border-rose-200 bg-rose-50/70'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-sm font-black text-white shadow-sm">
                          {row.fullName.trim().slice(0, 1) || 'ش'}
                        </div>
                        <div>
                          <div className="text-base font-black text-slate-950">{row.fullName}</div>
                          <div className="mt-1 text-xs font-semibold text-slate-500" dir="ltr">{row.email || row.authUserId || 'Auth account'}</div>
                          <div className="mt-1 text-xs font-bold text-emerald-700">✅ نفس Auth account محفوظ — بدون وراثة الأدوار</div>
                        </div>
                      </div>
                    </div>
                    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-xs font-black shadow-sm ${row.keep ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-white text-rose-700'}`}>
                      <input
                        type="checkbox"
                        checked={row.keep}
                        onChange={(e) => updateRolloverRow(row.memberId, { keep: e.target.checked })}
                      />
                      {row.keep ? 'انقله للسنة الجديدة' : 'لا تنقله'}
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <MiniMetric label="فريق السنة المصدر" value={row.currentTeamName} />
                    <MiniMetric label="رتبة السنة المصدر" value={row.currentRankLabel} />
                  </div>

                  <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="text-sm font-black text-slate-900">بيانات السنة القديمة للمراجعة فقط</div>
                    <div className="mt-2 text-sm leading-7 text-slate-600">
                      المسؤوليات السابقة: {row.sourceRoleKeys.length ? row.sourceRoleKeys.map(roleLabelsByKey).join('، ') : 'لا توجد مسؤوليات مسجلة'}
                    </div>
                    <div className="mt-2 text-xs font-bold text-amber-800">
                      عند النقل لن يتم نسخ الفريق أو الرتبة أو أي Role. يتم إعدادهم من شاشة «الأعضاء والأدوار» للسنة الهدف.
                    </div>
                    {row.hasTargetAssignment ? (
                      <div className="mt-3 rounded-2xl border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-800">
                        هذا الشخص موجود بالفعل في السنة الهدف. إعادة النقل ستعيده إلى Setup Required بدون Roles.
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-3xl border border-amber-100 bg-amber-50/60 p-4 md:grid-cols-2">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">بعد النقل: أكمل Setup من إدارة الأعضاء، ثم فعّل السنة من Review الجاهزية.</div>
              <WizardCheck label="بعد النقل: مزامنة الجداول القديمة" checked={rolloverSyncLegacy} onChange={setRolloverSyncLegacy} help="الأفضل تأجيلها لحد انتهاء Setup السنة الجديدة." />
            </div>
            {targetYearId ? (
              <div className="flex justify-end">
                <Link to={`/app/admin-members?year=${targetYearId}`} className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-800">
                  إعداد Team / Rank / Roles للسنة الهدف
                </Link>
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState title="لم يتم تحميل أكونتات السنة المصدر بعد" description="اختر السنة المصدر، أو اتركها على السنة الحالية، ثم اضغط تحميل أكونتات السنة المصدر. سيظهر القادة/الشيفات أصحاب Auth accounts فقط، وليس الـEquipiers." />
        )}
      </SectionCard>

      {activationReviewYearId ? (
        <SectionCard
          title={`مراجعة جاهزية التفعيل — ${activationReviewYear?.name || 'السنة'}`}
          description="الفحص يتم من قاعدة البيانات في طلب واحد، ويعرض فقط عينة محدودة من العناصر الناقصة لتقليل حجم البيانات وتحسين الأداء."
          actions={
            <LoadingButton variant="outline" onClick={() => { setActivationReviewYearId(null); setActivationReadiness(null) }}>
              إغلاق المراجعة
            </LoadingButton>
          }
        >
          {activationReadinessLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-600">
              جاري فحص الجاهزية...
            </div>
          ) : activationReadiness ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                <MiniMetric label="الأعضاء النشطون" value={activationReadiness.counts.active_members} />
                <MiniMetric label="Configured" value={activationReadiness.counts.configured_members} />
                <MiniMetric label="Needs Setup" value={activationReadiness.counts.needs_setup} />
                <MiniMetric label="بدون فريق (مسموح)" value={activationReadiness.counts.missing_team} />
                <MiniMetric label="بدون رتبة" value={activationReadiness.counts.missing_rank} />
                <MiniMetric label="بدون Account" value={activationReadiness.counts.missing_account} />
                <MiniMetric label="بدون Role (مسموح)" value={activationReadiness.counts.missing_role} />
                <MiniMetric label="الفرق المفعلة" value={activationReadiness.counts.teams} />
              </div>

              {activationReadiness.can_activate ? (
                <InlineAlert tone="success" title="السنة جاهزة للتفعيل">
                  كل الأعضاء النشطين استكملوا البيانات الأساسية المطلوبة، وكل قائد لديه Auth Account. عدم وجود Team أو System Role مسموح ويظهر فقط كمعلومة/تحذير غير مانع.
                </InlineAlert>
              ) : (
                <InlineAlert tone="error" title="السنة غير جاهزة للتفعيل">
                  حل النقاط المانعة أولًا. قاعدة البيانات نفسها سترفض التفعيل حتى لو كانت الشاشة قديمة أو تم استدعاء الـRPC مباشرة.
                </InlineAlert>
              )}

              {activationReadiness.critical.length ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <div className="font-black text-rose-900">نقاط مانعة</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {activationReadiness.critical.map((item) => (
                      <div key={item.code} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-800">
                        <span className="font-bold">{item.label}</span> — {item.count}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activationReadiness.warnings.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="font-black text-amber-900">تحذيرات غير مانعة</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {activationReadiness.warnings.map((item) => (
                      <div key={item.code} className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900">
                        <span className="font-bold">{item.label}</span> — {item.count}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activationReadiness.issues.length ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                    <div>
                      <div className="font-black text-slate-900">عينة من الأشخاص المحتاجين Setup</div>
                      <div className="text-xs text-slate-500">نعرض حتى 50 فقط للحفاظ على سرعة الشاشة.</div>
                    </div>
                    <Link to={`/app/admin-members?year=${activationReviewYearId}`} className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white">
                      فتح إدارة أعضاء هذه السنة
                    </Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 text-right">الاسم</th><th className="px-4 py-3 text-right">الإيميل</th><th className="px-4 py-3 text-right">الناقص</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {activationReadiness.issues.map((issue) => (
                          <tr key={issue.member_id}>
                            <td className="px-4 py-3 font-bold text-slate-900">{issue.full_name}</td>
                            <td className="px-4 py-3 text-slate-600" dir="ltr">{issue.email || '—'}</td>
                            <td className="px-4 py-3 text-slate-700">{issue.missing.map((missing) => ({ rank: 'Rank', account: 'Auth Account' } as Record<string,string>)[missing] || missing).join('، ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm text-slate-600">
                  التفعيل يعيد فحص نفس الشروط داخل Transaction واحدة قبل تغيير السنة الحالية.
                </div>
                <div className="flex flex-wrap gap-2">
                  <LoadingButton variant="outline" onClick={() => handleSetCurrent(activationReviewYearId)}>إعادة الفحص</LoadingButton>
                  <LoadingButton
                    loading={switchingYearId === activationReviewYearId}
                    onClick={confirmScoutYearActivation}
                    disabled={!activationReadiness.can_activate}
                  >
                    تفعيل كسنة حالية
                  </LoadingButton>
                </div>
              </div>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard
        title="السنوات الموجودة"
        description="راجع ملخص كل سنة وحدد الحالية أو عدّلها أو شغّل المزامنة حسب الحاجة."
      >
        {sortedYears.length === 0 ? (
          <EmptyState title="لا توجد سنوات كشفية بعد" description="ابدأ بإنشاء السنة الأولى ثم اربط بها الفرق والأعضاء والأدوار." />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {sortedYears.map((year) => {
              const summary = summaries[year.id]
              const isCurrent = year.is_current
              const isSwitching = switchingYearId === year.id
              const isSyncing = syncingYearId === year.id
              const isDeleting = deletingYearId === year.id
              return (
                <div key={year.id} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{year.name}</h3>
                          {isCurrent ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                              الحالية
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">{fmtDate(year.start_date)} — {fmtDate(year.end_date)}</div>
                      </div>
                      <StatusPill tone={statusTone(year.status)}>{statusLabel(year.status)}</StatusPill>
                    </div>
                  </div>

                  <div className="space-y-4 px-5 py-4">
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                      <MiniMetric label="الفرق" value={summary?.teams_count ?? 0} />
                      <MiniMetric label="الأعضاء" value={summary?.members_count ?? 0} />
                      <MiniMetric label="النشطون" value={summary?.active_members_count ?? 0} />
                      <MiniMetric label="الأدوار" value={summary?.roles_count ?? 0} />
                      <MiniMetric label="الترمات" value={summary?.terms_count ?? 0} />
                      <MiniMetric label="الاجتماعات المخططة" value={summary?.meeting_dates_count ?? 0} />
                      <MiniMetric label="Configured" value={summary?.configured_members_count ?? 0} />
                      <MiniMetric label="Needs Setup" value={summary?.needs_setup_count ?? 0} />
                    </div>

                    {year.notes ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                        {year.notes}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <LoadingButton variant="outline" onClick={() => {
                        setEditId(year.id)
                        setName(year.name)
                        setStartDate(year.start_date || '')
                        setEndDate(year.end_date || '')
                        setStatus(year.status)
                        setNotes(year.notes || '')
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}>
                        تعديل
                      </LoadingButton>

                      <LoadingButton loading={isSwitching} variant={isCurrent ? 'soft' : 'brand'} onClick={() => handleSetCurrent(year.id)} disabled={isCurrent}>
                        {isCurrent ? 'هي السنة الحالية' : 'مراجعة الجاهزية والتفعيل'}
                      </LoadingButton>

                      <LoadingButton loading={isSyncing} variant="outline" onClick={() => handleSyncLegacy(year.id)}>
                        مزامنة الجداول الحالية
                      </LoadingButton>

                      <LoadingButton
                        loading={isDeleting}
                        variant="outline"
                        onClick={() => handleDeleteYear(year)}
                        disabled={isCurrent}
                        className="border-rose-200 bg-rose-50/80 text-rose-700 hover:bg-rose-100/80"
                      >
                        {isCurrent ? 'لا يمكن حذف الحالية' : 'حذف السنة'}
                      </LoadingButton>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function FlowStep({ step, title, desc, active = false }: { step: string; title: string; desc: string; active?: boolean }) {
  return (
    <div className={`rounded-3xl border p-4 shadow-sm transition ${active ? 'border-indigo-200 bg-white text-slate-900' : 'border-slate-200 bg-white/58 text-slate-500'}`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-2xl text-xs font-black ${active ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500'}`}>{step}</span>
        <span className="text-sm font-black">{title}</span>
      </div>
      <div className="mt-2 text-xs leading-5 opacity-80">{desc}</div>
    </div>
  )
}

function PreviewCard({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-bold text-slate-900">{title}</div>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-800">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WizardCheck({
  label,
  checked,
  onChange,
  help,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  help: string
  disabled?: boolean
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-3xl border px-4 py-3 transition ${disabled ? 'border-slate-200 bg-slate-50 opacity-60' : checked ? 'border-indigo-200 bg-indigo-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
      <div>
        <div className="text-sm font-bold text-slate-900">{label}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">{help}</div>
      </div>
    </label>
  )
}

function MiniMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-black text-slate-900">{value}</div>
    </div>
  )
}

function StatusPill({ children, tone }: { children: ReactNode; tone: string }) {
  const classes =
    tone === 'green'
      ? 'border-green-200 bg-green-50 text-green-700'
      : tone === 'yellow'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : tone === 'blue'
      ? 'border-sky-200 bg-sky-50 text-sky-700'
      : tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-slate-200 bg-slate-50 text-slate-700'

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${classes}`}>{children}</span>
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1 text-sm font-medium text-slate-700">{label}</div>
      {children}
    </label>
  )
}
