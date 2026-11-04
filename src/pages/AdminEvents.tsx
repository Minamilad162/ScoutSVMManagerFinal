import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toaster'
import { PageLoader } from '../components/ui/PageLoader'
import { LoadingButton } from '../components/ui/LoadingButton'
import { EmptyState } from '../components/ui/EmptyState'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { useScoutYear } from '../components/ScoutYearProvider'

type EventRow = {
  id: string
  title: string
  content: string | null
  starts_at: string
  location: string | null
  created_at: string
}

export default function AdminEvents() {
  const toast = useToast()
  const { currentScoutYear } = useScoutYear()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [when, setWhen] = useState('')
  const [location, setLocation] = useState('')

  const [rows, setRows] = useState<EventRow[]>([])

  useEffect(() => {
    void init()
  }, [])

  async function init() {
    setLoading(true)
    try {
      const now = new Date()
      now.setDate(now.getDate() + 3)
      now.setHours(18, 0, 0, 0)
      const pad = (n: number) => String(n).padStart(2, '0')
      setWhen(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`)

      await refresh()
    } catch (e: any) {
      toast.error(e.message || 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }

  async function refresh() {
    let query = supabase
      .from('events')
      .select('id,title,content,starts_at,location,created_at')
      .is('soft_deleted_at', null) as any
    if (currentScoutYear?.start_date) query = query.gte('starts_at', `${currentScoutYear.start_date}T00:00:00`)
    if (currentScoutYear?.end_date) query = query.lte('starts_at', `${currentScoutYear.end_date}T23:59:59`)
    const { data, error } = await query.order('starts_at', { ascending: false })
    if (error) return toast.error(error.message || 'تعذر تحميل الفعاليات')
    setRows((data as any) ?? [])
  }

  async function save() {
    if (!title.trim()) return toast.error('أدخل عنوان الفعالية')
    if (!when) return toast.error('اختر الموعد')

    setSaving(true)
    try {
      const starts_at = new Date(when).toISOString()
      const { error } = await supabase.from('events').insert({
        title: title.trim(),
        content: content.trim() || null,
        starts_at,
        location: location.trim() || null,
      })
      if (error) throw error

      toast.success('تم إنشاء الفعالية وإرسال الإشعار للجميع')
      setTitle('')
      setContent('')
      setLocation('')
      await refresh()
    } catch (e: any) {
      toast.error(e.message || 'تعذر إنشاء الفعالية')
    } finally {
      setSaving(false)
    }
  }

  async function softDelete(id: string) {
    setDeleting(id)
    try {
      const { error } = await supabase
        .from('events')
        .update({ soft_deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      toast.success('تم حذف الفعالية')
      await refresh()
    } catch (e: any) {
      toast.error(e.message || 'تعذر الحذف')
    } finally {
      setDeleting(null)
    }
  }

  const upcomingCount = useMemo(() => rows.filter((row) => new Date(row.starts_at).getTime() >= Date.now()).length, [rows])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        eyebrow="إدارة الفعاليات"
        title="إنشاء الفعاليات العامة وإرسالها للمستخدمين"
        description="من هذه الشاشة يمكنك إضافة فعالية عامة بمكانها وموعدها وتفاصيلها، مع الحفاظ على سجل واضح للفعاليات السابقة داخل النظام."
        badge={<span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Admin</span>}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="إجمالي الفعاليات" value={rows.length} accent="indigo" />
        <MetricCard label="الفعاليات القادمة" value={upcomingCount} accent="emerald" />
        <MetricCard label="آخر تحديث" value={rows[0] ? new Date(rows[0].starts_at).toLocaleDateString('ar-EG') : '—'} accent="sky" />
      </div>

      <SectionCard title="إنشاء فعالية جديدة" description="املأ البيانات الأساسية ثم أرسل الإشعار للجميع بضغطة واحدة.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="min-w-0">
            <label className="mb-1 block text-sm font-medium text-slate-700">العنوان</label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: اجتماع السبت"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-sm font-medium text-slate-700">الموعد</label>
            <input type="datetime-local" className="w-full rounded-2xl border border-slate-300 px-3 py-2" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div className="md:col-span-2 min-w-0">
            <label className="mb-1 block text-sm font-medium text-slate-700">المكان</label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-3 py-2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="مثال: مقر الكشافة"
            />
          </div>
          <div className="md:col-span-2 min-w-0">
            <label className="mb-1 block text-sm font-medium text-slate-700">التفاصيل</label>
            <textarea
              className="min-h-[140px] w-full resize-y rounded-2xl border border-slate-300 px-3 py-2"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="تفاصيل إضافية..."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <LoadingButton loading={saving} onClick={save}>إنشاء وإرسال</LoadingButton>
        </div>
      </SectionCard>

      <SectionCard title="الفعاليات السابقة" description="يمكنك مراجعة الفعاليات المنشأة مؤخرًا أو حذف فعالية لم تعد مطلوبة.">
        {rows.length === 0 ? (
          <EmptyState title="لا توجد فعاليات حتى الآن" description="ابدأ بإضافة فعالية جديدة لتظهر هنا بشكل منظم مع الموعد والمكان والتفاصيل." />
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-200" dir="ltr" style={{ WebkitOverflowScrolling: 'touch' as any }}>
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-100/80 text-slate-700">
                <tr>
                  <th className="p-3 text-start">العنوان</th>
                  <th className="p-3 text-start whitespace-nowrap">الموعد</th>
                  <th className="p-3 text-start">المكان</th>
                  <th className="p-3 text-start">التفاصيل</th>
                  <th className="p-3 text-center whitespace-nowrap">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-200 align-top bg-white">
                    <td className="p-3 break-words font-semibold text-slate-800">{r.title}</td>
                    <td className="p-3 whitespace-nowrap text-slate-600">
                      <time dateTime={r.starts_at}>{new Date(r.starts_at).toLocaleString('ar-EG')}</time>
                    </td>
                    <td className="p-3 break-words text-slate-600">{r.location || '—'}</td>
                    <td className="p-3 whitespace-pre-wrap break-words text-slate-600">{r.content || '—'}</td>
                    <td className="p-3 text-center">
                      <button className="btn border" disabled={deleting === r.id} onClick={() => softDelete(r.id)}>
                        {deleting === r.id ? '...' : 'حذف'}
                      </button>
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
