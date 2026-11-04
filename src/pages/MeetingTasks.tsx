import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { EmptyState } from '../components/ui/EmptyState'
import { InlineAlert } from '../components/ui/InlineAlert'
import { useCurrentScoutYear } from '../hooks/useCurrentScoutYear'

type RoleRow = { role_slug: string; team_id?: string | null }

type MinuteOption = {
  id: string
  meeting_date: string
  title: string | null
}

type MeetingInfo = {
  id: string
  meeting_date: string
  title: string | null
}

type TaskRow = {
  id: string
  minute_id: string
  task_text: string
  owner_name: string
  due_date: string
  status: 'pending' | 'in_progress' | 'done' | 'cancelled'
  sort_order: number
  completed_at?: string | null
  status_updated_at?: string | null
  created_at?: string
  updated_at?: string
  meeting_minutes?: MeetingInfo | MeetingInfo[] | null
}

const STATUS_OPTIONS = [
  { value: '', label: 'كل الحالات' },
  { value: 'pending', label: 'لم يبدأ' },
  { value: 'in_progress', label: 'جارٍ التنفيذ' },
  { value: 'done', label: 'تم' },
  { value: 'cancelled', label: 'ملغي' },
] as const

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function startOfMonthISO() {
  const d = new Date()
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  return x.toISOString().slice(0, 10)
}

function endOfMonthISO() {
  const d = new Date()
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return x.toISOString().slice(0, 10)
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

function statusLabel(status: TaskRow['status']) {
  if (status === 'pending') return 'لم يبدأ'
  if (status === 'in_progress') return 'جارٍ التنفيذ'
  if (status === 'done') return 'تم'
  if (status === 'cancelled') return 'ملغي'
  return status
}

function toneFromStatus(status: TaskRow['status']): 'slate' | 'green' | 'yellow' | 'red' | 'blue' {
  if (status === 'done') return 'green'
  if (status === 'in_progress') return 'blue'
  if (status === 'cancelled') return 'red'
  if (status === 'pending') return 'yellow'
  return 'slate'
}

function normalizeMeeting(meeting: TaskRow['meeting_minutes']): MeetingInfo | null {
  if (!meeting) return null
  if (Array.isArray(meeting)) return meeting[0] || null
  return meeting
}

export default function MeetingTasks() {
  const { roles } = useAuth() as {
    roles: RoleRow[]
    user: { id?: string; name?: string; email?: string } | null
  }

  const [searchParams, setSearchParams] = useSearchParams()

  const [rows, setRows] = useState<TaskRow[]>([])
  const [minuteOptions, setMinuteOptions] = useState<MinuteOption[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [minuteId, setMinuteId] = useState(searchParams.get('minuteId') || '')
  const [statusFilter, setStatusFilter] = useState('')
  const [ownerQuery, setOwnerQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)

  const hasRole = useCallback(
    (slug: string) => (roles || []).some((r) => r.role_slug === slug),
    [roles]
  )

  const isAdmin = useMemo(() => hasRole('admin'), [hasRole])
  const canAccess = useMemo(
    () => isAdmin || hasRole('chef_de_legion'),
    [hasRole, isAdmin]
  )
  const { currentScoutYear } = useCurrentScoutYear()

  const loadMinuteOptions = useCallback(async () => {
    if (!canAccess) return

    const { data, error } = await supabase
      .from('meeting_minutes')
      .select('id, meeting_date, title')
      .gte('meeting_date', currentScoutYear?.start_date ?? '1900-01-01')
      .lte('meeting_date', currentScoutYear?.end_date ?? '2999-12-31')
      .order('meeting_date', { ascending: false })
      .limit(200)

    if (!error) {
      setMinuteOptions((data || []) as MinuteOption[])
    }
  }, [canAccess, currentScoutYear?.end_date, currentScoutYear?.start_date])

  const loadData = useCallback(async () => {
    if (!canAccess) {
      setRows([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      let req = supabase
        .from('meeting_minute_tasks')
        .select(`
          id,
          minute_id,
          task_text,
          owner_name,
          due_date,
          status,
          sort_order,
          completed_at,
          status_updated_at,
          created_at,
          updated_at,
          meeting_minutes!inner (
            id,
            meeting_date,
            title
          )
        `)
        .gte('meeting_minutes.meeting_date', currentScoutYear?.start_date ?? '1900-01-01')
        .lte('meeting_minutes.meeting_date', currentScoutYear?.end_date ?? '2999-12-31')
        .order('due_date', { ascending: true })
        .order('sort_order', { ascending: true })

      if (minuteId) req = req.eq('minute_id', minuteId)
      if (statusFilter) req = req.eq('status', statusFilter)
      if (ownerQuery.trim()) req = req.ilike('owner_name', `%${ownerQuery.trim()}%`)
      if (fromDate) req = req.gte('due_date', fromDate)
      if (toDate) req = req.lte('due_date', toDate)

      const { data, error } = await req
      if (error) throw error

      let result = (data || []) as TaskRow[]

      if (overdueOnly) {
        const now = todayISO()
        result = result.filter(
          (t) =>
            t.status !== 'done' &&
            t.status !== 'cancelled' &&
            t.due_date < now
        )
      }

      setRows(result)
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء تحميل التاسكات')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [canAccess, currentScoutYear?.end_date, currentScoutYear?.start_date, minuteId, statusFilter, ownerQuery, fromDate, toDate, overdueOnly])

  useEffect(() => {
    loadMinuteOptions()
  }, [loadMinuteOptions])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (minuteId) next.set('minuteId', minuteId)
    else next.delete('minuteId')
    setSearchParams(next, { replace: true })
  }, [minuteId, searchParams, setSearchParams])

  const handleStatusChange = async (taskId: string, newStatus: TaskRow['status']) => {
    if (!isAdmin) return

    const oldRows = rows
    setUpdatingId(taskId)

    setRows((prev) =>
      prev.map((row) =>
        row.id === taskId ? { ...row, status: newStatus } : row
      )
    )

    try {
      const { error } = await supabase
        .from('meeting_minute_tasks')
        .update({ status: newStatus })
        .eq('id', taskId)

      if (error) throw error

      await loadData()
    } catch (e: any) {
      setRows(oldRows)
      setError(e?.message || 'تعذر تحديث الحالة')
    } finally {
      setUpdatingId(null)
    }
  }

  const totals = useMemo(() => {
    const now = todayISO()
    return rows.reduce(
      (acc, row) => {
        acc.total += 1
        if (row.status === 'pending') acc.pending += 1
        if (row.status === 'in_progress') acc.inProgress += 1
        if (row.status === 'done') acc.done += 1
        if (row.status === 'cancelled') acc.cancelled += 1
        if (
          row.status !== 'done' &&
          row.status !== 'cancelled' &&
          row.due_date < now
        ) {
          acc.overdue += 1
        }
        return acc
      },
      {
        total: 0,
        pending: 0,
        inProgress: 0,
        done: 0,
        cancelled: 0,
        overdue: 0,
      }
    )
  }, [rows])

  if (!canAccess) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
          <div className="text-lg font-bold mb-2">غير مسموح</div>
          <p className="text-sm">هذه الصفحة متاحة فقط لـ Admin و Chef de Legion.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHero
        eyebrow="لوحة متابعة تنفيذية"
        title="متابعة التاسكات"
        description={`تابع كل التاسكات الخارجة من محاضر السنة الكشفية الحالية${currentScoutYear ? ` (${currentScoutYear.name})` : ''} في مكان واحد، واكشف المتأخر منها بسرعة عبر الفلاتر والتنبيهات الواضحة. فلاتر التاريخ اختيارية، ولو تركتها فارغة سيظهر لك كل ما يخص السنة الحالية.`}
        actions={
          <button
            type="button"
            onClick={loadData}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            تحديث
          </button>
        }
      />

      {currentScoutYear && (
        <InlineAlert tone="info" title="نطاق العرض الحالي">
          يتم عرض التاسكات المرتبطة بمحاضر السنة الكشفية الحالية فقط: {currentScoutYear.name}
        </InlineAlert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="إجمالي التاسكات" value={totals.total} />
        <StatCard label="لم يبدأ" value={totals.pending} />
        <StatCard label="جارٍ التنفيذ" value={totals.inProgress} />
        <StatCard label="تم" value={totals.done} />
        <StatCard label="ملغي" value={totals.cancelled} />
        <StatCard label="متأخر" value={totals.overdue} danger={totals.overdue > 0} />
      </div>

      <SectionCard title="الفلاتر" description="ضيّق النتائج حسب المحضر أو الحالة أو المسؤول أو فترة الاستحقاق.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              المحضر
            </label>
            <select
              value={minuteId}
              onChange={(e) => setMinuteId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="">كل المحاضر</option>
              {minuteOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {(m.title?.trim() || 'محضر بدون عنوان') + ' - ' + fmtDate(m.meeting_date)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              الحالة
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              المسؤول
            </label>
            <input
              type="text"
              value={ownerQuery}
              onChange={(e) => setOwnerQuery(e.target.value)}
              placeholder="ابحث باسم المسؤول"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              من تاريخ الاستحقاق
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              إلى تاريخ الاستحقاق
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-end">
            <label className="flex w-full items-center justify-between rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">
              <span>المتأخر فقط</span>
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(e) => setOverdueOnly(e.target.checked)}
              />
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadData}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            تطبيق الفلاتر
          </button>

          <button
            type="button"
            onClick={() => {
              setMinuteId('')
              setStatusFilter('')
              setOwnerQuery('')
              setFromDate(startOfMonthISO())
              setToDate(endOfMonthISO())
              setOverdueOnly(false)
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            مسح
          </button>
        </div>
      </SectionCard>

      {error && (
        <InlineAlert tone="error" title="تعذر تحميل التاسكات">
          {error}
        </InlineAlert>
      )}

      {loading ? (
        <EmptyState title="جاري تحميل التاسكات..." description="يتم الآن جمع التاسكات من المحاضر وعرض حالتها الحالية." />
      ) : rows.length === 0 ? (
        <EmptyState title="لا توجد تاسكات مطابقة للفلاتر الحالية" description="جرّب تغيير الفلاتر أو إنشاء محضر جديد وإضافة تاسكات." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-3 py-3 text-right">التاسك</th>
                <th className="px-3 py-3 text-right">المسؤول</th>
                <th className="px-3 py-3 text-right">Due Date</th>
                <th className="px-3 py-3 text-right">الحالة</th>
                <th className="px-3 py-3 text-right">المحضر</th>
                <th className="px-3 py-3 text-right">إجراءات</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const meeting = normalizeMeeting(row.meeting_minutes)
                const overdue =
                  row.status !== 'done' &&
                  row.status !== 'cancelled' &&
                  row.due_date < todayISO()

                return (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-800">{row.task_text}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {overdue && <StatusPill label="متأخر" tone="red" />}
                        {row.completed_at && (
                          <StatusPill
                            label={`اكتملت: ${fmtDate(row.completed_at)}`}
                            tone="green"
                          />
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-slate-700">{row.owner_name}</td>

                    <td className="px-3 py-3 text-slate-700">{fmtDate(row.due_date)}</td>

                    <td className="px-3 py-3">
                      {isAdmin ? (
                        <div className="space-y-1">
                          <select
                            value={row.status}
                            disabled={updatingId === row.id}
                            onChange={(e) =>
                              handleStatusChange(row.id, e.target.value as TaskRow['status'])
                            }
                            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 disabled:opacity-60"
                          >
                            {STATUS_OPTIONS.filter((x) => x.value).map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <div className="text-xs text-slate-500">
                            آخر تحديث: {fmtDate(row.status_updated_at)}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <StatusPill
                            label={statusLabel(row.status)}
                            tone={toneFromStatus(row.status)}
                          />
                          <div className="text-xs text-slate-500">
                            آخر تحديث: {fmtDate(row.status_updated_at)}
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-800">
                        {meeting?.title?.trim() || 'محضر بدون عنوان'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {fmtDate(meeting?.meeting_date)}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/app/meeting-minutes/${row.minute_id}`}
                          className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          فتح المحضر
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  danger = false,
}: {
  label: string
  value: number
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
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}