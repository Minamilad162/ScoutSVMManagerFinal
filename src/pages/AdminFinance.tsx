import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toaster'
import { PageLoader } from '../components/ui/PageLoader'
import { LoadingButton } from '../components/ui/LoadingButton'
import { fetchTeams, fetchTerms } from '../features/reference/api'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'

type Team = { id: string; name: string }
type Term = { id: string; name: string; year: number }

export default function AdminFinance() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [teams, setTeams] = useState<Team[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [teamId, setTeamId] = useState('')
  const [termId, setTermId] = useState('')

  const [budget, setBudget] = useState<number | null>(null)
  const [spent, setSpent] = useState(0)

  const remaining = useMemo(() => (budget ?? 0) - spent, [budget, spent])
  const status: 'ok' | 'low' | 'depleted' = useMemo(() => {
    if (!budget || budget <= 0) return spent > 0 ? 'depleted' : 'ok'
    if (remaining <= 0) return 'depleted'
    if (remaining <= 0.25 * budget) return 'low'
    return 'ok'
  }, [budget, remaining, spent])

  const egp = (v: number) => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(v)

  useEffect(() => {
    void init()
  }, [])

  async function init() {
    setLoading(true)
    try {
      const [tm, ts] = await Promise.all([fetchTerms(), fetchTeams()])
      setTerms(tm)
      setTeams(ts)
      if (ts.length) setTeamId(ts[0].id)
      if (tm.length) setTermId(tm[0].id)
    } catch (e: any) {
      toast.error(e.message || 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (teamId && termId) void refresh()
  }, [teamId, termId])

  async function refresh() {
    setLoading(true)
    try {
      const [{ data: bRow, error: bErr }, { data: exRows, error: eErr }] = await Promise.all([
        supabase.from('team_budgets').select('amount_total').eq('team_id', teamId).eq('term_id', termId).is('soft_deleted_at', null).maybeSingle(),
        supabase.from('expenses').select('total').eq('team_id', teamId).eq('term_id', termId).is('soft_deleted_at', null),
      ])
      if (bErr) throw bErr
      if (eErr) throw eErr
      setBudget(bRow?.amount_total ?? null)
      setSpent(((exRows as any[]) ?? []).reduce((sum, row) => sum + Number(row.total || 0), 0))
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحميل الميزانية')
    } finally {
      setLoading(false)
    }
  }

  async function saveBudget() {
    if (!teamId || !termId) {
      toast.error('اختر الفريق والترم')
      return
    }

    const val = Number((document.getElementById('budgetInput') as HTMLInputElement | null)?.value ?? budget ?? 0)
    if (!isFinite(val) || val < 0) return toast.error('قيمة الميزانية غير صالحة')

    setSaving(true)
    try {
      const { error } = await supabase
        .from('team_budgets')
        .upsert({ team_id: teamId, term_id: termId, amount_total: val }, { onConflict: 'team_id,term_id' })
      if (error) throw error
      toast.success('تم حفظ الميزانية')
      await refresh()
    } catch (e: any) {
      toast.error(e.message || 'تعذر حفظ الميزانية')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="finance99-page adminfinance99-page space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        className="finance99-hero"
        eyebrow="إدارة المالية"
        title="تعيين ميزانية الترم لكل فريق"
        description="هذه الصفحة مخصصة للأدمن أو المسؤول العام لتحديد ميزانية كل فريق داخل الترم ومتابعة المصروف والمتبقي بشكل واضح وسريع."
        badge={<span className="finance99-admin-badge rounded-full border px-3 py-1 text-xs font-semibold">Finance Admin</span>}
      />

      <div className="finance99-metrics grid gap-3 md:grid-cols-3">
        <MetricCard label="الميزانية الحالية" value={budget !== null ? egp(budget) : '—'} accent="indigo" />
        <MetricCard label="المصروف" value={egp(spent)} accent="amber" />
        <MetricCard label="المتبقي" value={egp(remaining)} hint={status === 'low' ? 'تحذير: أقل من 25%' : status === 'depleted' ? 'انتهت الميزانية' : 'الوضع المالي مستقر'} accent={status === 'depleted' ? 'rose' : status === 'low' ? 'amber' : 'emerald'} />
      </div>

      <SectionCard className="finance99-section finance99-scope" title="تحديد الفريق والترم" description="اختر الفريق والترم أولًا، ثم أدخل قيمة الميزانية الجديدة واحفظها.">
        <div className="grid gap-3 md:grid-cols-3 md:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الفريق</label>
            <select className="w-full rounded-2xl border border-slate-300 px-3 py-2 cursor-pointer" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الترم</label>
            <select className="w-full rounded-2xl border border-slate-300 px-3 py-2 cursor-pointer" value={termId} onChange={(e) => setTermId(e.target.value)}>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.year} — {t.name}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">قيمة الميزانية (EGP)</div>
            <div className="flex gap-2">
              <input id="budgetInput" type="number" min={0} step="0.01" defaultValue={budget ?? 0} className="w-full rounded-2xl border border-slate-300 px-3 py-2" />
              <LoadingButton loading={saving} onClick={saveBudget}>حفظ</LoadingButton>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="finance99-section finance99-note" title="ملاحظات تشغيلية" tone="subtle">
        <div className="text-sm leading-7 text-slate-600">
          هذه الصفحة مخصصة لتعيين الميزانية فقط. تسجيل المصروفات اليومية يتم من صفحة الفريق نفسها، بينما يظهر هنا أثر المصروفات على الميزانية الكلية للترم المختار.
        </div>
      </SectionCard>
    </div>
  )
}
