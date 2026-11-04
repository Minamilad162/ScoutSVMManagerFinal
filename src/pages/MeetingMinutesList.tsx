import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { EmptyState } from '../components/ui/EmptyState'
import { InlineAlert } from '../components/ui/InlineAlert'
import { useCurrentScoutYear } from '../hooks/useCurrentScoutYear'

type RoleRow = { role_slug: string; team_id?: string | null }

type MeetingMinuteSummaryRow = {
  id: string
  meeting_date: string
  title: string | null
  attendees_count: number | null
  tasks_count: number | null
  pending_count: number | null
  in_progress_count: number | null
  done_count: number | null
  cancelled_count: number | null
  overdue_count: number | null
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

export default function MeetingMinutesList() {
  const navigate = useNavigate()
  const { roles, user } = useAuth() as {
    roles: RoleRow[]
    user: { id?: string; name?: string; email?: string } | null
  }

  const [rows, setRows] = useState<MeetingMinuteSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [query, setQuery] = useState('')
  const { currentScoutYear } = useCurrentScoutYear()

  const hasRole = useCallback(
    (slug: string) => (roles || []).some((r) => r.role_slug === slug),
    [roles]
  )

  const canAccess = useMemo(
    () => hasRole('admin') || hasRole('chef_de_legion'),
    [hasRole]
  )

  const canCreate = canAccess

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
        .from('meeting_minutes_summary')
        .select('*')
        .order('meeting_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (currentScoutYear?.start_date) req = req.gte('meeting_date', currentScoutYear.start_date)
      if (currentScoutYear?.end_date) req = req.lte('meeting_date', currentScoutYear.end_date)

      if (fromDate) req = req.gte('meeting_date', fromDate)
      if (toDate) req = req.lte('meeting_date', toDate)

      if (query.trim()) {
        req = req.ilike('title', `%${query.trim()}%`)
      }

      const { data, error } = await req
      if (error) throw error

      setRows((data || []) as MeetingMinuteSummaryRow[])
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء تحميل المحاضر')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [canAccess, currentScoutYear?.end_date, currentScoutYear?.start_date, fromDate, toDate, query])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.minutes += 1
        acc.tasks += Number(row.tasks_count || 0)
        acc.pending += Number(row.pending_count || 0)
        acc.inProgress += Number(row.in_progress_count || 0)
        acc.done += Number(row.done_count || 0)
        acc.overdue += Number(row.overdue_count || 0)
        return acc
      },
      {
        minutes: 0,
        tasks: 0,
        pending: 0,
        inProgress: 0,
        done: 0,
        overdue: 0,
      }
    )
  }, [rows])

  if (!canAccess) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
          <div className="text-lg font-bold mb-2">غير مسموح</div>
          <p className="text-sm">
            هذه الصفحة متاحة فقط لـ Admin و Chef de Legion.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHero
        eyebrow="سجل الاجتماعات والمتابعة"
        title="المحاضر"
        description={`اعرض محاضر السنة الكشفية الحالية${currentScoutYear ? ` (${currentScoutYear.name})` : ''}، تابع تنفيذ التاسكات المرتبطة بها، وراجع حالة الإنجاز من مكان واحد بشكل أوضح وأسرع. الفلاتر الزمنية اختيارية، ولو تركتها فارغة سيظهر لك كل ما يخص السنة الحالية.`}
        actions={
          <>
            <button
              type="button"
              onClick={loadData}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              تحديث
            </button>

            {canCreate && (
              <button
                type="button"
                onClick={() => navigate('/app/meeting-minutes/new')}
                className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                + إضافة محضر
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="عدد المحاضر" value={totals.minutes} />
        <StatCard label="إجمالي التاسكات" value={totals.tasks} />
        <StatCard label="لم يبدأ" value={totals.pending} />
        <StatCard label="جارٍ التنفيذ" value={totals.inProgress} />
        <StatCard label="تم" value={totals.done} />
        <StatCard label="متأخر" value={totals.overdue} danger={totals.overdue > 0} />
      </div>

      <SectionCard title="الفلاتر" description="حدّد الفترة أو ابحث بعنوان المحضر للوصول للبيانات بسرعة. لو تركت التاريخين فارغين سيظهر كل ما يخص السنة الحالية.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              من تاريخ
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
              إلى تاريخ
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              بحث بالعنوان
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="مثلاً: اجتماع قادة"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={loadData}
              className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              تطبيق الفلترة
            </button>

            <button
              type="button"
              onClick={() => {
                setFromDate('')
                setToDate('')
                setQuery('')
              }}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              مسح
            </button>
          </div>
        </div>
      </SectionCard>

      {error && (
        <InlineAlert tone="error" title="تعذر تحميل المحاضر">
          {error}
        </InlineAlert>
      )}

      {loading ? (
        <EmptyState title="جاري تحميل المحاضر..." description="لحظات وسيتم عرض المحاضر والتاسكات المرتبطة بها." />
      ) : rows.length === 0 ? (
        <EmptyState
          title="لا توجد محاضر في الفترة المحددة"
          description="جرّب تعديل التاريخ أو أضف محضرًا جديدًا لبدء المتابعة."
          action={
            canCreate ? (
              <button
                type="button"
                onClick={() => navigate('/app/meeting-minutes/new')}
                className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                + إضافة أول محضر
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-lg font-bold text-slate-800">
                    {row.title?.trim() || 'محضر بدون عنوان'}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    تاريخ الاجتماع: {fmtDate(row.meeting_date)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusPill label={`الحضور ${row.attendees_count || 0}`} />
                  <StatusPill label={`التاسكات ${row.tasks_count || 0}`} />
                  <StatusPill label={`تم ${row.done_count || 0}`} tone="green" />
                  <StatusPill label={`لم يبدأ ${row.pending_count || 0}`} tone="yellow" />
                  <StatusPill
                    label={`متأخر ${row.overdue_count || 0}`}
                    tone={(row.overdue_count || 0) > 0 ? 'red' : 'slate'}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <MiniInfo label="جارٍ التنفيذ" value={row.in_progress_count || 0} />
                <MiniInfo label="ملغي" value={row.cancelled_count || 0} />
                <MiniInfo label="تاريخ الإنشاء" value={fmtDate(row.created_at)} />
                <MiniInfo label="آخر تعديل" value={fmtDate(row.updated_at)} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={`/app/meeting-minutes/${row.id}`}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  فتح المحضر
                </Link>

                <Link
                  to={`/app/meeting-tasks?minuteId=${row.id}`}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  متابعة التاسكات
                </Link>
              </div>
            </div>
          ))}
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
  value: number
  danger?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        danger
          ? 'border-red-200 bg-red-50'
          : 'border-slate-200 bg-white'
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
  tone?: 'slate' | 'green' | 'yellow' | 'red'
}) {
  const cls =
    tone === 'green'
      ? 'bg-green-100 text-green-700 border-green-200'
      : tone === 'yellow'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : tone === 'red'
      ? 'bg-red-100 text-red-700 border-red-200'
      : 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}