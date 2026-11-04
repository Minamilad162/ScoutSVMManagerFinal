import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { EmptyState } from '../components/ui/EmptyState'
import { InlineAlert } from '../components/ui/InlineAlert'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { PageLoader } from '../components/ui/PageLoader'
import { SectionCard } from '../components/ui/SectionCard'
import {
  fetchLeaderReportTeams,
  fetchReportCenterData,
  type AttendanceReportRow,
  type BudgetReportRow,
  type CampReportRow,
  type CaseReportRow,
  type EvaluationReportRow,
  type FinalEvaluationSummary,
  type ReportTeamOption,
  type TaskOwnerReportRow,
} from '../features/reports/api'
import { fetchTerms, type TermOption } from '../features/reference/api'
import { useCurrentScoutYear } from '../hooks/useCurrentScoutYear'
import { getErrorMessage, logError } from '../lib/errors'
import { exportJsonWorkbook } from '../lib/exportWorkbook'

function fmtMoney(value?: number | null) {
  return Number(value || 0).toLocaleString('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

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

function campStatusLabel(status?: string | null) {
  if (status === 'draft') return 'مسودة'
  if (status === 'open') return 'مفتوح'
  if (status === 'closed') return 'مغلق'
  if (status === 'cancelled') return 'ملغي'
  return status || '—'
}

function caseTypeLabel(value: string) {
  if (value === 'medical') return 'طبي'
  if (value === 'attendance') return 'غياب / التزام'
  if (value === 'other') return 'أخرى'
  return value || 'أخرى'
}


export default function ReportsCenter() {
  const nav = useNavigate()
  const { user, roles } = useAuth()
  const { currentScoutYear, loading: yearLoading } = useCurrentScoutYear()

  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [teams, setTeams] = useState<ReportTeamOption[]>([])
  const [terms, setTerms] = useState<TermOption[]>([])
  const [teamId, setTeamId] = useState('')
  const [termId, setTermId] = useState('')

  const [budgetRows, setBudgetRows] = useState<BudgetReportRow[]>([])
  const [attendanceRows, setAttendanceRows] = useState<AttendanceReportRow[]>([])
  const [campRows, setCampRows] = useState<CampReportRow[]>([])
  const [caseRows, setCaseRows] = useState<CaseReportRow[]>([])
  const [evaluationRows, setEvaluationRows] = useState<EvaluationReportRow[]>([])
  const [finalEvaluationSummary, setFinalEvaluationSummary] = useState<FinalEvaluationSummary>({
    eligible_count: 0,
    final_evaluated_count: 0,
    average_score: 0,
    promote_votes: 0,
    exceptional_votes: 0,
  })
  const [taskOwnerRows, setTaskOwnerRows] = useState<TaskOwnerReportRow[]>([])

  const isLeader = useMemo(() => roles.some((role) => role.role_slug === 'chef_de_legion'), [roles])

  const loadTeamsAndTerms = useCallback(async () => {
    if (!user?.id || !isLeader) {
      setTeams([])
      setTerms([])
      setTeamId('')
      setTermId('')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [teamRows, termRows] = await Promise.all([
        fetchLeaderReportTeams(user.id),
        fetchTerms(),
      ])

      setTeams(teamRows)
      setTerms(termRows)
      setTeamId((prev) => prev || teamRows[0]?.id || '')
      setTermId((prev) => prev || '')
    } catch (err) {
      logError('ReportsCenter.loadTeamsAndTerms', err, { userId: user?.id })
      setError(getErrorMessage(err, 'تعذر تحميل بيانات التقارير'))
    } finally {
      setLoading(false)
    }
  }, [isLeader, user?.id])

  useEffect(() => {
    void loadTeamsAndTerms()
  }, [loadTeamsAndTerms])

  const loadReports = useCallback(async () => {
    if (!isLeader || !user?.id || !currentScoutYear?.id || !teamId) return

    setLoading(true)
    setError(null)
    try {
      const data = await fetchReportCenterData({
        userId: user.id,
        teamId,
        termId: termId || null,
        scoutYearId: currentScoutYear.id,
        scoutYearStart: currentScoutYear.start_date,
        scoutYearEnd: currentScoutYear.end_date,
      })
      setBudgetRows(data.budgetRows)
      setAttendanceRows(data.attendanceRows)
      setCampRows(data.campRows)
      setCaseRows(data.caseRows)
      setEvaluationRows(data.evaluationRows)
      setFinalEvaluationSummary(data.finalEvaluationSummary)
      setTaskOwnerRows(data.taskOwnerRows)
    } catch (err) {
      logError('ReportsCenter.loadReports', err, { teamId, termId, scoutYearId: currentScoutYear?.id })
      setError(getErrorMessage(err, 'تعذر تحميل مركز التقارير'))
      setBudgetRows([])
      setAttendanceRows([])
      setCampRows([])
      setCaseRows([])
      setEvaluationRows([])
      setFinalEvaluationSummary({
        eligible_count: 0,
        final_evaluated_count: 0,
        average_score: 0,
        promote_votes: 0,
        exceptional_votes: 0,
      })
      setTaskOwnerRows([])
    } finally {
      setLoading(false)
    }
  }, [currentScoutYear?.end_date, currentScoutYear?.id, currentScoutYear?.start_date, isLeader, teamId, termId, user?.id])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  const selectedTeam = useMemo(() => teams.find((team) => team.id === teamId) || null, [teams, teamId])
  const filteredTerms = useMemo(() => terms.filter((term) => !currentScoutYear?.id || term.scout_year_id === currentScoutYear.id), [terms, currentScoutYear?.id])
  const selectedTerm = useMemo(() => filteredTerms.find((term) => term.id === termId) || null, [filteredTerms, termId])

  const totals = useMemo(() => {
    const budgetTotal = budgetRows.reduce((sum, row) => sum + Number(row.budget_total || 0), 0)
    const spentTotal = budgetRows.reduce((sum, row) => sum + Number(row.spent_total || 0), 0)
    const remainingTotal = budgetRows.reduce((sum, row) => sum + Number(row.remaining_total || 0), 0)

    const attendanceCount = attendanceRows.reduce((sum, row) => sum + row.attendance_count, 0)
    const presentCount = attendanceRows.reduce((sum, row) => sum + row.present_count, 0)
    const attendanceRatio = attendanceCount > 0 ? Number(((presentCount / attendanceCount) * 100).toFixed(1)) : 0

    const campRequired = campRows.reduce((sum, row) => sum + row.required_total, 0)
    const campPaid = campRows.reduce((sum, row) => sum + row.paid_total, 0)
    const campRatio = campRequired > 0 ? Number(((campPaid / campRequired) * 100).toFixed(1)) : 0

    const openCases = caseRows.reduce((sum, row) => sum + row.open_count, 0)
    const evaluationsEligible = evaluationRows.reduce((sum, row) => sum + row.eligible_count, 0)
    const evaluationsDone = evaluationRows.reduce((sum, row) => sum + row.evaluated_count, 0)
    const evaluationCoverage = evaluationsEligible > 0 ? Number(((evaluationsDone / evaluationsEligible) * 100).toFixed(1)) : 0
    const overdueTasks = taskOwnerRows.reduce((sum, row) => sum + row.overdue_count, 0)

    return {
      budgetTotal,
      spentTotal,
      remainingTotal,
      attendanceRatio,
      campRatio,
      openCases,
      evaluationCoverage,
      overdueTasks,
    }
  }, [attendanceRows, budgetRows, campRows, caseRows, evaluationRows, taskOwnerRows])

  const exportExcel = useCallback(async () => {
    if (!selectedTeam || !currentScoutYear) return
    setExporting(true)
    try {
      const metaSheet = [
        { البند: 'السنة الكشفية', القيمة: currentScoutYear.name },
        { البند: 'الفريق', القيمة: selectedTeam.name },
        { البند: 'الترم', القيمة: selectedTerm?.name || 'كل الترمات' },
        { البند: 'تاريخ التصدير', القيمة: fmtDate(new Date().toISOString()) },
      ]
      const workbookSheets: Array<{ name: string; rows: Array<Record<string, unknown>> }> = [
        { name: 'ملخص', rows: metaSheet },
      ]

      const budgetSheet = budgetRows.map((row) => ({
        الترم: row.term_name,
        السنة: row.term_year,
        الميزانية: row.budget_total,
        المصروف: row.spent_total,
        المتبقي: row.remaining_total,
        'عدد البنود': row.expenses_count,
      }))
      workbookSheets.push({ name: 'الميزانيات', rows: budgetSheet.length ? budgetSheet : [{ الترم: 'لا توجد بيانات' }] })

      const attendanceSheet = attendanceRows.map((row) => ({
        الترم: row.term_name,
        الاجتماعات: row.meetings_count,
        'إجمالي السجلات': row.attendance_count,
        حاضر: row.present_count,
        غائب: row.absent_count,
        'نسبة الحضور %': row.attendance_ratio,
      }))
      workbookSheets.push({ name: 'الحضور', rows: attendanceSheet.length ? attendanceSheet : [{ الترم: 'لا توجد بيانات' }] })

      const campSheet = campRows.map((row) => ({
        المعسكر: row.title,
        الحالة: campStatusLabel(row.status),
        'تاريخ البداية': row.start_date,
        'تاريخ الاستحقاق': row.due_date,
        المشاركون: row.members_count,
        المطلوب: row.required_total,
        المدفوع: row.paid_total,
        المتبقي: row.remaining_total,
        'نسبة التحصيل %': row.collection_percentage,
      }))
      workbookSheets.push({ name: 'المعسكرات', rows: campSheet.length ? campSheet : [{ المعسكر: 'لا توجد بيانات' }] })

      const caseSheet = caseRows.map((row) => ({
        النوع: caseTypeLabel(row.case_type),
        الإجمالي: row.total_count,
        مفتوحة: row.open_count,
        مؤرشفة: row.archived_count,
        مثبتة: row.pinned_count,
      }))
      workbookSheets.push({ name: 'الحالات', rows: caseSheet.length ? caseSheet : [{ النوع: 'لا توجد بيانات' }] })

      const evaluationSheet = evaluationRows.map((row) => ({
        الترم: row.term_name,
        'المستهدفون': row.eligible_count,
        'تم تقييمهم': row.evaluated_count,
        'نسبة التغطية %': row.coverage_ratio,
      }))
      workbookSheets.push({ name: 'التقييمات', rows: evaluationSheet.length ? evaluationSheet : [{ الترم: 'لا توجد بيانات' }] })

      const finalEvalSheet = [
        {
          'المستهدفون': finalEvaluationSummary.eligible_count,
          'تم تقييمهم نهائيًا': finalEvaluationSummary.final_evaluated_count,
          'متوسط الدرجة': finalEvaluationSummary.average_score,
          'أصوات الوعد': finalEvaluationSummary.promote_votes,
          'الأصوات الاستثنائية': finalEvaluationSummary.exceptional_votes,
        },
      ]
      workbookSheets.push({ name: 'التقييم النهائي', rows: finalEvalSheet })

      const tasksSheet = taskOwnerRows.map((row) => ({
        المسؤول: row.owner_name,
        الإجمالي: row.total_count,
        معلقة: row.pending_count,
        'قيد التنفيذ': row.in_progress_count,
        تمت: row.done_count,
        ملغاة: row.cancelled_count,
        متأخرة: row.overdue_count,
      }))
      workbookSheets.push({ name: 'المهام', rows: tasksSheet.length ? tasksSheet : [{ المسؤول: 'لا توجد بيانات' }] })

      const safeTeam = selectedTeam.name.replace(/[\\/:*?"<>|]+/g, '_')
      const safeTerm = (selectedTerm?.name || 'all_terms').replace(/[\\/:*?"<>|]+/g, '_')
      const fileName = `reports_${safeTeam}_${safeTerm}_${new Date().toISOString().slice(0, 10)}.xlsx`
      await exportJsonWorkbook(fileName, workbookSheets)
    } catch (err) {
      logError('ReportsCenter.exportExcel', err, { teamId, termId })
      setError(getErrorMessage(err, 'تعذر تصدير ملف Excel'))
    } finally {
      setExporting(false)
    }
  }, [budgetRows, attendanceRows, campRows, caseRows, currentScoutYear, evaluationRows, finalEvaluationSummary, selectedTeam, selectedTerm, taskOwnerRows, teamId, termId])

  if (yearLoading || loading) {
    return <PageLoader visible text="جاري تحميل مركز التقارير..." />
  }

  if (!isLeader) {
    return (
      <div className="p-4 md:p-6">
        <EmptyState
          title="مركز التقارير غير متاح"
          description="هذه الصفحة مخصصة لـ Chef de Legion فقط لعرض تقارير الفريق المهمة داخل السنة الحالية."
          action={<button className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => nav('/app')}>الرجوع للرئيسية</button>}
        />
      </div>
    )
  }

  return (
    <div className="reports99-page space-y-6 p-4 md:p-6">
      <PageHero
        className="reports99-hero"
        eyebrow="📊 مركز التقارير"
        title="تقارير الفريق المهمة"
        badge={<span className="reports99-year-badge inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold">{currentScoutYear?.name || 'السنة غير محددة'}</span>}
        description={
          <>يعرض هذا المركز أهم التقارير المنظمة لــ <b>Chef de Legion</b> فقط: <b>الميزانيات</b>، <b>الحضور</b>، <b>التحصيل</b>، <b>الحالات</b>، <b>التقييمات</b>، و<b>المهام</b> داخل السنة الكشفية الحالية.</>
        }
        actions={
          <>
            <button className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50" onClick={() => window.print()}>
              طباعة التقرير
            </button>
            <button className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60" onClick={() => void exportExcel()} disabled={exporting}>
              {exporting ? 'جارٍ التصدير...' : 'تصدير Excel'}
            </button>
            <button className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800" onClick={() => nav('/app/TeamStatistics')}>
              الرجوع للوحة الفريق
            </button>
          </>
        }
      />

      {error ? <InlineAlert tone="error" title="تعذر تحميل التقارير">{error}</InlineAlert> : null}

      <SectionCard className="reports99-section reports99-filters" title="فلاتر التقرير" description="اختر الفريق ثم الترم الذي تريد التركيز عليه. ترك الترم فارغًا يعرض كل ترمات السنة الحالية للفريق المختار.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الفريق</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-700">
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الترم</label>
            <select value={termId} onChange={(e) => setTermId(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-700">
              <option value="">كل الترمات</option>
              {filteredTerms.map((term) => (
                <option key={term.id} value={term.id}>{term.name} {term.year ? `(${term.year})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800" onClick={() => void loadReports()}>
              تحديث التقرير
            </button>
          </div>
        </div>
      </SectionCard>

      <div className="reports99-kpis grid grid-cols-2 gap-3 xl:grid-cols-8">
        <MetricCard label="إجمالي الميزانية" value={fmtMoney(totals.budgetTotal)} hint={selectedTeam?.name || '—'} accent="indigo" />
        <MetricCard label="إجمالي المصروف" value={fmtMoney(totals.spentTotal)} hint="كل الترمات الظاهرة" accent="amber" />
        <MetricCard label="المتبقي" value={fmtMoney(totals.remainingTotal)} hint="ميزانية - مصروف" accent={totals.remainingTotal < 0 ? 'rose' : 'emerald'} />
        <MetricCard label="نسبة الحضور" value={`${totals.attendanceRatio}%`} hint="من سجلات الحضور" accent="sky" />
        <MetricCard label="نسبة التحصيل" value={`${totals.campRatio}%`} hint="على مستوى المعسكرات" accent="emerald" />
        <MetricCard label="الحالات المفتوحة" value={totals.openCases} hint="داخل السنة الحالية" accent="rose" />
        <MetricCard label="تغطية التقييم" value={`${totals.evaluationCoverage}%`} hint="التقييمات الدورية" accent="violet" />
        <MetricCard label="المهام المتأخرة" value={totals.overdueTasks} hint="تحتاج متابعة" accent={totals.overdueTasks > 0 ? 'rose' : 'emerald'} />
      </div>

      <SectionCard className="reports99-section reports99-budget" title="تقرير الميزانية حسب الترم" description="يعرض ميزانية كل ترم مقابل المصروف الفعلي وعدد بنود المصروف داخل الفريق المختار.">
        {budgetRows.length === 0 ? (
          <EmptyState title="لا توجد بيانات ميزانيات" description="لم يتم العثور على ميزانيات أو مصروفات لهذا الفريق داخل نطاق التقرير الحالي." />
        ) : (
          <div className="reports99-table-wrap overflow-x-auto rounded-2xl border border-slate-200">
            <table className="reports99-table min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3 text-right">الترم</th>
                  <th className="px-3 py-3 text-right">الميزانية</th>
                  <th className="px-3 py-3 text-right">المصروف</th>
                  <th className="px-3 py-3 text-right">المتبقي</th>
                  <th className="px-3 py-3 text-right">عدد البنود</th>
                </tr>
              </thead>
              <tbody>
                {budgetRows.map((row) => (
                  <tr key={row.term_id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-800">{row.term_name}</td>
                    <td className="px-3 py-3">{fmtMoney(row.budget_total)}</td>
                    <td className="px-3 py-3">{fmtMoney(row.spent_total)}</td>
                    <td className={`px-3 py-3 font-semibold ${row.remaining_total < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{fmtMoney(row.remaining_total)}</td>
                    <td className="px-3 py-3">{row.expenses_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard className="reports99-section reports99-attendance" title="تقرير الحضور حسب الترم" description="يعرض عدد الاجتماعات وسجلات الحضور ونسبة الالتزام في الفريق المختار.">
        {attendanceRows.length === 0 ? (
          <EmptyState title="لا توجد بيانات حضور" description="لم يتم العثور على اجتماعات حضور أو سجلات attendance داخل نطاق التقرير الحالي." />
        ) : (
          <div className="reports99-table-wrap overflow-x-auto rounded-2xl border border-slate-200">
            <table className="reports99-table min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3 text-right">الترم</th>
                  <th className="px-3 py-3 text-right">الاجتماعات</th>
                  <th className="px-3 py-3 text-right">إجمالي السجلات</th>
                  <th className="px-3 py-3 text-right">حاضر</th>
                  <th className="px-3 py-3 text-right">غائب</th>
                  <th className="px-3 py-3 text-right">نسبة الحضور</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((row) => (
                  <tr key={row.term_id || row.term_name} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-800">{row.term_name}</td>
                    <td className="px-3 py-3">{row.meetings_count}</td>
                    <td className="px-3 py-3">{row.attendance_count}</td>
                    <td className="px-3 py-3 text-emerald-700">{row.present_count}</td>
                    <td className="px-3 py-3 text-rose-700">{row.absent_count}</td>
                    <td className="px-3 py-3 font-semibold">{row.attendance_ratio}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard className="reports99-section reports99-evaluation" title="تقرير التقييمات" description="ملخص تغطية التقييمات الدورية للقيادات داخل الفريق، مع نظرة سريعة على التقييم النهائي في السنة الحالية.">
        <div className="reports99-submetrics grid gap-3 md:grid-cols-4">
          <MetricCard label="المستهدفون نهائيًا" value={finalEvaluationSummary.eligible_count} accent="indigo" />
          <MetricCard label="تم تقييمهم نهائيًا" value={finalEvaluationSummary.final_evaluated_count} accent="emerald" />
          <MetricCard label="متوسط الدرجة" value={finalEvaluationSummary.average_score || '—'} accent="amber" />
          <MetricCard label="أصوات استثنائية" value={finalEvaluationSummary.exceptional_votes} accent="rose" />
        </div>
        {evaluationRows.length === 0 ? (
          <EmptyState title="لا توجد بيانات تقييمات" description="لم يتم العثور على تقييمات دورية ضمن نطاق التقرير الحالي." />
        ) : (
          <div className="reports99-table-wrap overflow-x-auto rounded-2xl border border-slate-200">
            <table className="reports99-table min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3 text-right">الترم</th>
                  <th className="px-3 py-3 text-right">المستهدفون</th>
                  <th className="px-3 py-3 text-right">تم تقييمهم</th>
                  <th className="px-3 py-3 text-right">نسبة التغطية</th>
                </tr>
              </thead>
              <tbody>
                {evaluationRows.map((row) => (
                  <tr key={row.term_id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-800">{row.term_name}</td>
                    <td className="px-3 py-3">{row.eligible_count}</td>
                    <td className="px-3 py-3">{row.evaluated_count}</td>
                    <td className="px-3 py-3 font-semibold">{row.coverage_ratio}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard className="reports99-section reports99-camps" title="تقرير المعسكرات والتحصيل" description="ملخص المعسكرات الخاصة بالفريق داخل السنة الحالية، مع نسبة التحصيل لكل معسكر.">
        {campRows.length === 0 ? (
          <EmptyState title="لا توجد معسكرات أو تحصيل" description="لم يتم العثور على سجلات تقسيط أو تحصيل لهذا الفريق داخل السنة الحالية." />
        ) : (
          <div className="space-y-3">
            {campRows.map((row) => (
              <div key={row.camp_id} className="reports99-camp-card rounded-2xl border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-base font-bold text-slate-900">{row.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{campStatusLabel(row.status)} • من {fmtDate(row.start_date)} إلى {fmtDate(row.due_date)}</div>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
                    نسبة التحصيل {row.collection_percentage}%
                  </div>
                </div>
                <div className="reports99-camp-metrics mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <MetricCard label="المشاركون" value={row.members_count} accent="sky" />
                  <MetricCard label="المطلوب" value={fmtMoney(row.required_total)} accent="indigo" />
                  <MetricCard label="المدفوع" value={fmtMoney(row.paid_total)} accent="emerald" />
                  <MetricCard label="المتبقي" value={fmtMoney(row.remaining_total)} accent={row.remaining_total > 0 ? 'amber' : 'emerald'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard className="reports99-section reports99-cases" title="تقرير الحالات" description="حصر سريع للحالات الخاصة بالفريق داخل السنة الحالية بحسب النوع والحالة.">
        {caseRows.length === 0 ? (
          <EmptyState title="لا توجد حالات" description="لم يتم العثور على حالات مفتوحة أو مؤرشفة داخل السنة الحالية لهذا الفريق." />
        ) : (
          <div className="reports99-table-wrap overflow-x-auto rounded-2xl border border-slate-200">
            <table className="reports99-table min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3 text-right">النوع</th>
                  <th className="px-3 py-3 text-right">الإجمالي</th>
                  <th className="px-3 py-3 text-right">مفتوحة</th>
                  <th className="px-3 py-3 text-right">مؤرشفة</th>
                  <th className="px-3 py-3 text-right">Pinned</th>
                </tr>
              </thead>
              <tbody>
                {caseRows.map((row) => (
                  <tr key={row.case_type} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-800">{caseTypeLabel(row.case_type)}</td>
                    <td className="px-3 py-3">{row.total_count}</td>
                    <td className="px-3 py-3 text-rose-700">{row.open_count}</td>
                    <td className="px-3 py-3 text-slate-600">{row.archived_count}</td>
                    <td className="px-3 py-3">{row.pinned_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard className="reports99-section reports99-tasks" title="تقرير المهام والمتابعة" description="يعرض توزيع المهام المرتبطة بالمحاضر داخل نطاق التقرير الحالي، مع إبراز المسؤولين الذين لديهم مهام متأخرة.">
        {taskOwnerRows.length === 0 ? (
          <EmptyState title="لا توجد مهام" description="لم يتم العثور على مهام محاضر داخل نطاق التقرير الحالي." />
        ) : (
          <div className="reports99-table-wrap overflow-x-auto rounded-2xl border border-slate-200">
            <table className="reports99-table min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-3 text-right">المسؤول</th>
                  <th className="px-3 py-3 text-right">الإجمالي</th>
                  <th className="px-3 py-3 text-right">معلقة</th>
                  <th className="px-3 py-3 text-right">قيد التنفيذ</th>
                  <th className="px-3 py-3 text-right">تمت</th>
                  <th className="px-3 py-3 text-right">ملغاة</th>
                  <th className="px-3 py-3 text-right">متأخرة</th>
                </tr>
              </thead>
              <tbody>
                {taskOwnerRows.map((row) => (
                  <tr key={row.owner_name} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-800">{row.owner_name || 'غير محدد'}</td>
                    <td className="px-3 py-3">{row.total_count}</td>
                    <td className="px-3 py-3">{row.pending_count}</td>
                    <td className="px-3 py-3">{row.in_progress_count}</td>
                    <td className="px-3 py-3 text-emerald-700">{row.done_count}</td>
                    <td className="px-3 py-3 text-slate-500">{row.cancelled_count}</td>
                    <td className={`px-3 py-3 font-semibold ${row.overdue_count > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{row.overdue_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
