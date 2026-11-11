// src/pages/AdminAttendance.tsx
import { useEffect, useMemo, useState } from 'react'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toaster'
import { PageLoader } from '../components/ui/PageLoader'
import { LoadingButton } from '../components/ui/LoadingButton'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { useScoutYear } from '../components/ScoutYearProvider'
import { clampDateToBounds, getScoutYearBounds, inDateBounds } from '../lib/scoutYearScope'
import { safeWriteAuditLog } from '../features/audit/api'
import { buildAttendanceSummary } from '../features/audit/humanize'
import { fetchTerms } from '../features/reference/api'

type Team = { id: string; name: string }
type Term = { id: string; name: string; year: number; start_date: string | null; end_date: string | null }

type RankObj = { rank_slug: string | null; rank_label: string | null }

type Member = {
  id: string
  full_name: string
  team_id: string
  rank_slug?: string | null
  rank_label?: string | null
}

type DayStatus = {
  present?: boolean
  is_excused?: boolean
  excuse_note?: string
}

type ScopeRead = 'range' | 'year' | 'term'

export default function AdminAttendance() {
  const toast = useToast()
  const { currentScoutYear } = useScoutYear()
  const [loading, setLoading] = useState(true)

  // ====== Teams / Terms ======
  const [teams, setTeams] = useState<Team[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [teamNameMap, setTeamNameMap] = useState<Map<string,string>>(new Map())

  // ====== READ (Stats) filters — مستقلة ======
  const [readTeamId, setReadTeamId] = useState<string>('all') // 'all' => كل الفرق
  const [readScope, setReadScope] = useState<ScopeRead>('range')
  const [readFrom, setReadFrom] = useState<string>('')
  const [readTo, setReadTo] = useState<string>('')
  const [readYear, setReadYear] = useState<number>(new Date().getFullYear())
  const [readTermId, setReadTermId] = useState<string>('')

  // ====== WRITE (Chef de legion attendance) filters — مستقلة ======
  const [writeTeamId, setWriteTeamId] = useState<string>('')       // فريق الكتابة أو "all"
  const [writeDate, setWriteDate] = useState<string>('')           // تاريخ التسجيل
  const [writeType, setWriteType] = useState<'preparation'|'meeting'>('meeting')

  // ====== READ data ======
  const [readMembers, setReadMembers] = useState<Member[]>([])
  const [readRows, setReadRows] = useState<any[]>([]) // rows للجدول

  // ====== WRITE data ======
  const [chefs, setChefs] = useState<Member[]>([]) // أعضاء rank = chef_de_legion (فريق واحد أو كل الفرق)
  const [dayStatus, setDayStatus] = useState<Record<string, DayStatus>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (currentScoutYear?.id) void init() }, [currentScoutYear?.id])
  async function init() {
    setLoading(true)
    try {
      // فرق
      const { data: ts, error: te } = await supabase.from('teams').select('id,name').order('name')
      if (te) throw te
      const tlist = (ts as Team[]) ?? []
      setTeams(tlist)
      setTeamNameMap(new Map(tlist.map(t => [t.id, t.name])))

      // ترمات
      const tmsList = await fetchTerms()
      const tms = tmsList as Term[]
      setTerms(tmsList)
      setReadTermId(tmsList[0]?.id || '')

      // تواريخ افتراضية للقراءة (الشهر الحالي)
      const today = new Date(); const pad = (n:number)=>String(n).padStart(2,'0')
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const yearBounds = getScoutYearBounds(currentScoutYear)
      setReadFrom(clampDateToBounds(`${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`, yearBounds))
      setReadTo(clampDateToBounds(`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`, yearBounds))
      setReadYear(Number(currentScoutYear?.start_date?.slice(0, 4) || today.getFullYear()))

      // افتراض الكتابة: أول فريق لو موجود
      if (tlist.length) setWriteTeamId(tlist[0].id)
      setWriteDate(clampDateToBounds(`${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`, yearBounds))
      setWriteType('meeting')
    } catch (e:any) {
      toast.error(e.message || 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }

  // ====== READ: تحميل الأعضاء (Chef de legion فقط) حسب "الكل" أو فريق محدد ======
  useEffect(() => { loadReadMembers() }, [readTeamId])
  async function loadReadMembers() {
    try {
      let q = scoutYearFrom('v_members_current', 'v_members_context')
        .select('id, full_name, team_id, rank_slug, rank_label')
        .eq('rank_slug', 'chef_de_legion')
        .eq('is_active', true)
        .order('full_name', { ascending: true }) as any

      if (readTeamId !== 'all') q = q.eq('team_id', readTeamId)

      const { data, error } = await q
      if (error) throw error

      // Supabase بيرجع ranks كـ Array — نفلّتها إلى عنصر واحد
      const mapped: Member[] = ((data as any[]) ?? []).map(r => ({
        id: r.id,
        full_name: r.full_name,
        team_id: r.team_id,
        rank_slug: r.rank_slug,
        rank_label: r.rank_label,
      }))
      setReadMembers(mapped)
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل الأعضاء (الإحصائيات)')
    }
  }

  // ====== READ: حساب الفترة الزمنية الفعلية من الفلاتر ======
  function computeReadRange(): { from?: string, to?: string } {
    const year = getScoutYearBounds(currentScoutYear)
    if (!year) return { from: '9999-01-01', to: '9999-01-01' }
    if (readScope === 'range') {
      return { from: readFrom && readFrom > year.start ? readFrom : year.start, to: readTo && readTo < year.end ? readTo : year.end }
    }
    if (readScope === 'year') {
      return { from: year.start, to: year.end }
    }
    // term
    const t = terms.find(x => x.id === readTermId)
    return { from: t?.start_date && t.start_date > year.start ? t.start_date : year.start, to: t?.end_date && t.end_date < year.end ? t.end_date : year.end }
  }

  // ====== READ: تحميل الإحصائيات ======
  async function loadStats() {
    const { from, to } = computeReadRange()
    setLoading(true)
    try {
      // meetings
      let mq = supabase
        .from('meetings')
        .select('id, team_id, meeting_date, mtype') as any
      if (currentScoutYear?.id) mq = mq.eq('scout_year_id', currentScoutYear.id)
      if (readTeamId !== 'all') mq = mq.eq('team_id', readTeamId)
      if (from) mq = mq.gte('meeting_date', from)
      if (to) mq = mq.lte('meeting_date', to)
      mq = mq.order('meeting_date', { ascending: true })

      const { data: meets, error: me } = await mq
      if (me) throw me

      const meetingIds = (meets as any[] ?? []).map(x => x.id)
      if (!meetingIds.length) { setReadRows([]); setLoading(false); return }

      // attendance (مع بعذر/بدون)
      const { data: atts, error: ae } = await supabase
        .from('attendance')
        .select('meeting_id, member_id, is_present, is_excused')
        .in('meeting_id', meetingIds)
      if (ae) throw ae

      // build maps
      const nameByMember: Record<string, string> = {}
      const rankByMember: Record<string, string> = {}
      const teamByMember: Record<string, string> = {}
      readMembers.forEach(m => {
        nameByMember[m.id] = m.full_name
        rankByMember[m.id] = m.rank_label || 'Chef de legion'
        teamByMember[m.id] = teamNameMap.get(m.team_id) || '—'
      })

      const map: Record<string, {
        present: number, excused: number, unexcused: number, total: number,
        name: string, rank: string, team_name: string
      }> = {}

      ;(atts as any[] ?? []).forEach(a => {
        const mid = a.member_id
        if (!nameByMember[mid]) return // خارج الفلتر (مش Chef)
        if (!map[mid]) {
          map[mid] = {
            present: 0, excused: 0, unexcused: 0, total: 0,
            name: nameByMember[mid], rank: rankByMember[mid], team_name: teamByMember[mid]
          }
        }
        map[mid].total += 1
        if (a.is_present) map[mid].present += 1
        else (a.is_excused ? map[mid].excused++ : map[mid].unexcused++)
      })

      const rows = Object.values(map).sort((a,b) => a.name.localeCompare(b.name, 'ar'))
      setReadRows(rows)
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل الإحصائيات')
    } finally {
      setLoading(false)
    }
  }

  // ====== WRITE: تحميل Chef de legion للفريق المختار أو لكل الفرق ======
  useEffect(() => { if (writeTeamId) loadChefs() }, [writeTeamId])
  async function loadChefs() {
    try {
      let q = scoutYearFrom('v_members_current', 'v_members_context')
        .select('id, full_name, team_id, rank_slug, rank_label')
        .eq('rank_slug', 'chef_de_legion')
        .eq('is_active', true)
        .order('team_id', { ascending: true })
        .order('full_name', { ascending: true }) as any

      if (writeTeamId !== 'all') q = q.eq('team_id', writeTeamId)

      const { data, error } = await q
      if (error) throw error

      const list: Member[] = ((data as any[]) ?? []).map(r => ({
        id: r.id,
        full_name: r.full_name,
        team_id: r.team_id,
        rank_slug: r.rank_slug,
        rank_label: r.rank_label,
      }))
      setChefs(list)
      setDayStatus({})
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل قادة الفرقة')
    }
  }

  // ====== WRITE: تحكم الحالة ======
  function setPresent(mid: string, v: boolean) {
    setDayStatus(prev => {
      const curr = prev[mid] || {}
      return { ...prev, [mid]: { ...curr, present: v, ...(v ? { is_excused: false, excuse_note: '' } : {}) } }
    })
  }
  function setExcused(mid: string, v: boolean) {
    setDayStatus(prev => {
      const curr = prev[mid] || {}
      return { ...prev, [mid]: { ...curr, is_excused: v } }
    })
  }
  function setNote(mid: string, v: string) {
    setDayStatus(prev => {
      const curr = prev[mid] || {}
      return { ...prev, [mid]: { ...curr, excuse_note: v } }
    })
  }

  // ====== WRITE: حفظ ======
  const [savingBusy, setSavingBusy] = useState(false)
  async function saveAttendance() {
    if (!writeDate) return toast.error('اختر التاريخ')
    if (!inDateBounds(writeDate, getScoutYearBounds(currentScoutYear))) return toast.error('تاريخ الحضور خارج السنة الكشفية المختارة')
    if (!chefs.length) return toast.error('لا يوجد Chef de legion للحفظ')

    setSaving(true); setSavingBusy(true)
    try {
      // لو فريق معيّن: اجتماع واحد
      if (writeTeamId !== 'all') {
        const { data: mrow, error: me } = await supabase
          .from('meetings')
          .upsert({ team_id: writeTeamId, meeting_date: writeDate, mtype: writeType, scout_year_id: currentScoutYear?.id }, { onConflict: 'team_id,meeting_date,mtype' })
          .select('id')
          .maybeSingle()
        if (me) throw me
        const meetingId = mrow?.id
        if (!meetingId) throw new Error('تعذر إنشاء/الوصول للاجتماع')

        const memberIds = chefs.map((member) => member.id)
        const { data: prevRows } = await supabase
          .from('attendance')
          .select('member_id, is_present')
          .eq('meeting_id', meetingId)
          .in('member_id', memberIds)

        const beforeMap = new Map<string, boolean>()
        for (const row of (prevRows as any[] ?? [])) beforeMap.set(String(row.member_id), !!row.is_present)

        const rows = chefs.map(m => {
          const st = dayStatus[m.id] || {}
          const present = st.present === true
          const absent  = st.present === false
          return {
            meeting_id: meetingId,
            member_id: m.id,
            is_present: present,
            is_excused: present ? false : !!st.is_excused,
            excuse_note: present ? null : (st.excuse_note || null),
          }
        }).filter(r => typeof r.is_present === 'boolean')

        if (!rows.length) { toast.error('لم يتم تحديد أي حضور/غياب'); setSaving(false); setSavingBusy(false); return }

        const { error: aerr } = await supabase
          .from('attendance')
          .upsert(rows, { onConflict: 'meeting_id,member_id' })
        if (aerr) throw aerr

        const teamName = teamNameMap.get(writeTeamId) || 'فريق غير محدد'
        const absentMembersAfter = chefs.filter((member) => dayStatus[member.id]?.present === false).map((member) => member.full_name)
        const absentMembersBefore = chefs.filter((member) => !beforeMap.get(member.id)).map((member) => member.full_name)
        const presentCountAfter = chefs.length - absentMembersAfter.length
        const presentCountBefore = chefs.length - absentMembersBefore.length

        void safeWriteAuditLog({
          action: 'save_attendance',
          module: 'attendance',
          entityType: 'meeting',
          entityId: meetingId,
          entityDisplay: `${teamName} — ${writeDate}`,
          summary: buildAttendanceSummary({
            teamName,
            meetingDate: writeDate,
            presentCount: presentCountAfter,
            absentCount: absentMembersAfter.length,
            subject: 'حضور Chef de legion',
          }),
          severity: absentMembersAfter.length > 0 ? 'warning' : 'info',
          source: 'AdminAttendance',
          teamId: writeTeamId,
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
            meeting_date: writeDate,
            meeting_type: writeType,
            team_name: teamName,
            audience: 'chef_de_legion',
            absent_members: absentMembersAfter,
          },
        })
      } else {
        // "الكل": ننشئ اجتماع لكل فريق موجود له Chef ونحفظ حضور كل قائد على اجتماع فريقه
        const teamIds = Array.from(new Set(chefs.map(c => c.team_id)))
        if (!teamIds.length) throw new Error('لا توجد فرق')

        // أنشئ/احصل على اجتماع لكل فريق
        const teamMeetingMap = new Map<string, string>() // team_id -> meeting_id
        // نعملها على التوالي لتبسيط الأخطاء
        for (const tid of teamIds) {
          const teamMeetingPayload: any = { team_id: tid, meeting_date: writeDate, mtype: writeType }
          if (currentScoutYear?.id) teamMeetingPayload.scout_year_id = currentScoutYear.id
          const writeTermId = terms.find(term => (!term.start_date || writeDate >= term.start_date) && (!term.end_date || writeDate <= term.end_date))?.id
          if (writeTermId) teamMeetingPayload.term_id = writeTermId
          const { data: mrow, error: me } = await supabase
            .from('meetings')
            .upsert(teamMeetingPayload, { onConflict: 'team_id,meeting_date,mtype' })
            .select('id')
            .maybeSingle()
          if (me) throw me
          if (!mrow?.id) throw new Error(`تعذر إنشاء/الوصول لاجتماع الفريق ${teamNameMap.get(tid) || tid}`)
          teamMeetingMap.set(tid, mrow.id)
        }

        // حضّر صفوف الحضور موزّعة على الاجتماعات الصحيحة
        const rows = chefs.map(m => {
          const st = dayStatus[m.id] || {}
          const present = st.present === true
          const absent  = st.present === false
          const meeting_id = teamMeetingMap.get(m.team_id)
          if (!meeting_id) return null
          return {
            meeting_id,
            member_id: m.id,
            is_present: present,
            is_excused: present ? false : !!st.is_excused,
            excuse_note: present ? null : (st.excuse_note || null),
          }
        }).filter((r: any) => r && typeof r.is_present === 'boolean') as any[]

        if (!rows.length) { toast.error('لم يتم تحديد أي حضور/غياب'); setSaving(false); setSavingBusy(false); return }

        // نرفعهم دفعة واحدة
        const { error: aerr } = await supabase
          .from('attendance')
          .upsert(rows, { onConflict: 'meeting_id,member_id' })
        if (aerr) throw aerr

        const absentMembers = chefs.filter((member) => dayStatus[member.id]?.present === false).map((member) => member.full_name)
        void safeWriteAuditLog({
          action: 'save_attendance',
          module: 'attendance',
          entityType: 'meeting_batch',
          entityDisplay: `كل الفرق — ${writeDate}`,
          summary: `سجّل حضور قادة الفرق لكل الفرق يوم ${writeDate}: ${rows.length - absentMembers.length} حاضر و${absentMembers.length} غائب`,
          severity: absentMembers.length > 0 ? 'warning' : 'info',
          source: 'AdminAttendance',
          after: {
            present_count: rows.length - absentMembers.length,
            absent_count: absentMembers.length,
            affected_teams: teamIds.map((tid) => teamNameMap.get(tid) || tid),
          },
          changedFields: ['present_count', 'absent_count'],
          context: {
            meeting_date: writeDate,
            meeting_type: writeType,
            audience: 'chef_de_legion',
            team_names: teamIds.map((tid) => teamNameMap.get(tid) || tid),
            absent_members: absentMembers,
          },
        })
      }

      toast.success('تم حفظ الحضور')
    } catch (e:any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally {
      setSaving(false); setSavingBusy(false)
    }
  }

  // ====== مشتقات للعرض ======
  const showTeamColumnInRead = readTeamId === 'all'
  const showTeamColumnInWrite = writeTeamId === 'all'
  const attendanceTotals = useMemo(() => readRows.reduce((acc:any, row:any) => ({
    present: acc.present + Number(row.present || 0),
    excused: acc.excused + Number(row.excused || 0),
    unexcused: acc.unexcused + Number(row.unexcused || 0),
    total: acc.total + Number(row.total || 0),
  }), { present: 0, excused: 0, unexcused: 0, total: 0 }), [readRows])
  const attendancePct = attendanceTotals.total > 0
    ? Math.round((attendanceTotals.present / attendanceTotals.total) * 100)
    : 0
  const markedToday = useMemo(
    () => chefs.filter((member) => typeof dayStatus[member.id]?.present === 'boolean').length,
    [chefs, dayStatus]
  )

  // ====== UI ======
  return (
    <div className="attendance123-page space-y-5 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        className="attendance123-hero"
        eyebrow="الحضور"
        title="إدارة الحضور"
        description="راجع التزام قادة الفرق عبر المدى أو السنة أو الترم، ثم سجّل حضور اليوم من نفس مساحة العمل بدون تغيير خطوات الحفظ الحالية."
        badge={<span className="attendance123-hero-badge">Admin</span>}
      />

      <div className="attendance123-kpis grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="إجمالي السجلات" value={attendanceTotals.total} hint={readRows.length ? `${readRows.length} قائد في النتائج` : 'اعرض الإحصائيات لبدء التحليل'} accent="navy" />
        <MetricCard label="حاضر" value={attendanceTotals.present} accent="emerald" />
        <MetricCard label="غياب بعذر" value={attendanceTotals.excused} accent="amber" />
        <MetricCard label="غياب بدون عذر" value={attendanceTotals.unexcused} accent="rose" />
        <MetricCard label="نسبة الحضور" value={`${attendancePct}%`} hint={attendanceTotals.total ? 'من السجلات المعروضة' : 'لا توجد بيانات بعد'} accent="sky" />
      </div>

      <SectionCard
        className="attendance123-panel attendance123-stats"
        title="إحصائيات الحضور — Chef de legion"
        description="استخدم نفس الفلاتر الحالية لاختيار الفريق والنطاق، ثم اعرض النتائج في جدول موحد وسهل القراءة."
        actions={<span className="attendance123-count-chip">{readRows.length} قائد</span>}
      >
        <div className="attendance123-filterbar">
          <label className="attendance123-field">
            <span>الفريق</span>
            <select value={readTeamId} onChange={e=>setReadTeamId(e.target.value)}>
              <option value="all">كل الفرق</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>

          <label className="attendance123-field">
            <span>النطاق</span>
            <select value={readScope} onChange={e=>setReadScope(e.target.value as ScopeRead)}>
              <option value="range">مدى (من/إلى)</option>
              <option value="year">سنة كاملة</option>
              <option value="term">ترم</option>
            </select>
          </label>

          {readScope === 'range' && (
            <>
              <label className="attendance123-field"><span>من</span><input type="date" value={readFrom} min={getScoutYearBounds(currentScoutYear)?.start} max={getScoutYearBounds(currentScoutYear)?.end} onChange={e=>setReadFrom(e.target.value)} /></label>
              <label className="attendance123-field"><span>إلى</span><input type="date" value={readTo} min={getScoutYearBounds(currentScoutYear)?.start} max={getScoutYearBounds(currentScoutYear)?.end} onChange={e=>setReadTo(e.target.value)} /></label>
            </>
          )}

          {readScope === 'year' && (
            <label className="attendance123-field"><span>السنة</span><input type="number" value={readYear} readOnly /></label>
          )}

          {readScope === 'term' && (
            <label className="attendance123-field attendance123-field-wide">
              <span>الترم</span>
              <select value={readTermId} onChange={e=>setReadTermId(e.target.value)}>
                {terms.map(t => <option key={t.id} value={t.id}>{t.year} — {t.name}</option>)}
              </select>
            </label>
          )}

          <button type="button" className="attendance123-primary" onClick={loadStats}>عرض الإحصائيات</button>
        </div>

        <div className="attendance123-table-wrap">
          <table className="attendance123-table min-w-[900px] md:min-w-0">
            <thead>
              <tr>
                {showTeamColumnInRead && <th>الفريق</th>}
                <th>الاسم</th><th>الرتبة</th><th>حضور</th><th>غياب بعذر</th><th>غياب بدون عذر</th><th>الإجمالي</th><th>نسبة الحضور</th>
              </tr>
            </thead>
            <tbody>
              {readRows.map((r:any, i:number) => {
                const pct = r.total > 0 ? Math.round((r.present / r.total) * 100) : 0
                return (
                  <tr key={i}>
                    {showTeamColumnInRead && <td><span className="attendance123-team">{r.team_name}</span></td>}
                    <td><strong>{r.name}</strong></td>
                    <td>{r.rank}</td>
                    <td className="text-center"><span className="attendance123-number is-present">{r.present}</span></td>
                    <td className="text-center"><span className="attendance123-number is-excused">{r.excused}</span></td>
                    <td className="text-center"><span className="attendance123-number is-absent">{r.unexcused}</span></td>
                    <td className="text-center font-black">{r.total}</td>
                    <td className="text-center"><span className={`attendance123-pct ${pct>=80?'is-good':pct>=60?'is-warn':'is-bad'}`}>{r.total > 0 ? `${pct}%` : '—'}</span></td>
                  </tr>
                )
              })}
              {readRows.length === 0 && <tr><td className="attendance123-empty" colSpan={showTeamColumnInRead ? 8 : 7}>اختر النطاق واضغط «عرض الإحصائيات» لعرض البيانات.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        className="attendance123-panel attendance123-write"
        title="تسجيل حضور اليوم — Chef de legion"
        description="نفس عملية التسجيل الحالية: اختر الفريق والتاريخ ونوع اليوم، حدّد حاضر/غائب والعذر عند الحاجة، ثم احفظ."
        actions={<span className="attendance123-count-chip is-green">تم تحديد {markedToday} من {chefs.length}</span>}
      >
        <div className="attendance123-filterbar attendance123-write-filters">
          <label className="attendance123-field"><span>الفريق</span><select value={writeTeamId} onChange={e=>setWriteTeamId(e.target.value)}><option value="all">كل الفرق</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="attendance123-field"><span>التاريخ</span><input type="date" value={writeDate} min={getScoutYearBounds(currentScoutYear)?.start} max={getScoutYearBounds(currentScoutYear)?.end} onChange={e=>setWriteDate(e.target.value)} /></label>
          <label className="attendance123-field"><span>نوع اليوم</span><select value={writeType} onChange={e=>setWriteType(e.target.value as any)}><option value="preparation">تحضير</option><option value="meeting">اجتماع</option></select></label>
          <LoadingButton className="attendance123-save" loading={saving} onClick={saveAttendance}>حفظ الحضور</LoadingButton>
        </div>

        <div className="attendance123-table-wrap">
          <table className="attendance123-table attendance123-write-table min-w-[860px] md:min-w-0">
            <thead><tr>{showTeamColumnInWrite && <th>الفريق</th>}<th>الاسم</th><th>حاضر</th><th>غائب</th><th>بعذر؟</th><th>العذر</th></tr></thead>
            <tbody>
              {chefs.map(m => {
                const st = dayStatus[m.id] || {}
                const present = st.present === true
                const absent = st.present === false
                return (
                  <tr key={m.id} className={present ? 'is-present-row' : absent ? 'is-absent-row' : ''}>
                    {showTeamColumnInWrite && <td><span className="attendance123-team">{teamNameMap.get(m.team_id) || '—'}</span></td>}
                    <td><strong>{m.full_name}</strong></td>
                    <td className="text-center"><label className="attendance123-choice is-present"><input type="radio" name={`att-${m.id}`} checked={present} onChange={()=>setPresent(m.id, true)} /><span>حاضر</span></label></td>
                    <td className="text-center"><label className="attendance123-choice is-absent"><input type="radio" name={`att-${m.id}`} checked={absent} onChange={()=>setPresent(m.id, false)} /><span>غائب</span></label></td>
                    <td className="text-center"><label className="attendance123-excuse"><input type="checkbox" disabled={!absent} checked={!!st.is_excused} onChange={e=>setExcused(m.id, e.target.checked)} /><span>بعذر</span></label></td>
                    <td><input className="attendance123-note-input" placeholder="سبب الغياب (اختياري)" value={st.excuse_note || ''} onChange={e=>setNote(m.id, e.target.value)} disabled={!absent} /></td>
                  </tr>
                )
              })}
              {chefs.length === 0 && <tr><td className="attendance123-empty" colSpan={showTeamColumnInWrite ? 6 : 5}>لا يوجد Chef de legion مطابق للفريق المختار.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
