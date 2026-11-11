import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { PageHero } from '../components/ui/PageHero'
import { MetricCard } from '../components/ui/MetricCard'
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
    <div className="minutes125-page space-y-5 p-4 md:p-6">
      <PageHero
        className="minutes125-hero"
        eyebrow="سجل الاجتماعات والمتابعة"
        title="محاضر الاجتماعات"
        description={`محاضر السنة الكشفية${currentScoutYear ? ` ${currentScoutYear.name}` : ''}، مع الحضور والتاسكات وحالة التنفيذ في شاشة واحدة. فتح المحضر ومتابعة التاسكات يستمران بنفس الـworkflow الحالي.`}
        actions={<><button type="button" onClick={loadData} className="minutes125-secondary">↻ تحديث</button>{canCreate&&<button type="button" onClick={()=>navigate('/app/meeting-minutes/new')} className="minutes125-primary">+ إضافة محضر جديد</button>}</>}
      />

      <div className="minutes125-kpis grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="إجمالي المحاضر" value={totals.minutes} hint="في النطاق الحالي" accent="sky" />
        <MetricCard label="إجمالي التاسكات" value={totals.tasks} hint={`${totals.inProgress} جارٍ التنفيذ`} accent="indigo" />
        <MetricCard label="تم التنفيذ" value={totals.done} hint="تاسكات مكتملة" accent="emerald" />
        <MetricCard label="متأخر" value={totals.overdue} hint={totals.overdue>0?'يحتاج متابعة':'لا توجد تأخيرات'} accent={totals.overdue>0?'rose':'amber'} />
      </div>

      <SectionCard className="minutes125-filter-card" title="البحث والفلاتر" description="اترك التاريخ فارغًا لعرض كل محاضر السنة الحالية، أو ضيّق النتائج بعنوان المحضر وفترة محددة.">
        <div className="minutes125-filters">
          <label><span>بحث بالعنوان</span><input type="text" value={query} onChange={e=>setQuery(e.target.value)} placeholder="مثلاً: اجتماع قادة" /></label>
          <label><span>من تاريخ</span><input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} /></label>
          <label><span>إلى تاريخ</span><input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} /></label>
          <div className="minutes125-filter-actions"><button type="button" onClick={loadData} className="minutes125-primary">تطبيق الفلترة</button><button type="button" onClick={()=>{setFromDate('');setToDate('');setQuery('')}} className="minutes125-secondary">مسح</button></div>
        </div>
      </SectionCard>

      {error && <InlineAlert tone="error" title="تعذر تحميل المحاضر">{error}</InlineAlert>}

      {loading ? (
        <EmptyState title="جاري تحميل المحاضر..." description="لحظات وسيتم عرض المحاضر والتاسكات المرتبطة بها." />
      ) : rows.length===0 ? (
        <EmptyState title="لا توجد محاضر في الفترة المحددة" description="جرّب تعديل التاريخ أو أضف محضرًا جديدًا لبدء المتابعة." action={canCreate?<button type="button" onClick={()=>navigate('/app/meeting-minutes/new')} className="minutes125-primary">+ إضافة أول محضر</button>:undefined} />
      ) : (
        <SectionCard className="minutes125-table-card" title={`قائمة المحاضر — ${rows.length}`} description="اضغط فتح المحضر للمراجعة والتعديل، أو انتقل مباشرة إلى متابعة التاسكات المرتبطة به.">
          <div className="minutes125-table-wrap">
            <table className="minutes125-table min-w-[1050px]">
              <thead><tr><th>موضوع الاجتماع</th><th>تاريخ الاجتماع</th><th>الحضور</th><th>التاسكات</th><th>لم يبدأ</th><th>جارٍ</th><th>تم</th><th>متأخر</th><th>آخر تعديل</th><th>الإجراءات</th></tr></thead>
              <tbody>{rows.map(row=><tr key={row.id} className={(row.overdue_count||0)>0?'has-overdue':''}>
                <td><div className="minutes125-title"><span>☷</span><strong>{row.title?.trim()||'محضر بدون عنوان'}</strong></div></td>
                <td>{fmtDate(row.meeting_date)}</td><td><StatusPill label={String(row.attendees_count||0)} /></td><td><StatusPill label={String(row.tasks_count||0)} /></td><td><StatusPill label={String(row.pending_count||0)} tone="yellow" /></td><td><StatusPill label={String(row.in_progress_count||0)} /></td><td><StatusPill label={String(row.done_count||0)} tone="green" /></td><td><StatusPill label={String(row.overdue_count||0)} tone={(row.overdue_count||0)>0?'red':'slate'} /></td><td>{fmtDate(row.updated_at)}</td>
                <td><div className="minutes125-actions"><Link to={`/app/meeting-minutes/${row.id}`}>فتح المحضر</Link><Link className="secondary" to={`/app/meeting-tasks?minuteId=${row.id}`}>التاسكات</Link></div></td>
              </tr>)}</tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <div className="minutes125-user">المستخدم الحالي: {user?.name||user?.email||'-'}</div>
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