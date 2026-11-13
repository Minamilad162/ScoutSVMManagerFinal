import { useEffect, useRef, useState } from 'react'
import { useScoutYear } from '../components/ScoutYearProvider'
import { getTermYearBounds, inDateBounds } from '../lib/scoutYearScope'
import { cairoDay, cairoLocalToISO, cairoRangeISO, bookingDateLabel } from '../features/reservations/bookingRecords'
import { scopedFieldMeetingDays, preferredFieldMeeting, canBookFieldForTeam, fieldBookingUnavailableReason } from '../features/reservations/fieldTeamBooking'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toaster'
import { PageLoader } from '../components/ui/PageLoader'
import { fetchCurrentUserContext, fetchTerms } from '../features/reference/api'
import { safeWriteAuditLog } from '../features/audit/api'
import { buildFieldReservationSummary } from '../features/audit/humanize'
import { LoadingButton } from '../components/ui/LoadingButton'
import { useAuth } from '../components/AuthProvider'
import FieldMaps from '../components/FieldMaps'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { MetricCard } from '../components/ui/MetricCard'
import { EmptyState } from '../components/ui/EmptyState'

// ===== Types =====
type Team = { id: string; name: string }
type Zone = { id: string; name: string }
type Term = { id: string; name: string; year: number; start_date: string | null; end_date: string | null }
type TermDateRow = { id: string; meeting_date: string } // YYYY-MM-DD

// حجوزات اليوم المختار (لكل الفرق)
type DayRow = {
  id: string
  starts_at: string
  ends_at: string
  field_zones: { name: string | null } | null
  teams: { name: string | null } | null
}

// حجوزات الفريق في اليوم المختار فقط
type TeamRow = {
  id: string
  starts_at: string
  ends_at: string
  field_zones: { name: string | null } | null
}

export default function FieldReservationsTeam() {
  const toast = useToast()
  const { roles } = useAuth()
  const { currentScoutYear, isReadOnlyView } = useScoutYear()
  const isAdmin = roles.some(r => r.role_slug === 'admin')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [canceling, setCanceling] = useState<string | null>(null)

  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState<string>('')
  const [teamName, setTeamName] = useState<string>('')
  const [memberTeamId, setMemberTeamId] = useState('')

  const [zones, setZones] = useState<Zone[]>([])

  // Terms + Dates
  const [terms, setTerms] = useState<Term[]>([])
  const [selTerm, setSelTerm] = useState<string>('')          // المختار في UI
  const [termDates, setTermDates] = useState<TermDateRow[]>([])
  const termMeta = terms.find(t => t.id === selTerm) || null
  const selectedTermBounds = termMeta ? getTermYearBounds(currentScoutYear, termMeta) : null

  // Meeting inputs
  const [mtype, setMtype] = useState<'preparation' | 'meeting'>('meeting')
  const [meetingDate, setMeetingDate] = useState<string>('')  // YYYY-MM-DD
  const [startTime, setStartTime] = useState<string>('16:00') // HH:MM
  const [endTime, setEndTime] = useState<string>('18:00')     // HH:MM
  const [zoneId, setZoneId] = useState<string>('')
  const canBookTeam = canBookFieldForTeam(roles, teamId, memberTeamId, isReadOnlyView)
  const blockReason = fieldBookingUnavailableReason({
    canBook: canBookTeam, readOnly: isReadOnlyView, hasTeam: Boolean(teamId),
    hasTerm: Boolean(selectedTermBounds), hasZone: Boolean(zoneId),
    selectedDate: meetingDate, registeredDates: termDates, today: cairoDay(),
  })

  // حجوزات الفريق (لليوم المختار فقط)
  const [rows, setRows] = useState<TeamRow[]>([])

  // ==== حجوزات كل الفرق في التاريخ المختار ====
  const [dayRows, setDayRows] = useState<DayRow[]>([])
  const [dayLoading, setDayLoading] = useState(false)

  // ==== حجوزات الفريق في التاريخ المختار ====
  const [teamDayLoading, setTeamDayLoading] = useState(false)
  const initRequestRef = useRef(0)
  const dayRequestRef = useRef(0)
  const teamRequestRef = useRef(0)

  // Load the CURRENT selected Scout Year, not stale terms from another season.
  useEffect(() => {
    const request = ++initRequestRef.current
    if (currentScoutYear?.id) void init(request)
    return () => { ++initRequestRef.current }
  }, [currentScoutYear?.id, isAdmin])
  async function init(request: number) {
    setLoading(true)
    setTerms([]); setSelTerm(''); setTermDates([]); setMeetingDate('')
    setRows([]); setDayRows([]); setZoneId(''); setTeamId(''); setTeamName(''); setMemberTeamId('')
    try {
      const [zoneResult, termRows] = await Promise.all([
        supabase.from('field_zones').select('id,name').eq('active', true).order('name'),
        fetchTerms(),
      ])
      if (zoneResult.error) throw zoneResult.error
      if (request !== initRequestRef.current) return
      const zoneList = (zoneResult.data as Zone[]) || []
      setZones(zoneList)
      setZoneId(zoneList[0]?.id || '')

      if (isAdmin) {
        const { data, error } = await supabase.from('teams').select('id,name').order('name')
        if (error) throw error
        if (request !== initRequestRef.current) return
        const teamList = (data as Team[]) || []
        setTeams(teamList)
        setTeamId(teamList[0]?.id || '')
        setTeamName(teamList[0]?.name || '')
      } else {
        const me = await fetchCurrentUserContext()
        if (request !== initRequestRef.current) return
        if (!me?.team_id) throw new Error('لا يوجد فريق مرتبط بحسابك في السنة الكشفية الحالية')
        setMemberTeamId(me.team_id)
        setTeamId(me.team_id)
        setTeamName(me.team_name || '—')
      }
      setTerms(termRows || [])
      const today = cairoDay()
      const active = termRows.find(t => t.start_date && t.end_date && today >= t.start_date && today <= t.end_date)
      setSelTerm((active || termRows[0])?.id || '')
    } catch (e: any) {
      if (request === initRequestRef.current) toast.error(e.message || 'تعذر تحميل بيانات الحجز')
    } finally {
      if (request === initRequestRef.current) setLoading(false)
    }
  }

  // Meeting dates are filtered to the selected term/year. Ignore stale network responses.
  useEffect(() => {
    let active = true
    setTermDates([])
    setMeetingDate('')
    if (!selTerm || !selectedTermBounds) return () => { active = false }
    void (async () => {
      try {
        const { data, error } = await supabase.from('term_meeting_dates')
          .select('id,meeting_date').eq('term_id', selTerm)
          .gte('meeting_date', selectedTermBounds.start)
          .lte('meeting_date', selectedTermBounds.end)
          .order('meeting_date', { ascending: true })
        if (error) throw error
        if (!active) return
        const available = scopedFieldMeetingDays((data || []) as TermDateRow[], selectedTermBounds)
        setTermDates(available)
        setMeetingDate(preferredFieldMeeting(available, cairoDay()))
      } catch (e: any) {
        if (active) toast.error(e.message || 'تعذر تحميل اجتماعات الترم')
      }
    })()
    return () => { active = false }
  }, [selTerm, selectedTermBounds?.start, selectedTermBounds?.end, currentScoutYear?.id])

  // ===== حجوزات كل الفرق في التاريخ المختار =====
  useEffect(() => {
    if (meetingDate) void refreshDayReservations()
    else { ++dayRequestRef.current; setDayRows([]) }
  }, [meetingDate, currentScoutYear?.id])

  async function refreshDayReservations() {
    const request = ++dayRequestRef.current
    if (!meetingDate) { setDayRows([]); return }
    setDayLoading(true)
    try {
      const range = cairoRangeISO(meetingDate, meetingDate)
      if (!range) { setDayRows([]); return }
      const { start: startISO, end: endISO } = range
      const { data, error } = await supabase
        .from('field_reservations')
        .select('id, starts_at, ends_at, field_zones:field_zone_id(name), teams:team_id(name)')
        .is('soft_deleted_at', null)
        .lt('starts_at', endISO)
        .gt('ends_at', startISO)
        .order('starts_at', { ascending: true })
      if (error) throw error
      if (request === dayRequestRef.current) setDayRows((data as any as DayRow[]) ?? [])
    } catch (e: any) {
      if (request === dayRequestRef.current) toast.error(e.message || 'تعذر تحميل حجوزات هذا التاريخ')
    } finally {
      if (request === dayRequestRef.current) setDayLoading(false)
    }
  }

  // ==== حجوزات الفريق لليوم المختار (تصفية بالتاريخ) ====
  useEffect(() => {
    if (teamId && meetingDate) void refreshTeamDayReservations()
    else { ++teamRequestRef.current; setRows([]) }
  }, [teamId, meetingDate, currentScoutYear?.id])

  async function refreshTeamDayReservations() {
    const request = ++teamRequestRef.current
    if (!teamId || !meetingDate) { setRows([]); return }
    setTeamDayLoading(true)
    try {
      const range = cairoRangeISO(meetingDate, meetingDate)
      if (!range) { setRows([]); return }
      const { start: startISO, end: endISO } = range
      const { data, error } = await supabase
        .from('field_reservations')
        .select('id, starts_at, ends_at, field_zones:field_zone_id(name)')
        .eq('team_id', teamId)
        .is('soft_deleted_at', null)
        .lt('starts_at', endISO)   // يبدأ قبل نهاية اليوم
        .gt('ends_at', startISO)   // وينتهي بعد بداية اليوم → overlap
        .order('starts_at', { ascending: true })
      if (error) throw error
      if (request === teamRequestRef.current) setRows((data as any as TeamRow[]) ?? [])
    } catch (e: any) {
      if (request === teamRequestRef.current) toast.error(e.message || 'تعذر تحميل حجوزات الفريق لهذا التاريخ')
    } finally {
      if (request === teamRequestRef.current) setTeamDayLoading(false)
    }
  }

  // ===== Actions =====
  async function save() {
    // Never submit unauthorized, archived or incomplete bookings.
    if (blockReason) return toast.error(blockReason)
    if (!teamId) return toast.error('اختر الفريق')
    if (!zoneId) return toast.error('اختر القطاع')

    if (mtype === 'meeting') {
      if (!selTerm) return toast.error('اختر الترم')
      if (!meetingDate) return toast.error('اختر تاريخ الاجتماع من قائمة التواريخ')
      // تأكد التاريخ من ضمن القائمة
      if (!termDates.some(d => d.meeting_date === meetingDate) || !inDateBounds(meetingDate, selectedTermBounds)) {
        return toast.error('التاريخ المختار غير موجود ضمن تواريخ الترم')
      }
      // (اختياري) تحقّق داخل نطاق الترم المختار
      const t = terms.find(t => t.id === selTerm)
      if (t && !inDateBounds(meetingDate, getTermYearBounds(currentScoutYear, t))) {
        return toast.error('التاريخ خارج حدود الترم')
      }
    } else {
      if (!meetingDate) return toast.error('اختر تاريخ الاجتماع')
      // (اختياري) لو فيه ترم نشط حاليًا، تقدر تمنع تاريخ خارج النطاق
      const t = terms.find(t => t.id === selTerm)
      if (t && !inDateBounds(meetingDate, getTermYearBounds(currentScoutYear, t))) {
        return toast.error('التاريخ خارج حدود الترم')
      }
    }

    if (!startTime || !endTime) return toast.error('أدخل وقتي البداية والنهاية')

    // Cairo time including daylight saving transitions, never browser-local UTC.
    const startISO = cairoLocalToISO(`${meetingDate}T${startTime}`)
    const endISO = cairoLocalToISO(`${meetingDate}T${endTime}`)
    if (!startISO || !endISO) return toast.error('الأوقات المختارة غير صالحة بتوقيت القاهرة')

    // تأكد إن البداية قبل النهاية
    if (new Date(startISO) >= new Date(endISO)) return toast.error('وقت البداية يجب أن يسبق وقت النهاية')
    if (new Date(startISO).getTime() <= Date.now()) return toast.error('لا يمكن إنشاء حجز بموعد بدأ بالفعل')

    setSaving(true)
    try {
      // Booking must not create/update a meeting: materials staff can reserve
      // their team's field but are not entitled to write the meetings table.
      const { data: mrow, error: me } = await supabase.from('meetings')
        .select('id').eq('team_id', teamId).eq('meeting_date', meetingDate)
        .eq('mtype', mtype).maybeSingle()
      if (me) throw me

      const { data: insertedReservation, error: ie } = await supabase
        .from('field_reservations')
        .insert({
          team_id: teamId,
          field_zone_id: zoneId,
          starts_at: startISO,
          ends_at: endISO,
          meeting_id: mrow?.id || null
        })
        .select('id')
        .single()
      if (ie) {
        const msg = String(ie.message || '')
        if (msg.includes('field_reservations_no_overlap') || msg.includes('overlap'))
          throw new Error('تعذر الحجز: هناك تعارض مع فريق آخر في نفس الوقت لهذا القطاع')
        throw ie
      }
      const zoneName = zones.find((zone) => zone.id === zoneId)?.name || 'قطاع غير محدد'
      void safeWriteAuditLog({
        action: 'create',
        module: 'field_reservations',
        entityType: 'field_reservation',
        entityId: insertedReservation?.id || null,
        entityDisplay: `${zoneName} — ${meetingDate}`.trim(),
        summary: buildFieldReservationSummary({
          action: 'create',
          zoneName,
          teamName,
          startsAt: startISO,
          endsAt: endISO,
        }),
        severity: 'info',
        source: 'FieldReservationsTeam',
        teamId,
        after: {
          zone_name: zoneName,
          starts_at: startISO,
          ends_at: endISO,
        },
        changedFields: ['zone_name', 'starts_at', 'ends_at'],
        context: {
          meeting_date: meetingDate,
          meeting_type: mtype,
          team_name: teamName,
          zone_name: zoneName,
        },
      })

      toast.success('تم الحجز')
      await refreshTeamDayReservations()
      await refreshDayReservations() // ← تحدّث جدول “حجوزات هذا التاريخ”
    } catch (e: any) {
      toast.error(e.message || 'تعذر الحجز')
    } finally {
      setSaving(false)
    }
  }

  async function cancel(id: string) {
    if (!canBookTeam) return toast.error('ليس لديك صلاحية إلغاء هذا الحجز')
    setCanceling(id)
    try {
      const reservation = rows.find((row) => row.id === id)
      const cancelledAt = new Date().toISOString()
      const { error } = await supabase
        .from('field_reservations')
        .update({ soft_deleted_at: cancelledAt })
        .eq('id', id)
      if (error) throw error

      void safeWriteAuditLog({
        action: 'cancel',
        module: 'field_reservations',
        entityType: 'field_reservation',
        entityId: id,
        entityDisplay: `${reservation?.field_zones?.name || 'قطاع غير محدد'} — ${meetingDate || ''}`.trim(),
        summary: buildFieldReservationSummary({
          action: 'cancel',
          zoneName: reservation?.field_zones?.name || null,
          teamName,
          startsAt: reservation?.starts_at || null,
          endsAt: reservation?.ends_at || null,
        }),
        severity: 'warning',
        source: 'FieldReservationsTeam',
        teamId,
        before: {
          zone_name: reservation?.field_zones?.name || null,
          starts_at: reservation?.starts_at || null,
          ends_at: reservation?.ends_at || null,
        },
        after: { soft_deleted_at: cancelledAt },
        changedFields: ['soft_deleted_at'],
        context: {
          meeting_date: meetingDate || null,
          team_name: teamName,
          zone_name: reservation?.field_zones?.name || null,
        },
      })

      toast.success('تم إلغاء الحجز')
      await refreshTeamDayReservations()
      await refreshDayReservations() // ← تحدّث جدول “حجوزات هذا التاريخ”
    } catch (e: any) {
      toast.error(e.message || 'تعذر الإلغاء')
    } finally { setCanceling(null) }
  }

  // ===== UI =====
  return (
    <div className="teamops127-page fieldreservations127-page space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        className="teamops127-hero fieldreservations127-hero"
        title="حجوزات قطاعات الأرض"
        eyebrow={teamName ? `الفريق: ${teamName}` : 'إدارة الحجوزات'}
        description="حجز قطاع أرض داخل تواريخ الترم المحددة، مع عرض خريطة الأرض وحجوزات الفريق وجميع الفرق في اليوم المختار."
        badge={!isAdmin ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">استخدام فريقي</span> : undefined}
      />

      <div className="teamops127-metrics grid gap-3 md:grid-cols-4">
        <MetricCard label="قطاعات متاحة" value={zones.length} hint="في الأرض الحالية" accent="indigo" />
        <MetricCard label="حجوزات فريقي" value={rows.length} hint="في اليوم المختار" accent="emerald" />
        <MetricCard label="حجوزات كل الفرق" value={dayRows.length} hint="في اليوم المختار" accent="sky" />
        <MetricCard label="تواريخ الترم" value={termDates.length} hint={meetingDate || 'بدون تاريخ'} accent="amber" />
      </div>

      {/* الخرائط دائمًا */}
      <SectionCard className="teamops127-map-panel" title="خريطة الأرض" description="راجع القطاعات قبل إنشاء الحجز، خاصة في الأيام التي تحتوي على حجوزات متعددة.">
        <FieldMaps className="mb-1" sticky height="h-72 md:h-[28rem]" />
      </SectionCard>

      {/* اختيار الفريق */}
      {!isAdmin ? (
        <SectionCard title="الفريق الحالي" description="الحجز سيتم على فريقك الحالي مباشرة من هذه الشاشة.">
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border">
            تحجز الآن لفريق: <b>{teamName}</b>
          </span>
        </SectionCard>
      ) : (
        <SectionCard title="اختيار الفريق" description="يمكن للإدارة الحجز أو المراجعة نيابة عن أي فريق من نفس الشاشة.">
          <label className="text-sm">الفريق</label>
          <select
            className="border rounded-xl p-2 w-full cursor-pointer"
            value={teamId}
            onChange={e => {
              const id = e.target.value
              setTeamId(id)
              const t = teams.find(x => x.id === id)
              setTeamName(t?.name || '')
            }}>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </SectionCard>
      )}

      <SectionCard className="teamops127-primary-panel" title="إضافة حجز جديد" description="اختر الترم، التاريخ، القطاع، ثم وقت البداية والنهاية قبل تأكيد الحجز.">
      <div>
        <div className="grid md:grid-cols-6 gap-2 items-end">
          {/* اختيار نوع اليوم */}
          <div className="md:col-span-2">
            <label className="text-sm">نوع اليوم</label>
            <select className="border rounded-xl p-2 w-full cursor-pointer" value={mtype} onChange={e=>setMtype(e.target.value as any)}>
              {/* <option value="preparation">تحضير (تاريخ حر)</option> */}
              <option value="meeting">اجتماع (من تواريخ الترم)</option>
            </select>
          </div>

          {/* اختيار الترم */}
          <div className="md:col-span-2">
            <label className="text-sm">الترم</label>
            <select className="border rounded-xl p-2 w-full cursor-pointer" value={selTerm} onChange={e=>setSelTerm(e.target.value)}>
              {!terms.length && <option value="">لا توجد ترمات في السنة الكشفية</option>}
              {terms.map(t => (
                <option key={t.id} value={t.id}>
                  {t.year} — {t.name}{t.start_date && t.end_date ? ` (${t.start_date} → ${t.end_date})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* تاريخ الاجتماع */}
          <div className="md:col-span-2">
            <label className="text-sm">تاريخ الاجتماع</label>
            {mtype === 'meeting' ? (
              <select
                className="border rounded-xl p-2 w-full cursor-pointer"
                value={meetingDate}
                onChange={e=>setMeetingDate(e.target.value)}
              >
                {termDates.length === 0 && <option value="">— لا توجد اجتماعات مسجلة —</option>}
                {termDates.map(d => <option key={d.id} value={d.meeting_date}>{d.meeting_date}</option>)}
              </select>
            ) : (
              <input
                type="date"
                className="border rounded-xl p-2 w-full"
                value={meetingDate}
                onChange={e=>setMeetingDate(e.target.value)}
                min={selectedTermBounds?.start}
                max={selectedTermBounds?.end}
              />
            )}
          </div>

          {/* القطاع */}
          <div className="md:col-span-2">
            <label className="text-sm">القطاع</label>
            <select className="border rounded-xl p-2 w-full cursor-pointer" value={zoneId} onChange={e=>setZoneId(e.target.value)}>
              {!zones.length && <option value="">لا توجد قطاعات مفعلة</option>}
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>

          {/* الأوقات */}
          <div className="md:col-span-1">
            <label className="text-sm">من (الساعة)</label>
            <input
              type="time"
              className="border rounded-xl p-2 w-full"
              value={startTime}
              onChange={e=>setStartTime(e.target.value)}
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-sm">إلى (الساعة)</label>
            <input
              type="time"
              className="border rounded-xl p-2 w-full"
              value={endTime}
              onChange={e=>setEndTime(e.target.value)}
            />
          </div>

          <div className="md:col-span-6 text-end">
            <LoadingButton loading={saving} disabled={Boolean(blockReason)} onClick={save}>حجز القطاع</LoadingButton>
          </div>
        </div>
        {blockReason && <div role="status" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-950">{blockReason}</div>}
      </div>
      </SectionCard>

      {/* حجوزات الفريق (مصفاة على التاريخ المختار) */}
      <SectionCard className="teamops127-list-panel" title={`حجوزات الفريق — ${meetingDate || 'بدون تاريخ'}`} description="كل الحجوزات الحالية لفريقك في اليوم المختار، مع إمكانية الإلغاء السريع.">
        <div className="flex items-center justify-between">
          {teamDayLoading && <span className="text-sm text-gray-500">جاري التحميل…</span>}
        </div>
        {(!teamDayLoading && rows.length === 0) ? (
          <EmptyState title="لا توجد حجوزات للفريق" description="لا توجد حجوزات مسجلة لهذا الفريق في التاريخ المختار." />
        ) : (
        <div className="border rounded-2xl overflow-hidden">
          <table className="table-modern w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-start">القطاع</th>
                <th className="p-2 text-start">من</th>
                <th className="p-2 text-start">إلى</th>
                <th className="p-2 text-center">إلغاء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.field_zones?.name || '—'}</td>
                  {/* Postgres بيخزن UTC (timestamptz) — هنا بنعرض محلي */}
                  <td className="p-2">{bookingDateLabel(r.starts_at)}</td>
                  <td className="p-2">{bookingDateLabel(r.ends_at)}</td>
                  <td className="p-2 text-center">
                    <button className="btn border" onClick={()=>cancel(r.id)} disabled={canceling===r.id || !canBookTeam}>{canceling===r.id ? '...' : 'إلغاء'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </SectionCard>

      {/* ===== الحجوزات في التاريخ المختار (لكل الفرق) ===== */}
      <SectionCard className="teamops127-list-panel" title={`حجوزات كل الفرق — ${meetingDate || 'بدون تاريخ'}`} description="راجع هذا الجدول قبل إنشاء حجز جديد لتجنب التعارضات على نفس القطاع أو الفترة.">
        <div className="flex items-center justify-between">
          {dayLoading && <span className="text-sm text-gray-500">جاري التحميل…</span>}
        </div>
        {(!dayLoading && dayRows.length === 0) ? (
          <EmptyState title="لا توجد حجوزات عامة" description="هذا اليوم لا يحتوي على حجوزات مسجلة من الفرق الأخرى حاليًا." />
        ) : (
        <div className="border rounded-2xl overflow-hidden">
          <table className="table-modern w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-start">القطاع</th>
                <th className="p-2 text-start">من</th>
                <th className="p-2 text-start">إلى</th>
                <th className="p-2 text-start">الفريق</th>
              </tr>
            </thead>
            <tbody>
              {dayRows.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.field_zones?.name || '—'}</td>
                  <td className="p-2">{bookingDateLabel(r.starts_at)}</td>
                  <td className="p-2">{bookingDateLabel(r.ends_at)}</td>
                  <td className="p-2">{r.teams?.name || '—'}</td>
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
