
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toaster'
import { LoadingButton } from '../components/ui/LoadingButton'
import { PageLoader } from '../components/ui/PageLoader'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { useRoleGate } from '../hooks/useRoleGate'
import { useAuth } from '../components/AuthProvider'
import { fetchCurrentUserContext, fetchTeams, fetchTerms } from '../features/reference/api'
import { clampDateToBounds, getTermYearBounds, inDateBounds } from '../lib/scoutYearScope'
import { useScoutYear } from '../components/ScoutYearProvider'
import { getErrorMessage, logError } from '../lib/errors'

type Team = { id: string; name: string }
type Term = { id: string; name: string; year: number; start_date: string | null; end_date: string | null }
type Expense = { id: string; expense_date: string; item_name: string; qty: number; unit_price: number; total: number }

export default function Finance() {
  const toast = useToast()
  const { currentScoutYear } = useScoutYear()
  const gate = useRoleGate()
  const { roles } = useAuth()

  const [teams, setTeams] = useState<Team[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [teamId, setTeamId] = useState<string>('')
  const [termId, setTermId] = useState<string>('')

  const [budget, setBudget] = useState<number | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Expense form
  const termMeta = terms.find(t => t.id === termId) || null
  const termBounds = termMeta ? getTermYearBounds(currentScoutYear, termMeta) : null
  const [exDate, setExDate] = useState<string>('')
  const [exName, setExName] = useState<string>('')
  const [exQty, setExQty] = useState<number | ''>('')
  const [exUnit, setExUnit] = useState<number | ''>('')
  const [savingExp, setSavingExp] = useState(false)

  const isAdmin = roles.some(r => r.role_slug === 'admin')
  const isGlobalFinance = roles.some(r => r.role_slug === 'responsable_finance' && (r.team_id === null || r.team_id === undefined))

  const egp = (v: number) => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(v)

  useEffect(() => {
    setTerms([]); setTermId(''); setBudget(null); setExpenses([])
    if (currentScoutYear?.id) void init()
  }, [currentScoutYear?.id])
  async function init() {
    setLoading(true)
    try {
      const [tm, ts] = await Promise.all([fetchTerms(), fetchTeams()])
      setTerms(tm)
      setTeams(ts)

      setTermId(tm[0]?.id || '')

      if (isAdmin || isGlobalFinance) {
        if (ts.length) setTeamId(ts[0].id)
      } else {
        const meRow = await fetchCurrentUserContext()
        if (!meRow?.team_id) throw new Error('لا يوجد فريق مرتبط بحسابك')
        setTeamId(meRow.team_id)
      }

      const today = new Date()
      const pad = (n:number)=>String(n).padStart(2,'0')
      setExDate(`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`)
    } catch (e:any) {
      logError('Finance.init', e)
      toast.error(getErrorMessage(e, 'تعذر تحميل البيانات'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setBudget(null); setExpenses([])
    if (teamId && termId && termBounds) void refreshData()
  }, [teamId, termId, currentScoutYear?.id, termBounds?.start, termBounds?.end])

  useEffect(() => { if (termBounds) setExDate(prev => clampDateToBounds(prev, termBounds)) }, [termBounds?.start, termBounds?.end])
  async function refreshData() {
    setLoading(true)
    try {
      if (!termBounds) { setBudget(null); setExpenses([]); return }
      const [{ data: bRow, error: bErr }, { data: expRows, error: eErr }] = await Promise.all([
        supabase.from('v_team_budgets_effective').select('amount_total').eq('team_id', teamId).eq('term_id', termId).is('soft_deleted_at', null).maybeSingle(),
        supabase.from('expenses').select('id, expense_date, item_name, qty, unit_price, total').eq('team_id', teamId).eq('term_id', termId).gte('expense_date', termBounds.start).lte('expense_date', termBounds.end).is('soft_deleted_at', null).order('expense_date', { ascending: false })
      ])
      if (bErr) throw bErr
      if (eErr) throw eErr
      setBudget(bRow?.amount_total ?? null)
      setExpenses((expRows as any[]) ?? [])
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل الميزانية/المصروفات')
    } finally {
      setLoading(false)
    }
  }

  const spent = useMemo(() => expenses.reduce((s, x) => s + (Number(x.total) || 0), 0), [expenses])
  const remaining = useMemo(() => (budget ?? 0) - spent, [budget, spent])
  const pct = useMemo(() => (budget && budget > 0 ? Math.min(100, Math.max(0, (spent / budget) * 100)) : 0), [budget, spent])
  const status: 'ok' | 'low' | 'depleted' = useMemo(() => {
    if (!budget || budget <= 0) return spent > 0 ? 'depleted' : 'ok'
    if (remaining <= 0) return 'depleted'
    if (remaining <= 0.25 * budget) return 'low'
    return 'ok'
  }, [budget, remaining, spent])

  async function addExpense() {
    if (!gate.canWriteExpense(teamId)) { toast.error('ليست لديك صلاحية إضافة مصروف'); return }
    if (!teamId || !termId || !termBounds) return toast.error('اختر ترمًا داخل السنة الكشفية الحالية')
    if (!inDateBounds(exDate, termBounds)) return toast.error('تاريخ المصروف خارج نطاق السنة الكشفية أو الترم')
    const q = Number(exQty); const u = Number(exUnit)
    if (!isFinite(q) || q <= 0) return toast.error('العدد غير صالح')
    if (!isFinite(u) || u < 0) return toast.error('سعر القطعة غير صالح')
    if (!exName.trim()) return toast.error('ادخل اسم المنتج')

    setSavingExp(true)
    try {
      const { error } = await supabase.from('expenses').insert({
        team_id: teamId, term_id: termId,
        expense_date: exDate,
        item_name: exName.trim(),
        qty: q, unit_price: u
      })
      if (error) throw error
      toast.success('تم إضافة المصروف')
      setExName(''); setExQty(''); setExUnit('')
      await refreshData()
    } catch (e:any) {
      toast.error(e.message || 'تعذر إضافة المصروف')
    } finally {
      setSavingExp(false)
    }
  }

  return (
    <div className="finance99-page space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري تحميل البيانات..." />

      <PageHero
        className="finance99-hero"
        eyebrow="مالية الفريق"
        title="متابعة الميزانية والمصروفات اليومية"
        description="راجع ميزانية الترم الحالية، أضف المصروفات المعتمدة، وتابع حالة الصرف والمتبقي بشكل أوضح."
      />

      <SectionCard className="finance99-section finance99-scope" title="اختيار الفريق والترم" description="يتم تحميل الميزانية والمصروفات بناءً على الفريق والترم المختارين.">
      <div className="grid gap-3 md:grid-cols-3 md:items-end">
        <div className={`${(isAdmin || isGlobalFinance) ? '' : 'opacity-60 pointer-events-none'}`}>
          <label className="text-sm">الفريق</label>
          <select className="border rounded-xl p-2 w-full cursor-pointer" value={teamId} onChange={e=>setTeamId(e.target.value)}>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {!(isAdmin || isGlobalFinance) && <div className="text-xs text-gray-500">لا يمكن تغيير الفريق إلا للأدمن/المسؤول العام</div>}
        </div>

        <div>
          <label className="text-sm">الترم</label>
          <select className="border rounded-xl p-2 w-full cursor-pointer" value={termId} onChange={e=>setTermId(e.target.value)}>
            {terms.map(t => <option key={t.id} value={t.id}>{t.year} — {t.name}</option>)}
          </select>
        </div>

        <div className="text-end">
          <div className="text-xs text-slate-500">تحديد الميزانية واعتمادها يتم من إدارة الميزانية بواسطة الأدمن.</div>
        </div>
      </div>
      </SectionCard>

      <div className="finance99-metrics grid gap-3 md:grid-cols-3">
        <MetricCard label="ميزانية الترم" value={budget !== null ? egp(budget) : '—'} accent="indigo" />
        <MetricCard label="المصروف" value={egp(spent)} accent="amber" />
        <MetricCard label="المتبقي" value={egp(remaining)} hint={status==='low' ? 'تحذير: أقل من 25%' : status==='depleted' ? 'انتهت الميزانية' : 'الوضع المالي مستقر'} accent={status==='depleted' ? 'rose' : status==='low' ? 'amber' : 'emerald'} />
      </div>

      <div className="finance99-budget-progress" aria-label={`تم استخدام ${pct.toFixed(0)}% من الميزانية`}>
        <div className="finance99-budget-progress-head">
          <span>استخدام الميزانية</span>
          <strong>{pct.toFixed(0)}%</strong>
        </div>
        <div className="finance99-budget-progress-track"><span style={{ width: `${pct}%` }} /></div>
        <div className="finance99-budget-progress-foot"><span>المصروف {egp(spent)}</span><span>المتبقي {egp(remaining)}</span></div>
      </div>

      <SectionCard className="finance99-section finance99-expenses-card" title="المصروفات" description="أضف المصروفات المسجلة خلال الترم وراجع الحركة المالية الحالية بشكل منظم.">
        {gate.canWriteExpense(teamId) && (
          <div className="finance99-form grid md:grid-cols-5 gap-2 items-end">
            <div>
              <label className="text-sm">التاريخ</label>
              <input type="date" min={termBounds?.start} max={termBounds?.end} className="border rounded-xl p-2 w-full" value={exDate} onChange={e=>setExDate(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm">اسم المنتج</label>
              <input className="border rounded-xl p-2 w-full" value={exName} onChange={e=>setExName(e.target.value)} placeholder="مثلاً: أدوات..." />
            </div>
            <div>
              <label className="text-sm">العدد</label>
              <input type="number" min={1} className="border rounded-xl p-2 w-full" value={exQty} onChange={e=>setExQty(e.target.value as any)} />
            </div>
            <div>
              <label className="text-sm">سعر القطعة</label>
              <input type="number" min={0} step="0.01" className="border rounded-xl p-2 w-full" value={exUnit} onChange={e=>setExUnit(e.target.value as any)} />
            </div>
            <div className="md:col-span-5 flex justify-end">
              <LoadingButton loading={savingExp} onClick={addExpense}>إضافة مصروف</LoadingButton>
            </div>
          </div>
        )}

        <div className="finance99-table-wrap border rounded-2xl overflow-hidden">
          <table className="finance99-table w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-start">التاريخ</th>
                <th className="p-2 text-start">المنتج</th>
                <th className="p-2 text-center">العدد</th>
                <th className="p-2 text-center">سعر القطعة</th>
                <th className="p-2 text-center">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(x => (
                <tr key={x.id} className="border-t">
                  <td className="p-2">{x.expense_date}</td>
                  <td className="p-2">{x.item_name}</td>
                  <td className="p-2 text-center">{x.qty}</td>
                  <td className="p-2 text-center">{egp(Number(x.unit_price))}</td>
                  <td className="p-2 text-center">{egp(Number(x.total))}</td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td className="p-3 text-center text-gray-500" colSpan={5}>لا توجد مصروفات</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
