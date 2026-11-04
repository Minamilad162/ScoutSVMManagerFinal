import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toaster'
import { PageLoader } from '../components/ui/PageLoader'
import { LoadingButton } from '../components/ui/LoadingButton'
import { EmptyState } from '../components/ui/EmptyState'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'

type Q = {
  id: number
  question_text: string
  weight: number
  active: boolean
  created_at?: string
}

export default function AdminEvalQuestions() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Q[]>([])
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [qText, setQText] = useState('')
  const [qWeight, setQWeight] = useState<number | ''>('')
  const [qActive, setQActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const [savingRow, setSavingRow] = useState<number | null>(null)
  const [deletingRow, setDeletingRow] = useState<number | null>(null)

  useEffect(() => { void refresh() }, [])
  async function refresh() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('evaluation_questions')
        .select('id, question_text, weight, active, created_at')
        .order('active', { ascending: false })
        .order('weight', { ascending: false })
        .order('id', { ascending: false })
      if (error) throw error
      setRows((data as any) ?? [])
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحميل الأسئلة')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (!showInactive && !r.active) return false
      if (!s) return true
      return r.question_text.toLowerCase().includes(s) || String(r.weight).includes(s)
    })
  }, [rows, search, showInactive])

  async function addQuestion() {
    if (!qText.trim()) return toast.error('أدخل نص السؤال')
    const w = Number(qWeight)
    if (!Number.isFinite(w) || w < 0 || w > 100) return toast.error('القيمة يجب أن يكون بين 0 و 100')

    setSaving(true)
    try {
      const { error } = await supabase.from('evaluation_questions').insert({ question_text: qText.trim(), weight: w, active: qActive })
      if (error) throw error
      toast.success('تمت الإضافة')
      setQText('')
      setQWeight('')
      setQActive(true)
      await refresh()
    } catch (e: any) {
      toast.error(e.message || 'تعذر الإضافة')
    } finally {
      setSaving(false)
    }
  }

  async function saveRow(r: Q) {
    setSavingRow(r.id)
    try {
      const w = Number(r.weight)
      if (!Number.isFinite(w) || w < 0 || w > 100) throw new Error('القيمة يجب أن يكون بين 0 و 100')
      const { error } = await supabase
        .from('evaluation_questions')
        .update({ question_text: r.question_text.trim(), weight: w, active: r.active })
        .eq('id', r.id)
      if (error) throw error
      toast.success('تم الحفظ')
      await refresh()
    } catch (e: any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally {
      setSavingRow(null)
    }
  }

  async function removeRow(id: number) {
    if (!confirm('هل تريد حذف هذا السؤال؟ سيؤثر ذلك على الإجابات المرتبطة به.')) return
    setDeletingRow(id)
    try {
      const { error } = await supabase.from('evaluation_questions').delete().eq('id', id)
      if (error) throw error
      toast.success('تم الحذف')
      setRows((prev) => prev.filter((x) => x.id !== id))
    } catch (e: any) {
      toast.error(e.message || 'تعذر الحذف')
    } finally {
      setDeletingRow(null)
    }
  }

  const activeCount = rows.filter((row) => row.active).length

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        eyebrow="إعدادات التقييم"
        title="إدارة بنك أسئلة التقييم"
        description="أضف الأسئلة، حدّث وزن كل سؤال، أو عطّل الأسئلة القديمة مع بقاء سجلها داخل النظام."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="إجمالي الأسئلة" value={rows.length} accent="indigo" />
        <MetricCard label="الأسئلة النشطة" value={activeCount} accent="emerald" />
        <MetricCard label="الأسئلة الظاهرة حاليًا" value={filtered.length} accent="sky" />
      </div>

      <SectionCard
        title="البحث والإضافة"
        description="يمكنك البحث داخل الأسئلة الحالية ثم إضافة سؤال جديد بنفس الشاشة."
        actions={<button className="btn border" onClick={() => void refresh()}>تحديث</button>}
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">بحث</label>
            <input className="w-full rounded-2xl border border-slate-300 px-3 py-2" placeholder="ابحث في نص السؤال أو الوزن" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">إظهار غير النشطة</label>
            <label className="flex min-h-[42px] items-center gap-2 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              عرض الأسئلة المعطلة أيضًا
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">نص السؤال</label>
            <input className="w-full rounded-2xl border border-slate-300 px-3 py-2" value={qText} onChange={(e) => setQText(e.target.value)} placeholder="مثلاً: يلتزم بمواعيد الحضور؟" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">القيمة (0–100)</label>
            <input type="number" min={0} max={100} className="w-full rounded-2xl border border-slate-300 px-3 py-2" value={qWeight} onChange={(e) => setQWeight(e.target.value as any)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">نشط؟</label>
            <select className="w-full rounded-2xl border border-slate-300 px-3 py-2" value={String(qActive)} onChange={(e) => setQActive(e.target.value === 'true')}>
              <option value="true">نعم</option>
              <option value="false">لا</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <LoadingButton loading={saving} onClick={addQuestion}>إضافة السؤال</LoadingButton>
        </div>
      </SectionCard>

      <SectionCard title="قائمة الأسئلة" description="يمكنك تعديل النص والوزن والحالة مباشرة، ثم حفظ كل صف بشكل مستقل.">
        {filtered.length === 0 ? (
          <EmptyState title="لا توجد أسئلة مطابقة" description="جرّب تعديل البحث أو أضف سؤالًا جديدًا ليظهر هنا." />
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-100/80 text-slate-700">
                <tr>
                  <th className="p-3 text-start w-[60px]">#</th>
                  <th className="p-3 text-start">السؤال</th>
                  <th className="p-3 text-center w-[120px]">القيمة</th>
                  <th className="p-3 text-center w-[120px]">نشط</th>
                  <th className="p-3 text-center w-[180px]">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200 align-top bg-white">
                    <td className="p-3 font-semibold text-slate-700">{r.id}</td>
                    <td className="p-3">
                      <input className="w-full rounded-2xl border border-slate-300 px-3 py-2" value={r.question_text} onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, question_text: e.target.value } : x)))} />
                    </td>
                    <td className="p-3 text-center">
                      <input type="number" min={0} max={100} className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-center sm:w-24" value={r.weight} onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, weight: Number(e.target.value) } : x)))} />
                    </td>
                    <td className="p-3 text-center">
                      <select className="w-full rounded-2xl border border-slate-300 px-3 py-2 sm:w-auto" value={String(r.active)} onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: e.target.value === 'true' } : x)))}>
                        <option value="true">نعم</option>
                        <option value="false">لا</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <LoadingButton className="w-full sm:w-auto" loading={savingRow === r.id} onClick={() => saveRow(r)}>حفظ</LoadingButton>
                        <button className="btn border w-full sm:w-auto" disabled={deletingRow === r.id} onClick={() => removeRow(r.id)}>
                          {deletingRow === r.id ? '...' : 'حذف'}
                        </button>
                      </div>
                    </td>
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
