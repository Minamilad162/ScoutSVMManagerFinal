import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useScoutYear } from '../components/ScoutYearProvider'
import { getScoutYearBounds, getTermYearBounds } from '../lib/scoutYearScope'
import { useAuth } from '../components/AuthProvider'
import { useToast } from '../components/ui/Toaster'
import { PageLoader } from '../components/ui/PageLoader'
import { EmptyState } from '../components/ui/EmptyState'
import { safeWriteAuditLog } from '../features/audit/api'
import { loadBookingSnapshot, type BookingSnapshot } from '../features/reservations/bookingApi'
import {
  bookingDateLabel, bookingStatus, cairoDatetimeLocal, cairoLocalToISO, cairoDay,
  validateBookingEdit, type BookingRecord, type BookingKind,
} from '../features/reservations/bookingRecords'
import {
  scopedReservationTerms, scopedReservationMeetings, preferredReservationMeeting,
  reservationSelectionBounds, type ReservationTerm, type ReservationMeeting,
} from '../features/reservations/bookingPeriod'
import './reservations-workspace.css'

type Mode = 'overview' | 'manage'
type Draft = { teamId: string; resourceId: string; startsAt: string; endsAt: string; qty: number }
const EMPTY: BookingSnapshot = { rows: [], teams: [], materials: [], zones: [], approvalsAvailable: true }

function toDraft(item: BookingRecord): Draft {
  return { teamId: item.teamId, resourceId: item.resourceId,
    startsAt: cairoDatetimeLocal(item.startsAt), endsAt: cairoDatetimeLocal(item.endsAt), qty: item.qty ?? 1 }
}

function shortYearLabel(year: { name?: string | null; start_date?: string | null; end_date?: string | null } | null) {
  return year?.name || `${year?.start_date?.slice(0, 4) || '—'}/${year?.end_date?.slice(0, 4) || '—'}`
}

function ResourceBadge({ kind }: { kind: BookingKind }) {
  return <span className={`r135-kind r135-kind-${kind}`}>{kind === 'material' ? '🧰 أدوات' : '🏕️ أرض'}</span>
}

/** Deliberately separate visual modes: the overview never renders write controls. */
export default function ReservationsWorkspace({ mode }: { mode: Mode }) {
  const manage = mode === 'manage'
  const toast = useToast()
  const { user } = useAuth()
  const { currentScoutYear, isReadOnlyView } = useScoutYear()
  const year = getScoutYearBounds(currentScoutYear)
  const yearStart = year?.start || ''
  const yearEnd = year?.end || ''
  const [terms, setTerms] = useState<ReservationTerm[]>([])
  const [termId, setTermId] = useState('')
  const [meetingDates, setMeetingDates] = useState<ReservationMeeting[]>([])
  const [meetingDate, setMeetingDate] = useState('all')
  const [termsLoading, setTermsLoading] = useState(true)
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [teamId, setTeamId] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | BookingKind>('all')
  const [search, setSearch] = useState('')
  const [data, setData] = useState<BookingSnapshot>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [changing, setChanging] = useState(false)
  const [reload, setReload] = useState(0)
  const [editId, setEditId] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [page, setPage] = useState(1)
  const requestIndex = useRef(0)
  const editPanelRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setData(EMPTY)
    setTerms([])
    setTermId('')
    setMeetingDates([])
    setMeetingDate('all')
    setTeamId('')
    setKindFilter('all')
    setSearch('')
    setPage(1)
    setEditId('')
    setDraft(null)
  }, [currentScoutYear?.id, yearStart, yearEnd])

  // Terms are fetched strictly from the year chosen in the global Scout Year selector.
  // Never fall back to another year's term if this year has none.
  useEffect(() => {
    let active = true
    setTermsLoading(true)
    setTerms([])
    setTermId('')
    if (!currentScoutYear?.id || !yearStart || !yearEnd) {
      setTermsLoading(false)
      return () => { active = false }
    }
    void (async () => {
      try {
        const { data: rows, error } = await supabase.from('terms')
          .select('id,name,scout_year_id,start_date,end_date')
          .eq('scout_year_id', currentScoutYear.id)
          .order('start_date', { ascending: true })
        if (error) throw error
        if (!active) return
        const available = scopedReservationTerms((rows || []) as ReservationTerm[], currentScoutYear)
        const today = cairoDay()
        const selected = available.find((term) => {
          const bounds = getTermYearBounds(currentScoutYear, term)
          return bounds && today >= bounds.start && today <= bounds.end
        }) || available[0]
        setTerms(available)
        setTermId(selected?.id || '')
      } catch (error: any) {
        if (active) toast.error(error?.message || 'تعذر تحميل ترمات السنة الكشفية')
      } finally {
        if (active) setTermsLoading(false)
      }
    })()
    return () => { active = false }
  }, [currentScoutYear?.id, yearStart, yearEnd])

  const selectedTerm = terms.find((term) => term.id === termId) || null
  const termBounds = selectedTerm ? getTermYearBounds(currentScoutYear, selectedTerm) : null
  const termStart = termBounds?.start || ''
  const termEnd = termBounds?.end || ''

  useEffect(() => {
    let active = true
    setMeetingDates([])
    setMeetingDate('all')
    setMeetingsLoading(Boolean(termId && termStart && termEnd))
    if (!termId || !termStart || !termEnd) return () => { active = false }
    void (async () => {
      try {
        const { data: rows, error } = await supabase.from('term_meeting_dates')
          .select('id,meeting_date').eq('term_id', termId)
          .gte('meeting_date', termStart).lte('meeting_date', termEnd)
          .order('meeting_date', { ascending: true })
        if (error) throw error
        if (!active) return
        const options = scopedReservationMeetings((rows || []) as ReservationMeeting[], { start: termStart, end: termEnd })
        setMeetingDates(options)
        setMeetingDate(preferredReservationMeeting(options, cairoDay()))
      } catch (error: any) {
        if (active) toast.error(error?.message || 'تعذر تحميل الاجتماعات المسجلة للترم')
      } finally {
        if (active) setMeetingsLoading(false)
      }
    })()
    return () => { active = false }
  }, [termId, termStart, termEnd])

  const selectedBounds = currentScoutYear?.id
    ? reservationSelectionBounds(currentScoutYear, selectedTerm, meetingDate, meetingDates)
    : null
  const selectedStart = selectedBounds?.start || ''
  const selectedEnd = selectedBounds?.end || ''
  const selectionLabel = selectedTerm
    ? `${selectedTerm.name} · ${meetingDate === 'all' ? 'الترم بالكامل' : meetingDate}`
    : 'لم يتم اختيار ترم'

  const fetchRows = useCallback(() => setReload((count) => count + 1), [])

  useEffect(() => {
    const request = ++requestIndex.current
    if (termsLoading || meetingsLoading || !selectedStart || !selectedEnd) {
      setData(EMPTY)
      setBusy(false)
      return
    }
    setBusy(true)
    // Re-fetch by the actual selected term/meeting; stale results cannot cross years.
    setData(EMPTY)
    loadBookingSnapshot(selectedStart, selectedEnd).then((snapshot) => {
      if (request === requestIndex.current) setData(snapshot)
    }).catch((error: any) => {
      if (request === requestIndex.current) toast.error(error?.message || 'تعذر تحميل الحجوزات')
    }).finally(() => {
      if (request === requestIndex.current) setBusy(false)
    })
    return () => { requestIndex.current += 1 }
  }, [currentScoutYear?.id, selectedStart, selectedEnd, termsLoading, meetingsLoading, reload])

  const teamNames = useMemo(() => new Map(data.teams.map((team) => [team.id, team.name])), [data.teams])
  const materials = useMemo(() => new Map(data.materials.map((item) => [item.id, item.name])), [data.materials])
  const fieldZones = useMemo(() => new Map(data.zones.map((item) => [item.id, item.name])), [data.zones])
  const resourceName = (item: BookingRecord) => item.kind === 'material'
    ? (materials.get(item.resourceId) || 'أداة غير معروفة')
    : (fieldZones.get(item.resourceId) || 'قطاع غير معروف')

  const filtered = useMemo(() => data.rows.filter((row) => {
    if (teamId && row.teamId !== teamId) return false
    if (manage && kindFilter !== 'all' && row.kind !== kindFilter) return false
    if (manage && search.trim()) {
      const resource = row.kind === 'material' ? materials.get(row.resourceId) : fieldZones.get(row.resourceId)
      return [resource, teamNames.get(row.teamId), row.id].some((value) => (value || '').toLowerCase().includes(search.trim().toLowerCase()))
    }
    return true
  }), [data.rows, teamId, kindFilter, manage, search, materials, fieldZones, teamNames])

  const totalPages = Math.max(1, Math.ceil(filtered.length / 15))
  const shownPage = Math.min(page, totalPages)
  const visible = filtered.slice((shownPage - 1) * 15, shownPage * 15)
  const countMaterials = filtered.filter((item) => item.kind === 'material').length
  const countFields = filtered.filter((item) => item.kind === 'field').length
  const countCompleted = filtered.filter((item) => ['returned', 'completed'].includes(bookingStatus(item).id)).length

  useEffect(() => { setPage(1) }, [teamId, kindFilter, search, termId, meetingDate])
  const editRow = data.rows.find((item) => `${item.kind}:${item.id}` === editId) || null

  useEffect(() => {
    if (editId) editPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [editId])

  function beginEdit(row: BookingRecord) {
    if (isReadOnlyView) { toast.error('السنوات المؤرشفة للعرض فقط.'); return }
    setEditId(`${row.kind}:${row.id}`)
    setDraft(toDraft(row))
  }

  function notifyTeam(row: BookingRecord, action: 'cancel' | 'update') {
    const ntype = row.kind === 'field'
      ? (action === 'cancel' ? 'field_reservation_cancelled' : 'field_reservation_updated')
      : (action === 'cancel' ? 'materials_reservation_cancelled' : 'materials_reservation_updated')
    void supabase.rpc('notify_team_roles', {
      _team_id: row.teamId,
      _role_slugs: ['chef_de_legion', 'responsable_materials'],
      _ntype: ntype,
      _payload: { team_id: row.teamId, teamName: teamNames.get(row.teamId) || '—',
        extra: { actor_name: user?.name || user?.email || 'مسؤول', reservation_id: row.id } },
      _actor_user_id: user?.id || null,
    }).then(({ error }) => { if (error) console.warn('Booking notification failed:', error.message) })
  }

  async function saveEdit() {
    if (!manage || !editRow || !draft || isReadOnlyView || changing || busy) return
    const errorMessage = validateBookingEdit(editRow, draft, year)
    if (errorMessage) { toast.error(errorMessage); return }
    if (editRow.kind === 'material' && !data.approvalsAvailable) {
      toast.error('تعذر التحقق من الاسترجاعات المعتمدة؛ لا يمكن تعديل حجز الأداة بأمان.')
      return
    }
    if (editRow.kind === 'material' && draft.qty < editRow.qtyReturned) {
      toast.error('لا يمكن خفض الكمية عن الكمية المعتمدة في الاسترجاع.')
      return
    }
    const start = cairoLocalToISO(draft.startsAt)!
    const end = cairoLocalToISO(draft.endsAt)!
    const payload: Record<string, unknown> = {
      team_id: draft.teamId, starts_at: start, ends_at: end,
      ...(editRow.kind === 'material'
        ? { material_id: draft.resourceId, qty: draft.qty }
        : { field_zone_id: draft.resourceId, ...(draft.teamId !== editRow.teamId ? { meeting_id: null } : {}) }),
    }
    const target = editRow.kind === 'material' ? 'material_reservations' : 'field_reservations'
    setChanging(true)
    try {
      const { data: updated, error } = await supabase.from(target)
        .update(payload).eq('id', editRow.id).is('soft_deleted_at', null).select('id').maybeSingle()
      if (error) throw error
      if (!updated) throw new Error('لم يتم تعديل الحجز. راجع الصلاحيات أو حالة الحجز.')
      void safeWriteAuditLog({
        action: 'update', module: target, entityType: editRow.kind === 'material' ? 'material_reservation' : 'field_reservation',
        entityId: editRow.id, entityDisplay: resourceName(editRow), source: 'ReservationsDirectManage', severity: 'warning',
        teamId: draft.teamId, scoutYearId: currentScoutYear?.id, summary: `تعديل حجز ${resourceName(editRow)} للفريق ${teamNames.get(draft.teamId) || ''}`,
        before: { team_id: editRow.teamId, resource_id: editRow.resourceId, qty: editRow.qty, starts_at: editRow.startsAt, ends_at: editRow.endsAt },
        after: payload,
      })
      notifyTeam({ ...editRow, teamId: draft.teamId }, 'update')
      if (draft.teamId !== editRow.teamId) notifyTeam(editRow, 'update')
      toast.success('تم تعديل الحجز بنجاح')
      setEditId(''); setDraft(null); fetchRows()
    } catch (error: any) {
      toast.error(error?.message?.includes('overlap') ? 'تعارض: القطاع محجوز خلال هذه الفترة.' : error?.message || 'تعذر حفظ التعديل')
    } finally { setChanging(false) }
  }

  async function removeBooking(row: BookingRecord, intent: 'cancel' | 'delete') {
    if (!manage || isReadOnlyView || changing || busy) return
    const verb = intent === 'cancel' ? 'إلغاء' : 'حذف من القائمة'
    if (!window.confirm(`هل تريد ${verb} حجز ${resourceName(row)} لفريق ${teamNames.get(row.teamId) || '—'}؟\nسيتم حفظ السجل في تاريخ العمليات دون حذفه نهائيًا من قاعدة البيانات.`)) return
    const target = row.kind === 'material' ? 'material_reservations' : 'field_reservations'
    setChanging(true)
    try {
      const deletedAt = new Date().toISOString()
      const { data: updated, error } = await supabase.from(target)
        .update({ soft_deleted_at: deletedAt }).eq('id', row.id).is('soft_deleted_at', null).select('id').maybeSingle()
      if (error) throw error
      if (!updated) throw new Error('لم يتم إلغاء الحجز. راجع الصلاحيات أو حالة الحجز.')
      void safeWriteAuditLog({
        action: intent, module: target, entityType: row.kind === 'material' ? 'material_reservation' : 'field_reservation',
        entityId: row.id, entityDisplay: resourceName(row), source: 'ReservationsDirectManage', severity: 'warning',
        teamId: row.teamId, scoutYearId: currentScoutYear?.id, summary: `${verb} حجز ${resourceName(row)} لفريق ${teamNames.get(row.teamId) || ''}`,
        before: { team_id: row.teamId, resource_id: row.resourceId, starts_at: row.startsAt, ends_at: row.endsAt },
        after: { soft_deleted_at: deletedAt }, changedFields: ['soft_deleted_at'],
      })
      notifyTeam(row, 'cancel')
      toast.success(`تم ${verb} الحجز بنجاح`)
      if (editId === `${row.kind}:${row.id}`) { setEditId(''); setDraft(null) }
      fetchRows()
    } catch (error: any) { toast.error(error?.message || 'تعذر إلغاء الحجز') }
    finally { setChanging(false) }
  }

  return (
    <div className={`r135-page ${manage ? 'is-manage' : 'is-overview'}`} dir="rtl">
      <PageLoader visible={busy && !data.rows.length} text="جاري تحميل حجوزات السنة الكشفية..." />
      <header className="r135-hero">
        <div>
          <span className="r135-eyebrow">{manage ? '⚙️ الإدارة والصلاحيات' : '📅 سجل الحجوزات · عرض فقط'}</span>
          <h1>{manage ? 'إدارة الحجوزات المباشرة' : 'الحجوزات'}</h1>
          <p>{manage
            ? 'إدارة حجوزات الأدوات وقطاعات الأرض: تعديل البيانات، وإلغاء أو حذف الحجز من القائمة مع الاحتفاظ بسجل العمليات.'
            : 'استعرض حجوزات الأدوات والأرض لجميع الفرق حسب التاريخ، وتابع وقت البداية والنهاية وحالة الاكتمال دون تغيير البيانات.'}</p>
          <div className="r135-year">السنة الكشفية: <b>{shortYearLabel(currentScoutYear)}</b>{isReadOnlyView ? ' · أرشيف للعرض فقط' : ''}</div>
        </div>
        {manage ? (
          <nav className="r135-hero-actions" aria-label="إنشاء وإدارة الحجوزات">
            {!isReadOnlyView && <Link to="/app/MaterialTeamReservation">＋ حجز أدوات</Link>}
            {!isReadOnlyView && <Link to="/app/FieldReservationsTeam">＋ حجز أرض</Link>}
            <Link to="/app/MaterialsReturnApprove">الاستلام والاسترجاع</Link>
            <Link to="/app/AdminFieldReservations">إدارة الأرض التفصيلية</Link>
          </nav>
        ) : <div className="r135-readonly-mark"> <span> <span aria-hidden="true">◉</span> للمتابعة والعرض فقط </span> </div>}
      </header>

      <div className="r135-stats" aria-label="ملخص الفترة">
        <div><span>إجمالي الحجوزات</span><strong>{filtered.length}</strong><small>في الاجتماع أو الترم المختار</small></div>
        <div><span>حجوزات الأدوات</span><strong>{countMaterials}</strong><small>🧰 الأدوات</small></div>
        <div><span>حجوزات الأرض</span><strong>{countFields}</strong><small>🏕️ القطاعات</small></div>
        <div><span>مكتملة</span><strong>{countCompleted}</strong><small>الأرض المنتهية أو الأدوات المسترجعة</small></div>
      </div>

      <section className="r135-panel r135-filters" aria-label="فلاتر الحجوزات">
        <div className="r135-panel-title">
          <div><h2>البحث في الحجوزات</h2><p>اختر الترم ثم الاجتماع من المواعيد المسجلة في السنة الكشفية، ويمكنك تحديد الفريق.</p></div>
          <button type="button" onClick={fetchRows} disabled={busy}>↻ تحديث</button>
        </div>
        <div className="r135-filter-grid">
          <label>الترم
            <select value={termId} disabled={termsLoading || !terms.length} onChange={(e) => setTermId(e.target.value)}>
              {!terms.length && <option value="">لا توجد ترمات لهذه السنة</option>}
              {terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
            </select>
          </label>
          <label>الاجتماع المسجّل
            <select value={meetingDate} disabled={meetingsLoading || !termId} onChange={(e) => setMeetingDate(e.target.value)}>
              <option value="all">كل حجوزات الترم</option>
              {meetingDates.map((item) => <option key={item.id} value={item.meeting_date}>{item.meeting_date}</option>)}
            </select>
          </label>
          <label>الفريق<select value={teamId} onChange={(e) => setTeamId(e.target.value)}><option value="">كل الفرق</option>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          {manage && <label>نوع الحجز<select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)}><option value="all">أدوات وأرض</option><option value="material">الأدوات فقط</option><option value="field">الأرض فقط</option></select></label>}
          {manage && <label>بحث بالاسم<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="الأداة، القطاع، الفريق..." /></label>}
        </div>
        <div className="r135-filter-shortcuts">
          <button type="button" disabled={!termId} onClick={() => setMeetingDate('all')}>كل الترم</button>
          <button type="button" disabled={!meetingDates.length} onClick={() => setMeetingDate(preferredReservationMeeting(meetingDates, cairoDay()))}>أقرب اجتماع</button>
          <small>{selectionLabel}</small>
        </div>
        {!termsLoading && !terms.length && <p className="r135-scope-help">لا توجد ترمات مسجلة للسنة الكشفية المختارة، ولن يتم عرض بيانات سنة أخرى.</p>}
        {!meetingsLoading && termId && !meetingDates.length && <p className="r135-scope-help">لا توجد اجتماعات مسجلة لهذا الترم. يمكنك عرض حجوزات الترم بالكامل لحين تسجيل الاجتماعات.</p>}
      </section>

      {!data.approvalsAvailable && <div className="r135-warning">تعذّر قراءة سجلات اعتماد الاسترجاع؛ قد لا تعكس حالات استرجاع الأدوات الوضع الفعلي.</div>}
      {isReadOnlyView && manage && <div className="r135-warning">السنة المختارة مؤرشفة: متاح استعراض الحجوزات فقط، ولا يمكن تعديلها أو إلغاؤها هنا.</div>}

      <section className="r135-panel r135-records">
        <div className="r135-panel-title"><div><h2>{manage ? 'الحجوزات القابلة للإدارة' : 'قائمة الحجوزات'}</h2><p>{filtered.length} حجز · {selectionLabel}</p></div>{busy && <span className="r135-loading">جاري التحديث…</span>}</div>
        {!filtered.length ? <EmptyState title="لا توجد حجوزات مطابقة" description="جرّب اختيار اجتماع آخر أو فريق آخر ضمن الترم والسنة الكشفية المختارين." /> : (
          <div className="r135-table-scroll"><table className="r135-table"><thead><tr>
            <th>النوع</th><th>الحجز</th><th>الفريق</th><th>بداية الحجز</th><th>تاريخ الانتهاء / الاكتمال</th><th>الكمية</th><th>الحالة</th>{manage && <th>إدارة</th>}
          </tr></thead><tbody>
            {visible.map((row) => {
              const status = bookingStatus(row)
              return <tr key={`${row.kind}:${row.id}`}>
                <td><ResourceBadge kind={row.kind} /></td>
                <td><strong>{resourceName(row)}</strong><small>#{row.id.slice(0, 8)}</small></td>
                <td><span className="r135-team">{teamNames.get(row.teamId) || '—'}</span></td>
                <td>{bookingDateLabel(row.startsAt)}</td>
                <td><span>{bookingDateLabel(row.endsAt)}</span>{row.kind === 'material' && row.approvedAt && <small>الاسترجاع: {bookingDateLabel(row.approvedAt)}</small>}</td>
                <td>{row.kind === 'material' ? row.qty : '—'}</td>
                <td><span className={`r135-status status-${status.id}`}>{status.label}</span></td>
                {manage && <td><div className="r135-row-actions"><button type="button" disabled={changing || isReadOnlyView} onClick={() => beginEdit(row)}>تعديل</button><button type="button" className="is-cancel" disabled={changing || isReadOnlyView} onClick={() => void removeBooking(row, 'cancel')}>إلغاء</button><button type="button" className="is-delete" disabled={changing || isReadOnlyView} onClick={() => void removeBooking(row, 'delete')}>حذف</button></div></td>}
              </tr>
            })}
          </tbody></table></div>
        )}
        {totalPages > 1 && <div className="r135-pagination"><span>صفحة {shownPage} من {totalPages}</span><div><button type="button" disabled={shownPage === 1} onClick={() => setPage((n) => n - 1)}>السابق</button><button type="button" disabled={shownPage === totalPages} onClick={() => setPage((n) => n + 1)}>التالي</button></div></div>}
      </section>

      {manage && editRow && draft && !isReadOnlyView && (
        <section ref={editPanelRef} className="r135-panel r135-editor" aria-label="تعديل الحجز">
          <div className="r135-panel-title"><div><h2>تعديل الحجز · {resourceName(editRow)}</h2><p>كل التعديلات تخضع للتحقق من الفترة والتعارض والصلاحيات في قاعدة البيانات.</p></div><button type="button" onClick={() => {setEditId('');setDraft(null)}}>✕ إغلاق</button></div>
          <div className="r135-edit-grid">
            <label>الفريق<select value={draft.teamId} onChange={(e) => setDraft({ ...draft, teamId: e.target.value })}>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
            <label>{editRow.kind === 'material' ? 'الأداة' : 'قطاع الأرض'}<select value={draft.resourceId} onChange={(e) => setDraft({ ...draft, resourceId: e.target.value })}>{(editRow.kind === 'material' ? data.materials : data.zones).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            {editRow.kind === 'material' && <label>الكمية<input type="number" min="1" step="1" value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: Number(e.target.value) })} /></label>}
            <label>البداية<input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></label>
            <label>النهاية<input type="datetime-local" value={draft.endsAt} onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })} /></label>
          </div>
          <div className="r135-editor-actions"><button type="button" className="r135-save" disabled={changing} onClick={() => void saveEdit()}>{changing ? 'جاري الحفظ...' : 'حفظ التعديل'}</button><button type="button" onClick={() => {setEditId('');setDraft(null)}}>إلغاء التعديل</button></div>
        </section>
      )}
      {manage && <p className="r135-footnote">ملاحظة: زر «حذف» يستخدم الحذف المنطقي (soft delete) للحفاظ على سجل الحجز وسجل العمليات، مثل آلية الإلغاء المتبعة في النظام؛ لا يحدث مسح نهائي لبيانات الإنتاج.</p>}
    </div>
  )
}
