import { useEffect, useMemo, useState } from 'react'
import { PageHero } from '../components/ui/PageHero'
import { MetricCard } from '../components/ui/MetricCard'
import { SectionCard } from '../components/ui/SectionCard'
import { InlineAlert } from '../components/ui/InlineAlert'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingButton } from '../components/ui/LoadingButton'
import { useScoutYear } from '../components/ScoutYearProvider'
import { getScoutYearNumericValue, getScoutYearDateRange } from '../lib/scoutYear'
import { getErrorMessage, logError } from '../lib/errors'
import {
  addMeetingDateToTerm,
  deleteMeetingDateFromTerm,
  listTermMeetingDates,
  listTermsWithMeetingStats,
  saveTermForScoutYear,
  type TermMeetingAdminRow,
  type TermMeetingDateRow,
} from '../features/terms/api'

function fmtDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

export default function AdminTermsMeetings() {
  const { currentScoutYear } = useScoutYear()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [datesLoading, setDatesLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [terms, setTerms] = useState<TermMeetingAdminRow[]>([])
  const [search, setSearch] = useState('')

  const [termEditId, setTermEditId] = useState<string | null>(null)
  const [termName, setTermName] = useState('')
  const [termYear, setTermYear] = useState<number>(getScoutYearNumericValue(currentScoutYear))
  const [termStart, setTermStart] = useState('')
  const [termEnd, setTermEnd] = useState('')

  const [selectedTermId, setSelectedTermId] = useState<string>('')
  const [meetingDates, setMeetingDates] = useState<TermMeetingDateRow[]>([])
  const [newMeetingDate, setNewMeetingDate] = useState('')

  useEffect(() => {
    setTermYear(getScoutYearNumericValue(currentScoutYear))
    if (currentScoutYear?.start_date && !termStart) setTermStart(currentScoutYear.start_date)
    if (currentScoutYear?.end_date && !termEnd) setTermEnd(currentScoutYear.end_date)
  }, [currentScoutYear?.id])

  useEffect(() => {
    void loadTerms()
  }, [currentScoutYear?.id])

  useEffect(() => {
    if (!selectedTermId) {
      setMeetingDates([])
      return
    }
    void loadMeetingDates(selectedTermId)
  }, [selectedTermId])

  async function loadTerms() {
    if (!currentScoutYear?.id) {
      setTerms([])
      setLoading(false)
      return
    }

    setLoading(true)
    setErr(null)
    try {
      const rows = await listTermsWithMeetingStats(currentScoutYear.id)
      setTerms(rows)
      if (rows.length && !rows.some((row) => row.id === selectedTermId)) {
        setSelectedTermId(rows[0].id)
      }
    } catch (error) {
      logError('AdminTermsMeetings.loadTerms', error as any, { scoutYearId: currentScoutYear.id })
      setErr(getErrorMessage(error, 'تعذر تحميل الترمات الحالية'))
      setTerms([])
    } finally {
      setLoading(false)
    }
  }

  async function loadMeetingDates(termId: string) {
    setDatesLoading(true)
    setErr(null)
    try {
      const rows = await listTermMeetingDates(termId)
      setMeetingDates(rows)
    } catch (error) {
      logError('AdminTermsMeetings.loadMeetingDates', error as any, { termId })
      setErr(getErrorMessage(error, 'تعذر تحميل تواريخ الاجتماعات'))
      setMeetingDates([])
    } finally {
      setDatesLoading(false)
    }
  }

  const filteredTerms = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return terms
    return terms.filter((term) => `${term.name} ${term.year}`.toLowerCase().includes(q))
  }, [terms, search])

  const selectedTerm = useMemo(
    () => terms.find((term) => term.id === selectedTermId) || null,
    [terms, selectedTermId]
  )

  const totals = useMemo(() => {
    return terms.reduce(
      (acc, term) => {
        acc.terms += 1
        acc.planned += term.planned_meetings_count
        acc.actual += term.actual_meetings_count
        return acc
      },
      { terms: 0, planned: 0, actual: 0 }
    )
  }, [terms])

  const yearRange = getScoutYearDateRange(currentScoutYear)

  function resetForm() {
    setTermEditId(null)
    setTermName('')
    setTermYear(getScoutYearNumericValue(currentScoutYear))
    setTermStart(currentScoutYear?.start_date || '')
    setTermEnd(currentScoutYear?.end_date || '')
  }

  async function handleSaveTerm() {
    if (!currentScoutYear?.id) {
      setErr('لا توجد سنة كشفية حالية مفعّلة')
      return
    }
    if (!termName.trim()) {
      setErr('اسم الترم مطلوب')
      return
    }
    if (termStart && termEnd && termStart > termEnd) {
      setErr('تاريخ البداية يجب أن يسبق تاريخ النهاية')
      return
    }
    if (yearRange?.start && termStart && termStart < yearRange.start) {
      setErr('بداية الترم خارج حدود السنة الحالية')
      return
    }
    if (yearRange?.end && termEnd && termEnd > yearRange.end) {
      setErr('نهاية الترم خارج حدود السنة الحالية')
      return
    }

    setSaving(true)
    setErr(null)
    setMsg(null)
    try {
      const saved = await saveTermForScoutYear({
        id: termEditId,
        scoutYearId: currentScoutYear.id,
        name: termName,
        year: termYear,
        start_date: termStart || null,
        end_date: termEnd || null,
      })
      setMsg(termEditId ? 'تم تحديث الترم بنجاح' : 'تمت إضافة الترم بنجاح')
      await loadTerms()
      setSelectedTermId(saved.id)
      resetForm()
    } catch (error) {
      logError('AdminTermsMeetings.handleSaveTerm', error as any, { termEditId })
      setErr(getErrorMessage(error, 'تعذر حفظ الترم'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAddMeetingDate() {
    if (!selectedTerm) {
      setErr('اختر ترمًا أولًا لإدارة مواعيده')
      return
    }

    setSaving(true)
    setErr(null)
    setMsg(null)
    try {
      await addMeetingDateToTerm({
        termId: selectedTerm.id,
        meetingDate: newMeetingDate,
        termStartDate: selectedTerm.start_date,
        termEndDate: selectedTerm.end_date,
      })
      setMsg('تمت إضافة موعد الاجتماع بنجاح')
      setNewMeetingDate('')
      await Promise.all([loadMeetingDates(selectedTerm.id), loadTerms()])
    } catch (error) {
      logError('AdminTermsMeetings.handleAddMeetingDate', error as any, { selectedTermId, newMeetingDate })
      setErr(getErrorMessage(error, 'تعذر إضافة موعد الاجتماع'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMeetingDate(id: string) {
    if (!selectedTerm) return
    if (!window.confirm('هل تريد حذف هذا الموعد من خطة الترم؟')) return

    setSaving(true)
    setErr(null)
    setMsg(null)
    try {
      await deleteMeetingDateFromTerm(id)
      setMsg('تم حذف موعد الاجتماع')
      await Promise.all([loadMeetingDates(selectedTerm.id), loadTerms()])
    } catch (error) {
      logError('AdminTermsMeetings.handleDeleteMeetingDate', error as any, { id })
      setErr(getErrorMessage(error, 'تعذر حذف موعد الاجتماع'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="🗓️ إدارة الترمات والاجتماعات"
        title="ترمات السنة الحالية وخطة الاجتماعات"
        badge={
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            {currentScoutYear?.name || 'السنة غير محددة'}
          </span>
        }
        description="هذه الصفحة مخصصة لإدارة الترمات ومواعيد الاجتماعات المخططة داخل السنة الكشفية الحالية فقط، مع مقارنة سريعة بين الخطة والتنفيذ الفعلي."
        actions={
          <>
            <LoadingButton variant="outline" onClick={() => void loadTerms()} loading={loading || datesLoading}>
              تحديث البيانات
            </LoadingButton>
            <LoadingButton onClick={resetForm} variant="soft">ترم جديد</LoadingButton>
          </>
        }
      />

      {!currentScoutYear ? (
        <InlineAlert tone="error" title="لا توجد سنة كشفية حالية">
          فعّل سنة كشفية حالية أولًا من صفحة إدارة السنة الكشفية حتى يمكن إنشاء الترمات وربط الاجتماعات بها.
        </InlineAlert>
      ) : null}

      {err ? <InlineAlert tone="error" title="تعذر إكمال العملية">{err}</InlineAlert> : null}
      {msg ? <InlineAlert tone="success" title="تمت العملية بنجاح">{msg}</InlineAlert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="عدد الترمات" value={totals.terms} hint="ضمن السنة الحالية" accent="indigo" />
        <MetricCard label="المواعيد المخططة" value={totals.planned} hint="من term_meeting_dates" accent="sky" />
        <MetricCard label="الاجتماعات الفعلية" value={totals.actual} hint="من meetings المرتبطة بالترم" accent="emerald" />
        <MetricCard
          label="نسبة التنفيذ"
          value={totals.planned ? `${Math.round((totals.actual / totals.planned) * 100)}%` : '—'}
          hint={totals.planned ? 'مقارنة بين الخطة والتنفيذ الحالي' : 'أضف مواعيد اجتماعات أولًا'}
          accent="amber"
        />
      </div>

      <SectionCard
        title="إدارة الترم"
        description="أضف أو عدّل ترمًا داخل السنة الحالية. يفضّل أن تكون تواريخه ضمن حدود السنة الكشفية المفعّلة."
        actions={
          termEditId ? (
            <LoadingButton variant="outline" onClick={resetForm}>إلغاء التعديل</LoadingButton>
          ) : undefined
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">اسم الترم</label>
            <input value={termName} onChange={(e) => setTermName(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500" placeholder="مثال: الترم الأول" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">السنة الرقمية</label>
            <input type="number" value={termYear} onChange={(e) => setTermYear(Number(e.target.value || getScoutYearNumericValue(currentScoutYear)))} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">بداية الترم</label>
            <input type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">نهاية الترم</label>
            <input type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <LoadingButton onClick={handleSaveTerm} loading={saving}>{termEditId ? 'تحديث الترم' : 'إضافة الترم'}</LoadingButton>
          {yearRange ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              حدود السنة الحالية: {fmtDate(yearRange.start)} → {fmtDate(yearRange.end)}
            </span>
          ) : null}
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <SectionCard title="ترمات السنة الحالية" description="اختر ترمًا لإدارة مواعيد الاجتماعات الخاصة به أو عدّل بياناته الأساسية من هنا.">
          <div className="grid gap-3 md:grid-cols-[1fr,auto] md:items-end">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">بحث</label>
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500" placeholder="ابحث باسم الترم أو سنته" />
            </div>
            <div className="text-xs text-slate-500">ترتيب حسب تاريخ البداية ثم الاسم.</div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">جاري تحميل الترمات...</div>
          ) : filteredTerms.length === 0 ? (
            <EmptyState title="لا توجد ترمات بعد" description="أضف أول ترم داخل السنة الحالية حتى تبدأ إدارة المواعيد والاجتماعات المرتبطة به." />
          ) : (
            <div className="space-y-3">
              {filteredTerms.map((term) => {
                const active = term.id === selectedTermId
                return (
                  <button
                    key={term.id}
                    type="button"
                    onClick={() => setSelectedTermId(term.id)}
                    className={`w-full rounded-[24px] border p-4 text-start transition ${active ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className={`text-lg font-black ${active ? 'text-white' : 'text-slate-900'}`}>{term.name}</div>
                        <div className={`mt-1 text-sm ${active ? 'text-slate-200' : 'text-slate-500'}`}>السنة الرقمية: {term.year} • {fmtDate(term.start_date)} → {fmtDate(term.end_date)}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-white/15 text-white' : 'bg-indigo-50 text-indigo-700'}`}>خطة: {term.planned_meetings_count}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-700'}`}>فعلي: {term.actual_meetings_count}</span>
                      </div>
                    </div>
                    <div className={`mt-4 grid gap-2 md:grid-cols-2 ${active ? 'text-slate-100' : 'text-slate-600'}`}>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs">آخر موعد مخطط: <b>{fmtDate(term.last_planned_date)}</b></div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs">آخر اجتماع فعلي: <b>{fmtDate(term.last_actual_meeting_date)}</b></div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${active ? 'border-white/20 text-white/90' : 'border-slate-200 text-slate-500'}`}>التواريخ المخططة في term_meeting_dates</span>
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${active ? 'border-white/20 text-white/90' : 'border-slate-200 text-slate-500'}`}>الاجتماعات الفعلية من meetings</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={selectedTerm ? `مواعيد الاجتماعات — ${selectedTerm.name}` : 'مواعيد الاجتماعات'}
          description={selectedTerm ? 'أضف واحذف مواعيد الخطة لهذا الترم. هذه التواريخ تُستخدم في الشاشات التشغيلية الخاصة بالحضور والحجوزات.' : 'اختر ترمًا من القائمة لعرض وإدارة مواعيده.'}
          actions={selectedTerm ? <LoadingButton variant="soft" onClick={() => {
            setTermEditId(selectedTerm.id)
            setTermName(selectedTerm.name)
            setTermYear(selectedTerm.year)
            setTermStart(selectedTerm.start_date || '')
            setTermEnd(selectedTerm.end_date || '')
          }}>تحرير بيانات الترم</LoadingButton> : undefined}
        >
          {!selectedTerm ? (
            <EmptyState title="اختر ترمًا أولًا" description="بعد اختيار الترم ستظهر هنا كل مواعيد الاجتماعات المخططة داخله، مع مقارنة بسيطة بعدد الاجتماعات الفعلية." />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="الخطة" value={selectedTerm.planned_meetings_count} hint="تواريخ term_meeting_dates" accent="sky" />
                <MetricCard label="المنفذ" value={selectedTerm.actual_meetings_count} hint="اجتماعات meetings المرتبطة بالترم" accent="emerald" />
              </div>

              <InlineAlert tone="info" title="معلومة مهمة">
                موعد الاجتماع هنا يعني <b>Meeting</b> مخطط داخل الترم، بينما بعض الشاشات قد تُسجل أيضًا اجتماعات فعلية حسب الاستخدام اليومي. هذه الصفحة تساعدك على إبقاء الخطة متسقة مع التنفيذ.
              </InlineAlert>

              <div className="grid gap-3 md:grid-cols-[1fr,auto] md:items-end">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">أضف موعد اجتماع جديد</label>
                  <input type="date" value={newMeetingDate} onChange={(e) => setNewMeetingDate(e.target.value)} min={selectedTerm.start_date || undefined} max={selectedTerm.end_date || undefined} className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500" />
                </div>
                <LoadingButton onClick={handleAddMeetingDate} loading={saving}>إضافة الموعد</LoadingButton>
              </div>

              {datesLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">جاري تحميل المواعيد...</div>
              ) : meetingDates.length === 0 ? (
                <EmptyState title="لا توجد مواعيد مخططة لهذا الترم" description="أضف مواعيد الاجتماعات الآن حتى تظهر في الشاشات التي تعتمد على term_meeting_dates داخل السنة الحالية." />
              ) : (
                <div className="overflow-x-auto rounded-[24px] border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-right">التاريخ</th>
                        <th className="px-4 py-3 text-right">اجتماعات فعلية مرتبطة</th>
                        <th className="px-4 py-3 text-right">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meetingDates.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-semibold text-slate-800">{fmtDate(row.meeting_date)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.actual_meetings_count > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                              {row.actual_meetings_count > 0 ? `${row.actual_meetings_count} اجتماع` : 'لم يُنفذ بعد'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <LoadingButton variant="outline" className="!rounded-xl !px-3 !py-2 text-xs" loading={saving} onClick={() => void handleDeleteMeetingDate(row.id)}>
                              حذف الموعد
                            </LoadingButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
