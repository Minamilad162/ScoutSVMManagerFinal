import { useEffect, useMemo, useState } from 'react'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { useScoutYear } from '../components/ScoutYearProvider'
import { EmptyState } from '../components/ui/EmptyState'
import { InlineAlert } from '../components/ui/InlineAlert'
import { LoadingButton } from '../components/ui/LoadingButton'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { PageLoader } from '../components/ui/PageLoader'
import { SectionCard } from '../components/ui/SectionCard'
import { useToast } from '../components/ui/Toaster'
import { fetchTeams, fetchTerms } from '../features/reference/api'
import { safeWriteAuditLog } from '../features/audit/api'
import { buildAttendanceSummary } from '../features/audit/humanize'
import { getErrorMessage, logError } from '../lib/errors'

type Team = { id: string; name: string }
type Term = { id: string; name: string; year: number; start_date: string | null; end_date: string | null }
type Member = { id: string; full_name: string; auth_user_id: string | null; rank_id: number | null }
type MeetingType = 'meeting' | 'preparation'
type Stat = { present: number; absent: number; total: number }

export default function Attendance() {
  const { user, roles } = useAuth()
  const { currentScoutYear } = useScoutYear()
  const toast = useToast()
  const isAdmin = roles.some(r => r.role_slug === 'admin')

  const [teams, setTeams] = useState<Team[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [teamId, setTeamId] = useState<string>('')
  const [termId, setTermId] = useState<string>('')

  const [members, setMembers] = useState<Member[]>([])
  const [ranks, setRanks] = useState<Record<number, string>>({})
  const [mtypeFilter, setMtypeFilter] = useState<'' | MeetingType>('')
  const [stats, setStats] = useState<Record<string, Stat>>({})
  const [totalMeetings, setTotalMeetings] = useState<number>(0)

  const [leaders, setLeaders] = useState<Member[]>([])
  const [adminOverrideAll, setAdminOverrideAll] = useState<boolean>(false)
  const [date, setDate] = useState<string>('')
  const [mtypeWrite, setMtypeWrite] = useState<MeetingType>('meeting')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [presence, setPresence] = useState<Record<string, boolean>>({})

  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)

  useEffect(() => { void init() }, [user])

  async function init() {
    if (!user) return
    setLoading(true)
    setErr(null)
    setMsg(null)
    try {
      const [tm, ts, { data: rk, error: re }] = await Promise.all([
        fetchTerms(),
        fetchTeams(),
        supabase.from('ranks').select('id,rank_label').order('id')
      ])
      if (re) throw re
      setTerms(tm)
      setTeams(ts)
      const rankMap: Record<number, string> = {}
      for (const r of (rk as any[] ?? [])) rankMap[r.id] = r.rank_label
      setRanks(rankMap)
      if (!termId && tm.length) setTermId(tm[0].id)
      if (!teamId && ts.length) setTeamId(ts[0].id)
    } catch (e: any) {
      logError('Attendance.init', e)
      setErr(getErrorMessage(e, 'خطأ أثناء التحميل'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (teamId) void loadMembers(teamId) }, [teamId])
  async function loadMembers(tid: string) {
    setErr(null)
    const { data, error } = await scoutYearFrom('v_members_current', 'v_members_context')
      .select('id, full_name, auth_user_id, rank_id')
      .eq('team_id', tid)
      .eq('is_active', true)
      .order('full_name')
    if (error) { setErr(error.message); return }
    setMembers((data as any) ?? [])
  }

  useEffect(() => { if (teamId && termId) void loadStats() }, [teamId, termId, mtypeFilter, members])
  async function loadStats() {
    setErr(null); setStats({}); setTotalMeetings(0)
    const term = terms.find(t => t.id === termId)
    if (!term?.start_date || !term?.end_date) return

    let meetingsQuery = supabase
      .from('meetings')
      .select('id, mtype, meeting_date')
      .eq('team_id', teamId)
      .gte('meeting_date', term.start_date)
      .lte('meeting_date', term.end_date)
    if (currentScoutYear?.id) meetingsQuery = meetingsQuery.eq('scout_year_id', currentScoutYear.id)
    if (mtypeFilter) meetingsQuery = meetingsQuery.eq('mtype', mtypeFilter)
    const { data: meetRows, error: meetErr } = await meetingsQuery
    if (meetErr) { setErr(meetErr.message); return }
    const total = (meetRows as any[] ?? []).length
    setTotalMeetings(total)

    let attQuery = supabase
      .from('attendance')
      .select('member_id, is_present, meetings!inner(id, team_id, meeting_date, mtype, scout_year_id)')
      .eq('meetings.team_id', teamId)
      .gte('meetings.meeting_date', term.start_date)
      .lte('meetings.meeting_date', term.end_date)
    if (currentScoutYear?.id) attQuery = attQuery.eq('meetings.scout_year_id', currentScoutYear.id)
    if (mtypeFilter) attQuery = attQuery.eq('meetings.mtype', mtypeFilter)
    const { data: attRows, error: attErr } = await attQuery
    if (attErr) { setErr(attErr.message); return }
    const rows = (attRows as any[] ?? [])

    const presentByMember = new Map<string, number>()
    for (const r of rows) {
      if (r.is_present) {
        const mid = r.member_id as string
        presentByMember.set(mid, (presentByMember.get(mid) || 0) + 1)
      }
    }
    const result: Record<string, Stat> = {}
    for (const m of members) {
      const p = presentByMember.get(m.id) || 0
      const a = Math.max(total - p, 0)
      result[m.id] = { present: p, absent: a, total }
    }
    setStats(result)
  }

  useEffect(() => { if (teamId) void loadLeaders(teamId) }, [teamId])
  async function loadLeaders(tid: string) {
    setErr(null); setMsg(null)
    const { data: ur, error: er1 } = await scoutYearFrom('v_user_roles_current', 'v_user_roles_context')
      .select('user_id, role_slug, team_id')
      .eq('role_slug', 'chef_de_legion')
      .or(`team_id.eq.${tid},team_id.is.null`)
    if (er1) { setErr(er1.message); return }

    const { data: ms, error: er2 } = await scoutYearFrom('v_members_current', 'v_members_context')
      .select('id, full_name, auth_user_id, rank_id')
      .eq('team_id', tid)
      .eq('is_active', true)
      .order('full_name')
    if (er2) { setErr(er2.message); return }

    const userIds = new Set(((ur as any[]) || []).map(u => u.user_id))
    const list = ((ms as any[]) || []).filter(m => m.auth_user_id && userIds.has(m.auth_user_id))

    setLeaders(list as any)

    const ids = (list as any[]).map(l => l.id as string)
    setSelectedIds(new Set(ids))
    const pres: Record<string, boolean> = {}
    for (const id of ids) pres[id] = true
    setPresence(pres)
  }

  const adminOverrideAllDefault = leaders.length === 0
  useEffect(() => {
    if (adminOverrideAllDefault) setAdminOverrideAll(true)
  }, [adminOverrideAllDefault])

  const writeList: Member[] = useMemo(() => {
    if (adminOverrideAll || leaders.length === 0) return members
    return leaders
  }, [adminOverrideAll, leaders, members])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function togglePresence(id: string) {
    setPresence(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function setAllPresence(val: boolean) {
    setPresence(prev => {
      const ids = writeList.map(m => m.id)
      const n: Record<string, boolean> = { ...prev }
      for (const id of ids) n[id] = val
      return n
    })
  }

  function selectAll(val: boolean) {
    if (val) setSelectedIds(new Set(writeList.map(l => l.id)))
    else setSelectedIds(new Set())
  }

  async function saveAttendance() {
    setErr(null)
    setMsg(null)
    if (!isAdmin) { setErr('هذه الصفحة مخصصة للأدمن'); return }
    if (!teamId || !date) { setErr('اختر الفريق والتاريخ'); return }
    if (selectedIds.size === 0) { setErr('اختر واحدًا على الأقل'); return }
    setSaving(true)
    try {
      const { data: mt, error: me } = await supabase
        .from('meetings')
        .upsert({ team_id: teamId, meeting_date: date, mtype: mtypeWrite }, { onConflict: 'team_id,meeting_date,mtype' })
        .select('id')
        .single()
      if (me) throw me
      const meeting_id = (mt as any).id as string

      const memberIds = Array.from(selectedIds)
      const { data: prevRows } = await supabase
        .from('attendance')
        .select('member_id, is_present')
        .eq('meeting_id', meeting_id)
        .in('member_id', memberIds)

      const beforeMap = new Map<string, boolean>()
      for (const row of (prevRows as any[] ?? [])) beforeMap.set(String(row.member_id), !!row.is_present)

      const payload = memberIds.map(id => ({ meeting_id, member_id: id, is_present: !!presence[id] }))
      const { error: ae } = await supabase.from('attendance').upsert(payload, { onConflict: 'meeting_id,member_id' })
      if (ae) throw ae

      const teamName = teams.find((team) => team.id === teamId)?.name || 'فريق غير محدد'
      const selectedMembers = writeList.filter((member) => selectedIds.has(member.id))
      const absentMembersAfter = selectedMembers.filter((member) => !presence[member.id]).map((member) => member.full_name)
      const absentMembersBefore = selectedMembers.filter((member) => !beforeMap.get(member.id)).map((member) => member.full_name)
      const presentCountAfter = selectedMembers.length - absentMembersAfter.length
      const presentCountBefore = selectedMembers.length - absentMembersBefore.length

      void safeWriteAuditLog({
        action: 'save_attendance',
        module: 'attendance',
        entityType: 'meeting',
        entityId: meeting_id,
        entityDisplay: `${teamName} — ${date}`,
        summary: buildAttendanceSummary({
          teamName,
          meetingDate: date,
          presentCount: presentCountAfter,
          absentCount: absentMembersAfter.length,
          subject: absentMembersAfter.length > 0 ? 'الحضور والغياب' : 'الحضور',
        }),
        severity: absentMembersAfter.length > 0 ? 'warning' : 'info',
        source: 'Attendance',
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
          meeting_date: date,
          meeting_type: mtypeWrite,
          team_name: teamName,
          selected_members: selectedMembers.map((member) => member.full_name),
          absent_members: absentMembersAfter,
        },
      })

      setMsg('تم حفظ الحضور/الغياب')
      toast.success('تم حفظ الحضور/الغياب')
      await loadStats()
    } catch (e: any) {
      setErr(e.message || 'تعذر الحفظ')
      toast.error(e.message || 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const rankLabel = (rid: number | null) => (rid && ranks[rid]) ? ranks[rid] : '—'
  const selectedCount = selectedIds.size
  const presentCount = writeList.filter(m => selectedIds.has(m.id) && presence[m.id]).length

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري تحميل البيانات..." />

      <PageHero
        eyebrow="📋 الحضور المركزي"
        title="الحضور والغياب — الإدارة"
        badge={
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            {currentScoutYear?.name || 'السنة غير محددة'}
          </span>
        }
        description="متابعة حضور أعضاء الفرق وتسجيل اليوم الجديد من مكان واحد، مع وضوح أكبر بين القراءة والتسجيل."
      />

      {err && <InlineAlert tone="error" title="تعذر تنفيذ العملية">{err}</InlineAlert>}
      {msg && <InlineAlert tone="success" title="تمت العملية بنجاح">{msg}</InlineAlert>}

      {!loading && !isAdmin && (
        <EmptyState
          title="هذه الصفحة مخصصة للأدمن فقط"
          description="يمكن لباقي المستخدمين متابعة شاشاتهم التشغيلية المعتادة، بينما تبقى هذه الشاشة مركزية للإدارة."
        />
      )}

      {!loading && isAdmin && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="أعضاء الفريق الظاهرون" value={members.length} accent="sky" />
            <MetricCard label="إجمالي الاجتماعات" value={totalMeetings} accent="indigo" />
            <MetricCard label="المحدَّدون للتسجيل" value={selectedCount} accent="amber" />
            <MetricCard label="الحاضرون المحددون" value={presentCount} accent={presentCount > 0 ? 'emerald' : 'rose'} />
          </div>

          <SectionCard title="قراءة الحضور والغياب" description="راجع ملخص الحضور والغياب لكل أعضاء الفريق خلال الترم أو النوع المحدد.">
            <div className="grid md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-sm">الفريق</label>
                <select className="border rounded-2xl p-2.5 w-full cursor-pointer" value={teamId} onChange={e=>setTeamId(e.target.value)}>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">الترم</label>
                <select className="border rounded-2xl p-2.5 w-full cursor-pointer" value={termId} onChange={e=>setTermId(e.target.value)}>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.year} — {t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">نوع اليوم</label>
                <select className="border rounded-2xl p-2.5 w-full cursor-pointer" value={mtypeFilter} onChange={e=>setMtypeFilter(e.target.value as any)}>
                  <option value="">الكل</option>
                  <option value="meeting">اجتماع</option>
                  <option value="preparation">تحضير</option>
                </select>
              </div>
            </div>

            <InlineAlert tone="info" title="معلومة سريعة">
              إجمالي الاجتماعات في الفترة المحددة: <b>{totalMeetings}</b> — الغياب = إجمالي الاجتماعات ناقص مرات الحضور.
            </InlineAlert>

            {members.length === 0 ? (
              <EmptyState title="لا يوجد أعضاء لعرضهم" description="اختر فريقًا آخر أو راجع تعيين الأعضاء داخل السنة الحالية." />
            ) : (
              <div className="border rounded-[24px] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-3 text-start">الاسم</th>
                      <th className="p-3">الرتبة</th>
                      <th className="p-3">حضور</th>
                      <th className="p-3">غياب</th>
                      <th className="p-3">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => {
                      const s = stats[m.id] || { present: 0, absent: totalMeetings, total: totalMeetings }
                      return (
                        <tr key={m.id} className="border-t">
                          <td className="p-3">{m.full_name}</td>
                          <td className="p-3 text-center">{rankLabel(m.rank_id)}</td>
                          <td className="p-3 text-center">{s.present}</td>
                          <td className="p-3 text-center">{s.absent}</td>
                          <td className="p-3 text-center">{s.total}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="تسجيل حضور اليوم" description="سجّل حضور أو غياب القادة أو الفريق كاملًا عند الحاجة، ثم احفظ العملية مرة واحدة.">
            <div className="grid md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="text-sm">الفريق</label>
                <select className="border rounded-2xl p-2.5 w-full cursor-pointer" value={teamId} onChange={e=>setTeamId(e.target.value)}>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">التاريخ</label>
                <input type="date" className="border rounded-2xl p-2.5 w-full cursor-pointer" value={date} onChange={e=>setDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">نوع اليوم</label>
                <select className="border rounded-2xl p-2.5 w-full cursor-pointer" value={mtypeWrite} onChange={e=>setMtypeWrite(e.target.value as MeetingType)}>
                  <option value="meeting">اجتماع</option>
                  <option value="preparation">تحضير</option>
                </select>
              </div>
              <div className="text-sm">
                <label className="text-sm">العمليات السريعة</label>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn border cursor-pointer" onClick={()=>selectAll(true)}>تحديد الكل</button>
                  <button className="btn border cursor-pointer" onClick={()=>selectAll(false)}>إلغاء تحديد الكل</button>
                  <button className="btn border cursor-pointer" onClick={()=>setAllPresence(true)}>الكل حاضر</button>
                  <button className="btn border cursor-pointer" onClick={()=>setAllPresence(false)}>الكل غائب</button>
                </div>
              </div>
              <div className="text-sm">
                <label className="text-sm">وضع الطوارئ</label>
                <div className="rounded-2xl border border-slate-200 px-3 py-2.5">
                  <input type="checkbox" className="cursor-pointer" checked={adminOverrideAll} onChange={e=>setAdminOverrideAll(e.target.checked)} /> <span className="text-sm">إظهار كل أعضاء الفريق</span>
                </div>
              </div>
            </div>

            {writeList.length === 0 ? (
              <EmptyState title="لا توجد أسماء متاحة للتسجيل" description="راجع الفريق أو أدوار Chef de legion أو فعّل وضع الطوارئ لعرض كل أعضاء الفريق." />
            ) : (
              <div className="border rounded-[24px] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-3 text-start">الاسم</th>
                      <th className="p-3">الرتبة</th>
                      <th className="p-3 text-center">اختيار</th>
                      <th className="p-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {writeList.map(l => (
                      <tr key={l.id} className="border-t">
                        <td className="p-3">{l.full_name}</td>
                        <td className="p-3 text-center">{rankLabel(l.rank_id)}</td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={selectedIds.has(l.id)}
                            onChange={()=>toggleSelect(l.id)}
                          />
                        </td>
                        <td className="p-3 text-center">
                          <button className={`btn ${presence[l.id] ? 'btn-brand' : 'border'} cursor-pointer`} onClick={()=>togglePresence(l.id)}>
                            {presence[l.id] ? 'حاضر' : 'غائب'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600">المحدَّدون: {selectedCount} — الحاضرون: {presentCount}</div>
              <LoadingButton loading={saving} onClick={saveAttendance}>حفظ الحضور والغياب</LoadingButton>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
