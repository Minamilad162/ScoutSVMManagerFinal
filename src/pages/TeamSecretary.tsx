// src/pages/TeamSecretary.tsx
import { useEffect, useMemo, useState } from 'react'
import { SecretaryFormsWorkspace } from '../features/secretaryForms/SecretaryFormsWorkspace'
import { canUploadSecretaryForms } from '../features/secretaryForms/permissions'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/PageLoader'
import { useToast } from '../components/ui/Toaster'
import { LoadingButton } from '../components/ui/LoadingButton'
import { useAuth } from '../components/AuthProvider'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { fetchCurrentUserContext, fetchTeamById, fetchTeams, fetchTerms } from '../features/reference/api'
import { safeWriteAuditLog } from '../features/audit/api'
import { buildAttendanceSummary } from '../features/audit/humanize'
import { getErrorMessage, logError } from '../lib/errors'
import { useScoutYear } from '../components/ScoutYearProvider'
import { clampDateToBounds, getScoutYearBounds, getTermYearBounds, inDateBounds } from '../lib/scoutYearScope'

type Team = { id: string; name: string }
type Term = { id: string; name: string; year: number; start_date: string|null; end_date: string|null }
type Equipier = { id: string; full_name: string; guardian_name: string|null; guardian_phone: string|null; birth_date: string|null; avatar_url?: string|null }
type Counts = { present: number; total: number; absent_excused: number; absent_unexcused: number }
type DayStatus = 'present'|'abs_excused'|'abs_unexcused'

export default function TeamSecretary() {
  const toast = useToast()
  const { currentScoutYear, actualCurrentScoutYear, isHistoricalView } = useScoutYear()
  const { roles, user } = useAuth()
  const isAdmin = roles.some(r => r.role_slug === 'admin')
  const isGlobalSec = roles.some(r => r.role_slug === 'responsable_secretary' && (r.team_id === null || r.team_id === undefined))

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'equipiers'|'attendance'|'forms'>('equipiers')

  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState<string>('')
  const [teamName, setTeamName] = useState<string>('')

  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState<string>('')

  const [list, setList] = useState<Equipier[]>([])
  const [counts, setCounts] = useState<Record<string, Counts>>({})

  // add/edit
  const [newName, setNewName] = useState<string>('')
  const [newGuardian, setNewGuardian] = useState<string>('')
  const [newPhone, setNewPhone] = useState<string>('')
  const [newDOB, setNewDOB] = useState<string>('')
  const [newAvatar, setNewAvatar] = useState<File | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Equipier>>({})

  // attendance tab
  const [meetingDate, setMeetingDate] = useState<string>('')

  // كانت موجودة قبل كده — حافظنا عليها ونزامنها مع الحالة الجديدة
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})

  // حالة اليوم الموحّدة (UI ثابت)
  const [status, setStatus] = useState<Record<string, DayStatus>>({})

  // ترتيب/تصفية/نطاق الإحصاء
  const [sortBy, setSortBy] = useState<'ratio_desc'|'ratio_asc'|'name'>('ratio_desc')
  const [filterBy, setFilterBy] = useState<'all'|'present'|'abs_excused'|'abs_unexcused'>('all')
  const [statsScope, setStatsScope] = useState<'term'|'year'>('term')

  const AVATARS_BUCKET = 'avatars';

  async function uploadAvatarOrWarn(file: File, teamId: string, memberId: string, toast?: any) {
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${teamId}/${memberId}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase
        .storage.from(AVATARS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type })

      if (upErr) {
        if (/bucket not found/i.test(upErr.message)) {
          toast?.error?.('Bucket باسم "avatars" غير موجود — أنشئه ثم أعد المحاولة.')
          return null
        }
        throw upErr
      }
      const { data: pub } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
      return pub.publicUrl as string
    } catch (e:any) {
      toast?.error?.(e.message || 'تعذر رفع الصورة')
      return null
    }
  }

  useEffect(() => { if (currentScoutYear?.id) void init(); else { setTerms([]); setList([]); setCounts({}) } }, [currentScoutYear?.id])
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
        const ownTeamId = me?.team_id || roles.find(r => r.team_id && ['responsable_secretary', 'chef_de_legion'].includes(r.role_slug))?.team_id
        if (!ownTeamId) throw new Error('لا يوجد فريق مرتبط بحسابك')
        setTeamId(ownTeamId)
        const t = await fetchTeamById(ownTeamId)
        setTeamName(t?.name || '—')
      }

      const now = new Date(); const pad=(n:number)=>String(n).padStart(2,'0')
      const d = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
      setMeetingDate(clampDateToBounds(d, getScoutYearBounds(currentScoutYear)))
    } catch (e:any) {
      logError('TeamSecretary.init', e)
      toast.error(getErrorMessage(e, 'تعذر التحميل'))
    } finally { setLoading(false) }
  }

  useEffect(() => { if (teamId) refreshList() }, [teamId])

  // تحميل الإحصائيات حسب النطاق المختار
  useEffect(() => {
    if (!teamId || !termId) { setCounts({}); return }
    if (statsScope === 'term') refreshCountsTerm()
    else refreshCountsYear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, termId, statsScope])

  async function refreshList() {
    try {
      const { data, error } = await scoutYearFrom('v_members_current', 'v_members_context')
        .select('id, full_name, guardian_name, guardian_phone, birth_date, avatar_url')
        .eq('team_id', teamId).eq('is_equipier', true).eq('is_active', true).order('full_name')
      if (error) throw error
      const arr = (data as any[]) ?? []
      setList(arr)

      const c: Record<string, boolean> = {}; const r: Record<string, string> = {}
      const st: Record<string, DayStatus> = {}
      arr.forEach(m => { c[m.id] = false; r[m.id] = ''; st[m.id] = 'abs_unexcused' })
      setChecks(c); setReasons(r); setStatus(st)

      if (meetingDate) await loadMeetingAttendanceForDate(meetingDate, arr.map(x=>x.id))
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل الأفراد')
    }
  }

  // ==== الترم (كما كان سابقًا) ====
  async function refreshCountsTerm() {
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
    } catch {
      setCounts({})
    }
  }

  // ==== كل السنة (حساب فعلي client-side) ====
  async function refreshCountsYear() {
    try {
      if (!teamId || !termId) { setCounts({}); return }
      // Do not use a Jan-Dec fallback for school/scout years crossing calendar years.
      const bounds = getScoutYearBounds(currentScoutYear)
      if (!bounds) { setCounts({}); return }
      const { start, end } = bounds

      let meetingsQuery = supabase
        .from('meetings')
        .select('id')
        .eq('team_id', teamId)
        .eq('mtype', 'meeting')
        .gte('meeting_date', start)
        .lte('meeting_date', end)
      if (currentScoutYear?.id) meetingsQuery = meetingsQuery.eq('scout_year_id', currentScoutYear.id)

      const { data: meetings, error: mErr } = await meetingsQuery
      if (mErr) throw mErr
      const ids = (meetings ?? []).map(m => m.id)
      if (!ids.length) { setCounts({}); return }

      const { data: atts, error: aErr } = await supabase
        .from('attendance')
        .select('member_id, is_present, absence_reason, meeting_id')
        .in('meeting_id', ids)
      if (aErr) throw aErr

      const map: Record<string, Counts> = {}
      ;(atts as any[] ?? []).forEach(a => {
        const mid = a.member_id as string
        if (!map[mid]) map[mid] = { present:0, total:0, absent_excused:0, absent_unexcused:0 }
        map[mid].total += 1
        if (a.is_present) map[mid].present += 1
        else if (a.absence_reason) map[mid].absent_excused += 1
        else map[mid].absent_unexcused += 1
      })
      setCounts(map)
    } catch {
      setCounts({})
    }
  }

  // تحميل حالة يوم الاجتماع المحدد
  async function loadMeetingAttendanceForDate(dateISO: string, memberIds?: string[]) {
    try {
      let meetingLookup = supabase
        .from('meetings').select('id')
        .eq('team_id', teamId).eq('meeting_date', dateISO).eq('mtype', 'meeting')
      if (currentScoutYear?.id) meetingLookup = meetingLookup.eq('scout_year_id', currentScoutYear.id)
      const { data: mrow } = await meetingLookup.maybeSingle()
      const ids = memberIds ?? list.map(x=>x.id)

      if (!mrow?.id) {
        const c: Record<string, boolean> = {}; const r: Record<string, string> = {}; const st: Record<string, DayStatus> = {}
        ids.forEach(id => { c[id] = false; r[id] = ''; st[id] = 'abs_unexcused' })
        setChecks(c); setReasons(r); setStatus(st)
        return
      }

      const { data: attRows } = await supabase
        .from('attendance')
        .select('member_id, is_present, absence_reason')
        .eq('meeting_id', mrow.id)

      const c: Record<string, boolean> = {}; const r: Record<string, string> = {}; const st: Record<string, DayStatus> = {}
      ids.forEach(id => { c[id] = false; r[id] = ''; st[id] = 'abs_unexcused' })
      ;(attRows as any[] ?? []).forEach(a => {
        const pres = !!a.is_present
        c[a.member_id] = pres
        r[a.member_id] = pres ? '' : (a.absence_reason || '')
        st[a.member_id] = pres ? 'present' : (a.absence_reason ? 'abs_excused' : 'abs_unexcused')
      })
      setChecks(c); setReasons(r); setStatus(st)
    } catch {/* silent */}
  }

  // مزامنة الحالة مع الحقول القديمة (بدون تغيير لوجيك التخزين)
  function setStatusFor(memberId: string, v: DayStatus) {
    setStatus(p => ({ ...p, [memberId]: v }))
    if (v === 'present') {
      setChecks(p=>({ ...p, [memberId]: true }))
      setReasons(r=>({ ...r, [memberId]: '' }))
    } else if (v === 'abs_unexcused') {
      setChecks(p=>({ ...p, [memberId]: false }))
      setReasons(r=>({ ...r, [memberId]: '' }))
    } else { // abs_excused
      setChecks(p=>({ ...p, [memberId]: false }))
      // نسيب العذر كما هو (لو فاضي المستخدم يكتبه)
    }
  }

  async function addEquipier() {
    if (!newName.trim()) return toast.error('ادخل الاسم')
    try {
      const { data: row, error } = await supabase.from('members').insert({
        full_name: newName.trim(),
        team_id: teamId,
        is_equipier: true,
        guardian_name: newGuardian || null,
        guardian_phone: newPhone || null,
        birth_date: newDOB || null
      }).select('id').single()
      if (error) throw error
      const newId = row?.id as string

      if (newAvatar && newId) {
        const url = await uploadAvatarOrWarn(newAvatar, teamId, newId, toast)
        if (url) await supabase.from('members').update({ avatar_url: url }).eq('id', newId)
      }

      toast.success('تم إضافة الإكويبيير')
      setNewName(''); setNewGuardian(''); setNewPhone(''); setNewDOB(''); setNewAvatar(null)
      await refreshList()
      if (statsScope === 'term') await refreshCountsTerm(); else await refreshCountsYear()
    } catch (e:any) {
      toast.error(e.message || 'تعذر الإضافة')
    }
  }

  function startEdit(m: Equipier) { setEditingId(m.id); setEditDraft({ ...m }) }
  function cancelEdit() { setEditingId(null); setEditDraft({}) }
  async function saveEdit() {
    if (!editingId) return
    const payload: any = {
      full_name: (editDraft.full_name || '').trim(),
      guardian_name: editDraft.guardian_name || null,
      guardian_phone: editDraft.guardian_phone || null,
      birth_date: editDraft.birth_date || null
    }
    if (!payload.full_name) return toast.error('الاسم مطلوب')
    try {
      const { error } = await supabase.from('members').update(payload).eq('id', editingId).eq('is_equipier', true)
      if (error) throw error
      toast.success('تم حفظ التعديلات')
      cancelEdit()
      await refreshList()
      if (statsScope === 'term') await refreshCountsTerm(); else await refreshCountsYear()
    } catch (e:any) { toast.error(e.message || 'تعذر الحفظ') }
  }
  async function deleteEquipier(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا الإكويبيير؟')) return
    try {
      const { error } = await supabase.from('members').delete().eq('id', id).eq('is_equipier', true)
      if (error) throw error
      toast.success('تم الحذف')
      await refreshList()
      if (statsScope === 'term') await refreshCountsTerm(); else await refreshCountsYear()
    } catch (e:any) { toast.error(e.message || 'تعذر الحذف') }
  }

  async function saveAttendance() {
    setSaving(true)
    try {
      if (!meetingDate) throw new Error('اختر تاريخ الاجتماع')
      const term = terms.find(t => t.id === termId)
      if (!term || !inDateBounds(meetingDate, getTermYearBounds(currentScoutYear, term))) throw new Error('تاريخ الاجتماع خارج حدود الترم والسنة الكشفية')
      const meetingPayload: any = { team_id: teamId, meeting_date: meetingDate, mtype: 'meeting' }
      if (currentScoutYear?.id) meetingPayload.scout_year_id = currentScoutYear.id
      if (termId) meetingPayload.term_id = termId
      const { data: mrow, error: me } = await supabase
        .from('meetings')
        .upsert(meetingPayload, { onConflict: 'team_id,meeting_date,mtype' })
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

      // نستخدم checks/reasons كما كانت (بدون تغيير لوجيك التخزين)
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
        source: 'TeamSecretary',
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
          term_name: terms.find((term) => term.id === termId)?.name || null,
          absent_members: absentMembersAfter,
        },
      })

      toast.success('تم حفظ الحضور')
      if (statsScope === 'term') await refreshCountsTerm(); else await refreshCountsYear()
      await loadMeetingAttendanceForDate(meetingDate)
    } catch (e:any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally { setSaving(false) }
  }

  // ===== Helpers للعرض =====
  const ratioFor = (id: string) => {
    const c = counts[id] || { present: 0, total: 0 }
    return c.total ? c.present / c.total : 0
  }

  const displayList = useMemo(() => {
    let arr = [...list]
    // تصفية حسب حالة اليوم
    if (filterBy !== 'all') {
      arr = arr.filter(m => (status[m.id] || 'abs_unexcused') === filterBy)
    }
    // ترتيب
    if (sortBy === 'ratio_desc') arr.sort((a,b) => ratioFor(b.id) - ratioFor(a.id))
    else if (sortBy === 'ratio_asc') arr.sort((a,b) => ratioFor(a.id) - ratioFor(b.id))
    else arr.sort((a,b) => a.full_name.localeCompare(b.full_name, 'ar'))
    return arr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, counts, sortBy, filterBy, status])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        eyebrow="السيكرتارية"
        title={tab === 'forms' ? 'سكرتارية الفريق · الاستمارات' : tab === 'attendance' ? 'سكرتارية الفريق · الحضور' : 'إدارة أفراد الفريق والمتابعة اليومية'}
        description={tab === 'forms' ? 'ملفات PDF الخاصة بفريقك، منظمة حسب السنة الكشفية مع إمكانيات عرضها ورفع استمارات جديدة.' : 'راجع قائمة الأفراد، أضف أفرادًا جددًا، وسجّل حضور الاجتماعات مع رؤية أوضح للفريق الحالي.'}
      />

      {tab !== 'forms' && <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="إجمالي الأفراد" value={list.length} accent="indigo" />
        <MetricCard label="الترمات المتاحة" value={terms.length} accent="sky" />
        <MetricCard label="الفريق الحالي" value={teamName || '—'} accent="emerald" />
      </div>}

      <SectionCard title="نطاق العمل" description="اختر الفريق المطلوب أو راجع بيانات فريقك الحالي، ثم استخدم التبويب المناسب بالأسفل.">

      {(isAdmin || isGlobalSec) ? (
        <div className="mb-3">
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
        </div>
      ) : (
        <div className="mb-3 text-sm">
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border">
            فريقك: <b>{teamName}</b>
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="أقسام سكرتارية الفريق">
        <button className={`tab ${tab==='equipiers'?'tab-active':''}` } onClick={()=>setTab('equipiers')}>الأولاد (إدارة)</button>
        <button className={`tab ${tab==='forms'?'tab-active':''}` } onClick={()=>setTab('forms')}>📄 الاستمارات</button>
        <button type="button" className={`tab ${tab==='attendance'?'tab-active':''}`} onClick={()=>setTab('attendance')}>حضور الاجتماعات</button>
      </div>

      </SectionCard>

      {tab === 'forms' && (
        <SecretaryFormsWorkspace teamId={teamId} teamName={teamName}
          scoutYearId={currentScoutYear?.id || ''} scoutYearLabel={currentScoutYear?.name || ''}
          userId={user?.id || null}
          canUpload={canUploadSecretaryForms({
            teamId, scoutYearId: currentScoutYear?.id || '', currentPhysicalScoutYearId: actualCurrentScoutYear?.id || null,
            userId: user?.id || null, isHistoricalView, roles,
          })} />
      )}

      {/* ===== تبويب الحضور ===== */}
      {tab==='attendance' && (
        <section className="space-y-4">
          <div className="card">
            <div className="grid gap-2 md:grid-cols-3 items-end">
              <div>
                <label className="text-sm">الترم</label>
                <select className="border rounded-xl p-2 w-full min-w-0 cursor-pointer" value={termId} onChange={e=>setTermId(e.target.value)}>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.year} — {t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">تاريخ الاجتماع</label>
                <input
                  type="date"
                  className="border rounded-xl p-2 w-full min-w-0"
                  value={meetingDate}
                  min={getTermYearBounds(currentScoutYear, terms.find(t => t.id === termId))?.start}
                  max={getTermYearBounds(currentScoutYear, terms.find(t => t.id === termId))?.end}
                  onChange={async e=>{
                    const v = e.target.value
                    setMeetingDate(v)
                    await loadMeetingAttendanceForDate(v)
                  }}
                />
              </div>
              <div className="text-end">
                <LoadingButton loading={saving} onClick={saveAttendance}>حفظ الحضور</LoadingButton>
              </div>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div>
                <label className="text-sm">ترتيب حسب</label>
                <select className="border rounded-xl p-2 w-full min-w-0 cursor-pointer" value={sortBy} onChange={e=>setSortBy(e.target.value as any)}>
                  <option value="ratio_desc">الأكثر حضورًا ← الأقل</option>
                  <option value="ratio_asc">الأقل حضورًا ← الأكثر</option>
                  <option value="name">الاسم (أ-ي)</option>
                </select>
              </div>
              <div>
                <label className="text-sm">تصفية</label>
                <select className="border rounded-xl p-2 w-full min-w-0 cursor-pointer" value={filterBy} onChange={e=>setFilterBy(e.target.value as any)}>
                  <option value="all">الكل</option>
                  <option value="present">حضر اليوم</option>
                  <option value="abs_excused">غياب بعذر</option>
                  <option value="abs_unexcused">غياب بدون عذر</option>
                </select>
              </div>
              <div>
                <label className="text-sm">نطاق الإحصاء</label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1 text-sm">
                    <input type="radio" name="scope" checked={statsScope==='term'} onChange={()=>setStatsScope('term')} />
                    الترم الحالي
                  </label>
                  <label className="inline-flex items-center gap-1 text-sm">
                    <input type="radio" name="scope" checked={statsScope==='year'} onChange={()=>setStatsScope('year')} />
                    كل السنة
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="border rounded-2xl w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-[950px] text-xs sm:text-sm">
              <thead className="bg-gray-100 thead-sticky">
                <tr>
                  <th className="p-2 text-start w-[30%]">الاسم</th>
                  <th className="p-2 text-center w-[180px] whitespace-nowrap">حالة اليوم</th>
                  <th className="p-2 text-start">العذر (إذا كان بعذر)</th>
                  <th className="p-2 text-center whitespace-nowrap">حضوره ({statsScope==='term' ? 'الترم' : 'السنة'})</th>
                </tr>
              </thead>
              <tbody>
                {displayList.map(m => {
                  const c = counts[m.id] || { present: 0, total: 0, absent_excused: 0, absent_unexcused: 0 }
                  const st = status[m.id] || 'abs_unexcused'
                  const ratio = c.total ? Math.round((c.present/c.total)*100) : 0

                  return (
                    <tr key={m.id} className="border-t align-top">
                      <td className="p-2">{m.full_name}</td>

                      <td className="p-2 text-center">
                        <select
                          className={`border rounded-xl p-2 w-full md:w-[170px] status-select cursor-pointer ${
                            st==='present' ? 'bg-green-50' : st==='abs_excused' ? 'bg-amber-50' : 'bg-rose-50'
                          }`}
                          value={st}
                          onChange={e=>setStatusFor(m.id, e.target.value as DayStatus)}
                        >
                          <option value="present">حضر</option>
                          <option value="abs_unexcused">غياب بدون عذر</option>
                          <option value="abs_excused">غياب بعذر</option>
                        </select>
                      </td>

                      <td className="p-2">
                        {st === 'abs_excused' ? (
                          <input
                            className="border rounded-xl p-2 w-full min-w-0 reason-input"
                            placeholder="اكتب العذر (اختياري)"
                            value={reasons[m.id] || ''}
                            onChange={e=>setReasons(r=>({...r, [m.id]: e.target.value}))}
                          />
                        ) : <span className="text-xs text-gray-500">—</span>}
                      </td>

                      <td className="p-2 text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          <span className="px-2 py-1 rounded-full bg-white border text-[11px] sm:text-xs whitespace-nowrap">
                            {c.present} من {c.total} — {ratio}%
                          </span>
                          <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#0ea5e9]" style={{ width: `${ratio}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {displayList.length === 0 && <tr><td className="p-3 text-center text-gray-500" colSpan={4}>لا توجد بيانات</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===== تبويب إدارة الأولاد (بدون تغيير لوجيك) ===== */}
      {tab==='equipiers' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">إضافة ولد جديد</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <div>
              <label className="text-sm">الاسم</label>
              <input className="border rounded-xl p-2 w-full min-w-0" value={newName} onChange={e=>setNewName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">اسم ولي الأمر</label>
              <input className="border rounded-xl p-2 w-full min-w-0" value={newGuardian} onChange={e=>setNewGuardian(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">هاتف ولي الأمر</label>
              <input className="border rounded-xl p-2 w-full min-w-0" value={newPhone} onChange={e=>setNewPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">تاريخ الميلاد</label>
              <input type="date" className="border rounded-xl p-2 w-full min-w-0" value={newDOB} onChange={e=>setNewDOB(e.target.value)} />
            </div>

              {/* <div className="sm:col-span-2 md:col-span-2">
                <label className="text-sm">صورة شخصية (اختياري)</label>
                <input type="file" className="block w-full text-sm" accept="image/*" onChange={e=>setNewAvatar(e.target.files?.[0] ?? null)} />
                {newAvatar && <div className="text-xs text-gray-500 mt-1">الحجم: {(newAvatar.size/1024/1024).toFixed(2)} MB</div>}
              </div> */}

            <div className="sm:col-span-2 md:col-span-5 text-end">
              <LoadingButton loading={false} onClick={addEquipier}>إضافة</LoadingButton>
            </div>
          </div>

          <h2 className="text-lg font-semibold">قائمة الأولاد</h2>
          <div className="border rounded-2xl w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs sm:text-sm">
              <thead className="bg-gray-100 thead-sticky">
                <tr>
                  <th className="p-2 text-start">الاسم</th>
                  <th className="p-2 text-start">ولي الأمر</th>
                  <th className="p-2 text-start whitespace-nowrap">الهاتف</th>
                  <th className="p-2 text-start whitespace-nowrap">تاريخ الميلاد</th>
                  <th className="p-2 text-center whitespace-nowrap">النسبة (الترم/السنة)</th>
                  <th className="p-2 text-center whitespace-nowrap">غياب بعذر/بدون</th>
                  <th className="p-2 text-center whitespace-nowrap">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {list.map(m => {
                  const c = counts[m.id] || { present: 0, total: 0, absent_excused: 0, absent_unexcused: 0 }
                  const isEditing = editingId === m.id
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="p-2">{isEditing ? (
                        <input className="border rounded-xl p-1 w-full min-w-0" defaultValue={m.full_name} onChange={ev=>setEditDraft(d=>({...d, full_name: ev.target.value}))} />
                      ) : m.full_name}</td>
                      <td className="p-2">{isEditing ? (
                        <input className="border rounded-xl p-1 w-full min-w-0" defaultValue={m.guardian_name || ''} onChange={ev=>setEditDraft(d=>({...d, guardian_name: ev.target.value}))} />
                      ) : (m.guardian_name || '—')}</td>
                      <td className="p-2 whitespace-nowrap">{isEditing ? (
                        <input className="border rounded-xl p-1 w-full min-w-0" defaultValue={m.guardian_phone || ''} onChange={ev=>setEditDraft(d=>({...d, guardian_phone: ev.target.value}))} />
                      ) : (m.guardian_phone || '—')}</td>
                      <td className="p-2 whitespace-nowrap">{isEditing ? (
                        <input type="date" className="border rounded-xl p-1 w-full min-w-0" defaultValue={m.birth_date || ''} onChange={ev=>setEditDraft(d=>({...d, birth_date: ev.target.value}))} />
                      ) : (m.birth_date || '—')}</td>
                      <td className="p-2 text-center">
                        <span className="px-2 py-1 rounded-full bg-white border text-[11px] sm:text-xs whitespace-nowrap">
                          {c.present} من {c.total} — {c.total ? Math.round((c.present/c.total)*100) : 0}%
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <span className="px-2 py-1 rounded-full bg-white border text-[11px] sm:text-xs whitespace-nowrap">
                          بعذر {c.absent_excused} / بدون {c.absent_unexcused}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        {!isEditing ? (
                          <button className="btn border text-xs sm:text-sm" onClick={()=>startEdit(m)}>تعديل</button>
                        ) : (
                          <div className="flex gap-2 justify-center">
                            <button className="btn border text-xs sm:text-sm" onClick={saveEdit}>حفظ</button>
                            <button className="btn border text-xs sm:text-sm" onClick={cancelEdit}>إلغاء</button>
                          </div>
                        )}
                        <button className="btn border ml-2 text-xs sm:text-sm" onClick={()=>deleteEquipier(m.id)}>حذف</button>
                      </td>
                    </tr>
                  )
                })}
                {list.length === 0 && <tr><td className="p-3 text-center text-gray-500" colSpan={7}>لا توجد بيانات</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
