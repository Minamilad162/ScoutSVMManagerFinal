import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/PageLoader'
import { fetchCurrentUserContext, fetchTerms } from '../features/reference/api'
import { LoadingButton } from '../components/ui/LoadingButton'
import { useToast } from '../components/ui/Toaster'
import { useRoleGate } from '../hooks/useRoleGate'
import { useAuth } from '../components/AuthProvider'
import { useScoutYear } from '../components/ScoutYearProvider'
import { clampDateToBounds, getScoutYearBounds, getTermYearBounds, inDateBounds } from '../lib/scoutYearScope'
import { EmptyState } from '../components/ui/EmptyState'
import scoutBackpack from '../assets/scout-theme/scout-backpack.webp'
import '../features/materialImages/materialImages.css'
import { loadMaterialImageCatalog, materialPhotoUrl } from '../features/materialImages/api'

type Team = { id: string; name: string }
type Material = { id: string; name: string; total_qty: number; image_path: string | null }
type Resv = { id: string; material_id: string; team_id: string; qty: number; starts_at: string; ends_at: string }
type DayRow = {
  id: string
  qty: number
  starts_at: string
  ends_at: string
  teams: { name: string | null } | null
  materials: { name: string | null } | null
}
type Term = { id: string; name: string; year: number; start_date: string | null; end_date: string | null }
type TermDateRow = { id: string; meeting_date: string }
type MaterialCategory = 'all' | 'camp' | 'rope' | 'kitchen' | 'first-aid' | 'light' | 'general'

const categoryOptions: Array<{ id: MaterialCategory; label: string; icon: string }> = [
  { id: 'all', label: 'الكل', icon: '▦' },
  { id: 'camp', label: 'المعسكر', icon: '△' },
  { id: 'rope', label: 'الحبال والتجهيزات', icon: '∞' },
  { id: 'kitchen', label: 'الطبخ', icon: '◉' },
  { id: 'first-aid', label: 'الإسعافات', icon: '+' },
  { id: 'light', label: 'الإضاءة', icon: '✦' },
  { id: 'general', label: 'أخرى', icon: '◇' },
]

function localDateTimeToISOString(dtLocal: string): string {
  if (!dtLocal || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dtLocal)) {
    const d = new Date(dtLocal)
    return isNaN(+d) ? new Date().toISOString() : d.toISOString()
  }
  const [datePart, timePart] = dtLocal.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mm] = timePart.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString()
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function combineDateTime(day: string, timeHHmm: string) {
  return `${day}T${timeHHmm}`
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (isNaN(+d)) return '—'
  return new Intl.DateTimeFormat('ar-EG', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

function formatDay(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`)
  if (isNaN(+d)) return ymd
  return new Intl.DateTimeFormat('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
}

function overlapsDay(isoStart: string, isoEnd: string, dayYYYYMMDD: string) {
  const [y, m, d] = dayYYYYMMDD.split('-').map(Number)
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0)
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999)
  const s = new Date(isoStart)
  const e = new Date(isoEnd)
  return e >= dayStart && s <= dayEnd
}

function getDayBoundsISO(ymd: string) {
  const start = new Date(`${ymd}T00:00:00`)
  const end = new Date(`${ymd}T23:59:59`)
  return { startISO: start.toISOString(), endISO: end.toISOString() }
}

function materialCategory(name: string): Exclude<MaterialCategory, 'all'> {
  const value = name.toLowerCase()
  if (/خيم|خيمة|tent|camp|معسكر|مشمع|tarp|tarpaulin/.test(value)) return 'camp'
  if (/حبل|rope|عدة|عقد|تجهيز/.test(value)) return 'rope'
  if (/طبخ|بوتاجاز|موقد|حلة|قدر|مطبخ|kitchen|cook|stove/.test(value)) return 'kitchen'
  if (/اسعاف|إسعاف|first|aid|طبي/.test(value)) return 'first-aid'
  if (/كشاف|فانوس|نور|إضاءة|اضاءة|lamp|light|led/.test(value)) return 'light'
  return 'general'
}

function MaterialGlyph({ category }: { category: Exclude<MaterialCategory, 'all'> }) {
  if (category === 'camp') return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 50 31 13l25 37H8Z"/><path d="M31 13v37M18 50l13-22 14 22"/></svg>
  if (category === 'rope') return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 20c-8-8-20 4-12 12l13 13c8 8 20-4 12-12L23 20Z"/><path d="M41 44c8 8 20-4 12-12L40 19c-8-8-20 4-12 12l13 13Z"/><path d="m24 40 16-16"/></svg>
  if (category === 'kitchen') return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 28h34v20a8 8 0 0 1-8 8H23a8 8 0 0 1-8-8V28Z"/><path d="M11 28h42M22 20h20M27 14h10"/></svg>
  if (category === 'first-aid') return <svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="16" width="44" height="38" rx="9"/><path d="M25 16v-5h14v5M27 29h10v6h6v10h-6v6H27v-6h-6V35h6v-6Z"/></svg>
  if (category === 'light') return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M21 24h22l4 30H17l4-30Z"/><path d="M24 24c0-13 16-13 16 0M24 37h16M28 31h8"/></svg>
  return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="m32 8 22 12v24L32 56 10 44V20L32 8Z"/><path d="m10 20 22 12 22-12M32 32v24"/></svg>
}

export default function MaterialsTeamReservations() {
  const { roles } = useAuth()
  const { currentScoutYear } = useScoutYear()
  const yearBounds = getScoutYearBounds(currentScoutYear)
  const gate = useRoleGate()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [teamId, setTeamId] = useState('')
  const [matId, setMatId] = useState('')
  const [qty, setQty] = useState<number | ''>(1)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [list, setList] = useState<Resv[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState('')
  const [termDates, setTermDates] = useState<TermDateRow[]>([])
  const [available, setAvailable] = useState<number | null>(null)
  const [dayRows, setDayRows] = useState<DayRow[]>([])
  const [dayLoading, setDayLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<MaterialCategory>('all')
  const [showAllTeamBookings, setShowAllTeamBookings] = useState(false)

  const isAdmin = roles.some((r) => r.role_slug === 'admin')
  const termMeta = useMemo(() => terms.find((t) => t.id === termId) || null, [terms, termId])
  const termBounds = termMeta ? getTermYearBounds(currentScoutYear, termMeta) : null
  const termMinDT = termBounds ? `${termBounds.start}T00:00` : undefined
  const termMaxDT = termBounds ? `${termBounds.end}T23:59` : undefined
  const selectedMaterial = useMemo(() => materials.find((m) => m.id === matId) || null, [materials, matId])
  const teamName = teams.find((t) => t.id === teamId)?.name || 'الفريق'
  const canBook = gate.canBookReservations(teamId)

  const effectiveFilterDay = useMemo(() => (startAt ? startAt.slice(0, 10) : ''), [startAt])
  const listFiltered = useMemo(() => {
    if (!effectiveFilterDay) return list
    return list.filter((r) => overlapsDay(r.starts_at, r.ends_at, effectiveFilterDay))
  }, [list, effectiveFilterDay])

  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLowerCase()
    return materials.filter((material) => {
      const inCategory = category === 'all' || materialCategory(material.name) === category
      const inSearch = !q || material.name.toLowerCase().includes(q)
      return inCategory && inSearch
    })
  }, [materials, search, category])

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: materials.length }
    for (const material of materials) {
      const key = materialCategory(material.name)
      counts[key] = (counts[key] || 0) + 1
    }
    return counts
  }, [materials])

  const durationLabel = useMemo(() => {
    const s = new Date(startAt)
    const e = new Date(endAt)
    if (isNaN(+s) || isNaN(+e) || e <= s) return 'حدد وقتًا صحيحًا'
    const minutes = Math.round((+e - +s) / 60000)
    const days = Math.floor(minutes / 1440)
    const hours = Math.floor((minutes % 1440) / 60)
    const mins = minutes % 60
    return [days ? `${days} يوم` : '', hours ? `${hours} ساعة` : '', mins ? `${mins} دقيقة` : ''].filter(Boolean).join(' و ') || 'أقل من دقيقة'
  }, [startAt, endAt])

  useEffect(() => { if (currentScoutYear?.id) void init() }, [currentScoutYear?.id])

  async function init() {
    setLoading(true)
    try {
      const [{ data: ts, error: te }, { data: ms, error: me }, imageCatalog] = await Promise.all([
        supabase.from('teams').select('id,name').order('name'),
        supabase.from('materials').select('id,name,total_qty').eq('active', true).order('name'),
        loadMaterialImageCatalog(),
      ])
      if (te) throw te
      if (me) throw me
      setTeams((ts as any) ?? [])
      setMaterials(((ms as Material[]) ?? []).map((m) => ({ ...m, image_path: imageCatalog.paths.get(m.id) || null })))
      if (ms?.length) setMatId(ms[0].id)

      const tm = await fetchTerms()
      setTerms((tm as any) ?? [])
      setTermId(tm[0]?.id || '')

      if (isAdmin) {
        if (ts?.length) setTeamId(ts[0].id)
      } else {
        const meRow = await fetchCurrentUserContext()
        if (!meRow?.team_id) throw new Error('لا يوجد فريق مرتبط بحسابك')
        setTeamId(meRow.team_id)
      }

      const now = new Date()
      now.setSeconds(0, 0)
      const end = new Date(now.getTime() + 2 * 60 * 60 * 1000)
      const clamped = clampDateToBounds(toLocalInput(now).slice(0, 10), yearBounds)
      setStartAt(clamped ? `${clamped}T${toLocalInput(now).slice(11,16)}` : '')
      setEndAt(clamped ? `${clamped}T${toLocalInput(end).slice(11,16)}` : '')
    } catch (e: any) {
      toast.error(e.message || 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (termId && termBounds) void loadTermDates(termId); else setTermDates([]) }, [termId, termBounds?.start, termBounds?.end])
  async function loadTermDates(tid: string) {
    try {
      const { data, error } = await supabase
        .from('term_meeting_dates')
        .select('id,meeting_date')
        .eq('term_id', tid)
        .gte('meeting_date', termBounds?.start || '9999-01-01')
        .lte('meeting_date', termBounds?.end || '9999-01-01')
        .order('meeting_date', { ascending: true })
      if (error) throw error
      setTermDates((data as any as TermDateRow[]) ?? [])
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحميل تواريخ الترم')
    }
  }

  useEffect(() => { if (teamId && yearBounds) void refreshList(); else setList([]) }, [teamId, currentScoutYear?.id])
  async function refreshList() {
    if (!yearBounds) { setList([]); return }
    try {
      const { data, error } = await supabase
        .from('material_reservations')
        .select('id, material_id, team_id, qty, starts_at, ends_at')
        .eq('team_id', teamId)
        .gte('starts_at', `${yearBounds.start}T00:00:00`)
        .lte('starts_at', `${yearBounds.end}T23:59:59`)
        .is('soft_deleted_at', null)
        .order('starts_at', { ascending: false })
      if (error) throw error
      setList((data as any) ?? [])
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحميل الحجوزات')
    }
  }

  useEffect(() => { void computeAvailability() }, [matId, startAt, endAt])
  async function computeAvailability() {
    setAvailable(null)
    if (!matId || !startAt || !endAt) return
    const s = new Date(startAt)
    const e = new Date(endAt)
    if (isNaN(+s) || isNaN(+e) || s >= e) return
    try {
      const { data, error } = await supabase.rpc('material_available_qty', {
        p_material_id: matId,
        p_starts: localDateTimeToISOString(startAt),
        p_ends: localDateTimeToISOString(endAt),
      })
      if (error) throw error
      setAvailable((data as any) ?? null)
    } catch {
      setAvailable(null)
    }
  }

  useEffect(() => {
    if (effectiveFilterDay) void refreshDayReservations()
    else setDayRows([])
  }, [effectiveFilterDay])

  async function refreshDayReservations() {
    if (!effectiveFilterDay) {
      setDayRows([])
      return
    }
    setDayLoading(true)
    try {
      const { data: rpc, error: rpcErr } = await supabase.rpc('material_reservations_by_day_all', { p_day: effectiveFilterDay })
      if (!rpcErr && rpc) {
        setDayRows((rpc as any[]).map((r) => ({
          id: r.id,
          qty: r.qty,
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          teams: { name: r.team_name ?? null },
          materials: { name: r.material_name ?? null },
        })))
        return
      }

      const { startISO, endISO } = getDayBoundsISO(effectiveFilterDay)
      const { data, error } = await supabase
        .from('material_reservations')
        .select('id, qty, starts_at, ends_at, teams:team_id(name), materials:material_id(name)')
        .is('soft_deleted_at', null)
        .lt('starts_at', endISO)
        .gt('ends_at', startISO)
        .order('starts_at', { ascending: true })
      if (error) throw error
      setDayRows((data as any) ?? [])
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحميل حجوزات هذا اليوم')
    } finally {
      setDayLoading(false)
    }
  }

  function validateRange(): string | null {
    const s = new Date(startAt)
    const e = new Date(endAt)
    if (isNaN(+s) || isNaN(+e)) return 'تنسيق التاريخ والوقت غير صالح'
    if (s >= e) return 'وقت البداية يجب أن يسبق وقت النهاية'
    if (termMeta?.start_date) {
      const min = new Date(`${termMeta.start_date}T00:00`)
      if (s < min || e < min) return 'الفترة المختارة قبل بداية الترم'
    }
    if (termMeta?.end_date) {
      const max = new Date(`${termMeta.end_date}T23:59`)
      if (s > max || e > max) return 'الفترة المختارة بعد نهاية الترم'
    }
    return null
  }

  function chooseMeetingDay(day: string) {
    const currentStartTime = startAt.slice(11, 16) || '16:00'
    const currentEndTime = endAt.slice(11, 16) || '18:00'
    setStartAt(combineDateTime(day, currentStartTime))
    setEndAt(combineDateTime(day, currentEndTime))
  }

  function adjustQty(delta: number) {
    const current = Number(qty) || 0
    const upper = available === null ? Math.max(1, selectedMaterial?.total_qty || 1) : Math.max(0, available)
    const next = Math.max(1, Math.min(upper || 1, current + delta))
    setQty(next)
  }

  function selectMaterial(id: string) {
    setMatId(id)
    if (!qty || Number(qty) < 1) setQty(1)
  }

  async function saveReservation() {
    if (!teamId) return toast.error('اختر الفريق')
    if (!matId) return toast.error('اختر الأداة')
    const q = Number(qty)
    if (!isFinite(q) || q <= 0) return toast.error('الكمية غير صالحة')
    if (!startAt || !endAt) return toast.error('حدد وقت البداية والنهاية')
    if (!inDateBounds(startAt, termBounds) || !inDateBounds(endAt, termBounds)) return toast.error('الحجز خارج حدود الترم والسنة الكشفية')
    const err = validateRange()
    if (err) return toast.error(err)
    if (available !== null && q > available) return toast.error(`المتاح في هذه الفترة ${available} فقط`)

    setSaving(true)
    try {
      const { error } = await supabase.from('material_reservations').insert({
        team_id: teamId,
        material_id: matId,
        qty: q,
        starts_at: localDateTimeToISOString(startAt),
        ends_at: localDateTimeToISOString(endAt),
      })
      if (error) throw error
      toast.success('تم تأكيد حجز الأداة')
      setQty(1)
      await Promise.all([refreshList(), refreshDayReservations(), computeAvailability()])
    } catch (e: any) {
      toast.error(e.message || 'تعذر الحجز (قد تكون الكمية غير متاحة)')
    } finally {
      setSaving(false)
    }
  }

  async function cancelReservation(id: string) {
    if (!window.confirm('هل تريد إلغاء هذا الحجز؟')) return
    try {
      const { error } = await supabase
        .from('material_reservations')
        .update({ soft_deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      toast.success('تم إلغاء الحجز')
      await Promise.all([refreshList(), refreshDayReservations(), computeAvailability()])
    } catch (e: any) {
      toast.error(e.message || 'تعذر الإلغاء')
    }
  }

  return (
    <div className="materials119-page space-y-6 p-4 md:p-6" dir="rtl">
      <PageLoader visible={loading} text="جاري تجهيز الأدوات والحجوزات..." />

      <section className="materials119-hero materials119-hero-booking">
        <div className="materials119-hero-copy">
          <span className="materials119-eyebrow">⚜️ تجهيزات الفريق في مكان واحد</span>
          <h1>حجز الأدوات والمعدات</h1>
          <p>اختَر الأداة، حدّد الفترة باليوم والساعة والدقيقة، وشاهد المتاح فورًا قبل تأكيد الحجز.</p>
          <div className="materials119-hero-chips">
            <span>الفريق: <b>{teamName}</b></span>
            <span>دقة الحجز: <b>بالدقيقة</b></span>
            <span>تعارض الكميات: <b>محمي تلقائيًا</b></span>
          </div>
        </div>
        <img className="materials119-hero-object" src={scoutBackpack} alt="حقيبة وتجهيزات كشفية" />
      </section>

      <div className="materials119-kpis">
        <div className="materials119-kpi"><span className="kpi-icon">▦</span><div><small>الأدوات النشطة</small><strong>{materials.length}</strong></div></div>
        <div className="materials119-kpi"><span className="kpi-icon">✓</span><div><small>المتاح للأداة المختارة</small><strong>{available === null ? '—' : available}</strong></div></div>
        <div className="materials119-kpi"><span className="kpi-icon">↔</span><div><small>حجوزات فريقي في اليوم</small><strong>{listFiltered.length}</strong></div></div>
        <div className="materials119-kpi"><span className="kpi-icon">◷</span><div><small>مدة الحجز</small><strong className="materials119-kpi-small">{durationLabel}</strong></div></div>
      </div>

      <div className="materials119-booking-layout">
        <main className="materials119-catalog-panel">
          <div className="materials119-toolbar">
            <label className="materials119-search">
              <span>⌕</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن أداة..." />
            </label>
            <div className="materials119-toolbar-meta">
              <span>{filteredMaterials.length} أداة</span>
              <span>{effectiveFilterDay ? formatDay(effectiveFilterDay) : 'حدد البداية'}</span>
            </div>
          </div>

          <div className="materials119-category-strip" aria-label="فئات الأدوات">
            {categoryOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`materials119-category ${category === option.id ? 'is-active' : ''}`}
                onClick={() => setCategory(option.id)}
              >
                <span>{option.icon}</span>
                <b>{option.label}</b>
                <small>{categoryCounts[option.id] || 0}</small>
              </button>
            ))}
          </div>

          {filteredMaterials.length === 0 ? (
            <EmptyState title="لا توجد أدوات مطابقة" description="غيّر البحث أو اختر فئة أخرى لعرض الأدوات المتاحة." />
          ) : (
            <div className="materials119-tool-grid">
              {filteredMaterials.map((material) => {
                const cat = materialCategory(material.name)
                const selected = material.id === matId
                return (
                  <button
                    type="button"
                    key={material.id}
                    className={`materials119-tool-card ${selected ? 'is-selected' : ''}`}
                    onClick={() => selectMaterial(material.id)}
                    aria-pressed={selected}
                  >
                    <span className="materials119-tool-status">{selected ? 'مختارة' : 'متاحة'}</span>
                    <div className={`materials119-tool-visual cat-${cat}`}><MaterialGlyph category={cat} />{material.image_path && materialPhotoUrl(material.image_path) && <img className="materials119-tool-photo" src={materialPhotoUrl(material.image_path)!} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />}</div>
                    <div className="materials119-tool-copy">
                      <strong>{material.name}</strong>
                      <span>{selected && available !== null ? `المتاح في الفترة: ${available}` : `إجمالي المخزون: ${material.total_qty}`}</span>
                    </div>
                    <span className="materials119-tool-select">{selected ? '✓' : '+'}</span>
                  </button>
                )
              })}
            </div>
          )}
        </main>

        <aside className="materials119-booking-card">
          <div className="materials119-booking-head">
            <div>
              <span>تفاصيل الحجز</span>
              <strong>{selectedMaterial?.name || 'اختر أداة'}</strong>
            </div>
            {selectedMaterial?.image_path && materialPhotoUrl(selectedMaterial.image_path) ? <img className="materials119-booking-photo" src={materialPhotoUrl(selectedMaterial.image_path)!} alt={`صورة ${selectedMaterial.name}`} /> : <span className="materials119-calendar-badge">▣</span>}
          </div>

          {isAdmin ? (
            <label className="materials119-field">
              <span>الفريق</span>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
          ) : (
            <div className="materials119-readonly-field"><span>الفريق</span><b>{teamName}</b></div>
          )}

          <label className="materials119-field">
            <span>الترم</span>
            <select value={termId} onChange={(e) => setTermId(e.target.value)}>
              {terms.map((term) => <option key={term.id} value={term.id}>{term.year} — {term.name}</option>)}
            </select>
            {termMeta?.start_date && termMeta?.end_date && <small>من {termMeta.start_date} إلى {termMeta.end_date}</small>}
          </label>

          {termDates.length > 0 && (
            <div className="materials119-quick-days">
              <span>تواريخ سريعة من جدول الترم</span>
              <div>
                {termDates.slice(0, 6).map((item) => (
                  <button key={item.id} type="button" onClick={() => chooseMeetingDay(item.meeting_date)}>{formatDay(item.meeting_date)}</button>
                ))}
              </div>
            </div>
          )}

          <div className="materials119-time-grid">
            <label className="materials119-field">
              <span>من — يوم / ساعة / دقيقة</span>
              <input type="datetime-local" step={60} value={startAt} onChange={(e) => setStartAt(e.target.value)} min={termMinDT} max={termMaxDT} />
            </label>
            <label className="materials119-field">
              <span>إلى — يوم / ساعة / دقيقة</span>
              <input type="datetime-local" step={60} value={endAt} onChange={(e) => setEndAt(e.target.value)} min={termMinDT} max={termMaxDT} />
            </label>
          </div>

          <div className="materials119-duration-line"><span>مدة الحجز</span><b>{durationLabel}</b></div>

          <div className="materials119-quantity-row">
            <div><span>الكمية</span><small>{available === null ? 'يتم حساب المتاح...' : `المتاح الآن ${available}`}</small></div>
            <div className="materials119-stepper">
              <button type="button" onClick={() => adjustQty(-1)} aria-label="تقليل الكمية">−</button>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value === '' ? '' : Number(e.target.value))} />
              <button type="button" onClick={() => adjustQty(1)} aria-label="زيادة الكمية">+</button>
            </div>
          </div>

          {available === 0 && <div className="materials119-unavailable">لا توجد كمية متاحة للأداة خلال الفترة المختارة.</div>}

          {canBook ? (
            <LoadingButton loading={saving} onClick={saveReservation} disabled={!matId || available === 0}>
              <span className="materials119-book-button">تأكيد الحجز <span>←</span></span>
            </LoadingButton>
          ) : (
            <div className="materials119-unavailable">ليس لديك صلاحية للحجز لهذا الفريق.</div>
          )}
          <p className="materials119-booking-note">سيتم فحص التعارض والكمية مرة أخرى من قاعدة البيانات عند التأكيد.</p>
        </aside>
      </div>

      <section className="materials119-reservations-section">
        <div className="materials119-section-title">
          <div><span>حجوزات فريقي</span><h2>{effectiveFilterDay ? formatDay(effectiveFilterDay) : 'الفترة الحالية'}</h2></div>
          <span className="materials119-count-pill">{listFiltered.length}</span>
        </div>
        {listFiltered.length === 0 ? (
          <EmptyState title="لا توجد حجوزات للفريق" description="ابدأ باختيار أداة وفترة زمنية من أعلى الصفحة." />
        ) : (
          <div className="materials119-reservation-list">
            {listFiltered.map((reservation) => (
              <article key={reservation.id} className="materials119-reservation-row">
                <div className="materials119-reservation-glyph">{materials.find((m) => m.id === reservation.material_id)?.image_path && materialPhotoUrl(materials.find((m) => m.id === reservation.material_id)?.image_path) ? <img src={materialPhotoUrl(materials.find((m) => m.id === reservation.material_id)?.image_path)!} alt="" /> : <MaterialGlyph category={materialCategory(materials.find((m) => m.id === reservation.material_id)?.name || '')} />}</div>
                <div className="materials119-reservation-main">
                  <strong>{materials.find((m) => m.id === reservation.material_id)?.name || 'أداة'}</strong>
                  <span>{formatDateTime(reservation.starts_at)} ← {formatDateTime(reservation.ends_at)}</span>
                </div>
                <span className="materials119-reservation-qty">× {reservation.qty}</span>
                <button type="button" className="materials119-cancel" onClick={() => cancelReservation(reservation.id)}>إلغاء</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="materials119-reservations-section">
        <button type="button" className="materials119-section-toggle" onClick={() => setShowAllTeamBookings((v) => !v)} aria-expanded={showAllTeamBookings}>
          <div><span>حجوزات جميع الفرق</span><small>راجع التعارضات على يوم البداية قبل الحجز</small></div>
          <div><span className="materials119-count-pill">{dayRows.length}</span><b>{showAllTeamBookings ? '−' : '+'}</b></div>
        </button>
        {showAllTeamBookings && (
          <div className="materials119-all-teams-wrap">
            {dayLoading ? <div className="materials119-loading-line">جاري تحميل حجوزات اليوم…</div> : dayRows.length === 0 ? (
              <EmptyState title="لا توجد حجوزات عامة" description="لا توجد حجوزات مسجلة لباقي الفرق في يوم البداية المختار." />
            ) : (
              <div className="overflow-x-auto">
                <table className="materials119-table min-w-[780px]">
                  <thead><tr><th>الفريق</th><th>الأداة</th><th>العدد</th><th>من</th><th>إلى</th></tr></thead>
                  <tbody>{dayRows.map((row) => <tr key={row.id}><td>{row.teams?.name || '—'}</td><td>{row.materials?.name || '—'}</td><td>{row.qty}</td><td>{formatDateTime(row.starts_at)}</td><td>{formatDateTime(row.ends_at)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
