import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { safeWriteAuditLog } from '../features/audit/api'
import { useAuth } from '../components/AuthProvider'
import { PageHero } from '../components/ui/PageHero'
import { MetricCard } from '../components/ui/MetricCard'
import { InlineAlert } from '../components/ui/InlineAlert'
import { exportJsonWorkbook } from '../lib/exportWorkbook'

type RoleRow = {
  role_slug: string
  team_id?: string | null
}

type CampStatus = 'draft' | 'open' | 'closed' | 'cancelled'
type PaymentStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'exempted'
  | 'cancelled'
  | 'not_participating'
type PaymentMethod = 'cash' | 'vodafone_cash' | 'bank_transfer' | 'other'
type TabKey = 'overview' | 'members' | 'payments'
type ParticipationFilter = 'all' | 'participating' | 'not_participating'

type CampSummaryRow = {
  id: string
  scout_year_id?: string | null
  title: string
  description: string | null
  base_amount: number
  equipier_price?: number | null
  chef_price?: number | null
  start_date: string | null
  due_date: string | null
  status: CampStatus
  teams_count: number | null
  members_count: number | null
  non_participants_count?: number | null
  total_required: number | null
  total_paid: number | null
  total_remaining: number | null
  paid_members_count: number | null
  partial_members_count: number | null
  unpaid_members_count: number | null
  exempted_members_count: number | null
  cancelled_members_count: number | null
  collection_percentage: number | null
  created_at: string
  updated_at: string
}

type CampTeamSummaryRow = {
  id: string
  camp_id: string
  team_id: string
  collector_member_id: string | null
  notes: string | null
  members_count: number | null
  non_participants_count?: number | null
  total_required: number | null
  total_paid: number | null
  total_remaining: number | null
  paid_members_count: number | null
  partial_members_count: number | null
  unpaid_members_count: number | null
  exempted_members_count: number | null
  cancelled_members_count: number | null
  collection_percentage: number | null
  created_at: string
  updated_at: string
}

type CampMemberRow = {
  id: string
  camp_id: string
  team_id: string
  member_id: string
  collector_member_id: string | null
  is_participating: boolean
  participant_role?: 'equipier' | 'chef' | null
  base_amount: number
  base_price?: number | null
  discount_amount: number
  discount_reason?: string | null
  required_amount: number
  final_due?: number | null
  paid_amount: number
  remaining_amount: number
  payment_status: PaymentStatus
  notes: string | null
  created_at: string
  updated_at: string
}

type PaymentRow = {
  id: string
  camp_member_id: string
  camp_id: string
  team_id: string
  member_id: string
  amount: number
  payment_date: string
  payment_method: PaymentMethod
  notes: string | null
  created_by: string | null
  created_at: string
}

type TeamRow = {
  id: string
  name: string
}

type MemberRow = {
  id: string
  team_id: string | null
  is_equipier: boolean | null
  full_name: string
}

type TeamDerivedSummary = {
  id: string
  camp_id: string
  team_id: string
  collector_member_id: string | null
  notes: string | null
  members_count: number
  non_participants_count: number
  total_required: number
  total_paid: number
  total_remaining: number
  paid_members_count: number
  partial_members_count: number
  unpaid_members_count: number
  exempted_members_count: number
  cancelled_members_count: number
  collection_percentage: number
  created_at: string
  updated_at: string
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'كاش' },
  { value: 'vodafone_cash', label: 'فودافون كاش' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
  { value: 'other', label: 'أخرى' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(value?: string | null) {
  if (!value) return '-'
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

function fmtMoney(value?: number | null) {
  return Number(value || 0).toLocaleString('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function teamLabel(team?: TeamRow | null) {
  if (!team) return '-'
  return team.name || 'فريق بدون اسم'
}

function memberLabel(member?: MemberRow | null) {
  if (!member) return '-'
  return member.full_name || 'عضو بدون اسم'
}

function campStatusLabel(status: CampStatus) {
  if (status === 'draft') return 'مسودة'
  if (status === 'open') return 'مفتوح'
  if (status === 'closed') return 'مغلق'
  if (status === 'cancelled') return 'ملغي'
  return status
}

function campStatusTone(status: CampStatus): 'slate' | 'green' | 'yellow' | 'red' | 'blue' {
  if (status === 'open') return 'green'
  if (status === 'draft') return 'yellow'
  if (status === 'closed') return 'blue'
  if (status === 'cancelled') return 'red'
  return 'slate'
}

function paymentStatusLabel(status: PaymentStatus) {
  if (status === 'unpaid') return 'غير مدفوع'
  if (status === 'partial') return 'مدفوع جزئي'
  if (status === 'paid') return 'مدفوع'
  if (status === 'exempted') return 'معفى'
  if (status === 'cancelled') return 'ملغي'
  if (status === 'not_participating') return 'غير مشارك'
  return status
}

function paymentStatusTone(status: PaymentStatus): 'slate' | 'green' | 'yellow' | 'red' | 'blue' {
  if (status === 'paid') return 'green'
  if (status === 'partial') return 'blue'
  if (status === 'unpaid') return 'yellow'
  if (status === 'cancelled') return 'red'
  if (status === 'exempted') return 'slate'
  if (status === 'not_participating') return 'slate'
  return 'slate'
}

function paymentMethodLabel(method: PaymentMethod) {
  if (method === 'cash') return 'كاش'
  if (method === 'vodafone_cash') return 'فودافون كاش'
  if (method === 'bank_transfer') return 'تحويل بنكي'
  if (method === 'other') return 'أخرى'
  return method
}

function participantRoleLabel(role?: 'equipier' | 'chef' | null) {
  if (role === 'chef') return 'Chef'
  return 'Equipier'
}

function participantRoleTone(role?: 'equipier' | 'chef' | null): 'slate' | 'green' | 'yellow' | 'red' | 'blue' {
  return role === 'chef' ? 'blue' : 'green'
}

export default function CampInstallmentDetails() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const { roles, user } = useAuth() as {
    roles: RoleRow[]
    user: { id?: string; name?: string; email?: string } | null
  }

  const [loading, setLoading] = useState(true)
  const [savingMember, setSavingMember] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [togglingMemberId, setTogglingMemberId] = useState<string | null>(null)
  const [syncingTeamId, setSyncingTeamId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [camp, setCamp] = useState<CampSummaryRow | null>(null)
  const [teamRows, setTeamRows] = useState<CampTeamSummaryRow[]>([])
  const [memberRows, setMemberRows] = useState<CampMemberRow[]>([])
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([])

  const [teamsMap, setTeamsMap] = useState<Record<string, TeamRow>>({})
  const [membersMap, setMembersMap] = useState<Record<string, MemberRow>>({})

  const [memberQuery, setMemberQuery] = useState('')
  const [memberStatusFilter, setMemberStatusFilter] = useState('')
  const [memberTeamFilter, setMemberTeamFilter] = useState('')
  const [participationFilter, setParticipationFilter] = useState<ParticipationFilter>('all')

  const [paymentMemberId, setPaymentMemberId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayISO())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentNotes, setPaymentNotes] = useState('')

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editParticipantRole, setEditParticipantRole] = useState<'equipier' | 'chef'>('equipier')
  const [editDiscountAmount, setEditDiscountAmount] = useState('0')
  const [editDiscountReason, setEditDiscountReason] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editMemberMode, setEditMemberMode] = useState<'active' | 'cancelled'>('active')

  const [exportTeamId, setExportTeamId] = useState<string>('all')

  const hasRole = useCallback(
    (slug: string) => (roles || []).some((r) => r.role_slug === slug),
    [roles]
  )

  const isAdmin = hasRole('admin')
  const canAccess = isAdmin || hasRole('chef_de_legion')

  const tab = (searchParams.get('tab') as TabKey) || 'overview'

  const setTab = (next: TabKey) => {
    const p = new URLSearchParams(searchParams)
    p.set('tab', next)
    setSearchParams(p, { replace: true })
  }

  const loadAll = useCallback(async () => {
    if (!id || !canAccess) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [campRes, campPricingRes, teamsRes, membersRes, paymentsRes] = await Promise.all([
        supabase.from('camp_installments_summary').select('*').eq('id', id).single(),

        supabase.from('camp_installments').select('id, base_amount, equipier_price, chef_price').eq('id', id).single(),

        supabase
          .from('camp_installment_teams_summary')
          .select('*')
          .eq('camp_id', id)
          .order('created_at', { ascending: true }),

        supabase
          .from('camp_installment_members')
          .select('*')
          .eq('camp_id', id)
          .order('created_at', { ascending: true }),

        supabase
          .from('camp_installment_payments')
          .select('*')
          .eq('camp_id', id)
          .order('payment_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      if (campRes.error) throw campRes.error
      if (campPricingRes.error) throw campPricingRes.error
      if (teamsRes.error) throw teamsRes.error
      if (membersRes.error) throw membersRes.error
      if (paymentsRes.error) throw paymentsRes.error

      const teamRowsValue = (teamsRes.data || []) as CampTeamSummaryRow[]
      const memberRowsValue = (membersRes.data || []) as CampMemberRow[]
      const paymentRowsValue = (paymentsRes.data || []) as PaymentRow[]

      setCamp({
        ...(campRes.data as CampSummaryRow),
        ...(campPricingRes.data || {}),
      })
      setTeamRows(teamRowsValue)
      setMemberRows(memberRowsValue)
      setPaymentRows(paymentRowsValue)

      const teamIds = Array.from(
        new Set(
          [
            ...teamRowsValue.map((x) => x.team_id),
            ...memberRowsValue.map((x) => x.team_id),
            ...paymentRowsValue.map((x) => x.team_id),
          ].filter(Boolean)
        )
      )

      const memberIds = Array.from(
        new Set(
          [
            ...teamRowsValue.map((x) => x.collector_member_id || ''),
            ...memberRowsValue.map((x) => x.member_id),
            ...memberRowsValue.map((x) => x.collector_member_id || ''),
            ...paymentRowsValue.map((x) => x.member_id),
          ].filter(Boolean)
        )
      )

      const teamsPromise = teamIds.length
        ? supabase.from('teams').select('id, name').in('id', teamIds)
        : Promise.resolve({ data: [], error: null } as any)

      const membersPromise = memberIds.length
        ? scoutYearFrom('v_members_current', 'v_members_context').select('id, team_id, is_equipier, full_name').in('id', memberIds).eq('is_active', true)
        : Promise.resolve({ data: [], error: null } as any)

      const [allTeamsRes, allMembersRes] = await Promise.all([teamsPromise, membersPromise])

      if (allTeamsRes.error) throw allTeamsRes.error
      if (allMembersRes.error) throw allMembersRes.error

      const nextTeamsMap: Record<string, TeamRow> = {}
      for (const row of (allTeamsRes.data || []) as TeamRow[]) nextTeamsMap[row.id] = row
      setTeamsMap(nextTeamsMap)

      const nextMembersMap: Record<string, MemberRow> = {}
      for (const row of (allMembersRes.data || []) as MemberRow[]) nextMembersMap[row.id] = row
      setMembersMap(nextMembersMap)
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء تحميل بيانات المعسكر')
    } finally {
      setLoading(false)
    }
  }, [id, canAccess])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const filteredMembers = useMemo(() => {
    return memberRows.filter((row) => {
      const member = membersMap[row.member_id]
      const name = memberLabel(member).toLowerCase()
      const teamName = teamLabel(teamsMap[row.team_id]).toLowerCase()

      if (memberQuery.trim()) {
        const q = memberQuery.trim().toLowerCase()
        if (!name.includes(q) && !teamName.includes(q)) return false
      }

      if (memberStatusFilter && row.payment_status !== memberStatusFilter) return false
      if (memberTeamFilter && row.team_id !== memberTeamFilter) return false
      if (participationFilter === 'participating' && !row.is_participating) return false
      if (participationFilter === 'not_participating' && row.is_participating) return false

      return true
    })
  }, [memberRows, membersMap, teamsMap, memberQuery, memberStatusFilter, memberTeamFilter, participationFilter])

  const selectedPaymentMember = useMemo(
    () => memberRows.find((x) => x.id === paymentMemberId) || null,
    [memberRows, paymentMemberId]
  )

  const editingMember = useMemo(
    () => memberRows.find((x) => x.id === editingMemberId) || null,
    [memberRows, editingMemberId]
  )

  const beginEditMember = (row: CampMemberRow) => {
    setEditingMemberId(row.id)
    setEditParticipantRole(row.participant_role === 'chef' ? 'chef' : 'equipier')
    setEditDiscountAmount(String(row.discount_amount ?? 0))
    setEditDiscountReason(row.discount_reason || '')
    setEditNotes(row.notes || '')
    setEditMemberMode(row.payment_status === 'cancelled' ? 'cancelled' : 'active')
    setTab('members')
  }

  const handleSaveMember = async () => {
    if (!isAdmin || !editingMember) return

    setSavingMember(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const discount = Number(editDiscountAmount || 0)
      if (!Number.isFinite(discount) || discount < 0) {
        throw new Error('قيمة الخصم غير صحيحة')
      }

      const payload = {
        participant_role: editParticipantRole,
        discount_amount: discount,
        discount_reason: editDiscountReason.trim() || null,
        notes: editNotes.trim() || null,
        payment_status:
          editMemberMode === 'cancelled'
            ? 'cancelled'
            : editingMember.is_participating
            ? 'unpaid'
            : 'not_participating',
      }

      const { error } = await supabase
        .from('camp_installment_members')
        .update(payload)
        .eq('id', editingMember.id)

      if (error) throw error

      setSuccessMsg('تم تحديث بيانات العضو بنجاح')
      setEditingMemberId(null)
      await loadAll()
    } catch (e: any) {
      setError(e?.message || 'تعذر تحديث بيانات العضو')
    } finally {
      setSavingMember(false)
    }
  }

  const handleToggleParticipation = async (row: CampMemberRow, nextValue: boolean) => {
    if (!isAdmin) return

    setTogglingMemberId(row.id)
    setError(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase.rpc('set_camp_member_participation', {
        p_camp_member_id: row.id,
        p_is_participating: nextValue,
      })

      if (error) throw error

      setSuccessMsg(nextValue ? 'تم اعتبار العضو مشاركًا في المعسكر' : 'تم استبعاد العضو من المعسكر')
      void safeWriteAuditLog({
        action: nextValue ? 'set_participating' : 'set_not_participating',
        module: 'camp_installments',
        entityType: 'camp_member',
        entityId: row.id,
        entityDisplay: (membersMap[row.member_id]?.full_name || row.member_id),
        summary: `${nextValue ? 'فعّل' : 'أوقف'} مشاركة ${(membersMap[row.member_id]?.full_name || row.member_id)} في معسكر ${(camp?.title || 'المعسكر')}` ,
        severity: 'warning',
        source: 'CampInstallmentDetails',
        scoutYearId: camp?.scout_year_id ?? null,
        teamId: row.team_id,
        targetMemberId: row.member_id,
        before: { is_participating: row.is_participating },
        after: { is_participating: nextValue },
        changedFields: ['is_participating'],
        context: { camp_title: (camp?.title || 'المعسكر'), member_name: (membersMap[row.member_id]?.full_name || row.member_id) },
      })
      await loadAll()
    } catch (e: any) {
      setError(e?.message || 'تعذر تحديث حالة المشاركة')
    } finally {
      setTogglingMemberId(null)
    }
  }

  const startPaymentForMember = (row: CampMemberRow) => {
    setPaymentMemberId(row.id)
    setPaymentAmount('')
    setPaymentDate(todayISO())
    setPaymentMethod('cash')
    setPaymentNotes('')
    setTab('payments')
  }

  const handleAddPayment = async () => {
    if (!isAdmin) return
    if (!selectedPaymentMember) {
      setError('اختر العضو أولًا')
      return
    }

    setSavingPayment(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const amount = Number(paymentAmount || 0)
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('قيمة الدفعة يجب أن تكون أكبر من صفر')
      }

      if (!selectedPaymentMember.is_participating) {
        throw new Error('لا يمكن تسجيل دفعة لعضو غير مشارك')
      }

      if (Number(selectedPaymentMember.remaining_amount || 0) <= 0) {
        throw new Error('لا يوجد مبلغ متبقٍ لهذا العضو')
      }

      if (selectedPaymentMember.payment_status === 'cancelled') {
        throw new Error('لا يمكن تسجيل دفعة لعضو حالته ملغي')
      }

      if (amount > Number(selectedPaymentMember.remaining_amount || 0)) {
        throw new Error('قيمة الدفعة أكبر من المبلغ المتبقي')
      }

      const payload = {
        camp_member_id: selectedPaymentMember.id,
        camp_id: selectedPaymentMember.camp_id,
        team_id: selectedPaymentMember.team_id,
        member_id: selectedPaymentMember.member_id,
        amount,
        payment_date: paymentDate || todayISO(),
        payment_method: paymentMethod,
        notes: paymentNotes.trim() || null,
      }

      const { data: insertedPayment, error } = await supabase.from('camp_installment_payments').insert(payload).select('id').single()

      if (error) throw error

      void safeWriteAuditLog({
        action: 'add_payment',
        module: 'camp_payments',
        entityType: 'camp_installment_payment',
        entityId: insertedPayment?.id ?? null,
        entityDisplay: `${(membersMap[selectedPaymentMember.member_id]?.full_name || selectedPaymentMember.member_id)} — ${(camp?.title || 'المعسكر')}` ,
        summary: `سجّل دفعة بقيمة ${amount} للعضو ${(membersMap[selectedPaymentMember.member_id]?.full_name || selectedPaymentMember.member_id)} في معسكر ${(camp?.title || 'المعسكر')}` ,
        severity: 'info',
        source: 'CampInstallmentDetails',
        scoutYearId: camp?.scout_year_id ?? null,
        teamId: selectedPaymentMember.team_id,
        targetMemberId: selectedPaymentMember.member_id,
        before: { paid_amount: selectedPaymentMember.paid_amount, remaining_amount: selectedPaymentMember.remaining_amount },
        after: { ...payload, paid_amount: Number(selectedPaymentMember.paid_amount || 0) + amount, remaining_amount: Math.max(Number(selectedPaymentMember.remaining_amount || 0) - amount, 0) },
        changedFields: ['amount', 'payment_date', 'payment_method', 'notes', 'paid_amount', 'remaining_amount'],
        context: { camp_title: (camp?.title || 'المعسكر'), member_name: (membersMap[selectedPaymentMember.member_id]?.full_name || selectedPaymentMember.member_id) },
      })

      setSuccessMsg('تم تسجيل الدفعة بنجاح')
      setPaymentAmount('')
      setPaymentNotes('')
      await loadAll()
    } catch (e: any) {
      setError(e?.message || 'تعذر تسجيل الدفعة')
    } finally {
      setSavingPayment(false)
    }
  }

  const handleSyncTeam = async (teamId: string) => {
    if (!isAdmin || !camp) return

    setError(null)
    setSuccessMsg(null)
    setSyncingTeamId(teamId)

    try {
      const { error } = await supabase.rpc('seed_camp_members_for_team', {
        p_camp_id: camp.id,
        p_team_id: teamId,
      })

      if (error) throw error

      setSuccessMsg('تمت مزامنة أعضاء الفريق بنجاح')
      await loadAll()
    } catch (e: any) {
      setError(e?.message || 'تعذرت مزامنة أعضاء الفريق')
    } finally {
      setSyncingTeamId(null)
    }
  }

  const membersTotals = useMemo(() => {
    return memberRows.reduce(
      (acc, row) => {
        if (row.is_participating) {
          acc.participants += 1
          acc.required += Number(row.required_amount || 0)
          acc.paid += Number(row.paid_amount || 0)
          acc.remaining += Number(row.remaining_amount || 0)
        } else {
          acc.nonParticipants += 1
        }

        if (row.payment_status === 'paid') acc.paidCount += 1
        if (row.payment_status === 'partial') acc.partial += 1
        if (row.payment_status === 'unpaid') acc.unpaid += 1
        if (row.payment_status === 'exempted') acc.exempted += 1
        if (row.payment_status === 'cancelled') acc.cancelled += 1

        return acc
      },
      {
        participants: 0,
        nonParticipants: 0,
        required: 0,
        paid: 0,
        remaining: 0,
        paidCount: 0,
        partial: 0,
        unpaid: 0,
        exempted: 0,
        cancelled: 0,
      }
    )
  }, [memberRows])

  const campDerivedStats = useMemo(() => {
    const activeRows = memberRows.filter((row) => row.payment_status !== 'cancelled')
    const participatingRows = activeRows.filter((row) => row.is_participating)

    const teamsCount = Array.from(new Set(teamRows.map((row) => row.team_id))).length
    const participants = participatingRows.length
    const nonParticipants = activeRows.filter((row) => !row.is_participating).length

    const totalRequired = participatingRows.reduce(
      (sum, row) => sum + Number(row.required_amount || 0),
      0
    )
    const totalPaid = participatingRows.reduce(
      (sum, row) => sum + Number(row.paid_amount || 0),
      0
    )
    const totalRemaining = participatingRows.reduce(
      (sum, row) => sum + Number(row.remaining_amount || 0),
      0
    )

    const paidCount = participatingRows.filter((row) => row.payment_status === 'paid').length
    const partialCount = participatingRows.filter((row) => row.payment_status === 'partial').length
    const unpaidCount = participatingRows.filter((row) => row.payment_status === 'unpaid').length
    const exemptedCount = participatingRows.filter((row) => row.payment_status === 'exempted').length
    const cancelledCount = memberRows.filter((row) => row.payment_status === 'cancelled').length

    const collectionPercentage =
      totalRequired > 0 ? Number(((totalPaid / totalRequired) * 100).toFixed(2)) : 0

    return {
      teamsCount,
      participants,
      nonParticipants,
      totalRequired,
      totalPaid,
      totalRemaining,
      paidCount,
      partialCount,
      unpaidCount,
      exemptedCount,
      cancelledCount,
      collectionPercentage,
    }
  }, [memberRows, teamRows])

  const teamDerivedSummaries = useMemo(() => {
    const map = new Map<string, TeamDerivedSummary>()

    for (const row of teamRows) {
      map.set(row.team_id, {
        id: row.id,
        camp_id: row.camp_id,
        team_id: row.team_id,
        collector_member_id: row.collector_member_id,
        notes: row.notes,
        members_count: 0,
        non_participants_count: 0,
        total_required: 0,
        total_paid: 0,
        total_remaining: 0,
        paid_members_count: 0,
        partial_members_count: 0,
        unpaid_members_count: 0,
        exempted_members_count: 0,
        cancelled_members_count: 0,
        collection_percentage: 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })
    }

    for (const row of memberRows) {
      if (!map.has(row.team_id)) {
        map.set(row.team_id, {
          id: `derived-${row.team_id}`,
          camp_id: row.camp_id,
          team_id: row.team_id,
          collector_member_id: row.collector_member_id,
          notes: null,
          members_count: 0,
          non_participants_count: 0,
          total_required: 0,
          total_paid: 0,
          total_remaining: 0,
          paid_members_count: 0,
          partial_members_count: 0,
          unpaid_members_count: 0,
          exempted_members_count: 0,
          cancelled_members_count: 0,
          collection_percentage: 0,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })
      }

      const bucket = map.get(row.team_id)!
      if (row.collector_member_id && !bucket.collector_member_id) {
        bucket.collector_member_id = row.collector_member_id
      }

      if (row.payment_status === 'cancelled') {
        bucket.cancelled_members_count += 1
        continue
      }

      if (!row.is_participating) {
        bucket.non_participants_count += 1
        continue
      }

      bucket.members_count += 1
      bucket.total_required += Number(row.required_amount || 0)
      bucket.total_paid += Number(row.paid_amount || 0)
      bucket.total_remaining += Number(row.remaining_amount || 0)

      if (row.payment_status === 'paid') bucket.paid_members_count += 1
      if (row.payment_status === 'partial') bucket.partial_members_count += 1
      if (row.payment_status === 'unpaid') bucket.unpaid_members_count += 1
      if (row.payment_status === 'exempted') bucket.exempted_members_count += 1
    }

    const arr = Array.from(map.values()).map((row) => ({
      ...row,
      collection_percentage:
        row.total_required > 0 ? Number(((row.total_paid / row.total_required) * 100).toFixed(2)) : 0,
    }))

    return arr.sort((a, b) =>
      teamLabel(teamsMap[a.team_id]).localeCompare(teamLabel(teamsMap[b.team_id]), 'ar')
    )
  }, [teamRows, memberRows, teamsMap])

  const generateExcel = async () => {
    if (!camp) return

    setExporting(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const teamFilter = exportTeamId === 'all' ? null : exportTeamId

      const baseRows = memberRows
        .filter((r) => r.payment_status !== 'cancelled')
        .filter((r) => (teamFilter ? r.team_id === teamFilter : true))

      const participatingRows = baseRows.filter((r) => r.is_participating)
      const exemptedRows = baseRows.filter((r) => r.is_participating && r.payment_status === 'exempted')
      const discountRows = baseRows.filter((r) => Number(r.discount_amount || 0) > 0)

      const paidTotal = participatingRows.reduce((sum, r) => sum + Number(r.paid_amount || 0), 0)
      const requiredTotal = participatingRows.reduce((sum, r) => sum + Number(r.required_amount || 0), 0)
      const remainingTotal = participatingRows.reduce((sum, r) => sum + Number(r.remaining_amount || 0), 0)
      const discountsTotal = discountRows.reduce((sum, r) => sum + Number(r.discount_amount || 0), 0)

      const participatingSheet = participatingRows.map((r) => ({
        المعسكر: camp.title,
        الفريق: teamLabel(teamsMap[r.team_id]),
        الاسم: memberLabel(membersMap[r.member_id]),
        النوع: participantRoleLabel(r.participant_role),
        مشارك: 'نعم',
        تم_الدفع: Number(r.paid_amount || 0) > 0 ? 'نعم' : 'لا',
        السعر_الأساسي: Number(r.base_amount || 0),
        الخصم: Number(r.discount_amount || 0),
        الحالة: paymentStatusLabel(r.payment_status),
        المطلوب: Number(r.required_amount || 0),
        المدفوع: Number(r.paid_amount || 0),
        المتبقي: Number(r.remaining_amount || 0),
      }))

      participatingSheet.push({
        المعسكر: '',
        الفريق: '',
        الاسم: 'الإجمالي',
        مشارك: '',
        تم_الدفع: '',
        الحالة: '',
        المطلوب: requiredTotal as any,
        المدفوع: paidTotal as any,
        المتبقي: remainingTotal as any,
      } as any)

      const exemptedSheet = exemptedRows.map((r) => ({
        المعسكر: camp.title,
        الفريق: teamLabel(teamsMap[r.team_id]),
        الاسم: memberLabel(membersMap[r.member_id]),
        النوع: participantRoleLabel(r.participant_role),
        الحالة: 'معفى',
        المطلوب_بعد_الإعفاء: Number(r.required_amount || 0),
      }))

      exemptedSheet.unshift({
        المعسكر: camp.title,
        الفريق: teamFilter ? teamLabel(teamsMap[teamFilter]) : 'كل الفرق',
        الاسم: `عدد المعفيين: ${exemptedRows.length}`,
        الحالة: '',
        المطلوب_بعد_الإعفاء: '',
      } as any)

      const discountsSheet = discountRows.map((r) => ({
        المعسكر: camp.title,
        الفريق: teamLabel(teamsMap[r.team_id]),
        الاسم: memberLabel(membersMap[r.member_id]),
        النوع: participantRoleLabel(r.participant_role),
        الخصم: Number(r.discount_amount || 0),
        سبب_الخصم: r.discount_reason || '',
        المطلوب_قبل_الخصم: Number(r.base_amount || 0),
        المطلوب_بعد_الخصم: Number(r.required_amount || 0),
      }))

      discountsSheet.push({
        المعسكر: '',
        الفريق: '',
        الاسم: 'إجمالي الخصومات',
        الخصم: discountsTotal as any,
        المطلوب_قبل_الخصم: '',
        المطلوب_بعد_الخصم: '',
      } as any)

      const teamNameForFile =
        exportTeamId === 'all' ? 'كل_الفرق' : (teamsMap[exportTeamId]?.name || 'فريق')
      const safeCampName = String(camp.title || 'camp').replace(/[\\/:*?"<>|]/g, '_')
      const fileName = `Camp_${safeCampName}_${teamNameForFile}_${todayISO()}.xlsx`

      await exportJsonWorkbook(fileName, [
        { name: 'المشاركون', rows: participatingSheet },
        { name: 'المعفيون', rows: exemptedSheet },
        { name: 'الخصومات', rows: discountsSheet },
      ])
      setSuccessMsg('تم تصدير ملف Excel بنجاح ✅')
    } catch (e: any) {
      setError(e?.message || 'تعذر تصدير ملف Excel')
    } finally {
      setExporting(false)
    }
  }

  if (!canAccess) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
          <div className="mb-2 text-lg font-bold">غير مسموح</div>
          <p className="text-sm">هذه الصفحة متاحة فقط لـ Admin و Chef de Legion.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          جاري تحميل المعسكر...
        </div>
      </div>
    )
  }

  if (!camp) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          المعسكر غير موجود
        </div>
      </div>
    )
  }

  return (
    <div className="camp100-page camp100-installment-details space-y-5 p-4 md:p-6">
      <PageHero
        className="camp100-hero"
        eyebrow="لوحة متابعة مالية مفصلة"
        title={camp.title}
        description={`تاريخ البدء: ${fmtDate(camp.start_date)} — آخر موعد للسداد: ${fmtDate(camp.due_date)}`}
        badge={<StatusPill label={campStatusLabel(camp.status)} tone={campStatusTone(camp.status)} />}
        actions={
          <>
            <Link
              to="/app/camp-installments"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              رجوع
            </Link>

            {isAdmin && (
              <Link
                to={`/app/camp-installments/${camp.id}/edit`}
                className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                تعديل المعسكر
              </Link>
            )}
          </>
        }
      />

      {camp.description && (
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600 shadow-sm">
          {camp.description}
        </div>
      )}

      {error && (
        <InlineAlert tone="error" title="تعذر تنفيذ العملية أو تحميل البيانات">
          {error}
        </InlineAlert>
      )}

      {successMsg && (
        <InlineAlert tone="success" title="تم تنفيذ العملية">
          {successMsg}
        </InlineAlert>
      )}

      <div className="camp100-metrics grid grid-cols-2 gap-3 md:grid-cols-8">
        <MetricCard label="عدد الفرق" value={campDerivedStats.teamsCount} accent="navy" />
        <MetricCard label="المشاركون" value={campDerivedStats.participants} accent="orange" />
        <MetricCard label="غير المشاركين" value={campDerivedStats.nonParticipants} accent="gold" />
        <MetricCard label="سعر Equipier" value={fmtMoney(camp.equipier_price ?? camp.base_amount)} accent="sky" />
        <MetricCard label="سعر Chef" value={fmtMoney(camp.chef_price ?? camp.base_amount)} accent="sky" />
        <MetricCard label="إجمالي المطلوب" value={fmtMoney(campDerivedStats.totalRequired)} accent="indigo" />
        <MetricCard label="إجمالي المدفوع" value={fmtMoney(campDerivedStats.totalPaid)} accent="emerald" />
        <MetricCard label="إجمالي المتبقي" value={fmtMoney(campDerivedStats.totalRemaining)} accent={campDerivedStats.totalRemaining > 0 ? 'rose' : 'emerald'} />
      </div>

      {isAdmin && (
        <SectionCard title="تصدير Excel">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="w-full md:max-w-sm">
              <label className="mb-1 block text-sm font-medium text-slate-700">التصدير لفريق</label>
              <select
                value={exportTeamId}
                onChange={(e) => setExportTeamId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
              >
                <option value="all">كل الفرق</option>
                {teamDerivedSummaries.map((row) => (
                  <option key={row.team_id} value={row.team_id}>
                    {teamLabel(teamsMap[row.team_id])}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={generateExcel}
              disabled={exporting}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {exporting ? 'جارٍ التصدير...' : 'Generate Excel'}
            </button>
          </div>

          <div className="text-sm text-slate-500">
            سيتم إنشاء ملف Excel يحتوي على 3 شيت: المشاركون، المعفيون، الخصومات.
          </div>
        </SectionCard>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
            نظرة عامة
          </TabButton>
          <TabButton active={tab === 'members'} onClick={() => setTab('members')}>
            الأعضاء
          </TabButton>
          <TabButton active={tab === 'payments'} onClick={() => setTab('payments')}>
            الدفعات
          </TabButton>
        </div>
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <SectionCard title="مؤشرات سريعة">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <MiniInfo label="مدفوع" value={campDerivedStats.paidCount} />
              <MiniInfo label="جزئي" value={campDerivedStats.partialCount} />
              <MiniInfo label="غير مدفوع" value={campDerivedStats.unpaidCount} />
              <MiniInfo label="معفى" value={campDerivedStats.exemptedCount} />
              <MiniInfo label="ملغي" value={campDerivedStats.cancelledCount} />
              <MiniInfo label="غير مشارك" value={campDerivedStats.nonParticipants} />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>نسبة التحصيل</span>
                <span>{campDerivedStats.collectionPercentage.toFixed(1)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600"
                  style={{
                    width: `${Math.min(Math.max(campDerivedStats.collectionPercentage, 0), 100)}%`,
                  }}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="الفرق ومسؤولو التحصيل">
            {teamDerivedSummaries.length === 0 ? (
              <div className="text-sm text-slate-500">لا توجد فرق مرتبطة بهذا المعسكر بعد.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {teamDerivedSummaries.map((row) => {
                  const team = teamsMap[row.team_id]
                  const collector = row.collector_member_id
                    ? membersMap[row.collector_member_id]
                    : null

                  return (
                    <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-lg font-bold text-slate-800">{teamLabel(team)}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            مسؤول التحصيل: {memberLabel(collector)}
                          </div>
                        </div>

                        <StatusPill
                          label={`${Number(row.collection_percentage || 0).toFixed(1)}%`}
                          tone="blue"
                        />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                        <MiniInfo label="المشاركون" value={row.members_count || 0} />
                        <MiniInfo label="غير المشاركين" value={row.non_participants_count || 0} />
                        <MiniInfo label="المطلوب" value={fmtMoney(row.total_required)} />
                        <MiniInfo label="المدفوع" value={fmtMoney(row.total_paid)} />
                        <MiniInfo label="المتبقي" value={fmtMoney(row.total_remaining)} />
                      </div>

                      {row.notes && (
                        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                          {row.notes}
                        </div>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleSyncTeam(row.team_id)}
                          disabled={syncingTeamId === row.team_id}
                          className="mt-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
                        >
                          {syncingTeamId === row.team_id ? 'جارٍ المزامنة...' : 'مزامنة أعضاء الفريق'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-5">
          {isAdmin && editingMember && (
            <SectionCard title="تعديل بيانات العضو">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                <MiniInfo label="العضو" value={memberLabel(membersMap[editingMember.member_id])} />
                <MiniInfo label="الفريق" value={teamLabel(teamsMap[editingMember.team_id])} />
                <MiniInfo label="النوع الحالي" value={participantRoleLabel(editingMember.participant_role)} />
                <MiniInfo label="السعر الأساسي" value={fmtMoney(editingMember.base_amount)} />
                <MiniInfo label="المدفوع" value={fmtMoney(editingMember.paid_amount)} />
                <MiniInfo label="المتبقي" value={fmtMoney(editingMember.remaining_amount)} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">النوع</label>
                  <select
                    value={editParticipantRole}
                    onChange={(e) => setEditParticipantRole(e.target.value as 'equipier' | 'chef')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                  >
                    <option value="equipier">Equipier</option>
                    <option value="chef">Chef</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">عند تغيير النوع سيُعاد تطبيق سعر المعسكر المناسب إذا لم يكن السعر الأساسي معدلًا يدويًا.</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">قيمة الخصم</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editDiscountAmount}
                    onChange={(e) => setEditDiscountAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">سبب الخصم</label>
                  <input
                    type="text"
                    value={editDiscountReason}
                    onChange={(e) => setEditDiscountReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">وضع العضو</label>
                  <select
                    value={editMemberMode}
                    onChange={(e) => setEditMemberMode(e.target.value as 'active' | 'cancelled')}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                  >
                    <option value="active">نشط</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>

                <div className="md:col-span-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700">ملاحظات</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveMember}
                  disabled={savingMember}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {savingMember ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                </button>

                <button
                  type="button"
                  onClick={() => setEditingMemberId(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  إلغاء
                </button>
              </div>
            </SectionCard>
          )}

          <SectionCard title="الأعضاء">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">بحث</label>
                <input
                  type="text"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="اسم العضو أو الفريق"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">الحالة</label>
                <select
                  value={memberStatusFilter}
                  onChange={(e) => setMemberStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                >
                  <option value="">كل الحالات</option>
                  <option value="unpaid">غير مدفوع</option>
                  <option value="partial">مدفوع جزئي</option>
                  <option value="paid">مدفوع</option>
                  <option value="exempted">معفى</option>
                  <option value="cancelled">ملغي</option>
                  <option value="not_participating">غير مشارك</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">الفريق</label>
                <select
                  value={memberTeamFilter}
                  onChange={(e) => setMemberTeamFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                >
                  <option value="">كل الفرق</option>
                  {Object.values(teamsMap).map((team) => (
                    <option key={team.id} value={team.id}>
                      {teamLabel(team)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">المشاركة</label>
                <select
                  value={participationFilter}
                  onChange={(e) => setParticipationFilter(e.target.value as ParticipationFilter)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                >
                  <option value="all">الكل</option>
                  <option value="participating">مشارك</option>
                  <option value="not_participating">غير مشارك</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setMemberQuery('')
                    setMemberStatusFilter('')
                    setMemberTeamFilter('')
                    setParticipationFilter('all')
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  مسح الفلاتر
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
              <MiniInfo label="المشاركون" value={membersTotals.participants} />
              <MiniInfo label="غير المشاركين" value={membersTotals.nonParticipants} />
              <MiniInfo label="المطلوب" value={fmtMoney(membersTotals.required)} />
              <MiniInfo label="المدفوع" value={fmtMoney(membersTotals.paid)} />
              <MiniInfo label="المتبقي" value={fmtMoney(membersTotals.remaining)} />
              <MiniInfo label="Paid / Partial" value={`${membersTotals.paidCount} / ${membersTotals.partial}`} />
            </div>

            {filteredMembers.length === 0 ? (
              <div className="mt-4 text-sm text-slate-500">لا يوجد أعضاء مطابقون للفلاتر الحالية.</div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="px-3 py-2 text-right">العضو</th>
                      <th className="px-3 py-2 text-right">النوع</th>
                      <th className="px-3 py-2 text-right">الفريق</th>
                      <th className="px-3 py-2 text-right">المسؤول</th>
                      <th className="px-3 py-2 text-right">المشاركة</th>
                      <th className="px-3 py-2 text-right">السعر الأساسي</th>
                      <th className="px-3 py-2 text-right">الخصم</th>
                      <th className="px-3 py-2 text-right">المطلوب</th>
                      <th className="px-3 py-2 text-right">المدفوع</th>
                      <th className="px-3 py-2 text-right">المتبقي</th>
                      <th className="px-3 py-2 text-right">الحالة</th>
                      <th className="px-3 py-2 text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((row) => {
                      const rowClass =
                        row.payment_status === 'paid'
                          ? 'bg-green-50'
                          : row.payment_status === 'unpaid'
                          ? 'bg-amber-50'
                          : row.payment_status === 'cancelled'
                          ? 'bg-slate-100'
                          : row.payment_status === 'not_participating'
                          ? 'bg-slate-50'
                          : ''

                      return (
                        <tr key={row.id} className={`border-b border-slate-100 ${rowClass}`}>
                          <td className="px-3 py-3 font-medium text-slate-800">
                            {memberLabel(membersMap[row.member_id])}
                          </td>
                          <td className="px-3 py-3">
                            <StatusPill
                              label={participantRoleLabel(row.participant_role)}
                              tone={participantRoleTone(row.participant_role)}
                            />
                          </td>
                          <td className="px-3 py-3">{teamLabel(teamsMap[row.team_id])}</td>
                          <td className="px-3 py-3">
                            {memberLabel(row.collector_member_id ? membersMap[row.collector_member_id] : null)}
                          </td>
                          <td className="px-3 py-3">
                            <StatusPill
                              label={row.is_participating ? 'مشارك' : 'غير مشارك'}
                              tone={row.is_participating ? 'green' : 'slate'}
                            />
                          </td>
                          <td className="px-3 py-3">{fmtMoney(row.base_amount)}</td>
                          <td className="px-3 py-3">{fmtMoney(row.discount_amount)}</td>
                          <td className="px-3 py-3">{fmtMoney(row.required_amount)}</td>
                          <td className="px-3 py-3">{fmtMoney(row.paid_amount)}</td>
                          <td className="px-3 py-3">{fmtMoney(row.remaining_amount)}</td>
                          <td className="px-3 py-3">
                            <StatusPill
                              label={paymentStatusLabel(row.payment_status)}
                              tone={paymentStatusTone(row.payment_status)}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              {isAdmin && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleParticipation(row, !row.is_participating)}
                                    disabled={togglingMemberId === row.id}
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
                                  >
                                    {togglingMemberId === row.id
                                      ? '...'
                                      : row.is_participating
                                      ? 'إلغاء مشاركة'
                                      : 'جعله مشارك'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => beginEditMember(row)}
                                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50"
                                  >
                                    تعديل
                                  </button>

                                  {row.is_participating && row.payment_status !== 'cancelled' && (
                                    <button
                                      type="button"
                                      onClick={() => startPaymentForMember(row)}
                                      className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                                    >
                                      تسجيل دفعة
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-5">
          {isAdmin && (
            <SectionCard title="تسجيل دفعة جديدة">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="xl:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">العضو</label>
                  <select
                    value={paymentMemberId}
                    onChange={(e) => setPaymentMemberId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                  >
                    <option value="">اختر العضو</option>
                    {memberRows
                      .filter(
                        (row) =>
                          row.is_participating &&
                          row.payment_status !== 'cancelled' &&
                          Number(row.remaining_amount || 0) > 0
                      )
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {memberLabel(membersMap[row.member_id])} - {teamLabel(teamsMap[row.team_id])}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">المبلغ</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">التاريخ</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">الطريقة</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="xl:col-span-4">
                  <label className="mb-1 block text-sm font-medium text-slate-700">ملاحظات</label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddPayment}
                    disabled={savingPayment}
                    className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {savingPayment ? 'جارٍ الحفظ...' : 'تسجيل الدفعة'}
                  </button>
                </div>
              </div>

              {selectedPaymentMember && (
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  العضو المختار:{' '}
                  <span className="font-semibold">
                    {memberLabel(membersMap[selectedPaymentMember.member_id])}
                  </span>
                  {' • '} المتبقي:{' '}
                  <span className="font-semibold">
                    {fmtMoney(selectedPaymentMember.remaining_amount)}
                  </span>
                  {' • '} الحالة:{' '}
                  <span className="font-semibold">
                    {paymentStatusLabel(selectedPaymentMember.payment_status)}
                  </span>
                </div>
              )}
            </SectionCard>
          )}

          <SectionCard title="سجل الدفعات">
            {paymentRows.length === 0 ? (
              <div className="text-sm text-slate-500">لا توجد دفعات مسجلة حتى الآن.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="px-3 py-2 text-right">التاريخ</th>
                      <th className="px-3 py-2 text-right">العضو</th>
                      <th className="px-3 py-2 text-right">الفريق</th>
                      <th className="px-3 py-2 text-right">المبلغ</th>
                      <th className="px-3 py-2 text-right">الطريقة</th>
                      <th className="px-3 py-2 text-right">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentRows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="px-3 py-3">{fmtDate(row.payment_date)}</td>
                        <td className="px-3 py-3 font-medium text-slate-800">
                          {memberLabel(membersMap[row.member_id])}
                        </td>
                        <td className="px-3 py-3">{teamLabel(teamsMap[row.team_id])}</td>
                        <td className="px-3 py-3">{fmtMoney(row.amount)}</td>
                        <td className="px-3 py-3">{paymentMethodLabel(row.payment_method)}</td>
                        <td className="px-3 py-3">{row.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div>المستخدم الحالي: {user?.name || user?.email || '-'}</div>
        <div>رقم المعسكر: {camp.id}</div>
      </div>
    </div>
  )
}

function SectionCard({
  title,
  extra,
  children,
}: {
  title: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="camp100-local-section rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {extra}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function StatCard({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string | number
  danger?: boolean
}) {
  return (
    <div
      className={`camp100-local-stat rounded-2xl border p-4 shadow-sm ${
        danger ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className={`text-sm ${danger ? 'text-red-700' : 'text-slate-500'}`}>{label}</div>
      <div className={`mt-2 text-2xl font-bold ${danger ? 'text-red-700' : 'text-slate-800'}`}>
        {value}
      </div>
    </div>
  )
}

function MiniInfo({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="camp100-mini-info rounded-xl bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  )
}

function StatusPill({
  label,
  tone = 'slate',
}: {
  label: string
  tone?: 'slate' | 'green' | 'yellow' | 'red' | 'blue'
}) {
  const cls =
    tone === 'green'
      ? 'bg-green-100 text-green-700 border-green-200'
      : tone === 'yellow'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : tone === 'red'
      ? 'bg-red-100 text-red-700 border-red-200'
      : tone === 'blue'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : 'bg-slate-100 text-slate-700 border-slate-200'

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-indigo-600 text-white'
          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}
