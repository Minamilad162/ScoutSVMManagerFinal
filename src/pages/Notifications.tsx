import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { EmptyState } from '../components/ui/EmptyState'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { PageLoader } from '../components/ui/PageLoader'
import { SectionCard } from '../components/ui/SectionCard'
import { InlineAlert } from '../components/ui/InlineAlert'
import { useToast } from '../components/ui/Toaster'
import { useCurrentScoutYear } from '../hooks/useCurrentScoutYear'
import { ensurePushSubscription, getPushPermission } from '../lib/pushNotifications'

type Notif = {
  id: string
  ntype: string
  payload: any
  is_read: boolean
  created_at: string
}

/** -------- Helpers -------- */
const pickAny = (obj: any, ...keys: string[]) => {
  if (!obj) return undefined
  for (const k of keys) {
    const v = obj[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return undefined
}

function fmtDate(d?: string) {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(+dt)) return d
  return dt.toLocaleDateString()
}
function fmtTime(d?: string) {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(+dt)) return d
  return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function fmtDateTime(d?: string) {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(+dt)) return d
  return dt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}
function addOneDayISO(date?: string | null) {
  if (!date) return null
  const dt = new Date(`${date}T00:00:00`)
  dt.setDate(dt.getDate() + 1)
  return dt.toISOString()
}
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.round(diff/60000); if (m < 1) return 'الآن'
  if (m < 60) return `${m} د`
  const h = Math.round(m/60); if (h < 24) return `${h} س`
  const days = Math.round(h/24); return `${days} يوم`
}

function toNum(x: any): number | null {
  if (x === null || x === undefined || x === '') return null
  const n = Number(x)
  return Number.isFinite(n) ? n : null
}
function money(x: number | null | undefined) {
  if (x === null || x === undefined) return '—'
  return `${x}` // لو عايز تنسيق محلي: new Intl.NumberFormat('ar-EG').format(x)
}

/** نطبّع الـpayload لمفاتيح موحّدة + نحتفظ بالـextra كما هو */
function normalizePayload(p: any) {
  return {
    teamId:         pickAny(p, 'team_id', 'teamId'),
    teamName:       pickAny(p, 'team_name', 'teamName', 'team'),
    memberId:       pickAny(p, 'member_id', 'memberId', 'user_id'),
    memberName:     pickAny(p, 'member_name', 'memberName', 'user_name', 'name'),
    guardianName:   pickAny(p, 'guardian_name', 'guardianName'),
    guardianPhone:  pickAny(p, 'guardian_phone', 'guardianPhone'),
    role:           pickAny(p, 'role', 'role_name'),
    zoneId:         pickAny(p, 'zone_id', 'field_zone_id'),
    zoneName:       pickAny(p, 'zone_name', 'field_zone_name'),
    materialId:     pickAny(p, 'material_id'),
    materialName:   pickAny(p, 'material_name', 'item_name'),
    qty:            pickAny(p, 'qty', 'quantity'),
    from:           pickAny(p, 'from', 'starts_at', 'start'),
    to:             pickAny(p, 'to', 'ends_at', 'end'),
    meetingDate:    pickAny(p, 'meeting_date', 'last_meeting_date'),
    mtype:          pickAny(p, 'mtype', 'meeting_type'),
    termLabel:      pickAny(p, 'term_label', 'term_name'),
    termYear:       pickAny(p, 'term_year', 'year'),
    termId:         pickAny(p, 'term_id', 'termId'),

    // حقول مالية محتملة من السيرفر
    amountTotal:    pickAny(p, 'amount_total', 'budget_Amount', 'budget_total'),
    spentTotal:     pickAny(p, 'spent', 'expenses_sum', 'spent_total'),
    remaining:      pickAny(p, 'remaining', 'remaining_amount', 'remaing_total'),

    note:           pickAny(p, 'note', 'message'),
    extra:          p
  }
}

/** اشتقاق remaining إذا مش موجود: remaining || (amount_total - spent) */
function deriveRemaining(np: ReturnType<typeof normalizePayload>): number | null {
  const direct = toNum(np.remaining)
  if (direct !== null) return direct

  const amount = toNum(np.amountTotal)
    ?? toNum(pickAny(np.extra, 'amount_total', 'budget_Amount', 'budget_total'))
  const spent  = toNum(np.spentTotal)
    ?? toNum(pickAny(np.extra, 'spent', 'expenses_sum', 'spent_total'))

  if (amount !== null && spent !== null) return amount - spent
  return null
}

/** -------- Visual meta per notification type -------- */
const typeMeta: Record<string, {
  title: string
  tone: 'info'|'warn'|'danger'
  icon: string
  makeText: (n: Notif, np: ReturnType<typeof normalizePayload>) => string
}> = {
  budget_low: {
    title: 'تنبيه الميزانية',
    tone: 'warn',
    icon: '💸',
    makeText: (_, np) => {
      const team = np.teamName ?? '—'
      const rem  = deriveRemaining(np)
      return `ميزانية فريق ${team} أقل من 25%. المتبقي: ${money(rem)} EGP.`
    },
  },
  budget_depleted: {
    title: 'نفاد الميزانية',
    tone: 'danger',
    icon: '⛔',
    makeText: (_, np) => {
      const team = np.teamName ?? '—'
      return `ميزانية فريق ${team}${np.termLabel ? ` (ترم ${np.termLabel})` : ''} نفدت.`
    },
  },
  eval_due: {
    title: 'تقييمات مطلوبة',
    tone: 'warn',
    icon: '📝',
    makeText: (_, np) =>
      `باقي أسبوعين لانتهاء الترم${np.termLabel ? ` (${np.termLabel})` : ''}. ${Array.isArray(np.extra?.missing) && np.extra.missing.length ? `لم تُقيَّم: ${np.extra.missing.join('، ')}` : ''}`,
  },
  materials_conflict: {
    title: 'تعارض حجز أدوات',
    tone: 'danger',
    icon: '🧰',
    makeText: (_, np) =>
      `الأداة ${np.materialName ?? '—'} محجوزة لفريق ${np.teamName ?? '—'} من ${fmtTime(np.from)} إلى ${fmtTime(np.to)}.`,
  },
  field_conflict: {
    title: 'تعارض حجز أرض',
    tone: 'danger',
    icon: '🏕️',
    makeText: (_, np) =>
      `قطاع الأرض ${np.zoneName ?? '—'} محجوز لفريق ${np.teamName ?? '—'} من ${fmtTime(np.from)} إلى ${fmtTime(np.to)}.`,
  },
  event: {
    title: 'إشعار فعالية',
    tone: 'info',
    icon: '📅',
    makeText: (_, np) => {
      const t = np.extra?.title || 'فعالية'
      const when = np.from || np.extra?.starts_at
      const loc = np.extra?.location
      const body = np.extra?.content
      return `${t}${when ? ` — الموعد: ${fmtDateTime(when)}` : ''}${loc ? ` — المكان: ${loc}` : ''}${body ? ` — ${body}` : ''}`
    }
  },
  equipier_3_absences: {
    title: 'تحذير غياب متتالٍ (3 مرات)',
    tone: 'warn',
    icon: '🚸',
    makeText: (n, np) => {
      const name = np.memberName || '—'
      const team = np.teamName || '—'
      const dates: string[] = Array.isArray(n.payload?.dates) ? n.payload.dates : []
      const datesTxt = dates.length ? dates.map(fmtDate).join('، ') : '—'
      return `العضو ${name} (فريق ${team}) تغيّب 3 اجتماعات متتالية في التواريخ: ${datesTxt}`
    }
  },
  materials_return_all_ok: {
    title: 'تم تسليم العهدة كاملة',
    tone: 'info',
    icon: '✅',
    makeText: (_, np) => {
      const team = np.teamName || '—'
      const date = np.extra?.date || np.from || ''
      const total = np.extra?.total ?? np.amountTotal ?? ''
      return `الفريق ${team} سلّم العهدة كاملة${date ? ` بتاريخ ${date}` : ''}${total ? ` (عدد البنود: ${total})` : ''}.`
    }
  },



  // +++ أضف داخل typeMeta +++
field_reservation_updated: {
  title: 'تعديل حجز أرض',
  tone: 'warn',
  icon: '🗓️',
  makeText: (_, p) => {
    const who  = p.extra?.actor_name || 'مسؤول'
    const team = p.teamName || '—'
    const zOld = p.extra?.zone_old_name || '—'
    const zNew = p.extra?.zone_new_name || '—'
    const tOld = p.extra?.start_old && p.extra?.end_old ? `${fmtTime(p.extra.start_old)}–${fmtTime(p.extra.end_old)}` : '—'
    const tNew = p.extra?.start_new && p.extra?.end_new ? `${fmtTime(p.extra.start_new)}–${fmtTime(p.extra.end_new)}` : '—'
    return `${who} عدّل حجز الأرض لفريق ${team}: ${zOld} ${tOld} → ${zNew} ${tNew}`
  }
},
field_reservation_cancelled: {
  title: 'إلغاء حجز أرض',
  tone: 'danger',
  icon: '⛔',
  makeText: (_, p) => {
    const who  = p.extra?.actor_name || 'مسؤول'
    const team = p.teamName || '—'
    const zone = p.extra?.zone_old_name || '—'
    const tOld = p.extra?.start_old && p.extra?.end_old ? `${fmtTime(p.extra.start_old)}–${fmtTime(p.extra.end_old)}` : '—'
    return `${who} ألغى حجز الأرض (${zone} ${tOld}) لفريق ${team}.`
  }
},
materials_reservation_updated: {
  title: 'تعديل حجز أدوات',
  tone: 'warn',
  icon: '🧰',
  makeText: (_, p) => {
    const who  = p.extra?.actor_name || 'مسؤول'
    const team = p.teamName || '—'
    const item = p.materialName || p.materialName || '—'
    const qOld = p.extra?.qty_old ?? '—'
    const qNew = p.extra?.qty_new ?? '—'
    const tOld = p.extra?.start_old && p.extra?.end_old ? `${fmtTime(p.extra.start_old)}–${fmtTime(p.extra.end_old)}` : ''
    const tNew = p.extra?.start_new && p.extra?.end_new ? `${fmtTime(p.extra.start_new)}–${fmtTime(p.extra.end_new)}` : ''
    const timeTxt = (tOld || tNew) ? ` | وقت: ${tOld} → ${tNew}` : ''
    return `${who} عدّل حجز الأدوات لفريق ${team}: ${item} (الكمية ${qOld} → ${qNew})${timeTxt}`
  }
},
materials_reservation_cancelled: {
  title: 'إلغاء حجز أدوات',
  tone: 'danger',
  icon: '🧯',
  makeText: (_, p) => {
    const who  = p.extra?.actor_name || 'مسؤول'
    const team = p.teamName || '—'
    const item = p.materialName || p.materialName || '—'
    const qty  = p.qty ?? p.extra?.qty_old ?? '—'
    const tOld = p.extra?.start_old && p.extra?.end_old ? `${fmtTime(p.extra.start_old)}–${fmtTime(p.extra.end_old)}` : ''
    return `${who} ألغى حجز الأدوات (${item} × ${qty} ${tOld?`| ${tOld}`:''}) لفريق ${team}.`
  }
},





  materials_return_not_all: {
    title: 'لم يتم تسليم العهدة كاملة',
    tone: 'warn',
    icon: '⚠️',
    makeText: (n, np) => {
      const team = np.teamName || '—'
      const date = n.payload?.date || ''
      const approved = n.payload?.approved ?? '0'
      const total = n.payload?.total ?? '0'
      const items = Array.isArray(n.payload?.pending_items)
        ? n.payload.pending_items.map((i:any)=>`${i.material_name} (متبقٍّ: ${i.remaining_qty})`).join('، ')
        : ''
      return `الفريق ${team} لم يسلّم العهدة كاملة${date ? ` بتاريخ ${date}` : ''} — المعتمد ${approved} من إجمالي ${total}${items ? `.\nالبنود الناقصة: ${items}` : ''}`
    }
  },
}

function clsTone(tone: 'info'|'warn'|'danger') {
  switch (tone) {
    case 'warn': return 'border-amber-300 bg-amber-50'
    case 'danger': return 'border-rose-300 bg-rose-50'
    default: return 'border-sky-300 bg-sky-50'
  }
}

export default function Notifications() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Notif[]>([])
  const [showRead, setShowRead] = useState(false)
  const [search, setSearch] = useState('')
  const [marking, setMarking] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() => getPushPermission())
  const [pushEnabling, setPushEnabling] = useState(false)
  const { currentScoutYear } = useCurrentScoutYear()

  useEffect(() => { refresh() }, [showRead, currentScoutYear?.id])
  async function refresh() {
    setLoading(true)
    try {
      let q = supabase.from('v_my_notifications').select('*').order('created_at', { ascending: false }) as any
      if (!showRead) q = q.eq('is_read', false)
      if (currentScoutYear?.start_date) q = q.gte('created_at', `${currentScoutYear.start_date}T00:00:00`)
      const endExclusive = addOneDayISO(currentScoutYear?.end_date)
      if (endExclusive) q = q.lt('created_at', endExclusive)
      const { data, error } = await q
      if (error) throw error
      const list: Notif[] = (data as any) ?? []

      // ✅ فلترة الدوبليكيت على مستوى الواجهة (نفس النوع + نفس الفريق + نفس النص)
      const seen = new Set<string>()
      const deduped: Notif[] = []
      for (const n of list) {
        const np = normalizePayload(n.payload)
        const meta = typeMeta[n.ntype]
        const text = meta?.makeText(n, np) || n.ntype
        const key = `${n.ntype}|${np.teamId ?? ''}|${np.termId ?? ''}|${text}`
        if (!seen.has(key)) {
          seen.add(key)
          deduped.push(n)
        }
      }

      setRows(deduped)

      // ✅ ابعت عدّاد غير المقروء لسايدنـاف مباشرة
      const unreadCount = deduped.filter((n: Notif) => !n.is_read).length
      window.dispatchEvent(new CustomEvent('app:notif-unread', { detail: unreadCount }))
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل الإشعارات')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const s = search.toLowerCase()
    return rows.filter(n => {
      const meta = typeMeta[n.ntype]
      const np = normalizePayload(n.payload)
      const title = meta?.title || n.ntype.replace(/_/g,' ')
      const text = meta?.makeText(n, np) || ''
      return (title.toLowerCase().includes(s) || text.toLowerCase().includes(s) || n.ntype.toLowerCase().includes(s)
        || (np.teamName?.toLowerCase().includes(s))
        || (np.memberName?.toLowerCase().includes(s))
        || (np.zoneName?.toLowerCase().includes(s))
        || (np.materialName?.toLowerCase().includes(s))
        || (np.guardianName?.toLowerCase().includes(s))
        || (np.guardianPhone?.toLowerCase().includes(s))
      )
    })
  }, [rows, search])

  async function enableDeviceNotifications() {
    setPushEnabling(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      const result = await ensurePushSubscription(authData.user?.id, { requestPermission: true })
      const nextPermission = getPushPermission()
      setPushPermission(nextPermission)

      if (result.status === 'subscribed') {
        toast.success('تم تفعيل إشعارات الجهاز')
      } else if (result.status === 'permission-denied') {
        toast.error('الإشعارات محظورة من إعدادات المتصفح')
      } else if (result.status === 'unsupported') {
        toast.error('المتصفح الحالي لا يدعم إشعارات الجهاز')
      } else if (result.status === 'missing-vapid') {
        toast.error('إعداد إشعارات الجهاز غير مكتمل على السيرفر')
      }
    } catch (e: any) {
      toast.error(e?.message || 'تعذر تفعيل إشعارات الجهاز')
      setPushPermission(getPushPermission())
    } finally {
      setPushEnabling(false)
    }
  }

  async function markRead(id: string) {
    setMarking(id)
    try {
      const { error } = await supabase.rpc('mark_notifications_read', { _ids: [id] })
      if (error) throw error

      // ✅ حدّث الواجهة فورًا + ابعت العدّاد الجديد
      let newRows: Notif[]
      if (showRead) {
        newRows = rows.map(n => n.id === id ? { ...n, is_read: true } : n)
      } else {
        newRows = rows.filter(n => n.id !== id)
      }
      setRows(newRows)
      const unreadCount = newRows.filter(n => !n.is_read).length
      window.dispatchEvent(new CustomEvent('app:notif-unread', { detail: unreadCount }))
    } catch (e:any) {
      toast.error(e.message || 'تعذر التحديث')
    } finally { setMarking(null) }
  }

  const unreadCount = rows.filter(n => !n.is_read).length
  const shownUnreadCount = filtered.filter(n => !n.is_read).length

  async function markAllRead() {
    setMarkingAll(true)
    try {
      const { error } = await supabase.rpc('mark_all_my_notifications_read')
      if (error) throw error

      // ✅ حدّث الواجهة فورًا + ابعت صفر
      if (showRead) setRows(prev => prev.map(n => ({ ...n, is_read: true })))
      else setRows([])

      window.dispatchEvent(new CustomEvent('app:notif-unread', { detail: 0 }))
    } catch (e:any) {
      toast.error(e.message || 'تعذر التحديث')
    } finally { setMarkingAll(false) }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        eyebrow="🔔 صندوق الإشعارات"
        title="الإشعارات والمتابعات"
        description={`راجع المستجدات المهمة داخل السنة الكشفية الحالية${currentScoutYear ? ` (${currentScoutYear.name})` : ''} وحدّث حالة القراءة بسرعة، مع فلترة أوضح لما تريد رؤيته الآن فقط.`}
        actions={
          <button
            className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
            onClick={markAllRead}
            disabled={markingAll || rows.length===0}
            title="تحديد الكل كمقروء"
          >
            {markingAll ? '...' : 'تحديد الكل كمقروء'}
          </button>
        }
      />

      {currentScoutYear && (
        <InlineAlert tone="info" title="نطاق الإشعارات الحالي">
          يتم عرض الإشعارات التي أُنشئت داخل السنة الكشفية الحالية فقط: {currentScoutYear.name}
        </InlineAlert>
      )}

      <SectionCard
        title="إشعارات الجهاز"
        description="تفعيل إشعارات المتصفح اختياري ويتم فقط بعد ضغطك على الزر. لن يطلب التطبيق صلاحية الإشعارات تلقائيًا عند تسجيل الدخول."
        actions={
          pushPermission === 'granted' ? (
            <button
              type="button"
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800"
              onClick={enableDeviceNotifications}
              disabled={pushEnabling}
            >
              {pushEnabling ? 'جاري المزامنة...' : 'الإشعارات مفعلة — مزامنة'}
            </button>
          ) : pushPermission === 'denied' ? (
            <span className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-800">
              محظورة من المتصفح
            </span>
          ) : pushPermission === 'unsupported' ? (
            <span className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600">
              غير مدعومة على هذا المتصفح
            </span>
          ) : (
            <button
              type="button"
              className="rounded-2xl bg-[#e2802d] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#c96c20] disabled:opacity-60"
              onClick={enableDeviceNotifications}
              disabled={pushEnabling}
            >
              {pushEnabling ? 'جاري التفعيل...' : 'تفعيل إشعارات الجهاز'}
            </button>
          )
        }
      >
        <div className="text-sm leading-7 text-slate-600">
          {pushPermission === 'granted'
            ? 'المتصفح لديه الصلاحية بالفعل، ويمكنك إعادة مزامنة الاشتراك عند الحاجة.'
            : pushPermission === 'denied'
              ? 'لإعادة التفعيل، اسمح بالإشعارات من إعدادات الموقع داخل المتصفح ثم أعد فتح هذه الصفحة.'
              : pushPermission === 'unsupported'
                ? 'سيظل صندوق الإشعارات داخل ScoutSVM يعمل بشكل طبيعي.'
                : 'اضغط تفعيل عندما تريد استقبال إشعارات ScoutSVM على هذا الجهاز.'}
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="كل الإشعارات" value={rows.length} accent="sky" />
        <MetricCard label="غير المقروء" value={unreadCount} accent={unreadCount > 0 ? 'amber' : 'emerald'} />
        <MetricCard label="الظاهر بعد الفلترة" value={filtered.length} accent="indigo" />
        <MetricCard label="غير المقروء ضمن الظاهر" value={shownUnreadCount} accent={shownUnreadCount > 0 ? 'rose' : 'sky'} />
      </div>

      <SectionCard title="البحث والعرض" description="ابحث داخل عنوان الإشعار أو محتواه أو الفريق أو الاسم المرتبط به، واختر إن كنت تريد رؤية المقروء أيضًا.">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr,auto,auto] lg:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">بحث سريع</label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500"
              placeholder="ابحث (فريق، شخص، عنوان...)"
              value={search}
              onChange={e=>setSearch(e.target.value)}
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm rounded-2xl border border-slate-300 bg-white px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={showRead} onChange={e=>setShowRead(e.target.checked)} />
            عرض المقروء
          </label>
        </div>
      </SectionCard>

      <div className="space-y-3">
          {filtered.map(n => {
            const meta = typeMeta[n.ntype]
            const np = normalizePayload(n.payload)
            const title = meta?.title || n.ntype.replace(/_/g,' ')
            const text = meta?.makeText(n, np) || (np.note ?? '—')
            const tone = meta?.tone || 'info'
            const icon = meta?.icon || '🔔'
            const datesArr: string[] = Array.isArray(n.payload?.dates) ? n.payload.dates : []

            return (
              <div
                key={n.id}
                className={`notif-card rounded-2xl border p-4 ${clsTone(tone)} ${n.is_read ? 'opacity-60' : ''}`}
              >
                <div className="notif-grid">
                  <div className="min-w-0">
                    <div className="grid items-center gap-2 md:grid-cols-[1fr,auto]">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-lg">{icon}</span>
                        <div className="notif-title font-semibold break-words">{title}</div>
                        {!n.is_read && (
                          <span className="badge-new">جديد</span>
                        )}
                      </div>
                      <span className="notif-time">{timeAgo(n.created_at)}</span>
                    </div>

                    <div className="mt-2 text-sm leading-6 whitespace-pre-line break-words">
                      {text}
                    </div>

                    <div className="mt-3 chips">
                      {np.teamName && <span className="chip">فريق: <b>{np.teamName}</b></span>}
                      {np.memberName && <span className="chip">الاسم: <b>{np.memberName}</b></span>}
                      {np.guardianName && <span className="chip">ولي الأمر: <b>{np.guardianName}</b></span>}
                      {np.guardianPhone && <span className="chip">هاتف ولي الأمر: <b dir="ltr">{np.guardianPhone}</b></span>}
                      {np.role && <span className="chip">الدور: <b>{np.role}</b></span>}
                      {np.materialName && <span className="chip">أداة: <b>{np.materialName}</b></span>}
                      {np.zoneName && <span className="chip">قطاع: <b>{np.zoneName}</b></span>}
                      {np.qty !== undefined && <span className="chip">العدد: <b>{np.qty}</b></span>}
                      {np.termLabel && <span className="chip">الترم: <b>{np.termLabel}</b></span>}
                    </div>

                    <div className="mt-3 details-grid">
                      {(np.from || np.to) && (
                        <div className="detail">
                          <div className="detail-label">الفترة</div>
                          <div className="break-words">
                            <b>{fmtDateTime(np.from)}</b> — <b>{fmtDateTime(np.to)}</b>
                          </div>
                        </div>
                      )}

                      {np.meetingDate && (
                        <div className="detail">
                          <div className="detail-label">تاريخ الاجتماع</div>
                          <div><b>{fmtDate(np.meetingDate)}</b></div>
                        </div>
                      )}

                      {Array.isArray(datesArr) && datesArr.length === 3 && (
                        <div className="detail">
                          <div className="detail-label">تواريخ الغياب</div>
                          <div className="break-words"><b>{datesArr.map(fmtDate).join('، ')}</b></div>
                        </div>
                      )}

                      {np.mtype && (
                        <div className="detail">
                          <div className="detail-label">نوع اليوم</div>
                          <div><b>{np.mtype === 'preparation' ? 'تحضير' : np.mtype === 'meeting' ? 'اجتماع' : np.mtype}</b></div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="actions-col">
                    {!n.is_read ? (
                      <button
                        className="btn border w-full md:w-auto"
                        disabled={marking===n.id}
                        onClick={()=>markRead(n.id)}
                      >
                        {marking===n.id ? '...' : 'تمّت القراءة'}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-500 block text-center md:text-start">مقروء</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <EmptyState
              title="لا توجد إشعارات للعرض"
              description="جرّب إلغاء البحث أو تفعيل عرض المقروء إذا كنت تريد رؤية سجل أوسع."
            />
          )}
        </div>
    </div>
  )
}
