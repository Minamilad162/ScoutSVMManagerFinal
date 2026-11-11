import { useEffect, useMemo, useRef, useState } from 'react'
import { SecretaryFormsWorkspace } from '../features/secretaryForms/SecretaryFormsWorkspace'
import { listSecretaryFormCounts } from '../features/secretaryForms/api'
import { canUploadSecretaryForms, visibleSecretaryTeams } from '../features/secretaryForms/permissions'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/PageLoader'
import { useToast } from '../components/ui/Toaster'
import { useAuth } from '../components/AuthProvider'
import { LoadingButton } from '../components/ui/LoadingButton'
import { fetchTerms } from '../features/reference/api'
import { useScoutYear } from '../components/ScoutYearProvider'
import { getTermYearBounds } from '../lib/scoutYearScope'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { MetricCard } from '../components/ui/MetricCard'
import { EmptyState } from '../components/ui/EmptyState'

type Team = { id: string; name: string }
type Term = { id: string; name: string; year: number; start_date: string|null; end_date: string|null }
type Member = {
  id: string
  auth_user_id: string | null
  full_name: string
  is_equipier: boolean
  personal_phone: string|null
  guardian_name: string|null
  guardian_phone: string|null
  birth_date: string|null
  rank_label?: string | null
}
type RoleRow = { user_id: string; role_slug: string; team_id: string | null }

type Counts = { present: number; total: number; absent_excused: number; absent_unexcused: number }

const SECRETARY_ROLE_LABELS: Record<string, string> = {
  admin: 'مدير النظام',
  chef_de_legion: 'قائد الفريق',
  responsable_secretary: 'مسؤول السكرتارية',
  responsable_finance: 'مسؤول المالية',
  responsable_media: 'مسؤول الإعلام',
  responsable_materials: 'مسؤول الأدوات',
}


export default function AdminSecretary() {
  const toast = useToast()
  const { currentScoutYear, actualCurrentScoutYear, isHistoricalView } = useScoutYear()
  const { roles, user } = useAuth()
  const isAdmin = roles.some(r => r.role_slug === 'admin')
  const isGlobalSec = roles.some(r => r.role_slug === 'responsable_secretary' && (r.team_id === null || r.team_id === undefined))
  const canSeeAllTeams = isAdmin || isGlobalSec

  const [loading, setLoading] = useState(true)
  const [secretaryTab, setSecretaryTab] = useState<'equipiers' | 'chefs' | 'attendance' | 'forms'>('equipiers')
  const [memberSearch, setMemberSearch] = useState('')
  const refreshRequest = useRef(0)
  const [formCounts, setFormCounts] = useState<Record<string, number>>({})
  const [formRefreshKey, setFormRefreshKey] = useState(0)
  const [countsError, setCountsError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [teams, setTeams] = useState<Team[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [teamId, setTeamId] = useState<string>('')
  const [termId, setTermId] = useState<string>('')
  const [rows, setRows] = useState<Member[]>([])
  const [rolesMap, setRolesMap] = useState<Record<string, RoleRow[]>>({})
  const [att, setAtt] = useState<Record<string, Counts>>({})

  const [edit, setEdit] = useState<Record<string, Partial<Member>>>({})

  useEffect(() => { refreshRequest.current += 1; setTerms([]); setTermId(''); setRows([]); setRolesMap({}); setAtt({}); setEdit({}); if (currentScoutYear?.id) void init() }, [currentScoutYear?.id])
  async function init() {
    setLoading(true)
    try {
      const [ts, tm] = await Promise.all([
        supabase.from('teams').select('id,name').order('name'),
        fetchTerms()
      ])
      if (ts.error) throw ts.error
      const visibleTeams = visibleSecretaryTeams((ts.data as Team[]) ?? [], roles)
      setTeams(visibleTeams)
      setTerms(tm)
      setTeamId(previous => visibleTeams.some(t => t.id === previous) ? previous : (visibleTeams[0]?.id || ''))
      if (tm.length) setTermId(tm[0].id)
    } catch (e:any) {
      toast.error(e.message || 'تعذر التحميل')
    } finally { setLoading(false) }
  }

  useEffect(() => { if (secretaryTab !== 'forms' && teamId && termId) void refresh() }, [secretaryTab, teamId, termId, currentScoutYear?.id])
  useEffect(() => {
    let active = true
    setFormCounts({})
    setCountsError('')
    if (!currentScoutYear?.id) return
    listSecretaryFormCounts(currentScoutYear.id)
      .then((counts) => { if (active) setFormCounts(counts) })
      .catch((err: any) => { if (active) setCountsError(err.message || 'تعذر جلب عدد الاستمارات.') })
    return () => { active = false }
  }, [currentScoutYear?.id, formRefreshKey])
  async function refresh() {
    const requestId = ++refreshRequest.current
    setLoading(true)
    try {
      const { data: ms, error: me } = await scoutYearFrom('v_members_current', 'v_members_context')
        .select('id, auth_user_id, full_name, is_equipier, personal_phone, guardian_name, guardian_phone, birth_date, rank_label')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .order('is_equipier', { ascending: true })
        .order('full_name', { ascending: true })
      if (me) throw me
      if (requestId !== refreshRequest.current) return
      const members = (ms as any[]) ?? []
      setRows(members)

      const userIds = members.map(m => m.auth_user_id).filter(Boolean) as string[]
      if (userIds.length) {
        const { data: ur, error: re } = await scoutYearFrom('v_user_roles_current', 'v_user_roles_context')
          .select('user_id, role_slug, team_id')
          .in('user_id', userIds)
        if (re) throw re
        const map: Record<string, RoleRow[]> = {}
        ;(ur as RoleRow[] ?? []).forEach(r => {
          members.forEach(m => {
            if (m.auth_user_id === r.user_id) {
              if (!map[m.id]) map[m.id] = []
              map[m.id].push(r)
            }
          })
        })
        if (requestId === refreshRequest.current) setRolesMap(map)
      } else {
        if (requestId === refreshRequest.current) setRolesMap({})
      }

      const term = terms.find(t => t.id === termId)
      const bounds = getTermYearBounds(currentScoutYear, term)
      const gte = bounds?.start
      const lte = bounds?.end
      if (gte && lte) {
        const { data: attRows, error: ae } = await supabase
          .from('attendance')
          .select(`member_id, is_present, absence_reason, meetings!inner(mtype, meeting_date, team_id, scout_year_id)`)
          .eq('meetings.team_id', teamId)
          .eq('meetings.scout_year_id', currentScoutYear!.id)
          .eq('meetings.mtype', 'meeting')
          .gte('meetings.meeting_date', gte)
          .lte('meetings.meeting_date', lte)
        if (ae) throw ae
        const map: Record<string, Counts> = {}
        ;(attRows as any[] ?? []).forEach(r => {
          const id = r.member_id as string
          if (!map[id]) map[id] = { present: 0, total: 0, absent_excused: 0, absent_unexcused: 0 }
          map[id].total += 1
          if (r.is_present) map[id].present += 1
          else {
            if (r.absence_reason && String(r.absence_reason).trim() !== '') map[id].absent_excused += 1
            else map[id].absent_unexcused += 1
          }
        })
        if (requestId === refreshRequest.current) setAtt(map)
      } else {
        if (requestId === refreshRequest.current) setAtt({})
      }
    } catch (e:any) {
      if (requestId === refreshRequest.current) toast.error(e.message || 'تعذر تحميل البيانات')
    } finally { if (requestId === refreshRequest.current) setLoading(false) }
  }

  const teamName = useMemo(() => teams.find(t => t.id === teamId)?.name || '', [teams, teamId])
  const canUploadSelectedTeam = canUploadSecretaryForms({
    teamId, scoutYearId: currentScoutYear?.id || '', currentPhysicalScoutYearId: actualCurrentScoutYear?.id || null,
    userId: user?.id || null, isHistoricalView, roles,
  })

  const chefs = useMemo(() => rows.filter(r => !r.is_equipier), [rows])
  const equipiers = useMemo(() => rows.filter(r => r.is_equipier), [rows])
  const visibleEquipiers = useMemo(() => equipiers.filter(m =>
    `${m.full_name} ${m.guardian_name || ''} ${m.guardian_phone || ''}`.toLocaleLowerCase().includes(memberSearch.trim().toLocaleLowerCase()),
  ), [equipiers, memberSearch])
  const visibleChefs = useMemo(() => chefs.filter(m =>
    `${m.full_name} ${m.rank_label || ''} ${m.personal_phone || ''}`.toLocaleLowerCase().includes(memberSearch.trim().toLocaleLowerCase()),
  ), [chefs, memberSearch])

  function selectTeam(nextTeamId: string) {
    if (nextTeamId === teamId) return
    refreshRequest.current += 1
    setRows([])
    setRolesMap({})
    setAtt({})
    setEdit({})
    setMemberSearch('')
    setTeamId(nextTeamId)
  }

  const roleChip = (m: Member) => {
    const rr = rolesMap[m.id] || []
    if (rr.length === 0) return <span className="px-2 py-1 rounded-full bg-gray-100 border text-xs">—</span>
    return (
      <div className="flex flex-wrap gap-1">
        {rr.map((x, i) => (
          <span key={i} className="px-2 py-1 rounded-full bg-white border text-xs">
            {SECRETARY_ROLE_LABELS[x.role_slug] || x.role_slug.replace(/_/g, ' ')} {x.team_id ? '' : '(عام)'}
          </span>
        ))}
      </div>
    )
  }

  async function saveEquipier(m: Member) {
    if (!canSeeAllTeams || isHistoricalView) return
    const e = edit[m.id] || {}
    setSavingId(m.id)
    try {
      const payload: any = {}
      if (typeof e.full_name !== 'undefined') payload.full_name = e.full_name
      if (typeof e.guardian_name !== 'undefined') payload.guardian_name = e.guardian_name
      if (typeof e.guardian_phone !== 'undefined') payload.guardian_phone = e.guardian_phone
      if (typeof e.birth_date !== 'undefined') payload.birth_date = e.birth_date || null
      if (Object.keys(payload).length === 0) { setSavingId(null); return }
      const { error } = await supabase.from('members').update(payload).eq('id', m.id).eq('is_equipier', true)
      if (error) throw error
      toast.success('تم الحفظ')
      setEdit(prev => { const p = { ...prev }; delete p[m.id]; return p })
      await refresh()
    } catch (e:any) {
      toast.error(e.message || 'تعذر الحفظ (تحقق من صلاحيات RLS)')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteEquipier(m: Member) {
    if (!canSeeAllTeams || isHistoricalView) return
    if (!confirm(`هل أنت متأكد من حذف ${m.full_name}؟`)) return
    setDeletingId(m.id)
    try {
      const { error } = await supabase.from('members').delete().eq('id', m.id).eq('is_equipier', true)
      if (error) throw error
      toast.success('تم الحذف')
      await refresh()
    } catch (e:any) {
      toast.error(e.message || 'تعذر الحذف (تحقق من صلاحيات RLS)')
    } finally {
      setDeletingId(null)
    }
  }


  const attendanceSummary = useMemo(() => {
    return equipiers.reduce(
      (acc, m) => {
        const row = att[m.id] || { present: 0, total: 0, absent_excused: 0, absent_unexcused: 0 }
        acc.present += row.present
        acc.total += row.total
        acc.excused += row.absent_excused
        acc.unexcused += row.absent_unexcused
        return acc
      },
      { present: 0, total: 0, excused: 0, unexcused: 0 }
    )
  }, [equipiers, att])

  const attendancePct = attendanceSummary.total > 0
    ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100)
    : 0

  return (
    <div className="secretary125-page secretary133-page space-y-5 p-4 md:p-6" dir="rtl">
      <PageLoader visible={loading && secretaryTab !== 'forms'} text="جاري تحميل بيانات السكرتارية..." />
      <PageHero
        className="secretary125-hero"
        eyebrow={`سكرتارية المجموعة · ${currentScoutYear?.name || 'السنة الكشفية'}`}
        title="إدارة السكرتارية"
        description="اختَر فريقًا من القائمة الجانبية، ثم تنقّل بين الأولاد والشيفات والحضور والاستمارات. كل البيانات تتبع الفريق والسنة الكشفية المختارين."
        badge={<span className="secretary125-hero-badge">{teamName || 'اختر فريقًا'}</span>}
      />

      <div className="secforms-admin-layout secretary133-layout">
        <aside className="secforms-team-sidebar" aria-label="الفرق الكشفية" dir="rtl">
          <div className="secforms-sidebar-head">
            <strong>الفرق الكشفية</strong>
            <small>اختر الفريق لعرض جميع بيانات السكرتارية الخاصة به</small>
          </div>
          <div className="secforms-team-buttons">
            {teams.map(team => (
              <button key={team.id} type="button"
                className={`secforms-team-button ${teamId === team.id ? 'is-active' : ''}`}
                aria-pressed={teamId === team.id}
                onClick={() => selectTeam(team.id)}>
                <span className="secforms-team-avatar" aria-hidden="true">⚜</span>
                <span className="secforms-team-text"><strong>{team.name}</strong><small>{formCounts[team.id] ?? 0} استمارة في السنة المختارة</small></span>
                <span aria-hidden="true">‹</span>
              </button>
            ))}
            {!loading && teams.length === 0 && <p className="secforms-sidebar-empty">لا توجد فرق متاحة لحسابك.</p>}
          </div>
          {countsError && <small className="secforms-count-error" role="status">{countsError}</small>}
        </aside>

        <main className="secretary133-main" aria-label="بيانات سكرتارية الفريق المختار">
          <div className="secretary133-workspace-head">
            <div>
              <span className="secretary133-kicker">الفريق المختار · {currentScoutYear?.name || '—'}</span>
              <h2>{teamName || 'اختر فريقًا من القائمة'}</h2>
              <p>تتغيّر البيانات في التابات تلقائيًا عند اختيار فريق أو سنة كشفية مختلفة.</p>
            </div>
            {isHistoricalView && <span className="secretary133-history-badge">أرشيف · عرض فقط</span>}
          </div>

          <div className="secforms-top-tabs secretary133-tabs" role="tablist" aria-label="أقسام إدارة السكرتارية">
            <button type="button" role="tab" aria-selected={secretaryTab === 'equipiers'}
              className={secretaryTab === 'equipiers' ? 'is-active' : ''}
              onClick={() => { setMemberSearch(''); setSecretaryTab('equipiers') }}>👦 الأولاد <span>{equipiers.length}</span></button>
            <button type="button" role="tab" aria-selected={secretaryTab === 'chefs'}
              className={secretaryTab === 'chefs' ? 'is-active' : ''}
              onClick={() => { setMemberSearch(''); setSecretaryTab('chefs') }}>⚜ الشيفات <span>{chefs.length}</span></button>
            <button type="button" role="tab" aria-selected={secretaryTab === 'attendance'}
              className={secretaryTab === 'attendance' ? 'is-active' : ''}
              onClick={() => setSecretaryTab('attendance')}>✓ الحضور</button>
            <button type="button" role="tab" aria-selected={secretaryTab === 'forms'}
              className={secretaryTab === 'forms' ? 'is-active' : ''}
              onClick={() => setSecretaryTab('forms')}>📄 الاستمارات <span>{formCounts[teamId] ?? 0}</span></button>
          </div>

          {secretaryTab === 'forms' && (
            <div role="tabpanel" aria-label="استمارات الفريق">
              <SecretaryFormsWorkspace teamId={teamId} teamName={teamName}
                scoutYearId={currentScoutYear?.id || ''} scoutYearLabel={currentScoutYear?.name || ''}
                userId={user?.id || null} canUpload={canUploadSelectedTeam} refreshKey={formRefreshKey}
                onUploaded={() => setFormRefreshKey(n => n + 1)} />
            </div>
          )}

          {secretaryTab !== 'forms' && <>
            <div className="secretary133-toolbar">
              {secretaryTab !== 'chefs' && <label className="secretary133-term-field">
                <span>الترم</span>
                <select value={termId} onChange={e => setTermId(e.target.value)}>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.name} — {t.year}</option>)}
                </select>
              </label>}
              {secretaryTab !== 'attendance' && <label className="secretary133-search-field">
                <span>بحث في {secretaryTab === 'chefs' ? 'الشيفات' : 'الأولاد'}</span>
                <input type="search" value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                  placeholder="بحث بالاسم أو البيانات..." />
              </label>}
              <div className="secretary133-toolbar-year"><small>السنة الكشفية</small><strong>{currentScoutYear?.name || '—'}</strong></div>
            </div>
          </>}

          {secretaryTab === 'equipiers' && <div role="tabpanel" aria-label="بيانات الأولاد" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard label="إجمالي الأولاد" value={equipiers.length} hint={teamName} accent="sky" />
              <MetricCard label="نسبة الحضور" value={`${attendancePct}%`} hint={`${attendanceSummary.present} حضور من ${attendanceSummary.total}`} accent="emerald" />
              <MetricCard label="غياب بعذر / بدون عذر" value={`${attendanceSummary.excused} / ${attendanceSummary.unexcused}`} hint="الترم المختار" accent="amber" />
            </div>
            <SectionCard className="secretary125-panel" title={`بيانات الأولاد — ${visibleEquipiers.length}`}
              description="الاسم وبيانات ولي الأمر وتاريخ الميلاد وموقف الحضور لكل ولد في الفريق المختار.">
              {visibleEquipiers.length === 0 ? (
                <EmptyState title="لا توجد بيانات أولاد" description="اختر فريقًا آخر أو غيّر البحث." />
              ) : <div className="secretary125-table-wrap">
                <table className="secretary125-table secretary125-equipier-table min-w-[1010px]">
                  <thead><tr><th>الاسم</th><th>ولي الأمر</th><th>هاتف ولي الأمر</th><th>تاريخ الميلاد</th><th>الحضور</th><th>غياب بعذر / بدون</th>{canSeeAllTeams && !isHistoricalView && <th>الإجراءات</th>}</tr></thead>
                  <tbody>{visibleEquipiers.map(m => {
                    const a = att[m.id] || { present: 0, total: 0, absent_excused: 0, absent_unexcused: 0 }
                    return <tr key={`${teamId}-${m.id}`}>
                      {canSeeAllTeams && !isHistoricalView ? <>
                        <td><input aria-label={`اسم ${m.full_name}`} defaultValue={m.full_name} onChange={ev => setEdit(p => ({ ...p, [m.id]: { ...p[m.id], full_name: ev.target.value } }))} /></td>
                        <td><input aria-label={`ولي أمر ${m.full_name}`} defaultValue={m.guardian_name || ''} onChange={ev => setEdit(p => ({ ...p, [m.id]: { ...p[m.id], guardian_name: ev.target.value } }))} /></td>
                        <td><input aria-label={`هاتف ولي أمر ${m.full_name}`} dir="ltr" defaultValue={m.guardian_phone || ''} onChange={ev => setEdit(p => ({ ...p, [m.id]: { ...p[m.id], guardian_phone: ev.target.value } }))} /></td>
                        <td><input aria-label={`ميلاد ${m.full_name}`} type="date" defaultValue={m.birth_date || ''} onChange={ev => setEdit(p => ({ ...p, [m.id]: { ...p[m.id], birth_date: ev.target.value } }))} /></td>
                      </> : <>
                        <td><div className="secretary125-person"><span>{m.full_name.slice(0, 1)}</span><strong>{m.full_name}</strong></div></td>
                        <td>{m.guardian_name || '—'}</td><td dir="ltr">{m.guardian_phone || '—'}</td><td>{m.birth_date || '—'}</td>
                      </>}
                      <td><span className="secretary125-pill is-green">{a.present} من {a.total}</span></td>
                      <td><span className="secretary125-pill is-amber">{a.absent_excused} / {a.absent_unexcused}</span></td>
                      {canSeeAllTeams && !isHistoricalView && <td><div className="secretary125-actions">
                        <LoadingButton loading={savingId === m.id} onClick={() => saveEquipier(m)}>حفظ</LoadingButton>
                        <button type="button" className="secretary125-delete" disabled={deletingId === m.id} onClick={() => deleteEquipier(m)}>{deletingId === m.id ? 'جارٍ الحذف' : 'حذف'}</button>
                      </div></td>}
                    </tr>
                  })}</tbody>
                </table>
              </div>}
            </SectionCard>
          </div>}

          {secretaryTab === 'chefs' && <div role="tabpanel" aria-label="بيانات الشيفات" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="إجمالي الشيفات" value={chefs.length} hint={teamName} accent="indigo" />
              <MetricCard label="الفريق" value={teamName || '—'} hint="بيانات القادة والمسؤوليات" accent="emerald" />
            </div>
            <SectionCard className="secretary125-panel" title={`بيانات الشيفات — ${visibleChefs.length}`}
              description="أسماء الشيفات والرتب والمسؤوليات وأرقام التواصل الخاصة بالفريق المختار.">
              {visibleChefs.length === 0 ? <EmptyState title="لا توجد شيفات" description="اختر فريقًا آخر أو غيّر البحث." /> :
                <div className="secretary125-table-wrap"><table className="secretary125-table min-w-[710px]">
                  <thead><tr><th>الاسم</th><th>الرتبة</th><th>المسؤوليات</th><th>رقم الهاتف</th><th>تاريخ الميلاد</th></tr></thead>
                  <tbody>{visibleChefs.map(m => <tr key={m.id}>
                    <td><div className="secretary125-person"><span>{m.full_name.slice(0, 1)}</span><strong>{m.full_name}</strong></div></td>
                    <td>{m.rank_label || '—'}</td><td>{roleChip(m)}</td>
                    <td dir="ltr">{m.personal_phone || '—'}</td><td>{m.birth_date || '—'}</td>
                  </tr>)}</tbody>
                </table></div>}
            </SectionCard>
          </div>}

          {secretaryTab === 'attendance' && <div role="tabpanel" aria-label="ملخص حضور الفريق" className="space-y-4">
            <div className="secretary125-kpis grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="نسبة الحضور" value={`${attendancePct}%`} hint={`${attendanceSummary.present} من ${attendanceSummary.total}`} accent="emerald" />
              <MetricCard label="حضور مسجل" value={attendanceSummary.present} hint="الترم المختار" accent="indigo" />
              <MetricCard label="غياب بعذر" value={attendanceSummary.excused} hint="الترم المختار" accent="amber" />
              <MetricCard label="غياب بدون عذر" value={attendanceSummary.unexcused} hint="الترم المختار" accent="rose" />
            </div>
            <div className="secretary133-attendance-grid">
              <SectionCard className="secretary125-panel" title="سجل حضور الأولاد" description="إحصائيات الاجتماع في الترم والسنة المختارين دون تعديل السجلات من هذه الصفحة.">
                {equipiers.length === 0 ? <EmptyState title="لا توجد بيانات حضور" description="اختر فريقًا به أولاد." /> :
                  <div className="secretary125-table-wrap"><table className="secretary125-table min-w-[620px]">
                    <thead><tr><th>الاسم</th><th>الحضور</th><th>غياب بعذر</th><th>غياب بدون عذر</th><th>نسبة الحضور</th></tr></thead>
                    <tbody>{equipiers.map(m => {
                      const a = att[m.id] || { present: 0, total: 0, absent_excused: 0, absent_unexcused: 0 }
                      return <tr key={m.id}><td><strong>{m.full_name}</strong></td><td>{a.present} / {a.total}</td>
                        <td>{a.absent_excused}</td><td>{a.absent_unexcused}</td>
                        <td><span className="secretary125-pill is-green">{a.total ? Math.round(a.present / a.total * 100) : 0}%</span></td></tr>
                    })}</tbody>
                  </table></div>}
              </SectionCard>
              <aside className="secretary125-summary-card">
                <div className="secretary125-summary-head"><span>◎</span><div><small>ملخص الترم</small><h2>{teamName || 'الفريق المختار'}</h2></div></div>
                <div className="secretary125-ring" style={{ '--pct': `${attendancePct * 3.6}deg` } as any}>
                  <div><strong>{attendancePct}%</strong><span>حضور</span></div>
                </div>
                <div className="secretary125-summary-list">
                  <div><span className="is-green" />حضور<strong>{attendanceSummary.present}</strong></div>
                  <div><span className="is-amber" />غياب بعذر<strong>{attendanceSummary.excused}</strong></div>
                  <div><span className="is-red" />غياب بدون عذر<strong>{attendanceSummary.unexcused}</strong></div>
                  <div><span className="is-blue" />إجمالي تسجيلات الحضور<strong>{attendanceSummary.total}</strong></div>
                </div>
              </aside>
            </div>
          </div>}
        </main>
      </div>
    </div>
  )
}
