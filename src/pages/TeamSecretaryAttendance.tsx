// src/pages/TeamSecretaryAttendance.tsx
import { useEffect, useMemo, useState } from 'react'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/PageLoader'
import { useToast } from '../components/ui/Toaster'
import { fetchCurrentUserContext, fetchTeamById, fetchTeams, fetchTerms } from '../features/reference/api'
import { safeWriteAuditLog } from '../features/audit/api'
import { buildAttendanceSummary } from '../features/audit/humanize'
import { getErrorMessage, logError } from '../lib/errors'
import { LoadingButton } from '../components/ui/LoadingButton'
import { useAuth } from '../components/AuthProvider'
import { PageHero } from '../components/ui/PageHero'
import { MetricCard } from '../components/ui/MetricCard'
import { SectionCard } from '../components/ui/SectionCard'
import { EmptyState } from '../components/ui/EmptyState'
import { InlineAlert } from '../components/ui/InlineAlert'
import { useScoutYear } from '../components/ScoutYearProvider'
import { clampDateToBounds, getTermYearBounds, inDateBounds } from '../lib/scoutYearScope'

type Team = { id: string; name: string }
type Term = { id: string; name: string; year: number; start_date: string|null; end_date: string|null }
type Equipier = { id: string; full_name: string }
type Counts = { present: number; total: number; absent_excused: number; absent_unexcused: number }

type TermDateRow = { id: string; meeting_date: string } // YYYY-MM-DD

export default function TeamSecretaryAttendance() {
  const toast = useToast()
  const { currentScoutYear } = useScoutYear()
  const { roles } = useAuth()
  const isAdmin = roles.some(r => r.role_slug === 'admin')
  const isGlobalSec = roles.some(r => r.role_slug === 'responsable_secretary' && (r.team_id === null || r.team_id === undefined))

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState<string>('')
  const [teamName, setTeamName] = useState<string>('')

  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState<string>('')

  // ✅ تواريخ الترم
  const [termDates, setTermDates] = useState<TermDateRow[]>([])
  const hasTermDates = termDates.length > 0
  const [useCustomDay, setUseCustomDay] = useState<boolean>(false)

  const [list, setList] = useState<Equipier[]>([])
  const [meetingDate, setMeetingDate] = useState<string>('')
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [counts, setCounts] = useState<Record<string, Counts>>({})

  const termMeta = useMemo(() => terms.find(t => t.id === termId) || null, [terms, termId])
  const termBounds = termMeta ? getTermYearBounds(currentScoutYear, termMeta) : null
  const attendanceMetrics = useMemo(() => {
    const total = list.length
    const present = Object.values(checks).filter(Boolean).length
    const absent = Math.max(total - present, 0)
    return { total, present, absent }
  }, [checks, list])

  useEffect(() => { if (currentScoutYear?.id) void init() }, [currentScoutYear?.id])
  async function init() {
    setLoading(true)
    try {
      const tm = await fetchTerms()
      setTerms(tm)
      setTermId(tm[0]?.id || '')

      if (isAdmin || isGlobalSec) {
        const ts = await fetchTeams()
        setTeams(ts)
        if (ts.length) { setTeamId(ts[0].id); setTeamName(ts[0].name) }
      } else {
        const me = await fetchCurrentUserContext()
        if (!me?.team_id) throw new Error('لا يوجد فريق مرتبط بحسابك')
        setTeamId(me.team_id)
        const t = await fetchTeamById(me.team_id)
        setTeamName(t?.name || '—')
      }

      // تاريخ افتراضي (اليوم)
      const now = new Date(); const pad=(n:number)=>String(n).padStart(2,'0')
      const d = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
      setMeetingDate(clampDateToBounds(d, getTermYearBounds(currentScoutYear)))
    } catch (e:any) {
      logError('TeamSecretaryAttendance.init', e)
      toast.error(getErrorMessage(e, 'تعذر التحميل'))
    } finally { setLoading(false) }
  }

  // ✅ تحميل تواريخ الترم المختار + دمج أي تواريخ اجتماعات محفوظة فعليًا
  useEffect(() => { if (termId && teamId && termBounds) void loadTermDates(termId); else setTermDates([]) }, [termId, teamId, terms, currentScoutYear?.id])
  async function loadTermDates(tid: string) {
    try {
      const term = terms.find(t => t.id === tid)
      const bounds = getTermYearBounds(currentScoutYear, term)
      if (!bounds) { setTermDates([]); return }

      const { data: baseDates, error: baseErr } = await supabase
        .from('term_meeting_dates')
        .select('id, meeting_date')
        .eq('term_id', tid)
        .gte('meeting_date', bounds.start).lte('meeting_date', bounds.end)
        .order('meeting_date', { ascending: true })
      if (baseErr) throw baseErr

      let meetingsQuery = supabase
        .from('meetings')
        .select('id, meeting_date')
        .eq('team_id', teamId)
        .eq('mtype', 'meeting') as any
      if (currentScoutYear?.id) meetingsQuery = meetingsQuery.eq('scout_year_id', currentScoutYear.id)

      meetingsQuery = meetingsQuery.gte('meeting_date', bounds.start).lte('meeting_date', bounds.end)

      const { data: existingMeetings, error: meetingsErr } = await meetingsQuery.order('meeting_date', { ascending: true })
      if (meetingsErr) throw meetingsErr

      const merged = new Map<string, TermDateRow>()

      ;((baseDates as any[]) ?? []).forEach(row => {
        merged.set(row.meeting_date, {
          id: row.id,
          meeting_date: row.meeting_date,
        })
      })

      ;((existingMeetings as any[]) ?? []).forEach(row => {
        if (!merged.has(row.meeting_date)) {
          merged.set(row.meeting_date, {
            id: `meeting-${row.id}`,
            meeting_date: row.meeting_date,
          })
        }
      })

      const mergedList = Array.from(merged.values()).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
      setTermDates(mergedList)

      if (mergedList.length > 0) {
        setUseCustomDay(false)
        const nextDate = mergedList.some(d => d.meeting_date === meetingDate)
          ? meetingDate
          : mergedList[0].meeting_date
        if (nextDate !== meetingDate) setMeetingDate(nextDate)
        await loadMeetingAttendanceForDate(nextDate)
      } else {
        setUseCustomDay(true)
        if (meetingDate) await loadMeetingAttendanceForDate(meetingDate)
      }
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل تواريخ الترم')
    }
  }

  useEffect(() => { if (teamId) refreshList() }, [teamId])
  useEffect(() => { if (teamId && termId) refreshCounts() }, [teamId, termId])

  async function refreshList() {
    try {
      const { data, error } = await scoutYearFrom('v_members_current', 'v_members_context')
        .select('id, full_name')
        .eq('team_id', teamId).eq('is_equipier', true).eq('is_active', true).order('full_name')
      if (error) throw error
      const arr = (data as any[]) ?? []
      setList(arr)
      const c: Record<string, boolean> = {}; const r: Record<string, string> = {}
      arr.forEach(m => { c[m.id] = false; r[m.id] = '' })
      setChecks(c); setReasons(r)
      if (meetingDate) await loadMeetingAttendanceForDate(meetingDate, arr.map(x=>x.id))
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل الأفراد')
    }
  }

  // ===== احصاءات الترم من الView (مع fallback) =====
  async function refreshCounts() {
    try {
      if (!teamId || !termId) { setCounts({}); return }
      const { data, error } = await supabase
        .from('v_equipier_term_stats')
        .select('member_id, present, total, absent_excused, absent_unexcused')
        .eq('team_id', teamId)
        .eq('term_id', termId)
      if (error) throw error
      const map: Record<string, Counts> = {}
      ;(data as any[] ?? []).forEach(r => {
        map[r.member_id] = {
          present: Number(r.present)||0,
          total: Number(r.total)||0,
          absent_excused: Number(r.absent_excused)||0,
          absent_unexcused: Number(r.absent_unexcused)||0
        }
      })
      setCounts(map)
    } catch (e:any) {
      await refreshCountsFallback()
    }
  }

  async function refreshCountsFallback() {
    try {
      const term = terms.find(t => t.id === termId)
      if (!term?.start_date || !term?.end_date) { setCounts({}); return }
      let attendanceQuery = supabase
        .from('attendance')
        .select('member_id, is_present, absence_reason, meetings!inner(meeting_date, mtype, team_id, scout_year_id)')
      if (currentScoutYear?.id) attendanceQuery = attendanceQuery.eq('meetings.scout_year_id', currentScoutYear.id)
      const { data, error } = await attendanceQuery
        .eq('meetings.team_id', teamId)
        .eq('meetings.mtype', 'meeting')
        .gte('meetings.meeting_date', term.start_date)
        .lte('meetings.meeting_date', term.end_date)
      if (error) throw error
      const map: Record<string, Counts> = {}
      ;(data as any[] ?? []).forEach(r => {
        const id = r.member_id as string
        if (!map[id]) map[id] = { present: 0, total: 0, absent_excused: 0, absent_unexcused: 0 }
        map[id].total += 1
        if (r.is_present) map[id].present += 1
        else {
          const exc = r.absence_reason && String(r.absence_reason).trim() !== ''
          if (exc) map[id].absent_excused += 1
          else map[id].absent_unexcused += 1
        }
      })
      setCounts(map)
    } catch { setCounts({}) }
  }

  async function loadMeetingAttendanceForDate(dateISO: string, memberIds?: string[]) {
    const ids = memberIds ?? list.map(x => x.id)
    const emptyChecks: Record<string, boolean> = {}
    const emptyReasons: Record<string, string> = {}
    ids.forEach(id => { emptyChecks[id] = false; emptyReasons[id] = '' })

    try {
      if (!teamId || !dateISO) {
        setChecks(emptyChecks)
        setReasons(emptyReasons)
        return
      }

      const { data: meetingRows, error: meetingsErr } = await supabase
        .from('meetings')
        .select('id')
        .eq('team_id', teamId)
        .eq('meeting_date', dateISO)
        .eq('mtype', 'meeting')
        .order('id', { ascending: true })

      if (meetingsErr) throw meetingsErr

      const meetingIds = (meetingRows ?? []).map(row => row.id)

      if (!meetingIds.length) {
        setChecks(emptyChecks)
        setReasons(emptyReasons)
        return
      }

      const { data: attRows, error: attErr } = await supabase
        .from('attendance')
        .select('member_id, is_present, absence_reason, meeting_id')
        .in('meeting_id', meetingIds)

      if (attErr) throw attErr

      const nextChecks = { ...emptyChecks }
      const nextReasons = { ...emptyReasons }

      ;(attRows as any[] ?? []).forEach(a => {
        nextChecks[a.member_id] = !!a.is_present
        nextReasons[a.member_id] = a.is_present ? '' : (a.absence_reason || '')
      })

      setChecks(nextChecks)
      setReasons(nextReasons)
    } catch {
      setChecks(emptyChecks)
      setReasons(emptyReasons)
    }
  }

  async function saveAttendance() {
    setSaving(true)
    try {
      if (!inDateBounds(meetingDate, termBounds)) throw new Error('تاريخ الاجتماع خارج حدود الترم والسنة الكشفية')
      const { data: mrow, error: me } = await supabase
        .from('meetings')
        .upsert({ team_id: teamId, meeting_date: meetingDate, mtype: 'meeting' }, { onConflict: 'team_id,meeting_date,mtype' })
        .select('id').maybeSingle()
      if (me) throw me
      const meeting_id = mrow?.id
      if (!meeting_id) throw new Error('تعذر إنشاء سجل الاجتماع')

      const memberIds = Object.keys(checks)
      const { data: prevRows } = await supabase
        .from('attendance')
        .select('member_id, is_present, absence_reason')
        .eq('meeting_id', meeting_id)
        .in('member_id', memberIds)

      const beforeMap = new Map<string, boolean>()
      for (const row of (prevRows as any[] ?? [])) beforeMap.set(String(row.member_id), !!row.is_present)

      const payload = memberIds.map((member_id) => ({
        meeting_id, member_id, is_present: !!checks[member_id],
        absence_reason: checks[member_id] ? null : ((reasons[member_id] || '').trim() || null)
      }))
      if (!payload.length) throw new Error('لا يوجد أفراد')

      const { error: ae } = await supabase.from('attendance').upsert(payload, { onConflict: 'meeting_id,member_id' })
      if (ae) throw ae

      const absentMembersAfter = list.filter((member) => !checks[member.id]).map((member) => member.full_name)
      const absentMembersBefore = list.filter((member) => !beforeMap.get(member.id)).map((member) => member.full_name)
      const presentCountAfter = list.length - absentMembersAfter.length
      const presentCountBefore = list.length - absentMembersBefore.length

      void safeWriteAuditLog({
        action: 'save_attendance',
        module: 'attendance',
        entityType: 'meeting',
        entityId: meeting_id,
        entityDisplay: `${teamName} — ${meetingDate}`,
        summary: buildAttendanceSummary({
          teamName,
          meetingDate,
          presentCount: presentCountAfter,
          absentCount: absentMembersAfter.length,
        }),
        severity: absentMembersAfter.length > 0 ? 'warning' : 'info',
        source: 'TeamSecretaryAttendance',
        teamId,
        before: {
          present_count: presentCountBefore,
          absent_count: absentMembersBefore.length,
          absent_members: absentMembersBefore,
        },
        after: {
          present_count: presentCountAfter,
          absent_count: absentMembersAfter.length,
          absent_members: absentMembersAfter,
        },
        changedFields: ['present_count', 'absent_count', 'absent_members'],
        context: {
          meeting_date: meetingDate,
          team_name: teamName,
          term_name: termMeta?.name || null,
          absent_members: absentMembersAfter,
        },
      })

      toast.success('تم حفظ الحضور')
      await refreshCounts()
      await loadMeetingAttendanceForDate(meetingDate)
    } catch (e:any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        eyebrow="إدارة يومية للحضور"
        title="حضور وغياب — سكرتارية الفريق"
        description="سجّل حضور الفريق بسرعة، وراجع نسبة الحضور داخل الترم المحدد مع واجهة أوضح وأسهل في المتابعة."
        badge={
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
            {teamName ? `الفريق: ${teamName}` : 'تحديد الفريق'}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <MetricCard label="الأعضاء الظاهرون" value={attendanceMetrics.total} accent="indigo" />
        <MetricCard label="حاضر الآن" value={attendanceMetrics.present} accent="emerald" />
        <MetricCard label="غائب الآن" value={attendanceMetrics.absent} accent="amber" />
      </div>

      {(isAdmin || isGlobalSec) ? (
        <SectionCard title="تحديد الفريق" description="اختر الفريق الذي تريد متابعة حضوره أو تسجيله الآن.">
          <label className="text-sm">الفريق</label>
          <select
            className="border rounded-xl p-2 w-full min-w-0 cursor-pointer"
            value={teamId}
            onChange={e=>{
              const id = e.target.value; setTeamId(id)
              const t = teams.find(x=>x.id===id); setTeamName(t?.name || '')
            }}
          >
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </SectionCard>
      ) : (
        <InlineAlert tone="info" title="نطاق العمل الحالي">
          فريقك الحالي هو <b>{teamName}</b> ويمكنك إدارة حضوره مباشرة من هذه الشاشة.
        </InlineAlert>
      )}

      <SectionCard title="تسجيل يوم الحضور" description="اختر الترم والتاريخ ثم احفظ الحضور أو الغياب لأفراد الفريق الظاهرين.">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 items-end">
        <div>
          <label className="text-sm">الترم</label>
          <select
            className="border rounded-xl p-2 w-full min-w-0 cursor-pointer"
            value={termId}
            onChange={e=>setTermId(e.target.value)}
          >
            {terms.map(t => <option key={t.id} value={t.id}>{t.year} — {t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm">تاريخ الاجتماع</label>
          {hasTermDates && !useCustomDay ? (
            <>
              <select
                className="border rounded-xl p-2 w-full min-w-0 cursor-pointer"
                value={meetingDate}
                onChange={async e=>{
                  const v = e.target.value
                  if (v === '__custom__') { setUseCustomDay(true); return }
                  setMeetingDate(v)
                  await loadMeetingAttendanceForDate(v)
                }}
              >
                {termDates.map(d => (
                  <option key={d.id} value={d.meeting_date}>{d.meeting_date}</option>
                ))}
                <option value="__custom__">— تاريخ آخر —</option>
              </select>
              <div className="text-[11px] text-gray-500 mt-1">اختر من جدول الترم أو اختر "تاريخ آخر".</div>
            </>
          ) : (
            <>
              <input
                type="date"
                className="border rounded-xl p-2 w-full min-w-0"
                value={meetingDate}
                onChange={async e=>{
                  const v = e.target.value
                  setMeetingDate(v)
                  await loadMeetingAttendanceForDate(v)
                }}
                min={termMeta?.start_date ?? undefined}
                max={termMeta?.end_date ?? undefined}
              />
              {hasTermDates && (
                <button
                  type="button"
                  className="text-[12px] underline mt-1"
                  onClick={()=>{
                    if (termDates.length){
                      setUseCustomDay(false)
                      const d = termDates[0].meeting_date
                      setMeetingDate(clampDateToBounds(d, getTermYearBounds(currentScoutYear)))
                      loadMeetingAttendanceForDate(d)
                    }
                  }}
                >الرجوع لاختيار من جدول الترم</button>
              )}
            </>
          )}
        </div>
        <div className="text-end">
          <LoadingButton loading={saving} onClick={saveAttendance}>حفظ الحضور</LoadingButton>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState title="لا توجد أسماء جاهزة للتسجيل" description="راجع الفريق أو الترم أو تأكد من وجود أعضاء نشطين في السنة الحالية." />
      ) : null}

      <div className="border rounded-2xl w-full max-w-full overflow-x-auto mt-3">
        <table className="w-full min-w-[900px] text-xs sm:text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-start">الاسم</th>
              <th className="p-2 text-center whitespace-nowrap">حضر؟</th>
              <th className="p-2 text-start">عذر الغياب (إن وُجد)</th>
              <th className="p-2 text-center whitespace-nowrap">حضوره في الترم</th>
            </tr>
          </thead>
          <tbody>
            {list.map(m => {
              const c = counts[m.id] || { present: 0, total: 0, absent_excused: 0, absent_unexcused: 0 }
              const present = !!checks[m.id]
              return (
                <tr key={m.id} className="border-t align-top">
                  <td className="p-2">{m.full_name}</td>
                  <td className="p-2 text-center whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="scale-125 cursor-pointer"
                      checked={present}
                      onChange={e=>{
                        const v = e.target.checked
                        setChecks(p=>({...p, [m.id]: v}))
                        if (v) setReasons(r=>({...r, [m.id]: ''}))
                      }}
                    />
                  </td>
                  <td className="p-2">
                    {!present ? (
                      <input
                        className="border rounded-xl p-2 w-full min-w-0"
                        placeholder="اكتب العذر (اختياري)"
                        value={reasons[m.id] || ''}
                        onChange={e=>setReasons(r=>({...r, [m.id]: e.target.value}))}
                      />
                    ) : <span className="text-xs text-gray-500">—</span>}
                  </td>
                  <td className="p-2 text-center whitespace-nowrap">
                    <span className="px-2 py-1 rounded-full bg-white border text-[11px] sm:text-xs">
                      {c.present} من {c.total} — {c.total ? Math.round((c.present/c.total)*100) : 0}%
                      <br />
                      <span className="text-[10px] sm:text-[11px] text-gray-600">بعذر {c.absent_excused} / بدون {c.absent_unexcused}</span>
                    </span>
                  </td>
                </tr>
              )
            })}
            {list.length === 0 && <tr><td className="p-3 text-center text-gray-500" colSpan={4}>لا توجد بيانات</td></tr>}
          </tbody>
        </table>
      </div>
      </SectionCard>
    </div>
  )
}
