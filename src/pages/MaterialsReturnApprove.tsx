import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useScoutYear } from '../components/ScoutYearProvider'
import { fetchTerms } from '../features/reference/api'
import { clampDateToBounds, getScoutYearBounds, getTermYearBounds, inDateBounds } from '../lib/scoutYearScope'
import { useToast } from '../components/ui/Toaster'
import { PageLoader } from '../components/ui/PageLoader'
import { LoadingButton } from '../components/ui/LoadingButton'
import { EmptyState } from '../components/ui/EmptyState'
import { useAuth } from '../components/AuthProvider'
import scoutBackpack from '../assets/scout-theme/scout-backpack.webp'

type RoleRow = { role_slug: string; team_id?: string | null }
type Team = { id: string; name: string }
type Term = { id: string; name: string; year: number; start_date: string | null; end_date: string | null }
type TermDateRow = { id: string; meeting_date: string }

type DueItem = {
  reservation_id: string
  team_id: string
  starts_at: string
  due_date: string
  material_id: string
  material_name: string
  qty: number
}

type ApprovalRow = {
  reservation_id: string
  qty_returned: number
  note: string | null
  approved_at: string
}

type ReturnStatus = 'upcoming' | 'active' | 'overdue' | 'partial' | 'returned'

const cairoFormatter = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

function todayCairoYYYYMMDD() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function getTimeZoneOffsetMs(timeZone: string, instant: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  )
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

function cairoLocalToISO(dateStr: string, hour: number, minute: number, second: number, ms = 0) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  let guess = new Date(localAsUtc)
  for (let i = 0; i < 2; i += 1) {
    const offset = getTimeZoneOffsetMs('Africa/Cairo', guess)
    guess = new Date(localAsUtc - offset)
  }
  return guess.toISOString()
}

function cairoRangeISO(dateStr: string) {
  return {
    from: cairoLocalToISO(dateStr, 0, 0, 0, 0),
    to: cairoLocalToISO(dateStr, 23, 59, 59, 999),
  }
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return cairoFormatter.format(date)
}

function statusMeta(item: DueItem, approval?: ApprovalRow): { status: ReturnStatus; label: string; helper: string } {
  const reserved = Math.max(0, Number(item.qty) || 0)
  const returned = Math.max(0, Number(approval?.qty_returned) || 0)
  if (approval && returned >= reserved) return { status: 'returned', label: 'تم الاستلام', helper: 'تم اعتماد الكمية المرتجعة بالكامل' }
  if (approval && returned > 0) return { status: 'partial', label: 'استلام جزئي', helper: `متبقي ${Math.max(0, reserved - returned)}` }

  const now = Date.now()
  const start = new Date(item.starts_at).getTime()
  const end = new Date(item.due_date).getTime()
  if (!Number.isNaN(end) && now > end) return { status: 'overdue', label: 'متأخر', helper: 'انتهت فترة الحجز ولم يُعتمد الاسترجاع' }
  if (!Number.isNaN(start) && !Number.isNaN(end) && now >= start && now <= end) return { status: 'active', label: 'فترة الحجز جارية', helper: 'الأداة ضمن فترة الحجز الحالية' }
  return { status: 'upcoming', label: 'حجز قادم', helper: 'لم تبدأ فترة الحجز بعد' }
}

export default function MaterialsReturnApprove() {
  const toast = useToast()
  const { roles, user } = useAuth()
  const { currentScoutYear, isReadOnlyView } = useScoutYear()
  const yearBounds = getScoutYearBounds(currentScoutYear)

  const isAdmin = roles.some((r: RoleRow) => r.role_slug === 'admin')
  const globalMaterials = roles.some((r: RoleRow) => r.role_slug === 'responsable_materials' && r.team_id == null)
  const teamMaterialsIds = roles
    .filter((r: RoleRow) => r.role_slug === 'responsable_materials' && r.team_id != null)
    .map((r) => String(r.team_id))
  const canSeeAllTeams = isAdmin || globalMaterials

  const [loading, setLoading] = useState(true)
  const [teamsMap, setTeamsMap] = useState<Map<string, string>>(new Map())
  const [filterDate, setFilterDate] = useState(todayCairoYYYYMMDD())
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState('')
  const termMeta = useMemo(() => terms.find((term) => term.id === termId) || null, [terms, termId])
  const termBounds = termMeta ? getTermYearBounds(currentScoutYear, termMeta) : yearBounds
  const [termDates, setTermDates] = useState<TermDateRow[]>([])
  const [useCustomDay, setUseCustomDay] = useState(false)
  const [selectedDay, setSelectedDay] = useState('')
  const [dueItems, setDueItems] = useState<DueItem[]>([])
  const [approvals, setApprovals] = useState<Map<string, ApprovalRow>>(new Map())
  const [filterTeamId, setFilterTeamId] = useState('all')
  const [editReservationId, setEditReservationId] = useState('')
  const [editQty, setEditQty] = useState<number | ''>('')
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [unapprovingId, setUnapprovingId] = useState('')
  const [sendingNotif, setSendingNotif] = useState(false)

  useEffect(() => { if (currentScoutYear?.id) void init() }, [currentScoutYear?.id])
  useEffect(() => { void loadByDate(filterDate) }, [filterDate, currentScoutYear?.id])

  async function init() {
    setLoading(true)
    try {
      setTerms([]); setTermId(''); setTermDates([]); setDueItems([]); setApprovals(new Map())
      const initialDate = clampDateToBounds(todayCairoYYYYMMDD(), yearBounds)
      setFilterDate(initialDate)
      await Promise.all([loadTeams(), loadTerms()])
    } catch (error: any) {
      toast.error(error?.message || 'تعذر تحميل بيانات الاسترجاع')
    } finally {
      setLoading(false)
    }
  }

  async function loadTeams() {
    const { data, error } = await supabase.from('teams').select('id,name').order('name')
    if (error) throw error
    setTeamsMap(new Map(((data ?? []) as Team[]).map((team) => [team.id, team.name])))
  }

  async function loadTerms() {
    const rows = (await fetchTerms()) as Term[]
    setTerms(rows)
    setTermId(rows[0]?.id || '')
  }

  useEffect(() => {
    if (!termId) return
    void (async () => {
      const { data, error } = await supabase
        .from('term_meeting_dates')
        .select('id,meeting_date')
        .eq('term_id', termId)
        .order('meeting_date', { ascending: true })
      if (error) {
        toast.error(error.message || 'تعذر تحميل تواريخ الترم')
        return
      }
      const bounds = getTermYearBounds(currentScoutYear, termMeta)
      const list = ((data ?? []) as TermDateRow[]).filter((row) => inDateBounds(row.meeting_date, bounds))
      setTermDates(list)
      if (list.length) {
        const currentInTerm = list.find((row) => row.meeting_date === filterDate)?.meeting_date
        const chosen = currentInTerm || list[0].meeting_date
        setSelectedDay(chosen)
        setUseCustomDay(false)
        setFilterDate(chosen)
      } else {
        setUseCustomDay(true)
        setFilterDate(clampDateToBounds(todayCairoYYYYMMDD(), bounds))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId, currentScoutYear?.id])

  async function loadByDate(dateStr: string) {
    if (!dateStr || !inDateBounds(dateStr, yearBounds)) {
      setDueItems([]); setApprovals(new Map()); return
    }
    const { from, to } = cairoRangeISO(dateStr)

    const { data, error } = await supabase
      .from('material_reservations')
      .select('id,team_id,starts_at,ends_at,material_id,qty')
      .is('soft_deleted_at', null)
      .gte('ends_at', from)
      .lte('ends_at', to)
      .order('ends_at', { ascending: true })
    if (error) throw error

    let rows = (data ?? []) as any[]
    if (!canSeeAllTeams) rows = rows.filter((row) => teamMaterialsIds.includes(String(row.team_id)))

    const materialIds = Array.from(new Set(rows.map((row) => row.material_id))).filter(Boolean)
    const materialNames = new Map<string, string>()
    if (materialIds.length) {
      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .select('id,name')
        .in('id', materialIds)
      if (materialsError) throw materialsError
      for (const material of (materials ?? []) as any[]) materialNames.set(String(material.id), material.name || '')
    }

    const items: DueItem[] = rows.map((row) => ({
      reservation_id: row.id,
      team_id: row.team_id,
      starts_at: row.starts_at,
      due_date: row.ends_at,
      material_id: row.material_id,
      material_name: materialNames.get(String(row.material_id)) || String(row.material_id),
      qty: Number(row.qty) || 0,
    }))
    setDueItems(items)

    const reservationIds = items.map((item) => item.reservation_id)
    if (!reservationIds.length) {
      setApprovals(new Map())
      return
    }

    const { data: approvalRows, error: approvalError } = await supabase
      .from('material_return_approvals')
      .select('reservation_id,qty_returned,note,approved_at')
      .in('reservation_id', reservationIds)
      .is('soft_deleted_at', null)
    if (approvalError) throw approvalError

    const map = new Map<string, ApprovalRow>()
    for (const row of (approvalRows ?? []) as ApprovalRow[]) map.set(row.reservation_id, row)
    setApprovals(map)
  }

  const teamIdsInData = useMemo(() => Array.from(new Set(dueItems.map((item) => item.team_id))), [dueItems])
  const visibleItems = useMemo(
    () => filterTeamId === 'all' ? dueItems : dueItems.filter((item) => item.team_id === filterTeamId),
    [dueItems, filterTeamId],
  )

  const metrics = useMemo(() => {
    let returned = 0
    let partial = 0
    let overdue = 0
    let active = 0
    for (const item of visibleItems) {
      const state = statusMeta(item, approvals.get(item.reservation_id)).status
      if (state === 'returned') returned += 1
      else if (state === 'partial') partial += 1
      else if (state === 'overdue') overdue += 1
      else if (state === 'active') active += 1
    }
    return { total: visibleItems.length, returned, partial, overdue, active }
  }, [visibleItems, approvals])

  const grouped = useMemo(() => {
    const groups = new Map<string, DueItem[]>()
    for (const item of visibleItems) {
      const list = groups.get(item.team_id) || []
      list.push(item)
      groups.set(item.team_id, list)
    }
    return Array.from(groups.entries())
      .map(([teamId, items]) => ({
        team_id: teamId,
        team_name: teamsMap.get(teamId) || '—',
        items: items.slice().sort((a, b) => a.due_date.localeCompare(b.due_date) || a.material_name.localeCompare(b.material_name, 'ar')),
      }))
      .sort((a, b) => a.team_name.localeCompare(b.team_name, 'ar'))
  }, [visibleItems, teamsMap])

  function startEdit(item: DueItem) {
    const approval = approvals.get(item.reservation_id)
    setEditReservationId(item.reservation_id)
    setEditQty(typeof approval?.qty_returned === 'number' ? approval.qty_returned : item.qty)
    setEditNote(approval?.note || '')
  }

  function cancelEdit() {
    setEditReservationId('')
    setEditQty('')
    setEditNote('')
  }

  async function saveApproval(item: DueItem) {
    if (isReadOnlyView) return toast.error('بيانات السنوات السابقة للعرض فقط')
    const qtyReturned = Number(editQty)
    if (!Number.isFinite(qtyReturned) || qtyReturned < 0) return toast.error('كمية مرتجعة غير صالحة')
    if (qtyReturned > Number(item.qty)) return toast.error('الكمية المرتجعة أكبر من المحجوزة')
    if (!user?.id) return toast.error('غير مسجّل الدخول')

    setSaving(true)
    try {
      const { error } = await supabase
        .from('material_return_approvals')
        .upsert([{
          reservation_id: item.reservation_id,
          qty_returned: qtyReturned,
          note: editNote.trim() || null,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          soft_deleted_at: null,
        }], { onConflict: 'reservation_id' })
      if (error) throw error
      toast.success(qtyReturned >= item.qty ? 'تم اعتماد استلام الأداة بالكامل' : 'تم حفظ الاستلام الجزئي')
      cancelEdit()
      await loadByDate(filterDate)
    } catch (error: any) {
      toast.error(error?.message || 'تعذر حفظ اعتماد الاستلام')
    } finally {
      setSaving(false)
    }
  }

  async function unapprove(item: DueItem) {
    if (isReadOnlyView) return toast.error('بيانات السنوات السابقة للعرض فقط')
    setUnapprovingId(item.reservation_id)
    try {
      const { error } = await supabase
        .from('material_return_approvals')
        .update({ soft_deleted_at: new Date().toISOString() })
        .eq('reservation_id', item.reservation_id)
        .is('soft_deleted_at', null)
      if (error) throw error
      toast.success('تم إلغاء اعتماد الاستلام')
      await loadByDate(filterDate)
    } catch (error: any) {
      toast.error(error?.message || 'تعذر إلغاء الاعتماد')
    } finally {
      setUnapprovingId('')
    }
  }

  async function runOverdueNotifications() {
    if (isReadOnlyView) return toast.error('لا يتم إرسال تنبيهات لسنوات مؤرشفة')
    setSendingNotif(true)
    try {
      const { error } = await supabase.rpc('send_overdue_material_returns', { force: true })
      if (error) throw error
      toast.success('تم تشغيل فحص تنبيهات التأخير')
    } catch (error: any) {
      toast.error(error?.message || 'تعذر تشغيل الفحص')
    } finally {
      setSendingNotif(false)
    }
  }

  function onTermDayChange(value: string) {
    if (value === '__custom__') {
      setUseCustomDay(true)
      return
    }
    setUseCustomDay(false)
    setSelectedDay(value)
    setFilterDate(value)
  }

  if (loading) return <PageLoader visible text="جارِ تجهيز دورة استلام الأدوات..." />

  const minDate = termBounds?.start || undefined
  const maxDate = termBounds?.end || undefined
  const showTeamFilter = canSeeAllTeams || teamIdsInData.length > 1

  return (
    <div className="materials119-page materials120-returns-page space-y-6 p-4 md:p-6" dir="rtl">
      <section className="materials119-hero materials120-return-hero">
        <div className="materials119-hero-copy">
          <span className="materials119-eyebrow">↩ دورة استلام واسترجاع واضحة</span>
          <h1>استلام الأدوات ومتابعة الاسترجاع</h1>
          <p>راجع الأدوات المستحقة حسب اليوم والفريق، اعرف حالة فترة الحجز فورًا، ثم اعتمد الكمية المرتجعة بالكامل أو جزئيًا.</p>
          <div className="materials119-hero-chips">
            <span>التوقيت: <b>القاهرة</b></span>
            <span>الاسترجاع: <b>كامل أو جزئي</b></span>
            <span>التأخير: <b>تنبيه تلقائي</b></span>
          </div>
        </div>
        <img className="materials119-hero-object" src={scoutBackpack} alt="تجهيزات كشفية" />
      </section>

      {isReadOnlyView && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">عرض بيانات السنة الكشفية {currentScoutYear?.name} فقط — لا يمكن تعديل اعتمادات الاسترجاع التاريخية.</p>}
      <div className="materials120-return-kpis">
        <article><span>↺</span><div><small>المستحق في اليوم</small><strong>{metrics.total}</strong></div></article>
        <article className="is-success"><span>✓</span><div><small>تم الاستلام</small><strong>{metrics.returned}</strong></div></article>
        <article className="is-warning"><span>◐</span><div><small>استلام جزئي</small><strong>{metrics.partial}</strong></div></article>
        <article className="is-danger"><span>!</span><div><small>متأخر</small><strong>{metrics.overdue}</strong></div></article>
        <article className="is-info"><span>↔</span><div><small>فترة جارية</small><strong>{metrics.active}</strong></div></article>
      </div>

      <section className="materials120-return-filter-card">
        <div className="materials120-return-filter-head">
          <div>
            <span>فلترة دورة الاسترجاع</span>
            <h2>حدد يوم الاسترجاع المستحق</h2>
          </div>
          {(isAdmin || globalMaterials) && (
            <LoadingButton loading={sendingNotif} onClick={runOverdueNotifications} disabled={isReadOnlyView}>
              تشغيل تنبيهات التأخير
            </LoadingButton>
          )}
        </div>

        <div className="materials120-return-filters">
          <label className="materials119-field">
            <span>الترم</span>
            <select value={termId} onChange={(event) => setTermId(event.target.value)}>
              {terms.map((term) => <option key={term.id} value={term.id}>{term.year} — {term.name}</option>)}
            </select>
          </label>

          <label className="materials119-field">
            <span>التاريخ</span>
            {termDates.length > 0 && !useCustomDay ? (
              <select value={selectedDay} onChange={(event) => onTermDayChange(event.target.value)}>
                {termDates.map((day) => <option key={day.id} value={day.meeting_date}>{day.meeting_date}</option>)}
                <option value="__custom__">— تاريخ آخر —</option>
              </select>
            ) : (
              <input type="date" value={filterDate} min={minDate} max={maxDate} onChange={(event) => setFilterDate(event.target.value)} />
            )}
          </label>

          {showTeamFilter && (
            <label className="materials119-field">
              <span>الفريق</span>
              <select value={filterTeamId} onChange={(event) => setFilterTeamId(event.target.value)}>
                <option value="all">كل الفرق</option>
                {teamIdsInData.map((teamId) => <option key={teamId} value={teamId}>{teamsMap.get(teamId) || teamId}</option>)}
              </select>
            </label>
          )}

          <div className="materials120-filter-actions">
            {useCustomDay && termDates.length > 0 && (
              <button type="button" className="materials119-secondary-btn" onClick={() => {
                const first = termDates[0]?.meeting_date
                if (!first) return
                setUseCustomDay(false)
                setSelectedDay(first)
                setFilterDate(first)
              }}>
                أيام الترم
              </button>
            )}
            <button type="button" className="materials120-refresh-btn" onClick={() => void loadByDate(filterDate)}>تحديث</button>
          </div>
        </div>
      </section>

      {grouped.length === 0 ? (
        <section className="materials120-return-empty">
          <EmptyState title="لا توجد أدوات مستحقة في هذا اليوم" description="اختر تاريخ استرجاع آخر أو اعرض كل الفرق لمراجعة الحجوزات المستحقة." />
        </section>
      ) : (
        <div className="materials120-return-groups">
          {grouped.map((team) => (
            <section key={team.team_id} className="materials120-return-team">
              <header>
                <div><span>الفريق</span><h2>{team.team_name}</h2></div>
                <b>{team.items.length} حجز</b>
              </header>

              <div className="materials120-return-list">
                {team.items.map((item) => {
                  const approval = approvals.get(item.reservation_id)
                  const meta = statusMeta(item, approval)
                  const isEditing = editReservationId === item.reservation_id
                  const returnedQty = Number(approval?.qty_returned || 0)
                  const remainingQty = Math.max(0, Number(item.qty) - returnedQty)
                  return (
                    <article key={item.reservation_id} className={`materials120-return-row status-${meta.status}`}>
                      <div className="materials120-return-icon" aria-hidden="true">↩</div>
                      <div className="materials120-return-main">
                        <div className="materials120-return-title-line">
                          <strong>{item.material_name}</strong>
                          <span className={`materials120-return-status status-${meta.status}`}>{meta.label}</span>
                        </div>
                        <p>{meta.helper}</p>
                        <div className="materials120-return-times">
                          <span><b>من</b>{formatDateTime(item.starts_at)}</span>
                          <span><b>إلى</b>{formatDateTime(item.due_date)}</span>
                        </div>
                      </div>

                      <div className="materials120-return-qtys">
                        <span><small>محجوز</small><b>{item.qty}</b></span>
                        <span><small>مستلم</small><b>{returnedQty || '—'}</b></span>
                        <span><small>متبقي</small><b>{remainingQty}</b></span>
                      </div>

                      {!isEditing ? (
                        <div className="materials120-return-actions">
                          <button type="button" className="materials120-approve-btn" disabled={isReadOnlyView} onClick={() => startEdit(item)}>{approval ? 'تعديل الاستلام' : 'اعتماد الاستلام'}</button>
                          {approval && (
                            <button type="button" className="materials120-unapprove-btn" onClick={() => void unapprove(item)} disabled={isReadOnlyView || unapprovingId === item.reservation_id}>
                              {unapprovingId === item.reservation_id ? 'جارٍ...' : 'إلغاء الاعتماد'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="materials120-return-edit">
                          <label><span>الكمية المرتجعة</span><input type="number" min={0} max={item.qty} step={1} value={editQty} onChange={(event) => setEditQty(event.target.value === '' ? '' : Number(event.target.value))} /></label>
                          <label><span>ملاحظة</span><input value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="مثلاً: قطعة تحتاج صيانة" /></label>
                          <div>
                            <LoadingButton loading={saving} onClick={() => void saveApproval(item)}>حفظ الاستلام</LoadingButton>
                            <button type="button" className="materials119-secondary-btn" onClick={cancelEdit}>إلغاء</button>
                          </div>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="materials120-flow-note">
        <b>ملاحظة تشغيلية:</b>
        <span>حالة «فترة الحجز جارية» محسوبة من وقت الحجز، أما «تم الاستلام / استلام جزئي» فهي حالة محفوظة فعليًا بعد اعتماد مسؤول الأدوات.</span>
      </div>
    </div>
  )
}
