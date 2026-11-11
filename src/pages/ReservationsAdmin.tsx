import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useScoutYear } from '../components/ScoutYearProvider'
import { clampDateToBounds, getScoutYearBounds } from '../lib/scoutYearScope'
import { useToast } from '../components/ui/Toaster'
import { PageLoader } from '../components/ui/PageLoader'
import { EmptyState } from '../components/ui/EmptyState'
import scoutBackpack from '../assets/scout-theme/scout-backpack.webp'

type Team = { id: string; name: string }
type Material = {
  id: string
  name: string
  storage_location_id: string | null
  storage_locations?: { name: string } | null
}
type Reservation = {
  id: string
  team_id: string
  material_id: string
  qty: number
  starts_at: string
  ends_at: string
  created_at: string | null
}
type Zone = {
  id: string
  team_id: string
  starts_at: string
  ends_at: string
  field_zones?: { name: string } | null
}
type ApprovalRow = {
  reservation_id: string
  qty_returned: number
  approved_at: string | null
}
type ReservationStatus = 'upcoming' | 'active' | 'overdue' | 'partial' | 'returned'
type ViewMode = 'list' | 'cards'
type MaterialCategory = 'camp' | 'rope' | 'kitchen' | 'first-aid' | 'light' | 'general'

const cairoFormatter = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

function todayLocalYYYYMMDD() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function rangeBoundsISO(fromDay: string, toDay: string) {
  const start = new Date(`${fromDay}T00:00:00`)
  const end = new Date(`${toDay}T23:59:59.999`)
  return { start: start.toISOString(), end: end.toISOString() }
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return cairoFormatter.format(d)
}

function formatCompactDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: 'Africa/Cairo',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

function durationLabel(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '—'
  const totalMinutes = Math.round((end - start) / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  return [days ? `${days} يوم` : '', hours ? `${hours} ساعة` : '', minutes ? `${minutes} دقيقة` : ''].filter(Boolean).join(' و ') || 'أقل من دقيقة'
}

function materialCategory(name: string): MaterialCategory {
  const value = name.toLowerCase()
  if (/خيم|خيمة|tent|camp|معسكر|مشمع|tarp|tarpaulin/.test(value)) return 'camp'
  if (/حبل|rope|عدة|عقد|تجهيز/.test(value)) return 'rope'
  if (/طبخ|بوتاجاز|موقد|حلة|قدر|مطبخ|kitchen|cook|stove/.test(value)) return 'kitchen'
  if (/اسعاف|إسعاف|first|aid|طبي/.test(value)) return 'first-aid'
  if (/كشاف|فانوس|نور|إضاءة|اضاءة|lamp|light|led/.test(value)) return 'light'
  return 'general'
}

function MaterialGlyph({ category }: { category: MaterialCategory }) {
  if (category === 'camp') return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 50 31 13l25 37H8Z"/><path d="M31 13v37M18 50l13-22 14 22"/></svg>
  if (category === 'rope') return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 20c-8-8-20 4-12 12l13 13c8 8 20-4 12-12L23 20Z"/><path d="M41 44c8 8 20-4 12-12L40 19c-8-8-20 4-12 12l13 13Z"/><path d="m24 40 16-16"/></svg>
  if (category === 'kitchen') return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M15 28h34v20a8 8 0 0 1-8 8H23a8 8 0 0 1-8-8V28Z"/><path d="M11 28h42M22 20h20M27 14h10"/></svg>
  if (category === 'first-aid') return <svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="16" width="44" height="38" rx="9"/><path d="M25 16v-5h14v5M27 29h10v6h6v10h-6v6H27v-6h-6V35h6v-6Z"/></svg>
  if (category === 'light') return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M21 24h22l4 30H17l4-30Z"/><path d="M24 24c0-13 16-13 16 0M24 37h16M28 31h8"/></svg>
  return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="m32 8 22 12v24L32 56 10 44V20L32 8Z"/><path d="m10 20 22 12 22-12M32 32v24"/></svg>
}

function reservationStatus(row: Reservation, approval?: ApprovalRow): { status: ReservationStatus; label: string; helper: string } {
  const returned = Math.max(0, Number(approval?.qty_returned) || 0)
  const reserved = Math.max(0, Number(row.qty) || 0)
  if (approval && returned >= reserved) return { status: 'returned', label: 'تم الاسترجاع', helper: 'تم اعتماد استلام الكمية بالكامل' }
  if (approval && returned > 0) return { status: 'partial', label: 'استرجاع جزئي', helper: `متبقي ${Math.max(0, reserved - returned)} قطعة` }

  const now = Date.now()
  const start = new Date(row.starts_at).getTime()
  const end = new Date(row.ends_at).getTime()
  if (!Number.isNaN(end) && now > end) return { status: 'overdue', label: 'متأخر', helper: 'انتهى الحجز ولم يعتمد الاسترجاع' }
  if (!Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end) return { status: 'active', label: 'جاري', helper: 'الأداة داخل فترة الحجز الآن' }
  return { status: 'upcoming', label: 'قادم', helper: 'لم تبدأ فترة الحجز بعد' }
}

export default function ReservationsAdmin() {
  const toast = useToast()
  const today = todayLocalYYYYMMDD()
  const { currentScoutYear } = useScoutYear()
  const yearBounds = getScoutYearBounds(currentScoutYear)

  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [materialsMap, setMaterialsMap] = useState<Record<string, Material>>({})
  const [rows, setRows] = useState<Reservation[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [approvals, setApprovals] = useState<Map<string, ApprovalRow>>(new Map())

  const [teamId, setTeamId] = useState('')
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [statusFilter, setStatusFilter] = useState<'all' | ReservationStatus>('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedId, setSelectedId] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    const scopedDay = clampDateToBounds(todayLocalYYYYMMDD(), yearBounds)
    setFromDate(scopedDay)
    setToDate(scopedDay)
    setRows([]); setZones([]); setApprovals(new Map()); setSelectedId('')
  }, [currentScoutYear?.id])
  useEffect(() => { void loadReferenceData() }, [])
  useEffect(() => { void refreshReservations() }, [fromDate, toDate])

  async function loadReferenceData() {
    try {
      const [{ data: teamsData, error: teamsErr }, { data: materialsData, error: materialsErr }] = await Promise.all([
        supabase.from('teams').select('id,name').order('name'),
        supabase.from('materials').select('id,name,storage_location_id,storage_locations:storage_location_id(name)').order('name'),
      ])
      if (teamsErr) throw teamsErr
      if (materialsErr) throw materialsErr
      setTeams((teamsData as Team[]) ?? [])
      const normalizedMaterials = ((materialsData as any[]) ?? []).map((item) => ({
        ...item,
        storage_locations: Array.isArray(item.storage_locations) ? (item.storage_locations[0] || null) : (item.storage_locations || null),
      })) as Material[]
      setMaterialsMap(Object.fromEntries(normalizedMaterials.map((item) => [item.id, item])))
    } catch (error: any) {
      toast.error(error?.message || 'تعذر تحميل الفرق والأدوات')
    }
  }

  async function refreshReservations() {
    if (!yearBounds || !fromDate || !toDate) { setRows([]); setZones([]); setApprovals(new Map()); return }
    if (toDate < fromDate) {
      toast.error('تاريخ النهاية يجب أن يكون بعد أو مساويًا لتاريخ البداية')
      return
    }

    setLoading(true)
    try {
      const startDay = fromDate < yearBounds.start ? yearBounds.start : fromDate
      const endDay = toDate > yearBounds.end ? yearBounds.end : toDate
      if (endDay < startDay) { setRows([]); setZones([]); setApprovals(new Map()); return }
      const { start, end } = rangeBoundsISO(startDay, endDay)
      const [{ data: reservationsData, error: reservationsErr }, { data: zonesData, error: zonesErr }] = await Promise.all([
        supabase
          .from('material_reservations')
          .select('id,team_id,material_id,qty,starts_at,ends_at,created_at')
          .is('soft_deleted_at', null)
          .lt('starts_at', end)
          .gt('ends_at', start)
          .order('starts_at'),
        supabase
          .from('field_reservations')
          .select('id,team_id,starts_at,ends_at,field_zones:field_zone_id(name)')
          .is('soft_deleted_at', null)
          .lt('starts_at', end)
          .gt('ends_at', start)
          .order('starts_at'),
      ])
      if (reservationsErr) throw reservationsErr
      if (zonesErr) throw zonesErr

      const reservationRows = ((reservationsData as Reservation[]) ?? [])
      setRows(reservationRows)
      setZones(((zonesData as any[]) ?? []).map((item) => ({
        ...item,
        field_zones: Array.isArray(item.field_zones) ? (item.field_zones[0] || null) : (item.field_zones || null),
      })) as Zone[])

      const ids = reservationRows.map((row) => row.id)
      if (!ids.length) {
        setApprovals(new Map())
        setSelectedId('')
        return
      }

      const { data: approvalRows, error: approvalError } = await supabase
        .from('material_return_approvals')
        .select('reservation_id,qty_returned,approved_at')
        .in('reservation_id', ids)
        .is('soft_deleted_at', null)

      if (approvalError) {
        // Return approval data is supplementary to the reservations screen.
        setApprovals(new Map())
      } else {
        setApprovals(new Map(((approvalRows ?? []) as ApprovalRow[]).map((row) => [row.reservation_id, row])))
      }
    } catch (error: any) {
      toast.error(error?.message || 'تعذر تحميل الحجوزات')
    } finally {
      setLoading(false)
    }
  }

  const teamNameById = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams])

  function zonesFor(row: Reservation) {
    const start = new Date(row.starts_at).getTime()
    const end = new Date(row.ends_at).getTime()
    return zones
      .filter((zone) => {
        if (zone.team_id !== row.team_id) return false
        const zoneStart = new Date(zone.starts_at).getTime()
        const zoneEnd = new Date(zone.ends_at).getTime()
        return zoneStart <= end && zoneEnd >= start
      })
      .map((zone) => zone.field_zones?.name)
      .filter(Boolean) as string[]
  }

  const teamContextRows = useMemo(
    () => teamId ? rows.filter((row) => row.team_id === teamId) : rows,
    [rows, teamId],
  )

  const metrics = useMemo(() => {
    let active = 0
    let partial = 0
    let overdue = 0
    let returned = 0
    for (const row of teamContextRows) {
      const state = reservationStatus(row, approvals.get(row.id)).status
      if (state === 'active') active += 1
      else if (state === 'partial') partial += 1
      else if (state === 'overdue') overdue += 1
      else if (state === 'returned') returned += 1
    }
    return { total: teamContextRows.length, active, partial, overdue, returned }
  }, [teamContextRows, approvals])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return teamContextRows
      .filter((row) => {
        const meta = reservationStatus(row, approvals.get(row.id))
        if (statusFilter !== 'all' && meta.status !== statusFilter) return false
        if (!q) return true
        const material = materialsMap[row.material_id]
        const teamName = teamNameById.get(row.team_id) || ''
        const storage = material?.storage_locations?.name || ''
        return [material?.name || '', teamName, storage, row.id].some((value) => value.toLowerCase().includes(q))
      })
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.material_id.localeCompare(b.material_id))
  }, [teamContextRows, approvals, statusFilter, search, materialsMap, teamNameById])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedRows = useMemo(() => filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize), [filteredRows, safePage])

  useEffect(() => { setPage(1) }, [teamId, statusFilter, search, fromDate, toDate])
  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedId('')
      return
    }
    if (!filteredRows.some((row) => row.id === selectedId)) setSelectedId(filteredRows[0].id)
  }, [filteredRows, selectedId])

  const selected = useMemo(() => filteredRows.find((row) => row.id === selectedId) || null, [filteredRows, selectedId])
  const selectedMaterial = selected ? materialsMap[selected.material_id] : null
  const selectedMeta = selected ? reservationStatus(selected, approvals.get(selected.id)) : null
  const selectedZones = selected ? zonesFor(selected) : []
  const selectedApproval = selected ? approvals.get(selected.id) : undefined

  function useToday() {
    setFromDate(clampDateToBounds(today, yearBounds))
    setToDate(clampDateToBounds(today, yearBounds))
  }

  return (
    <div className="materials121-page" dir="rtl">
      <PageLoader visible={loading} text="جاري تجهيز الحجوزات..." />

      <section className="materials121-hero">
        <div className="materials121-hero-copy">
          <span className="materials121-eyebrow">📅 مركز إدارة الحجوزات</span>
          <h1>إدارة الحجوزات</h1>
          <p>تابع حجوزات الأدوات لكل الفرق، راجع التوقيت بالدقيقة، واعرف حالة الاسترجاع من شاشة واحدة بسيطة.</p>
          <div className="materials121-hero-actions">
            <Link to="/app/MaterialTeamReservation" className="materials121-primary-link">＋ حجز جديد</Link>
            <Link to="/app/MaterialsReturnApprove" className="materials121-secondary-link">↩ الاستلام والاسترجاع</Link>
          </div>
        </div>
        <div className="materials121-hero-art" aria-hidden="true">
          <img src={scoutBackpack} alt="" />
          <span className="materials121-hero-orbit">✓</span>
        </div>
      </section>

      <section className="materials121-kpis" aria-label="ملخص الحجوزات">
        <article className="is-total"><span>▦</span><div><small>حجوزات الفترة</small><strong>{metrics.total}</strong><em>حجز</em></div></article>
        <article className="is-active"><span>▶</span><div><small>جارية الآن</small><strong>{metrics.active}</strong><em>حجز</em></div></article>
        <article className="is-partial"><span>◐</span><div><small>استرجاع جزئي</small><strong>{metrics.partial}</strong><em>حجز</em></div></article>
        <article className="is-overdue"><span>!</span><div><small>متأخرة</small><strong>{metrics.overdue}</strong><em>حجز</em></div></article>
        <article className="is-returned"><span>✓</span><div><small>تم استرجاعها</small><strong>{metrics.returned}</strong><em>حجز</em></div></article>
      </section>

      <section className="materials121-toolbar">
        <div className="materials121-toolbar-top">
          <div className="materials121-view-switch" aria-label="طريقة العرض">
            <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}>☷ <span>القائمة</span></button>
            <button type="button" className={viewMode === 'cards' ? 'is-active' : ''} onClick={() => setViewMode('cards')}>▦ <span>البطاقات</span></button>
          </div>
          <button type="button" className="materials121-today-btn" onClick={useToday}>اليوم</button>
          <button type="button" className="materials121-refresh-btn" onClick={() => void refreshReservations()}>↻ تحديث</button>
        </div>

        <div className="materials121-filters">
          <label className="materials121-search">
            <span>⌕</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث باسم الأداة، الفريق، مكان التخزين..." />
          </label>

          <label className="materials121-field">
            <span>الفريق</span>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">كل الفرق</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>

          <label className="materials121-field">
            <span>الحالة</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="all">كل الحالات</option>
              <option value="upcoming">قادم</option>
              <option value="active">جاري</option>
              <option value="overdue">متأخر</option>
              <option value="partial">استرجاع جزئي</option>
              <option value="returned">تم الاسترجاع</option>
            </select>
          </label>

          <label className="materials121-field materials121-date-field">
            <span>من تاريخ</span>
            <input type="date" value={fromDate} min={yearBounds?.start} max={yearBounds?.end} onChange={(e) => setFromDate(clampDateToBounds(e.target.value, yearBounds))} />
          </label>

          <label className="materials121-field materials121-date-field">
            <span>إلى تاريخ</span>
            <input type="date" min={fromDate || yearBounds?.start} max={yearBounds?.end} value={toDate} onChange={(e) => setToDate(clampDateToBounds(e.target.value, yearBounds))} />
          </label>
        </div>
      </section>

      <div className="materials121-workspace">
        <section className="materials121-results">
          <header className="materials121-results-head">
            <div>
              <span>النتائج</span>
              <h2>{filteredRows.length} حجز مطابق</h2>
            </div>
            <div className="materials121-range-caption">{fromDate === toDate ? fromDate : `${fromDate} ← ${toDate}`}</div>
          </header>

          {filteredRows.length === 0 ? (
            <div className="materials121-empty"><EmptyState title="لا توجد حجوزات مطابقة" description="غيّر الفترة أو الفريق أو الحالة، أو امسح كلمة البحث." /></div>
          ) : viewMode === 'list' ? (
            <div className="materials121-table-wrap">
              <table className="materials121-table">
                <thead>
                  <tr>
                    <th>الأداة</th>
                    <th>الفريق</th>
                    <th>من</th>
                    <th>إلى</th>
                    <th>الكمية</th>
                    <th>الحالة</th>
                    <th>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => {
                    const material = materialsMap[row.material_id]
                    const meta = reservationStatus(row, approvals.get(row.id))
                    const isSelected = selectedId === row.id
                    return (
                      <tr key={row.id} className={isSelected ? 'is-selected' : ''} onClick={() => setSelectedId(row.id)}>
                        <td>
                          <div className="materials121-tool-cell">
                            <span className="materials121-tool-glyph"><MaterialGlyph category={materialCategory(material?.name || '')} /></span>
                            <div><strong>{material?.name || 'أداة غير معروفة'}</strong><small>{material?.storage_locations?.name || 'بدون مكان تخزين'}</small></div>
                          </div>
                        </td>
                        <td><span className="materials121-team-pill">♙ {teamNameById.get(row.team_id) || '—'}</span></td>
                        <td><time>{formatCompactDateTime(row.starts_at)}</time></td>
                        <td><time>{formatCompactDateTime(row.ends_at)}</time></td>
                        <td><b className="materials121-qty">{row.qty}</b></td>
                        <td><span className={`materials121-status status-${meta.status}`}>{meta.label}</span></td>
                        <td><button type="button" className="materials121-details-btn" onClick={(e) => { e.stopPropagation(); setSelectedId(row.id) }}>عرض التفاصيل ‹</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="materials121-card-grid">
              {pagedRows.map((row) => {
                const material = materialsMap[row.material_id]
                const meta = reservationStatus(row, approvals.get(row.id))
                return (
                  <button key={row.id} type="button" className={`materials121-reservation-card ${selectedId === row.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(row.id)}>
                    <div className="materials121-card-top">
                      <span className="materials121-card-glyph"><MaterialGlyph category={materialCategory(material?.name || '')} /></span>
                      <span className={`materials121-status status-${meta.status}`}>{meta.label}</span>
                    </div>
                    <strong>{material?.name || 'أداة غير معروفة'}</strong>
                    <span className="materials121-card-team">{teamNameById.get(row.team_id) || '—'}</span>
                    <div className="materials121-card-times"><span>من <b>{formatCompactDateTime(row.starts_at)}</b></span><span>إلى <b>{formatCompactDateTime(row.ends_at)}</b></span></div>
                    <div className="materials121-card-foot"><span>الكمية <b>{row.qty}</b></span><em>{material?.storage_locations?.name || 'بدون تخزين'}</em></div>
                  </button>
                )
              })}
            </div>
          )}

          {filteredRows.length > pageSize && (
            <footer className="materials121-pagination">
              <span>عرض {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredRows.length)} من {filteredRows.length}</span>
              <div>
                <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, safePage - 3), Math.min(totalPages, safePage + 2)).map((n) => (
                  <button key={n} type="button" className={n === safePage ? 'is-active' : ''} onClick={() => setPage(n)}>{n}</button>
                ))}
                <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
              </div>
            </footer>
          )}
        </section>

        <aside className="materials121-detail-panel">
          {selected && selectedMaterial && selectedMeta ? (
            <>
              <header className="materials121-detail-head">
                <div>
                  <span>تفاصيل الحجز</span>
                  <h2>{selectedMaterial.name}</h2>
                </div>
                <span className={`materials121-status status-${selectedMeta.status}`}>{selectedMeta.label}</span>
              </header>

              <div className="materials121-detail-material">
                <span className="materials121-detail-glyph"><MaterialGlyph category={materialCategory(selectedMaterial.name)} /></span>
                <div><strong>{selectedMaterial.name}</strong><span>{selectedMaterial.storage_locations?.name || 'بدون مكان تخزين محدد'}</span></div>
                <b>× {selected.qty}</b>
              </div>

              <dl className="materials121-detail-grid">
                <div><dt>الفريق</dt><dd>{teamNameById.get(selected.team_id) || '—'}</dd></div>
                <div><dt>المدة</dt><dd>{durationLabel(selected.starts_at, selected.ends_at)}</dd></div>
                <div><dt>من</dt><dd>{formatDateTime(selected.starts_at)}</dd></div>
                <div><dt>إلى</dt><dd>{formatDateTime(selected.ends_at)}</dd></div>
                <div className="is-wide"><dt>الأرض المتقاطعة</dt><dd>{selectedZones.length ? selectedZones.join('، ') : 'لا توجد أرض مرتبطة بنفس الفترة'}</dd></div>
              </dl>

              <section className="materials121-timeline">
                <h3>سير الحجز</h3>
                <div className="is-done"><i>✓</i><div><strong>تم إنشاء الحجز</strong><span>{formatDateTime(selected.created_at)}</span></div></div>
                <div className={selectedMeta.status === 'upcoming' ? 'is-current' : 'is-done'}><i>{selectedMeta.status === 'upcoming' ? '○' : '✓'}</i><div><strong>بداية الحجز</strong><span>{formatDateTime(selected.starts_at)}</span></div></div>
                <div className={['returned'].includes(selectedMeta.status) ? 'is-done' : ['overdue','partial'].includes(selectedMeta.status) ? 'is-current' : ''}><i>{selectedMeta.status === 'returned' ? '✓' : '○'}</i><div><strong>{selectedMeta.label}</strong><span>{selectedMeta.helper}</span></div></div>
              </section>

              {selectedApproval && (
                <div className="materials121-return-summary">
                  <span>الكمية المرتجعة</span>
                  <strong>{selectedApproval.qty_returned} / {selected.qty}</strong>
                  <small>{selectedApproval.approved_at ? `آخر اعتماد: ${formatDateTime(selectedApproval.approved_at)}` : ''}</small>
                </div>
              )}

              <div className="materials121-detail-actions">
                <Link to="/app/MaterialsReturnApprove" className="materials121-primary-link">↩ فتح الاستلام والاسترجاع</Link>
                <Link to="/app/MaterialTeamReservation" className="materials121-secondary-link">＋ حجز أداة أخرى</Link>
              </div>
            </>
          ) : (
            <div className="materials121-detail-placeholder">
              <span>✦</span>
              <strong>اختر حجزًا</strong>
              <p>اضغط على أي صف أو بطاقة لعرض التفاصيل الكاملة هنا.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
