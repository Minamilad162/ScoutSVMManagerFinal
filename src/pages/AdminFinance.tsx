import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toaster'
import { PageLoader } from '../components/ui/PageLoader'
import { LoadingButton } from '../components/ui/LoadingButton'
import { fetchTeams, fetchTerms } from '../features/reference/api'
import { belongsToScoutYear, getTermYearBounds } from '../lib/scoutYearScope'
import { safeWriteAuditLog } from '../features/audit/api'
import { useScoutYear } from '../components/ScoutYearProvider'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'

type Team = { id: string; name: string }
type Term = { id: string; name: string; year: number; scout_year_id?: string | null; start_date?: string | null; end_date?: string | null }
type BudgetRecord = { id: string; amount_total: number; created_at: string | null; created_by: string | null; confirmed_at: string | null; confirmed_by: string | null; scout_year_id: string | null }
type BudgetAudit = { action: string; created_at: string | null; actor_name: string | null; actor_user_id: string | null; source: string | null }

export default function AdminFinance() {
  const toast = useToast()
  const { currentScoutYear, isReadOnlyView } = useScoutYear()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [teams, setTeams] = useState<Team[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [teamId, setTeamId] = useState('')
  const [termId, setTermId] = useState('')

  const termMeta = terms.find(t => t.id === termId) || null
  const termBounds = termMeta && belongsToScoutYear(termMeta, currentScoutYear) ? getTermYearBounds(currentScoutYear, termMeta) : null
  const [budget, setBudget] = useState<number | null>(null)
  const [budgetRecord, setBudgetRecord] = useState<BudgetRecord | null>(null)
  const [budgetAudit, setBudgetAudit] = useState<BudgetAudit[]>([])
  const [budgetDraft, setBudgetDraft] = useState<string>('')
  const [spent, setSpent] = useState(0)

  const remaining = useMemo(() => (budget ?? 0) - spent, [budget, spent])
  const status: 'ok' | 'low' | 'depleted' = useMemo(() => {
    if (budget === null) return 'ok'
    if (budget <= 0) return spent > 0 ? 'depleted' : 'ok'
    if (remaining <= 0) return 'depleted'
    if (remaining <= 0.25 * budget) return 'low'
    return 'ok'
  }, [budget, remaining, spent])

  const egp = (v: number) => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(v)

  useEffect(() => {
    if (currentScoutYear?.id) void init()
  }, [currentScoutYear?.id])

  async function init() {
    setLoading(true)
    try {
      const [tm, ts] = await Promise.all([fetchTerms(), fetchTeams()])
      setBudget(null); setBudgetRecord(null); setBudgetAudit([]); setBudgetDraft(''); setSpent(0); setTermId('')
      setTerms(tm)
      setTeams(ts)
      if (ts.length) setTeamId(ts[0].id)
      setTermId(tm[0]?.id || '')
    } catch (e: any) {
      toast.error(e.message || 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setBudget(null); setBudgetRecord(null); setBudgetAudit([]); setBudgetDraft(''); setSpent(0)
    if (teamId && termId && termBounds) void refresh()
  }, [teamId, termId, currentScoutYear?.id, termBounds?.start, termBounds?.end])

  async function refresh() {
    setLoading(true)
    try {
      if (!termBounds) { setBudget(null); setBudgetRecord(null); setBudgetDraft(''); setSpent(0); return }
      const [{ data: bRow, error: bErr }, { data: exRows, error: eErr }] = await Promise.all([
        supabase.from('team_budgets').select('id,amount_total,created_at,created_by,confirmed_at,confirmed_by,scout_year_id').eq('team_id', teamId).eq('term_id', termId).eq('scout_year_id', currentScoutYear!.id).is('soft_deleted_at', null).maybeSingle(),
        supabase.from('expenses').select('total').eq('team_id', teamId).eq('term_id', termId).gte('expense_date', termBounds.start).lte('expense_date', termBounds.end).is('soft_deleted_at', null),
      ])
      if (bErr) throw bErr
      if (eErr) throw eErr
      const record = (bRow || null) as BudgetRecord | null
      setBudgetRecord(record)
      setBudgetDraft(record ? String(record.amount_total) : '')
      // The real current year's existing values need explicit Super Admin confirmation.
      setBudget(record && (!currentScoutYear?.is_current || record.confirmed_at) ? Number(record.amount_total) : null)
      setBudgetAudit([])
      if (record?.id) {
        const { data: auditData } = await supabase.from('v_audit_log_readable')
          .select('action,created_at,actor_name,actor_user_id,source')
          .eq('entity_type', 'team_budgets').eq('entity_id', record.id).order('created_at', { ascending: false }).limit(4)
        setBudgetAudit((auditData || []) as BudgetAudit[])
      }
      setSpent(((exRows as any[]) ?? []).reduce((sum, row) => sum + Number(row.total || 0), 0))
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحميل الميزانية')
    } finally {
      setLoading(false)
    }
  }

  const budgetUsagePct = budget && budget > 0 ? Math.max(0, Math.round((spent / budget) * 100)) : 0
  const selectedTeam = teams.find((team) => team.id === teamId) || null
  const selectedTerm = terms.find((term) => term.id === termId) || null

  async function saveBudget() {
    if (!teamId || !termId || !termBounds) {
      toast.error('اختر الفريق والترم')
      return
    }

    if (isReadOnlyView) return toast.error('السنوات السابقة للعرض فقط؛ لا يمكن تعديل ميزانيتها')
    if (!budgetDraft.trim()) return toast.error('اكتب قيمة الميزانية أولًا')
    const val = Number(budgetDraft)
    if (!isFinite(val) || val < 0) return toast.error('قيمة الميزانية غير صالحة')

    setSaving(true)
    try {
      const { data: saved, error } = await supabase
        .from('team_budgets')
        .upsert({ team_id: teamId, term_id: termId, scout_year_id: currentScoutYear!.id, amount_total: val, confirmed_at: new Date().toISOString() }, { onConflict: 'team_id,term_id' })
        .select('id,amount_total').single()
      if (error) throw error
      void safeWriteAuditLog({
        action: budgetRecord ? 'update' : 'create', module: 'finance', entityType: 'team_budgets',
        entityId: saved.id, scoutYearId: currentScoutYear!.id, teamId, source: 'AdminFinance',
        summary: `تأكيد ميزانية ${selectedTeam?.name || ''} - ${selectedTerm?.name || ''} للسنة ${currentScoutYear?.name || ''}`,
        before: budgetRecord ? { amount_total: budgetRecord.amount_total, confirmed_at: budgetRecord.confirmed_at } : null,
        after: { amount_total: val, scout_year_id: currentScoutYear!.id, confirmed: true },
      })
      toast.success('تم حفظ واعتماد الميزانية للسنة المختارة')
      await refresh()
    } catch (e: any) {
      toast.error(e.message || 'تعذر حفظ الميزانية')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="finance123-page space-y-5 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        className="finance123-hero"
        eyebrow="المالية"
        title="إدارة الميزانية"
        description={`اعتماد ميزانيات الفرق حسب الترم والسنة الكشفية ${currentScoutYear?.name || ''}. الأرصدة الموروثة لا تدخل الإجماليات حتى تؤكدها بنفسك.`}
        badge={<span className="finance123-hero-badge">Finance Admin</span>}
      />

      <div className="finance123-kpis grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="الميزانية الحالية" value={budget !== null ? egp(budget) : '—'} hint={selectedTeam?.name || 'اختر الفريق'} accent="navy" />
        <MetricCard label="المصروف" value={egp(spent)} hint={selectedTerm ? `${selectedTerm.year} — ${selectedTerm.name}` : '—'} accent="rose" />
        <MetricCard label="المتبقي" value={budget === null ? '—' : egp(remaining)} hint={budget === null ? 'بانتظار اعتماد الميزانية' : status === 'low' ? 'تحذير: أقل من 25%' : status === 'depleted' ? 'انتهت الميزانية' : 'الوضع المالي مستقر'} accent={status === 'depleted' ? 'rose' : status === 'low' ? 'amber' : 'emerald'} />
        <MetricCard label="نسبة الاستهلاك" value={`${budgetUsagePct}%`} hint={budget ? 'المصروف من الميزانية' : 'لا توجد ميزانية محددة'} accent={budgetUsagePct >= 100 ? 'rose' : budgetUsagePct >= 75 ? 'amber' : 'sky'} />
      </div>

      <div className="finance123-workspace">
        <SectionCard className="finance123-budget-card" title="تحديد ميزانية الفريق" description={`ميزانية السنة الكشفية: ${currentScoutYear?.name || 'غير محددة'} — لا يتم اعتماد أي قيمة قديمة تلقائيًا.`}>
          <div className="finance123-form-grid">
            <label className="finance123-field"><span>الفريق</span><select value={teamId} onChange={(e) => setTeamId(e.target.value)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label className="finance123-field"><span>الترم</span><select value={termId} onChange={(e) => setTermId(e.target.value)}>{terms.map((term) => <option key={term.id} value={term.id}>{term.year} — {term.name}</option>)}</select></label>
            <label className="finance123-field finance123-budget-input"><span>قيمة الميزانية (EGP)</span><input id="budgetInput" type="number" min={0} step="0.01" value={budgetDraft} placeholder="لم تُحدّد الميزانية" disabled={isReadOnlyView || !termBounds} onChange={(event) => setBudgetDraft(event.target.value)} /></label>
            <LoadingButton className="finance123-save" loading={saving} disabled={isReadOnlyView || !termBounds} onClick={saveBudget}>{budgetRecord?.confirmed_at ? 'تحديث الميزانية' : 'حفظ واعتماد الميزانية'}</LoadingButton>
          </div>
          {budgetRecord && (
            <div className={`mt-4 rounded-xl border p-3 text-sm ${!budgetRecord.confirmed_at && currentScoutYear?.is_current ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
              <strong>{!budgetRecord.confirmed_at && currentScoutYear?.is_current ? '⚠️ سجل ميزانية سابق غير معتمد لهذه السنة' : 'سجل الميزانية المحفوظ'}</strong>
              <p className="mt-1">القيمة المسجلة: {egp(Number(budgetRecord.amount_total))} — التاريخ: {budgetRecord.created_at ? new Date(budgetRecord.created_at).toLocaleString('ar-EG') : 'غير معروف'}</p>
              <p className="mt-1">معرّف مُنشئ السجل: {budgetRecord.created_by || 'غير مسجل'} — رقم السجل: {budgetRecord.id}</p>
              {budgetAudit.length > 0 && <p className="mt-1">آخر عملية: {budgetAudit[0].action} — {budgetAudit[0].actor_name || budgetAudit[0].actor_user_id || 'مستخدم غير معروف'} ({budgetAudit[0].source || 'قاعدة البيانات'})</p>}
              {!budgetRecord.confirmed_at && currentScoutYear?.is_current && <p className="mt-2 font-semibold">لن يظهر هذا المبلغ في بطاقات الميزانية أو تقارير السنة الحالية إلا بعد مراجعته والضغط على «حفظ واعتماد الميزانية». لن يتم حذفه.</p>}
            </div>
          )}
          {!budgetRecord && termBounds && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">لا توجد ميزانية مسجلة لهذا الفريق والترم في {currentScoutYear?.name}. يمكنك تحديدها من هنا.</div>}
        </SectionCard>

        <SectionCard className="finance123-health-card" title="حالة الميزانية" description="قراءة سريعة للميزانية الحالية والمصروف الفعلي المسجل بالفعل في صفحة الفريق.">
          <div className="finance123-health">
            <div className="finance123-ring" style={{ '--finance-progress': `${Math.min(budgetUsagePct, 100) * 3.6}deg` } as any}>
              <div><strong>{budgetUsagePct}%</strong><span>مستهلك</span></div>
            </div>
            <div className="finance123-health-copy">
              <span className={`finance123-status is-${status}`}>{budget === null ? 'بانتظار اعتماد الميزانية' : status === 'depleted' ? 'الميزانية منتهية' : status === 'low' ? 'المتبقي منخفض' : 'الوضع مستقر'}</span>
              <div><span>الفريق</span><strong>{selectedTeam?.name || '—'}</strong></div>
              <div><span>الترم</span><strong>{selectedTerm ? `${selectedTerm.year} — ${selectedTerm.name}` : '—'}</strong></div>
              <div><span>المتبقي</span><strong>{budget === null ? '—' : egp(remaining)}</strong></div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard className="finance123-note" title="مسار العمل الحالي" tone="subtle">
        <div className="finance123-note-grid">
          <div><b>1</b><span><strong>اختر الفريق والترم</strong><small>يتم تحميل الميزانية والمصروف المسجلين حاليًا تلقائيًا.</small></span></div>
          <div><b>2</b><span><strong>عدّل قيمة الميزانية</strong><small>القيمة هنا هي إجمالي ميزانية الفريق للترم المختار.</small></span></div>
          <div><b>3</b><span><strong>احفظ</strong><small>تسجيل المصروفات اليومية يظل في صفحة الفريق كما هو بدون أي تغيير.</small></span></div>
        </div>
      </SectionCard>
    </div>
  )
}
