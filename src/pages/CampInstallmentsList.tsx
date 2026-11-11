import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { useScoutYear } from '../components/ScoutYearProvider'
import { getScoutYearBounds } from '../lib/scoutYearScope'
import { EmptyState } from '../components/ui/EmptyState'
import { InlineAlert } from '../components/ui/InlineAlert'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { fetchCurrentScoutYearId } from '../features/reference/api'

type RoleRow = {
  role_slug: string
  team_id?: string | null
}

type CampInstallmentSummaryRow = {
  id: string
  title: string
  description: string | null
  base_amount: number
  equipier_price?: number | null
  chef_price?: number | null
  start_date: string | null
  due_date: string | null
  status: 'draft' | 'open' | 'closed' | 'cancelled'
  teams_count: number | null
  members_count: number | null
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

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function statusLabel(status: CampInstallmentSummaryRow['status']) {
  if (status === 'draft') return 'مسودة'
  if (status === 'open') return 'مفتوح'
  if (status === 'closed') return 'مغلق'
  if (status === 'cancelled') return 'ملغي'
  return status
}

function statusTone(status: CampInstallmentSummaryRow['status']): 'slate' | 'green' | 'yellow' | 'red' | 'blue' {
  if (status === 'open') return 'green'
  if (status === 'draft') return 'yellow'
  if (status === 'closed') return 'blue'
  if (status === 'cancelled') return 'red'
  return 'slate'
}

export default function CampInstallmentsList() {
  const navigate = useNavigate()
  const { roles, user } = useAuth() as {
    roles: RoleRow[]
    user: { id?: string; name?: string; email?: string } | null
  }
  const { currentScoutYear } = useScoutYear()

  const [rows, setRows] = useState<CampInstallmentSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const yearBounds = getScoutYearBounds(currentScoutYear)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    setFromDate(yearBounds?.start || '')
    setToDate(yearBounds?.end || '')
  }, [currentScoutYear?.id, currentScoutYear?.start_date, currentScoutYear?.end_date])

  const hasRole = useCallback(
    (slug: string) => (roles || []).some((r) => r.role_slug === slug),
    [roles]
  )

  const isAdmin = useMemo(() => hasRole('admin'), [hasRole])
  const canAccess = useMemo(
    () => isAdmin || hasRole('chef_de_legion'),
    [hasRole, isAdmin]
  )

  const loadData = useCallback(async () => {
    if (!canAccess) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const currentScoutYearId = await fetchCurrentScoutYearId()
      if (!currentScoutYearId || !yearBounds) {
        setRows([])
        return
      }

      let pricingReq = supabase
        .from('camp_installments')
        .select('id, base_amount, equipier_price, chef_price, title, status, created_at')
        .eq('scout_year_id', currentScoutYearId)
        .order('created_at', { ascending: false }) as any

      if (statusFilter) pricingReq = pricingReq.eq('status', statusFilter)
      if (query.trim()) pricingReq = pricingReq.ilike('title', `%${query.trim()}%`)
      pricingReq = pricingReq.gte('created_at', `${fromDate && fromDate > yearBounds.start ? fromDate : yearBounds.start}T00:00:00`)
      pricingReq = pricingReq.lte('created_at', `${toDate && toDate < yearBounds.end ? toDate : yearBounds.end}T23:59:59`)

      const { data: pricingRows, error: pricingError } = await pricingReq
      if (pricingError) throw pricingError

      const campIds = ((pricingRows || []) as Array<{ id: string }>).map((row) => row.id)
      if (!campIds.length) {
        setRows([])
        return
      }

      const { data, error } = await supabase
        .from('camp_installments_summary')
        .select('*')
        .in('id', campIds)
        .order('created_at', { ascending: false })
      if (error) throw error

      const summaryRows = (data || []) as CampInstallmentSummaryRow[]

      const pricingMap = new Map(
        ((pricingRows || []) as Array<{ id: string; base_amount: number; equipier_price?: number | null; chef_price?: number | null }>).map((row) => [row.id, row])
      )

      setRows(
        summaryRows.map((row) => ({
          ...row,
          ...(pricingMap.get(row.id) || {}),
        }))
      )
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء تحميل المعسكرات')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [canAccess, statusFilter, query, fromDate, toDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.camps += 1
        acc.teams += Number(row.teams_count || 0)
        acc.members += Number(row.members_count || 0)
        acc.required += Number(row.total_required || 0)
        acc.paid += Number(row.total_paid || 0)
        acc.remaining += Number(row.total_remaining || 0)
        return acc
      },
      {
        camps: 0,
        teams: 0,
        members: 0,
        required: 0,
        paid: 0,
        remaining: 0,
      }
    )
  }, [rows])

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

  return (
    <div className="camp100-page camp100-installments-list space-y-6 p-4 md:p-6">
      <PageHero
        className="camp100-hero"
        eyebrow="🏕️ التحصيل والمعسكرات"
        title="إدارة المعسكرات والتقسيط"
        badge={
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            {currentScoutYear?.name || 'السنة غير محددة'}
          </span>
        }
        description="متابعة المعسكرات والمبالغ المطلوبة والمدفوعة ونسب التحصيل داخل السنة الحالية بشكل أوضح وأسهل في القراءة."
        actions={
          <>
            <button
              type="button"
              onClick={loadData}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              تحديث البيانات
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/app/camp-installments/new')}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
              >
                + إضافة معسكر
              </button>
            )}
          </>
        }
      />

      <div className="camp100-metrics grid grid-cols-2 gap-3 md:grid-cols-6">
        <MetricCard label="عدد المعسكرات" value={totals.camps} accent="navy" />
        <MetricCard label="عدد الفرق" value={totals.teams} accent="orange" />
        <MetricCard label="عدد الأعضاء" value={totals.members} accent="gold" />
        <MetricCard label="إجمالي المطلوب" value={fmtMoney(totals.required)} accent="amber" />
        <MetricCard label="إجمالي المدفوع" value={fmtMoney(totals.paid)} accent="sky" />
        <MetricCard label="إجمالي المتبقي" value={fmtMoney(totals.remaining)} accent={totals.remaining > 0 ? 'rose' : 'emerald'} />
      </div>

      <SectionCard className="camp100-filter-card" title="فلاتر العرض" description="تحكم في المعسكرات الظاهرة بسرعة حسب الاسم والحالة وفترة الإنشاء.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              بحث بالاسم
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="مثلاً: معسكر الصيف"
              className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              الحالة
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
            >
              <option value="">كل الحالات</option>
              <option value="draft">مسودة</option>
              <option value="open">مفتوح</option>
              <option value="closed">مغلق</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              من تاريخ الإنشاء
            </label>
            <input
              type="date"
              min={yearBounds?.start}
              max={yearBounds?.end}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              إلى تاريخ الإنشاء
            </label>
            <input
              type="date"
              min={yearBounds?.start}
              max={yearBounds?.end}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadData}
            className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            تطبيق الفلاتر
          </button>

          <button
            type="button"
            onClick={() => {
              setQuery('')
              setStatusFilter('')
              setFromDate(yearBounds?.start || '')
              setToDate(yearBounds?.end || '')
            }}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
          >
            مسح الفلاتر
          </button>
        </div>
      </SectionCard>

      {error && (
        <InlineAlert tone="error" title="تعذر تحميل المعسكرات">
          {error}
        </InlineAlert>
      )}

      {loading ? (
        <SectionCard title="جاري التحميل">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
            جاري تحميل المعسكرات...
          </div>
        </SectionCard>
      ) : rows.length === 0 ? (
        <EmptyState
          title="لا توجد معسكرات مطابقة للفلاتر الحالية"
          description="جرّب تعديل الفلاتر أو أضف معسكرًا جديدًا داخل السنة الحالية."
          action={
            isAdmin ? (
              <button
                type="button"
                onClick={() => navigate('/app/camp-installments/new')}
                className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                + إضافة أول معسكر
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rows.map((row) => {
            const isLate =
              row.status === 'open' &&
              !!row.due_date &&
              row.due_date < todayISO() &&
              Number(row.total_remaining || 0) > 0

            return (
              <div
                key={row.id}
                className="camp100-installment-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-lg font-bold text-slate-800">
                      {row.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      تاريخ البدء: {fmtDate(row.start_date)} | آخر موعد: {fmtDate(row.due_date)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={statusLabel(row.status)} tone={statusTone(row.status)} />
                    {isLate && <StatusPill label="متأخر" tone="red" />}
                    <StatusPill label={`الفرق ${row.teams_count || 0}`} />
                    <StatusPill label={`الأعضاء ${row.members_count || 0}`} />
                  </div>
                </div>

                {row.description && (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    {row.description}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                  <MiniInfo label="سعر Equipier" value={fmtMoney(row.equipier_price ?? row.base_amount)} />
                  <MiniInfo label="سعر Chef" value={fmtMoney(row.chef_price ?? row.base_amount)} />
                  <MiniInfo label="إجمالي المطلوب" value={fmtMoney(row.total_required)} />
                  <MiniInfo label="إجمالي المدفوع" value={fmtMoney(row.total_paid)} />
                  <MiniInfo label="إجمالي المتبقي" value={fmtMoney(row.total_remaining)} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                  <MiniInfo label="Paid" value={row.paid_members_count || 0} />
                  <MiniInfo label="Partial" value={row.partial_members_count || 0} />
                  <MiniInfo label="Unpaid" value={row.unpaid_members_count || 0} />
                  <MiniInfo label="Exempted" value={row.exempted_members_count || 0} />
                  <MiniInfo label="نسبة التحصيل" value={`${Number(row.collection_percentage || 0).toFixed(1)}%`} />
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>نسبة التحصيل</span>
                    <span>{Number(row.collection_percentage || 0).toFixed(1)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${Math.min(Math.max(Number(row.collection_percentage || 0), 0), 100)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/app/camp-installments/${row.id}`}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    فتح المعسكر
                  </Link>

                  <Link
                    to={`/app/camp-installments/${row.id}?tab=members`}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  >
                    الأعضاء
                  </Link>

                  <Link
                    to={`/app/camp-installments/${row.id}?tab=payments`}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  >
                    الدفعات
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-xs text-slate-400">
        المستخدم الحالي: {user?.name || user?.email || '-'}
      </div>
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
      className={`rounded-2xl border p-4 shadow-sm ${
        danger ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className={`text-sm ${danger ? 'text-red-700' : 'text-slate-500'}`}>
        {label}
      </div>
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
    <div className="rounded-xl bg-slate-50 p-3">
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

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}