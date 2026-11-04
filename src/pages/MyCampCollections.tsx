import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { safeWriteAuditLog } from '../features/audit/api'
import { useAuth } from '../components/AuthProvider'
import { fetchCurrentScoutYearId } from '../features/reference/api'
import { PageHero } from '../components/ui/PageHero'
import { MetricCard } from '../components/ui/MetricCard'
import { InlineAlert } from '../components/ui/InlineAlert'
import { EmptyState } from '../components/ui/EmptyState'

type PaymentMethod = 'cash' | 'vodafone_cash' | 'bank_transfer' | 'other'
type ParticipantRole = 'equipier' | 'chef'

type SummaryRow = {
  camp_id: string
  camp_title: string
  camp_status: 'draft' | 'open' | 'closed' | 'cancelled'
  camp_due_date: string | null
  team_id: string
  team_name: string
  collector_member_id: string
  collector_name: string
  members_count: number
  non_participants_count: number
  equipiers_count: number
  chefs_count: number
  total_required: number
  total_paid: number
  total_remaining: number
  collection_percentage: number
}

type MemberRow = {
  camp_member_id: string
  camp_id: string
  camp_title: string
  camp_status: 'draft' | 'open' | 'closed' | 'cancelled'
  camp_due_date: string | null
  team_id: string
  team_name: string
  member_id: string
  member_name: string
  is_equipier: boolean
  participant_role?: ParticipantRole | null
  is_participating: boolean
  collector_member_id: string
  collector_name: string
  base_amount?: number
  discount_amount?: number
  required_amount: number
  paid_amount: number
  remaining_amount: number
  payment_status:
    | 'unpaid'
    | 'partial'
    | 'paid'
    | 'exempted'
    | 'cancelled'
    | 'not_participating'
  notes: string | null
  created_at: string
  updated_at: string
}

type PaymentRow = {
  id: string
  camp_member_id: string
  camp_id: string
  camp_title: string
  team_id: string
  team_name: string
  member_id: string
  member_name: string
  amount: number
  payment_date: string
  payment_method: PaymentMethod
  notes: string | null
  created_at: string
}

type CampPriceRow = {
  id: string
  base_amount: number | null
  equipier_price: number | null
  chef_price: number | null
}

type ParticipationFilter = 'all' | 'participating' | 'not_participating'

type RoleRow = {
  role_slug: string
  team_id?: string | null
}

type DirectCampAssignmentRow = {
  id?: string
  camp_id: string
  team_id: string
  collector_member_id?: string | null
  notes?: string | null
}

type DirectCampRow = {
  id: string
  title?: string | null
  status?: SummaryRow['camp_status'] | null
  due_date?: string | null
  base_amount?: number | null
  equipier_price?: number | null
  chef_price?: number | null
}

type DirectTeamRow = { id: string; name?: string | null }
type DirectMemberMetaRow = { id: string; team_id?: string | null; is_equipier?: boolean | null; full_name?: string | null }

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

function num(value: unknown) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function nearlyEqual(a: unknown, b: unknown) {
  return Math.abs(num(a) - num(b)) < 0.0001
}

function campStatusLabel(status: SummaryRow['camp_status']) {
  if (status === 'draft') return 'مسودة'
  if (status === 'open') return 'مفتوح'
  if (status === 'closed') return 'مغلق'
  if (status === 'cancelled') return 'ملغي'
  return status
}

function campStatusTone(status: SummaryRow['camp_status']): 'slate' | 'green' | 'yellow' | 'red' | 'blue' {
  if (status === 'open') return 'green'
  if (status === 'draft') return 'yellow'
  if (status === 'closed') return 'blue'
  if (status === 'cancelled') return 'red'
  return 'slate'
}

function paymentStatusLabel(status: MemberRow['payment_status']) {
  if (status === 'unpaid') return 'غير مدفوع'
  if (status === 'partial') return 'مدفوع جزئي'
  if (status === 'paid') return 'مدفوع'
  if (status === 'exempted') return 'معفى'
  if (status === 'cancelled') return 'ملغي'
  if (status === 'not_participating') return 'غير مشارك'
  return status
}

function paymentStatusTone(status: MemberRow['payment_status']): 'slate' | 'green' | 'yellow' | 'red' | 'blue' {
  if (status === 'paid') return 'green'
  if (status === 'partial') return 'blue'
  if (status === 'unpaid') return 'yellow'
  if (status === 'cancelled') return 'red'
  return 'slate'
}

function paymentMethodLabel(method: PaymentMethod) {
  if (method === 'cash') return 'كاش'
  if (method === 'vodafone_cash') return 'فودافون كاش'
  if (method === 'bank_transfer') return 'تحويل بنكي'
  return 'أخرى'
}

function resolveParticipantRole(row: Pick<MemberRow, 'participant_role' | 'is_equipier'>): ParticipantRole {
  if (row.participant_role === 'chef' || row.participant_role === 'equipier') return row.participant_role
  return row.is_equipier ? 'equipier' : 'chef'
}

function participantRoleLabel(role: ParticipantRole) {
  return role === 'chef' ? 'Chef' : 'Equipier'
}

function derivePaymentStatus(row: {
  is_participating: boolean
  base_amount?: number
  discount_amount?: number
  required_amount: number
  paid_amount: number
  remaining_amount: number
  payment_status?: MemberRow['payment_status']
}): MemberRow['payment_status'] {
  if (row.payment_status === 'cancelled') return 'cancelled'
  if (!row.is_participating) return 'not_participating'
  if (Number(row.required_amount || 0) <= 0) return 'exempted'
  if (Number(row.paid_amount || 0) <= 0) return 'unpaid'
  if (Number(row.remaining_amount || 0) <= 0) return 'paid'
  return 'partial'
}

function resolveRolePrice(row: MemberRow, campPrice?: CampPriceRow | null) {
  const role = resolveParticipantRole(row)
  const campBase = num(campPrice?.base_amount)
  const equipierPrice = num(campPrice?.equipier_price || campPrice?.base_amount)
  const chefPrice = num(campPrice?.chef_price || campPrice?.base_amount)
  const rowBase = num(row.base_amount)

  if (!campPrice) return rowBase

  const pricesDiffer = !nearlyEqual(equipierPrice, chefPrice)
  const targetRolePrice = role === 'chef' ? chefPrice : equipierPrice
  const otherRolePrice = role === 'chef' ? equipierPrice : chefPrice

  if (!pricesDiffer) {
    return rowBase || targetRolePrice
  }

  if (
    row.base_amount == null ||
    nearlyEqual(rowBase, campBase) ||
    nearlyEqual(rowBase, otherRolePrice)
  ) {
    return targetRolePrice
  }

  return rowBase
}

function normalizeMemberRow(row: MemberRow, campPrice?: CampPriceRow | null): MemberRow {
  const resolvedRole = resolveParticipantRole(row)
  const resolvedBaseAmount = resolveRolePrice({ ...row, participant_role: resolvedRole }, campPrice)
  const resolvedDiscount = num(row.discount_amount)
  const resolvedPaid = num(row.paid_amount)
  const resolvedRequired = Math.max(resolvedBaseAmount - resolvedDiscount, 0)
  const resolvedRemaining = Math.max(resolvedRequired - resolvedPaid, 0)
  const resolvedStatus = derivePaymentStatus({
    is_participating: row.is_participating,
    base_amount: resolvedBaseAmount,
    discount_amount: resolvedDiscount,
    required_amount: resolvedRequired,
    paid_amount: resolvedPaid,
    remaining_amount: resolvedRemaining,
    payment_status: row.payment_status,
  })

  return {
    ...row,
    participant_role: resolvedRole,
    base_amount: resolvedBaseAmount,
    discount_amount: resolvedDiscount,
    required_amount: resolvedRequired,
    paid_amount: resolvedPaid,
    remaining_amount: resolvedRemaining,
    payment_status: resolvedStatus,
  }
}


function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function mergeByKey<T>(base: T[], extra: T[], getKey: (row: T) => string) {
  const map = new Map<string, T>()
  for (const row of base) {
    const key = getKey(row)
    if (key) map.set(key, row)
  }
  for (const row of extra) {
    const key = getKey(row)
    if (key) map.set(key, row)
  }
  return Array.from(map.values())
}

function pairKey(campId?: string | null, teamId?: string | null) {
  return `${campId || ''}__${teamId || ''}`
}

async function fetchCurrentMemberId(userId?: string | null) {
  if (!userId) return null

  const { data, error } = await scoutYearFrom('v_members_current', 'v_members_context')
    .select('id')
    .eq('auth_user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return (data?.id as string | undefined) || null
}

async function loadTeamScopedCampCollections({
  campIds,
  scopedTeamIds,
  currentMemberId,
}: {
  campIds: string[]
  scopedTeamIds: string[]
  currentMemberId?: string | null
}): Promise<{ summaryRows: SummaryRow[]; memberRows: MemberRow[]; paymentRows: PaymentRow[] }> {
  const cleanCampIds = uniqueNonEmpty(campIds)
  const cleanTeamIds = uniqueNonEmpty(scopedTeamIds)

  if (!cleanCampIds.length || (!cleanTeamIds.length && !currentMemberId)) {
    return { summaryRows: [], memberRows: [], paymentRows: [] }
  }

  const assignmentMap = new Map<string, DirectCampAssignmentRow>()

  if (cleanTeamIds.length) {
    const { data, error } = await supabase
      .from('camp_installment_teams')
      .select('id, camp_id, team_id, collector_member_id, notes')
      .in('camp_id', cleanCampIds)
      .in('team_id', cleanTeamIds)

    if (error) throw error

    for (const row of (data || []) as DirectCampAssignmentRow[]) {
      assignmentMap.set(row.id || pairKey(row.camp_id, row.team_id), row)
    }
  }

  if (currentMemberId) {
    const { data, error } = await supabase
      .from('camp_installment_teams')
      .select('id, camp_id, team_id, collector_member_id, notes')
      .in('camp_id', cleanCampIds)
      .eq('collector_member_id', currentMemberId)

    if (error) throw error

    for (const row of (data || []) as DirectCampAssignmentRow[]) {
      assignmentMap.set(row.id || pairKey(row.camp_id, row.team_id), row)
    }
  }

  const assignments = Array.from(assignmentMap.values())
  const allowedPairs = new Set(assignments.map((row) => pairKey(row.camp_id, row.team_id)))
  const assignmentCampIds = uniqueNonEmpty(assignments.map((row) => row.camp_id))
  const assignmentTeamIds = uniqueNonEmpty(assignments.map((row) => row.team_id))

  if (!assignments.length || !assignmentCampIds.length || !assignmentTeamIds.length) {
    return { summaryRows: [], memberRows: [], paymentRows: [] }
  }

  const [campRes, teamRes, campMembersRes, paymentsRes] = await Promise.all([
    supabase
      .from('camp_installments')
      .select('id, title, status, due_date, base_amount, equipier_price, chef_price')
      .in('id', assignmentCampIds),

    supabase.from('teams').select('id, name').in('id', assignmentTeamIds),

    supabase
      .from('camp_installment_members')
      .select('*')
      .in('camp_id', assignmentCampIds)
      .in('team_id', assignmentTeamIds),

    supabase
      .from('camp_installment_payments')
      .select('*')
      .in('camp_id', assignmentCampIds)
      .in('team_id', assignmentTeamIds)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(80),
  ])

  if (campRes.error) throw campRes.error
  if (teamRes.error) throw teamRes.error
  if (campMembersRes.error) throw campMembersRes.error
  if (paymentsRes.error) throw paymentsRes.error

  const campMap = new Map<string, DirectCampRow>()
  for (const row of (campRes.data || []) as DirectCampRow[]) campMap.set(row.id, row)

  const teamMap = new Map<string, string>()
  for (const row of (teamRes.data || []) as DirectTeamRow[]) teamMap.set(row.id, row.name || 'فريق بدون اسم')

  const rawCampMemberRows = ((campMembersRes.data || []) as any[]).filter((row) =>
    allowedPairs.has(pairKey(row.camp_id, row.team_id))
  )
  const rawPaymentRows = ((paymentsRes.data || []) as any[]).filter((row) =>
    allowedPairs.has(pairKey(row.camp_id, row.team_id))
  )

  const memberIds = uniqueNonEmpty([
    ...rawCampMemberRows.map((row) => row.member_id),
    ...rawCampMemberRows.map((row) => row.collector_member_id),
    ...rawPaymentRows.map((row) => row.member_id),
    ...assignments.map((row) => row.collector_member_id),
  ])

  const memberMap = new Map<string, DirectMemberMetaRow>()
  if (memberIds.length) {
    const { data, error } = await supabase
      .from('members')
      .select('id, team_id, is_equipier, full_name')
      .in('id', memberIds)

    if (error) throw error
    for (const row of (data || []) as DirectMemberMetaRow[]) memberMap.set(row.id, row)
  }

  const assignmentByPair = new Map<string, DirectCampAssignmentRow>()
  for (const row of assignments) assignmentByPair.set(pairKey(row.camp_id, row.team_id), row)

  const campPriceMap = new Map<string, CampPriceRow>()
  for (const row of (campRes.data || []) as DirectCampRow[]) {
    campPriceMap.set(row.id, {
      id: row.id,
      base_amount: row.base_amount ?? 0,
      equipier_price: row.equipier_price ?? row.base_amount ?? 0,
      chef_price: row.chef_price ?? row.base_amount ?? 0,
    })
  }

  const memberRows: MemberRow[] = rawCampMemberRows.map((row) => {
    const camp = campMap.get(row.camp_id)
    const assignment = assignmentByPair.get(pairKey(row.camp_id, row.team_id))
    const member = memberMap.get(row.member_id)
    const collectorId = row.collector_member_id || assignment?.collector_member_id || ''
    const collector = collectorId ? memberMap.get(collectorId) : null
    const teamName = teamMap.get(row.team_id) || 'فريق بدون اسم'

    const mergedRow: MemberRow = {
      camp_member_id: row.id,
      camp_id: row.camp_id,
      camp_title: camp?.title || 'معسكر بدون اسم',
      camp_status: (camp?.status || 'draft') as SummaryRow['camp_status'],
      camp_due_date: camp?.due_date || null,
      team_id: row.team_id,
      team_name: teamName,
      member_id: row.member_id,
      member_name: member?.full_name || 'عضو بدون اسم',
      is_equipier: Boolean(member?.is_equipier ?? row.is_equipier),
      participant_role: row.participant_role ?? (Boolean(member?.is_equipier ?? row.is_equipier) ? 'equipier' : 'chef'),
      is_participating: row.is_participating ?? true,
      collector_member_id: collectorId,
      collector_name: collector?.full_name || 'مسؤول الفريق',
      base_amount: row.base_amount ?? camp?.base_amount ?? 0,
      discount_amount: row.discount_amount ?? 0,
      required_amount: row.required_amount ?? 0,
      paid_amount: row.paid_amount ?? 0,
      remaining_amount: row.remaining_amount ?? 0,
      payment_status: row.payment_status || 'unpaid',
      notes: row.notes ?? null,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || row.created_at || new Date().toISOString(),
    }

    return normalizeMemberRow(mergedRow, campPriceMap.get(row.camp_id))
  })

  const membersByPair = new Map<string, MemberRow[]>()
  for (const row of memberRows) {
    const key = pairKey(row.camp_id, row.team_id)
    const list = membersByPair.get(key) || []
    list.push(row)
    membersByPair.set(key, list)
  }

  const summaryRows: SummaryRow[] = assignments.map((assignment) => {
    const key = pairKey(assignment.camp_id, assignment.team_id)
    const camp = campMap.get(assignment.camp_id)
    const teamName = teamMap.get(assignment.team_id) || 'فريق بدون اسم'
    const collector = assignment.collector_member_id ? memberMap.get(assignment.collector_member_id) : null
    const rows = membersByPair.get(key) || []
    const participatingRows = rows.filter((row) => row.is_participating)
    const totalRequired = participatingRows.reduce((acc, row) => acc + num(row.required_amount), 0)
    const totalPaid = participatingRows.reduce((acc, row) => acc + num(row.paid_amount), 0)
    const totalRemaining = participatingRows.reduce((acc, row) => acc + num(row.remaining_amount), 0)
    const equipiersCount = participatingRows.filter((row) => resolveParticipantRole(row) === 'equipier').length
    const chefsCount = participatingRows.filter((row) => resolveParticipantRole(row) === 'chef').length

    return {
      camp_id: assignment.camp_id,
      camp_title: camp?.title || 'معسكر بدون اسم',
      camp_status: (camp?.status || 'draft') as SummaryRow['camp_status'],
      camp_due_date: camp?.due_date || null,
      team_id: assignment.team_id,
      team_name: teamName,
      collector_member_id: assignment.collector_member_id || '',
      collector_name: collector?.full_name || 'مسؤول الفريق',
      members_count: participatingRows.length,
      non_participants_count: rows.length - participatingRows.length,
      equipiers_count: equipiersCount,
      chefs_count: chefsCount,
      total_required: totalRequired,
      total_paid: totalPaid,
      total_remaining: totalRemaining,
      collection_percentage: totalRequired > 0 ? Number(((totalPaid / totalRequired) * 100).toFixed(2)) : 0,
    }
  })

  const paymentRows: PaymentRow[] = rawPaymentRows.map((row) => {
    const camp = campMap.get(row.camp_id)
    const member = memberMap.get(row.member_id)
    return {
      id: row.id,
      camp_member_id: row.camp_member_id,
      camp_id: row.camp_id,
      camp_title: camp?.title || 'معسكر بدون اسم',
      team_id: row.team_id,
      team_name: teamMap.get(row.team_id) || 'فريق بدون اسم',
      member_id: row.member_id,
      member_name: member?.full_name || 'عضو بدون اسم',
      amount: num(row.amount),
      payment_date: row.payment_date,
      payment_method: (row.payment_method || 'cash') as PaymentMethod,
      notes: row.notes ?? null,
      created_at: row.created_at || row.payment_date || new Date().toISOString(),
    }
  })

  return { summaryRows, memberRows, paymentRows }
}

export default function MyCampCollections() {
  const { user, roles } = useAuth() as {
    user: { id?: string; name?: string; email?: string } | null
    roles: RoleRow[]
  }

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null)

  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([])
  const [memberRows, setMemberRows] = useState<MemberRow[]>([])
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([])

  const [search, setSearch] = useState('')
  const [selectedCampId, setSelectedCampId] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [participationFilter, setParticipationFilter] = useState<ParticipationFilter>('all')
  const [showCancelled, setShowCancelled] = useState(false)

  const [selectedCampMemberId, setSelectedCampMemberId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(todayISO())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentNotes, setPaymentNotes] = useState('')

  const paymentSectionRef = useRef<HTMLDivElement | null>(null)
  const paymentAmountInputRef = useRef<HTMLInputElement | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const currentScoutYearId = await fetchCurrentScoutYearId()
      if (!currentScoutYearId) {
        setSummaryRows([])
        setMemberRows([])
        setPaymentRows([])
        return
      }

      const { data: currentCamps, error: campsError } = await supabase
        .from('camp_installments')
        .select('id')
        .eq('scout_year_id', currentScoutYearId)

      if (campsError) throw campsError

      const campIds = ((currentCamps || []) as Array<{ id: string }>).map((row) => row.id)
      if (!campIds.length) {
        setSummaryRows([])
        setMemberRows([])
        setPaymentRows([])
        return
      }

      const [summaryRes, membersRes, paymentsRes] = await Promise.all([
        supabase
          .from('v_my_camp_collections_summary')
          .select('*')
          .in('camp_id', campIds)
          .order('camp_title', { ascending: true })
          .order('team_name', { ascending: true }),

        supabase
          .from('v_my_camp_collection_members')
          .select('*')
          .in('camp_id', campIds)
          .order('camp_title', { ascending: true })
          .order('team_name', { ascending: true })
          .order('is_equipier', { ascending: false })
          .order('member_name', { ascending: true }),

        supabase
          .from('v_my_camp_collection_payments')
          .select('*')
          .in('camp_id', campIds)
          .order('payment_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(50),
      ])

      if (summaryRes.error) throw summaryRes.error
      if (membersRes.error) throw membersRes.error
      if (paymentsRes.error) throw paymentsRes.error

      const scopedTeamIds = uniqueNonEmpty(
        (roles || [])
          .filter((role) => ['chef_de_legion', 'responsable_finance'].includes(role.role_slug))
          .map((role) => role.team_id)
      )
      const currentMemberId = await fetchCurrentMemberId(user?.id)

      const directScopeRows = await loadTeamScopedCampCollections({
        campIds,
        scopedTeamIds,
        currentMemberId,
      })

      const summaryRowsValue = mergeByKey(
        (summaryRes.data || []) as SummaryRow[],
        directScopeRows.summaryRows,
        (row) => pairKey(row.camp_id, row.team_id)
      )
      const baseMemberRows = mergeByKey(
        (membersRes.data || []) as MemberRow[],
        directScopeRows.memberRows,
        (row) => row.camp_member_id
      )
      const paymentRowsValue = mergeByKey(
        (paymentsRes.data || []) as PaymentRow[],
        directScopeRows.paymentRows,
        (row) => row.id
      )
        .sort((a, b) => `${b.payment_date || ''} ${b.created_at || ''}`.localeCompare(`${a.payment_date || ''} ${a.created_at || ''}`))
        .slice(0, 50)

      const campMemberIds = Array.from(
        new Set(baseMemberRows.map((row) => row.camp_member_id).filter(Boolean))
      )

      const campIdsFromMembers = Array.from(
        new Set(baseMemberRows.map((row) => row.camp_id).filter(Boolean))
      )

      let mergedMemberRows: MemberRow[] = baseMemberRows

      const memberMetaMap = new Map<string, any>()
      const campPriceMap = new Map<string, CampPriceRow>()

      if (campMemberIds.length) {
        const { data: memberMetaRows, error: memberMetaError } = await supabase
          .from('camp_installment_members')
          .select(
            'id, participant_role, base_amount, discount_amount, required_amount, paid_amount, remaining_amount, payment_status, is_participating, collector_member_id, notes, updated_at'
          )
          .in('id', campMemberIds)

        if (memberMetaError) throw memberMetaError

        for (const row of memberMetaRows || []) {
          memberMetaMap.set(row.id, row)
        }
      }

      if (campIdsFromMembers.length) {
        const { data: campPriceRows, error: campPriceError } = await supabase
          .from('camp_installments')
          .select('id, base_amount, equipier_price, chef_price')
          .in('id', campIdsFromMembers)

        if (campPriceError) throw campPriceError

        for (const row of (campPriceRows || []) as CampPriceRow[]) {
          campPriceMap.set(row.id, row)
        }
      }

      mergedMemberRows = baseMemberRows.map((row) => {
        const meta = memberMetaMap.get(row.camp_member_id)
        const mergedRow: MemberRow = meta
          ? {
              ...row,
              participant_role:
                meta.participant_role ??
                row.participant_role ??
                (row.is_equipier ? 'equipier' : 'chef'),
              base_amount: meta.base_amount ?? row.base_amount ?? 0,
              discount_amount: meta.discount_amount ?? row.discount_amount ?? 0,
              required_amount: meta.required_amount ?? row.required_amount ?? 0,
              paid_amount: meta.paid_amount ?? row.paid_amount ?? 0,
              remaining_amount: meta.remaining_amount ?? row.remaining_amount ?? 0,
              payment_status: meta.payment_status ?? row.payment_status,
              is_participating: meta.is_participating ?? row.is_participating,
              collector_member_id: meta.collector_member_id ?? row.collector_member_id,
              notes: meta.notes ?? row.notes,
              updated_at: meta.updated_at ?? row.updated_at,
            }
          : row

        return normalizeMemberRow(mergedRow, campPriceMap.get(row.camp_id))
      })

      setSummaryRows(summaryRowsValue)
      setMemberRows(mergedMemberRows)
      setPaymentRows(paymentRowsValue)
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء تحميل بيانات التحصيل')
    } finally {
      setLoading(false)
    }
  }, [roles, user?.id])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    if (!selectedCampMemberId) return

    const timer = window.setTimeout(() => {
      paymentSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      paymentAmountInputRef.current?.focus()
      paymentAmountInputRef.current?.select()
    }, 80)

    return () => window.clearTimeout(timer)
  }, [selectedCampMemberId])

  const filteredMembers = useMemo(() => {
    return memberRows.filter((row) => {
      if (!showCancelled && row.payment_status === 'cancelled') return false
      if (selectedCampId && row.camp_id !== selectedCampId) return false
      if (selectedTeamId && row.team_id !== selectedTeamId) return false
      if (participationFilter === 'participating' && !row.is_participating) return false
      if (participationFilter === 'not_participating' && row.is_participating) return false

      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const hay = `${row.member_name} ${row.team_name} ${row.camp_title}`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      return true
    })
  }, [memberRows, showCancelled, selectedCampId, selectedTeamId, participationFilter, search])

  const selectedMember = useMemo(
    () => memberRows.find((x) => x.camp_member_id === selectedCampMemberId) || null,
    [memberRows, selectedCampMemberId]
  )

  const summaryMetaMap = useMemo(() => {
    const map = new Map<string, SummaryRow>()

    for (const row of summaryRows) {
      map.set(`${row.camp_id}__${row.team_id}`, row)
    }

    for (const row of memberRows) {
      const key = `${row.camp_id}__${row.team_id}`
      if (!map.has(key)) {
        map.set(key, {
          camp_id: row.camp_id,
          camp_title: row.camp_title,
          camp_status: row.camp_status,
          camp_due_date: row.camp_due_date,
          team_id: row.team_id,
          team_name: row.team_name,
          collector_member_id: row.collector_member_id,
          collector_name: row.collector_name,
          members_count: 0,
          non_participants_count: 0,
          equipiers_count: 0,
          chefs_count: 0,
          total_required: 0,
          total_paid: 0,
          total_remaining: 0,
          collection_percentage: 0,
        })
      }
    }

    return map
  }, [summaryRows, memberRows])

  const grouped = useMemo(() => {
    const groupMap = new Map<
      string,
      {
        summary: SummaryRow
        equipiers: MemberRow[]
        chefs: MemberRow[]
      }
    >()

    for (const row of filteredMembers) {
      const key = `${row.camp_id}__${row.team_id}`
      const meta = summaryMetaMap.get(key)

      if (!meta) continue

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          summary: {
            ...meta,
            members_count: 0,
            non_participants_count: 0,
            equipiers_count: 0,
            chefs_count: 0,
            total_required: 0,
            total_paid: 0,
            total_remaining: 0,
            collection_percentage: 0,
          },
          equipiers: [],
          chefs: [],
        })
      }

      const bucket = groupMap.get(key)!
      const role = resolveParticipantRole(row)
      if (role === 'equipier') bucket.equipiers.push(row)
      else bucket.chefs.push(row)

      if (row.is_participating) {
        bucket.summary.members_count += 1
        if (role === 'equipier') bucket.summary.equipiers_count += 1
        else bucket.summary.chefs_count += 1
        bucket.summary.total_required += Number(row.required_amount || 0)
        bucket.summary.total_paid += Number(row.paid_amount || 0)
        bucket.summary.total_remaining += Number(row.remaining_amount || 0)
      } else {
        bucket.summary.non_participants_count += 1
      }
    }

    const arr = Array.from(groupMap.values()).map((group) => {
      group.summary.collection_percentage =
        group.summary.total_required > 0
          ? Number(((group.summary.total_paid / group.summary.total_required) * 100).toFixed(2))
          : 0
      return group
    })

    return arr.sort((a, b) => {
      const aKey = `${a.summary.camp_title} ${a.summary.team_name}`
      const bKey = `${b.summary.camp_title} ${b.summary.team_name}`
      return aKey.localeCompare(bKey, 'ar')
    })
  }, [filteredMembers, summaryMetaMap])

  const campOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of summaryRows) map.set(row.camp_id, row.camp_title)
    for (const row of memberRows) map.set(row.camp_id, row.camp_title)
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
  }, [summaryRows, memberRows])

  const teamOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of memberRows) {
      if (selectedCampId && row.camp_id !== selectedCampId) continue
      map.set(row.team_id, row.team_name)
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
  }, [memberRows, selectedCampId])

  const totals = useMemo(() => {
    return filteredMembers.reduce(
      (acc, row) => {
        if (row.is_participating) {
          acc.participants += 1
          acc.required += Number(row.required_amount || 0)
          acc.paid += Number(row.paid_amount || 0)
          acc.remaining += Number(row.remaining_amount || 0)
        } else {
          acc.nonParticipants += 1
        }
        return acc
      },
      { required: 0, paid: 0, remaining: 0, participants: 0, nonParticipants: 0 }
    )
  }, [filteredMembers])

  const handlePickMember = (row: MemberRow) => {
    setSelectedCampMemberId(row.camp_member_id)
    setPaymentAmount('')
    setPaymentDate(todayISO())
    setPaymentMethod('cash')
    setPaymentNotes('')
    setPaymentError(null)
    setPaymentSuccessMsg(null)
  }

  const handleToggleParticipation = async (row: MemberRow, nextValue: boolean) => {
    setTogglingId(row.camp_member_id)
    setError(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase.rpc('set_camp_member_participation', {
        p_camp_member_id: row.camp_member_id,
        p_is_participating: nextValue,
      })

      if (error) throw error

      setSuccessMsg(nextValue ? 'تم اعتبار العضو مشاركًا' : 'تم استبعاد العضو من المعسكر')
      void safeWriteAuditLog({
        action: nextValue ? 'set_participating' : 'set_not_participating',
        module: 'camp_installments',
        entityType: 'camp_member',
        entityId: row.camp_member_id,
        entityDisplay: row.member_name,
        summary: `${nextValue ? 'فعّل' : 'أوقف'} مشاركة ${row.member_name} في معسكر ${row.camp_title}`,
        severity: 'warning',
        source: 'MyCampCollections',
        scoutYearId: (row as any).scout_year_id ?? null,
        teamId: row.team_id,
        targetMemberId: row.member_id,
        delta: {
          before: { is_participating: row.is_participating },
          after: { is_participating: nextValue },
          changed_fields: ['is_participating'],
          context: { camp_id: row.camp_id, camp_title: row.camp_title },
        },
      })
      await loadAll()
    } catch (e: any) {
      setError(e?.message || 'تعذر تحديث حالة المشاركة')
    } finally {
      setTogglingId(null)
    }
  }

  const handleAddPayment = async () => {
    if (!selectedMember) {
      setPaymentError('اختر الاسم أولًا')
      setPaymentSuccessMsg(null)
      paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    setPaymentError(null)
    setPaymentSuccessMsg(null)

    try {
      const amount = Number(paymentAmount || 0)
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('قيمة الدفعة يجب أن تكون أكبر من صفر')
      }

      if (!selectedMember.is_participating) {
        throw new Error('هذا العضو غير مشارك في المعسكر')
      }

      if (selectedMember.payment_status === 'cancelled') {
        throw new Error('هذا العضو ملغي')
      }

      if (amount > Number(selectedMember.remaining_amount || 0)) {
        throw new Error('قيمة الدفعة أكبر من المبلغ المتبقي')
      }

      const insertPayload = {
        camp_member_id: selectedMember.camp_member_id,
        camp_id: selectedMember.camp_id,
        team_id: selectedMember.team_id,
        member_id: selectedMember.member_id,
        amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        notes: paymentNotes.trim() || null,
      }

      const { data, error } = await supabase
        .from('camp_installment_payments')
        .insert(insertPayload)
        .select('*')
        .single()

      if (error) throw error

      const nextPaidAmount = Number(selectedMember.paid_amount || 0) + amount
      const nextRemainingAmount = Math.max(Number(selectedMember.required_amount || 0) - nextPaidAmount, 0)

      const nextMemberRow: MemberRow = normalizeMemberRow({
        ...selectedMember,
        paid_amount: nextPaidAmount,
        remaining_amount: nextRemainingAmount,
        payment_status: derivePaymentStatus({
          is_participating: selectedMember.is_participating,
          required_amount: Number(selectedMember.required_amount || 0),
          paid_amount: nextPaidAmount,
          remaining_amount: nextRemainingAmount,
          payment_status: selectedMember.payment_status,
        }),
        updated_at: new Date().toISOString(),
      })

      setMemberRows((prev) =>
        prev.map((row) => (row.camp_member_id === selectedMember.camp_member_id ? nextMemberRow : row))
      )

      const newPaymentRow: PaymentRow = {
        id: data?.id || crypto.randomUUID(),
        camp_member_id: selectedMember.camp_member_id,
        camp_id: selectedMember.camp_id,
        camp_title: selectedMember.camp_title,
        team_id: selectedMember.team_id,
        team_name: selectedMember.team_name,
        member_id: selectedMember.member_id,
        member_name: selectedMember.member_name,
        amount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        notes: paymentNotes.trim() || null,
        created_at: data?.created_at || new Date().toISOString(),
      }

      setPaymentRows((prev) => [newPaymentRow, ...prev].slice(0, 50))
      setSelectedCampMemberId(selectedMember.camp_member_id)
      setPaymentSuccessMsg('تم تسجيل الدفعة بنجاح')
      setPaymentError(null)

      void safeWriteAuditLog({
        action: 'add_payment',
        module: 'camp_payments',
        entityType: 'camp_installment_payment',
        entityId: newPaymentRow.id,
        entityDisplay: `${selectedMember.member_name} — ${selectedMember.camp_title}` ,
        summary: `سجّل دفعة بقيمة ${amount} للعضو ${selectedMember.member_name} في معسكر ${selectedMember.camp_title}` ,
        severity: 'info',
        source: 'MyCampCollections',
        scoutYearId: (selectedMember as any).scout_year_id ?? null,
        teamId: selectedMember.team_id,
        targetMemberId: selectedMember.member_id,
        before: {
          paid_amount: selectedMember.paid_amount,
          remaining_amount: selectedMember.remaining_amount,
        },
        after: {
          amount,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          notes: paymentNotes.trim() || null,
          paid_amount: nextPaidAmount,
          remaining_amount: nextRemainingAmount,
        },
        changedFields: ['amount', 'payment_date', 'payment_method', 'notes', 'paid_amount', 'remaining_amount'],
        context: {
          camp_id: selectedMember.camp_id,
          camp_title: selectedMember.camp_title,
          required_amount: selectedMember.required_amount,
          member_name: selectedMember.member_name,
        },
      })
      setPaymentAmount('')
      setPaymentNotes('')

      paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      paymentAmountInputRef.current?.focus()
    } catch (e: any) {
      setPaymentError(e?.message || 'تعذر تسجيل الدفعة')
      setPaymentSuccessMsg(null)
      paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          جاري تحميل صفحة التحصيل...
        </div>
      </div>
    )
  }

  return (
    <div className="camp100-page camp100-my-collections space-y-5 p-4 md:p-6">
      <PageHero
        className="camp100-hero"
        eyebrow="لوحة مسؤول التحصيل"
        title="تحصيل المعسكرات"
        description="تابع الفرق والمعسكرات المسندة إليك، واختر العضو المناسب ثم سجّل الدفعة من نفس الشاشة بشكل أوضح وأسرع."
      />

      {error && (
        <InlineAlert tone="error" title="تعذر تحميل بيانات التحصيل">
          {error}
        </InlineAlert>
      )}

      {successMsg && (
        <InlineAlert tone="success" title="تم تنفيذ العملية">
          {successMsg}
        </InlineAlert>
      )}

      <div className="camp100-metrics grid grid-cols-2 gap-3 md:grid-cols-6">
        <MetricCard label="المعسكرات" value={campOptions.length} accent="navy" />
        <MetricCard label="الفرق الظاهرة" value={grouped.length} accent="orange" />
        <MetricCard label="المشاركون" value={totals.participants} accent="emerald" />
        <MetricCard label="غير المشاركين" value={totals.nonParticipants} accent="gold" />
        <MetricCard label="إجمالي المدفوع" value={fmtMoney(totals.paid)} accent="emerald" />
        <MetricCard label="إجمالي المتبقي" value={fmtMoney(totals.remaining)} accent="rose" />
      </div>

      <SectionCard title="البحث والفلاتر">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">بحث</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الفريق أو المعسكر"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">المعسكر</label>
            <select
              value={selectedCampId}
              onChange={(e) => {
                setSelectedCampId(e.target.value)
                setSelectedTeamId('')
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="">كل المعسكرات</option>
              {campOptions.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الفريق</label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="">كل الفرق</option>
              {teamOptions.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">حالة الاشتراك</label>
            <select
              value={participationFilter}
              onChange={(e) => setParticipationFilter(e.target.value as ParticipationFilter)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="all">الكل</option>
              <option value="participating">مشترك / مشارك</option>
              <option value="not_participating">غير مشترك / غير مشارك</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex w-full items-center justify-between rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <span>إظهار الملغيين</span>
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(e) => setShowCancelled(e.target.checked)}
              />
            </label>
          </div>
        </div>
      </SectionCard>

      <div ref={paymentSectionRef}>
        <SectionCard title="تسجيل دفعة">
          {paymentError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {paymentError}
            </div>
          )}

          {paymentSuccessMsg && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700">
              {paymentSuccessMsg}
            </div>
          )}

          {selectedMember ? (
            <>
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                الاسم: <span className="font-semibold">{selectedMember.member_name}</span>
                {' • '} النوع:{' '}
                <span className="font-semibold">
                  {participantRoleLabel(resolveParticipantRole(selectedMember))}
                </span>
                {' • '} الفريق: <span className="font-semibold">{selectedMember.team_name}</span>
                {' • '} المعسكر: <span className="font-semibold">{selectedMember.camp_title}</span>
                {' • '} السعر الأساسي: <span className="font-semibold">{fmtMoney(selectedMember.base_amount)}</span>
                {' • '} الخصم: <span className="font-semibold">{fmtMoney(selectedMember.discount_amount)}</span>
                {' • '} المطلوب: <span className="font-semibold">{fmtMoney(selectedMember.required_amount)}</span>
                {' • '} المدفوع: <span className="font-semibold">{fmtMoney(selectedMember.paid_amount)}</span>
                {' • '} المتبقي: <span className="font-semibold">{fmtMoney(selectedMember.remaining_amount)}</span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">المبلغ</label>
                  <input
                    ref={paymentAmountInputRef}
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
                    <option value="cash">كاش</option>
                    <option value="vodafone_cash">فودافون كاش</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleAddPayment}
                    disabled={saving}
                    className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {saving ? 'جارٍ الحفظ...' : 'تسجيل الدفعة'}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">ملاحظات</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">
              ابحث عن الاسم ثم اضغط "تسجيل دفعة" من القائمة بالأسفل
            </div>
          )}
        </SectionCard>
      </div>

      {grouped.length === 0 ? (
        <EmptyState title="لا توجد فرق مطابقة للفلاتر الحالية" description="جرّب تغيير الفلاتر أو تأكد أن الأدمن أضاف فريقك للمعسكر أو اختارك كمسؤول تحصيل." />
      ) : (
        grouped.map((group, idx) => {
          const summary = group.summary
          return (
            <SectionCard
              key={`${summary.camp_id}-${summary.team_id}-${idx}`}
              title={`${summary.camp_title} — ${summary.team_name}`}
              extra={
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={campStatusLabel(summary.camp_status)} tone={campStatusTone(summary.camp_status)} />
                  <StatusPill label={`${Number(summary.collection_percentage || 0).toFixed(1)}%`} tone="blue" />
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                <MiniInfo label="المسؤول" value={summary.collector_name} />
                <MiniInfo label="المشاركون" value={summary.members_count} />
                <MiniInfo label="غير المشاركين" value={summary.non_participants_count} />
                <MiniInfo label="Equipiers" value={summary.equipiers_count} />
                <MiniInfo label="Chefs" value={summary.chefs_count} />
                <MiniInfo label="المتبقي" value={fmtMoney(summary.total_remaining)} />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <MemberBucket
                  title="Equipiers"
                  rows={group.equipiers}
                  onPick={handlePickMember}
                  onToggle={handleToggleParticipation}
                  togglingId={togglingId}
                />
                <MemberBucket
                  title="Chefs"
                  rows={group.chefs}
                  onPick={handlePickMember}
                  onToggle={handleToggleParticipation}
                  togglingId={togglingId}
                />
              </div>
            </SectionCard>
          )
        })
      )}

      <SectionCard title="آخر الدفعات">
        {paymentRows.length === 0 ? (
          <div className="text-sm text-slate-500">لا توجد دفعات مسجلة بعد.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-2 text-right">التاريخ</th>
                  <th className="px-3 py-2 text-right">العضو</th>
                  <th className="px-3 py-2 text-right">الفريق</th>
                  <th className="px-3 py-2 text-right">المعسكر</th>
                  <th className="px-3 py-2 text-right">المبلغ</th>
                  <th className="px-3 py-2 text-right">الطريقة</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-3">{fmtDate(row.payment_date)}</td>
                    <td className="px-3 py-3 font-medium text-slate-800">{row.member_name}</td>
                    <td className="px-3 py-3">{row.team_name}</td>
                    <td className="px-3 py-3">{row.camp_title}</td>
                    <td className="px-3 py-3">{fmtMoney(row.amount)}</td>
                    <td className="px-3 py-3">{paymentMethodLabel(row.payment_method)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="text-xs text-slate-400">
        المستخدم الحالي: {user?.name || user?.email || '-'}
      </div>
    </div>
  )
}

function MemberBucket({
  title,
  rows,
  onPick,
  onToggle,
  togglingId,
}: {
  title: string
  rows: MemberRow[]
  onPick: (row: MemberRow) => void
  onToggle: (row: MemberRow, nextValue: boolean) => void
  togglingId: string | null
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3 text-lg font-bold text-slate-800">{title}</div>

      {rows.length === 0 ? (
        <div className="text-sm text-slate-500">لا توجد أسماء في هذا القسم</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const rowClass =
              row.payment_status === 'paid'
                ? 'bg-green-50'
                : row.payment_status === 'unpaid'
                ? 'bg-amber-50'
                : row.payment_status === 'cancelled'
                ? 'bg-slate-100'
                : row.payment_status === 'not_participating'
                ? 'bg-slate-50'
                : row.payment_status === 'partial'
                ? 'bg-blue-50'
                : 'bg-white'

            return (
              <div key={row.camp_member_id} className={`rounded-xl border border-slate-200 p-3 ${rowClass}`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{row.member_name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      النوع: {participantRoleLabel(resolveParticipantRole(row))} | السعر الأساسي: {fmtMoney(row.base_amount)} | الخصم:{' '}
                      {fmtMoney(row.discount_amount)} | المطلوب: {fmtMoney(row.required_amount)} | المدفوع:{' '}
                      {fmtMoney(row.paid_amount)} | المتبقي: {fmtMoney(row.remaining_amount)}
                    </div>
                    {row.notes && (
                      <div className="mt-1 text-xs text-slate-400">
                        ملاحظات: {row.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusPill
                      label={row.is_participating ? 'مشارك' : 'غير مشارك'}
                      tone={row.is_participating ? 'green' : 'slate'}
                    />
                    <StatusPill
                      label={paymentStatusLabel(row.payment_status)}
                      tone={paymentStatusTone(row.payment_status)}
                    />

                    <button
                      type="button"
                      onClick={() => onToggle(row, !row.is_participating)}
                      disabled={togglingId === row.camp_member_id}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-60"
                    >
                      {togglingId === row.camp_member_id
                        ? '...'
                        : row.is_participating
                        ? 'إلغاء مشاركة'
                        : 'جعله مشارك'}
                    </button>

                    {row.is_participating && row.payment_status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => onPick(row)}
                        className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        تسجيل دفعة
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
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
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="camp100-local-stat rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-800">{value}</div>
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
