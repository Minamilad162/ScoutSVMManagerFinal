import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { EmptyState } from '../components/ui/EmptyState'
import { InlineAlert } from '../components/ui/InlineAlert'
import { LoadingButton } from '../components/ui/LoadingButton'
import { MetricCard } from '../components/ui/MetricCard'
import { Modal } from '../components/ui/Modal'
import { PageHero } from '../components/ui/PageHero'
import { PageLoader } from '../components/ui/PageLoader'
import { SectionCard } from '../components/ui/SectionCard'
import { useToast } from '../components/ui/Toaster'
import { listAuditLogs, type AuditLogReadableRow, type AuditSeverity } from '../features/audit/api'
import { useCurrentScoutYear } from '../hooks/useCurrentScoutYear'
import { useTeamsData } from '../hooks/useReferenceData'
import { getErrorMessage, logError } from '../lib/errors'

function fmtDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function severityTone(severity?: AuditSeverity | null): 'indigo' | 'amber' | 'rose' | 'emerald' {
  if (severity === 'critical') return 'rose'
  if (severity === 'warning') return 'amber'
  if (severity === 'info') return 'indigo'
  return 'emerald'
}

function severityLabel(severity?: AuditSeverity | null) {
  if (severity === 'critical') return 'حرج'
  if (severity === 'warning') return 'تنبيه'
  return 'معلومة'
}

function toPrettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2)
  } catch {
    return String(value ?? '')
  }
}

function getChangedFields(delta: any) {
  if (Array.isArray(delta?.changed_fields)) return delta.changed_fields as string[]
  return []
}

function extractBeforeAfter(delta: any) {
  return {
    before: delta?.before ?? null,
    after: delta?.after ?? null,
    context: delta?.context ?? null,
  }
}

const FIELD_LABELS: Record<string, string> = {
  full_name: 'الاسم',
  team_id: 'الفريق',
  team_name: 'الفريق',
  rank_id: 'الرتبة',
  rank_label: 'الرتبة',
  is_equipier: 'الصفة',
  is_active: 'الحالة',
  notes: 'ملاحظات',
  role_id: 'الدور',
  role_label: 'الدور',
  role_slug: 'الدور',
  is_participating: 'المشاركة',
  amount: 'المبلغ',
  payment_date: 'تاريخ الدفع',
  payment_method: 'طريقة الدفع',
  remaining_before: 'المتبقي قبل العملية',
  remaining_amount_after: 'المتبقي بعد العملية',
  paid_amount_before: 'المدفوع قبل العملية',
  paid_amount_after: 'المدفوع بعد العملية',
  status: 'الحالة',
  is_current: 'السنة الحالية',
  start_date: 'تاريخ البداية',
  end_date: 'تاريخ النهاية',
  meeting_date: 'تاريخ الاجتماع',
  meeting_type: 'نوع الاجتماع',
  zone_name: 'القطاع',
  starts_at: 'وقت البداية',
  ends_at: 'وقت النهاية',
  absent_members: 'الأعضاء الغائبون',
  selected_members: 'الأعضاء المحددون',
  audience: 'النطاق',
  affected_teams: 'الفرق المتأثرة',
  reservation_date: 'يوم الحجز',
}


function actorLabel(row: AuditLogReadableRow) {
  if (row.actor_name) return row.actor_name
  if (row.actor_user_id) return `مستخدم ${row.actor_user_id.slice(0, 8)}`
  return 'غير معروف'
}

function prettifyValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا'
  if (typeof value === 'object') return toPrettyJson(value)
  return String(value)
}

function fieldLabel(field: string) {
  return FIELD_LABELS[field] || field
}

function buildDiffRows(before: Record<string, unknown> | null, after: Record<string, unknown> | null, changed: string[]) {
  const keys = changed.length
    ? changed
    : Array.from(new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])]))
  return keys.map((key) => ({
    key,
    label: fieldLabel(key),
    before: before?.[key],
    after: after?.[key],
  }))
}

export default function AdminAuditLog() {
  const { roles } = useAuth()
  const toast = useToast()
  const { currentScoutYear } = useCurrentScoutYear()
  const { data: teams } = useTeamsData(true)
  const isAdmin = roles.some((r) => r.role_slug === 'admin')

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<AuditLogReadableRow[]>([])
  const [selected, setSelected] = useState<AuditLogReadableRow | null>(null)

  const [search, setSearch] = useState('')
  const [teamId, setTeamId] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [severity, setSeverity] = useState<'all' | AuditSeverity>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  async function load(showToast = false) {
    if (!isAdmin) {
      setLoading(false)
      return
    }

    try {
      if (rows.length === 0) setLoading(true)
      else setRefreshing(true)
      setError(null)
      const data = await listAuditLogs({
        scoutYearId: currentScoutYear?.id ?? null,
        teamId: teamId || null,
        module: moduleFilter || null,
        action: actionFilter || null,
        severity,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        search: search || null,
        limit: 250,
      })
      setRows(data)
      if (showToast) toast.success('تم تحديث السجل')
    } catch (err) {
      logError('AdminAuditLog.load', err as any)
      setError(getErrorMessage(err as any, 'تعذر تحميل سجل العمليات'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [isAdmin, currentScoutYear?.id])

  const modules = useMemo(
    () => Array.from(new Set(rows.map((row) => row.module).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'ar')),
    [rows]
  )
  const actions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.action).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar')),
    [rows]
  )

  const stats = useMemo(() => {
    const total = rows.length
    const critical = rows.filter((row) => row.severity === 'critical').length
    const warnings = rows.filter((row) => row.severity === 'warning').length
    const todayPrefix = new Date().toISOString().slice(0, 10)
    const today = rows.filter((row) => String(row.created_at || '').slice(0, 10) === todayPrefix).length
    return { total, critical, warnings, today }
  }, [rows])

  if (!isAdmin) {
    return <div className="p-6">هذه الصفحة مخصصة للأدمن فقط.</div>
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري تحميل سجل العمليات..." />

      <PageHero
        eyebrow="📋 Audit Log"
        title="سجل العمليات بشكل أوضح"
        badge={
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
            {currentScoutYear?.name || 'السنة غير محددة'}
          </span>
        }
        description="راجع كل العمليات المهمة داخل السنة الحالية، مع فلترة واضحة وملخصات سريعة وتفاصيل قبل/بعد لكل سجل عند التوفر."
        actions={
          <>
            <LoadingButton variant="outline" loading={refreshing} onClick={() => void load(true)}>
              تحديث السجل
            </LoadingButton>
            <Link
              to="/app/admin"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              العودة للإدارة
            </Link>
          </>
        }
      />

      {error ? <InlineAlert tone="error" title="تعذر تحميل السجل">{error}</InlineAlert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="إجمالي السجلات" value={stats.total} hint="طبقًا للفلاتر الحالية" accent="indigo" />
        <MetricCard label="اليوم" value={stats.today} hint="عمليات اليوم" accent="sky" />
        <MetricCard label="تنبيهات" value={stats.warnings} hint="Severity = warning" accent="amber" />
        <MetricCard label="حرج" value={stats.critical} hint="Severity = critical" accent="rose" />
      </div>

      <SectionCard
        title="البحث والفلاتر"
        description="فلترة السجل حسب الفريق أو الموديول أو نوع العملية أو مستوى الأهمية أو فترة زمنية محددة."
        actions={
          <LoadingButton
            variant="soft"
            onClick={() => {
              setSearch('')
              setTeamId('')
              setModuleFilter('')
              setActionFilter('')
              setSeverity('all')
              setDateFrom('')
              setDateTo('')
            }}
          >
            تصفير الفلاتر
          </LoadingButton>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">بحث</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="فاعل، عضو، ملخص، نوع كيان..."
              className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الفريق</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500">
              <option value="">كل الفرق</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الموديول</label>
            <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500">
              <option value="">كل الموديولات</option>
              {modules.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">العملية</label>
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500">
              <option value="">كل العمليات</option>
              {actions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الأهمية</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as any)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500">
              <option value="all">الكل</option>
              <option value="info">معلومة</option>
              <option value="warning">تنبيه</option>
              <option value="critical">حرج</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">من</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">إلى</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <LoadingButton loading={refreshing} onClick={() => void load(true)}>تطبيق الفلاتر</LoadingButton>
        </div>
      </SectionCard>

      <SectionCard title="سجل العمليات" description="اضغط على أي سجل لعرض التفاصيل الكاملة، بما في ذلك قبل/بعد والسياق إن كان متاحًا داخل delta.">
        {rows.length === 0 ? (
          <EmptyState title="لا توجد سجلات مطابقة" description="جرّب تغيير الفلاتر أو التحقق من وجود عمليات مسجلة داخل السنة الحالية." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-2 text-right">الوقت</th>
                  <th className="px-3 py-2 text-right">الفاعل</th>
                  <th className="px-3 py-2 text-right">الموديول</th>
                  <th className="px-3 py-2 text-right">العملية</th>
                  <th className="px-3 py-2 text-right">الكيان</th>
                  <th className="px-3 py-2 text-right">الفريق</th>
                  <th className="px-3 py-2 text-right">الأهمية</th>
                  <th className="px-3 py-2 text-right">الملخص</th>
                  <th className="px-3 py-2 text-right">التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3 whitespace-nowrap">{fmtDate(row.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-800">{actorLabel(row)}</div>
                      <div className="text-xs text-slate-400">{row.target_member_name ? `على: ${row.target_member_name}` : row.actor_user_id ? row.actor_user_id.slice(0, 8) : '—'}</div>
                    </td>
                    <td className="px-3 py-3">{row.module || 'عام'}</td>
                    <td className="px-3 py-3">{row.action}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-700">{row.entity_type}</div>
                      <div className="text-xs text-slate-400">{row.entity_display || row.entity_id || '—'}</div>
                    </td>
                    <td className="px-3 py-3">{row.team_name || '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        row.severity === 'critical'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : row.severity === 'warning'
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                      }`}>
                        {severityLabel(row.severity)}
                      </span>
                    </td>
                    <td className="px-3 py-3 max-w-[340px] text-slate-600">{row.summary || 'بدون ملخص'}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        عرض التفاصيل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal open={Boolean(selected)} title="تفاصيل العملية" onClose={() => setSelected(null)}>
        {selected ? <AuditDetails row={selected} /> : null}
      </Modal>
    </div>
  )
}

function AuditDetails({ row }: { row: AuditLogReadableRow }) {
  const changed = getChangedFields(row.delta)
  const { before, after, context } = extractBeforeAfter(row.delta)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DetailBlock label="الوقت" value={fmtDate(row.created_at)} />
        <DetailBlock label="الفاعل" value={actorLabel(row)} />
        <DetailBlock label="المستهدف" value={row.target_member_name || row.entity_display || '—'} />
        <DetailBlock label="العملية" value={row.action} />
        <DetailBlock label="الموديول" value={row.module || 'عام'} />
        <DetailBlock label="الكيان" value={`${row.entity_type}${row.entity_display ? ` — ${row.entity_display}` : ''}`} />
        <DetailBlock label="الفريق" value={row.team_name || '—'} />
        <DetailBlock label="السنة" value={row.scout_year_name || '—'} />
        <DetailBlock label="المصدر" value={row.source || '—'} />
      </div>

      {row.summary ? (
        <InlineAlert tone={row.severity === 'critical' ? 'error' : row.severity === 'warning' ? 'info' : 'success'} title="الملخص">
          {row.summary}
        </InlineAlert>
      ) : null}

      {changed.length ? (
        <SectionCard title="الحقول المتغيرة" tone="subtle">
          <div className="flex flex-wrap gap-2">
            {changed.map((field) => (
              <span key={field} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {fieldLabel(field)}
              </span>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {(before || after) ? (
        <SectionCard title="ما الذي تغيّر؟" tone="subtle" description="عرض واضح للحالة قبل وبعد التعديل عند توفرها داخل السجل.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-2 text-right">الحقل</th>
                  <th className="px-3 py-2 text-right">قبل</th>
                  <th className="px-3 py-2 text-right">بعد</th>
                </tr>
              </thead>
              <tbody>
                {buildDiffRows(before, after, changed).map((item) => (
                  <tr key={item.key} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3 font-semibold text-slate-700">{item.label}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-pre-wrap">{prettifyValue(item.before)}</td>
                    <td className="px-3 py-3 text-slate-900 whitespace-pre-wrap">{prettifyValue(item.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {before ? (
              <SectionCard title="قبل التعديل — JSON" tone="subtle">
                <pre className="max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{toPrettyJson(before)}</pre>
              </SectionCard>
            ) : null}
            {after ? (
              <SectionCard title="بعد التعديل — JSON" tone="subtle">
                <pre className="max-h-80 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{toPrettyJson(after)}</pre>
              </SectionCard>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {context ? (
        <SectionCard title="السياق" tone="subtle">
          <pre className="max-h-72 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{toPrettyJson(context)}</pre>
        </SectionCard>
      ) : null}

      <SectionCard title="البيانات الخام" tone="subtle">
        <pre className="max-h-96 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{toPrettyJson(row.delta)}</pre>
      </SectionCard>
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value || '—'}</div>
    </div>
  )
}
