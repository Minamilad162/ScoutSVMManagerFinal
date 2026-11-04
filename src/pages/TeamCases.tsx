import { useEffect, useState } from 'react'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/PageLoader'
import { useToast } from '../components/ui/Toaster'
import { fetchCurrentUserContext, fetchTeamById, fetchTeams } from '../features/reference/api'
import { getErrorMessage, logError } from '../lib/errors'
import { LoadingButton } from '../components/ui/LoadingButton'
import { useAuth } from '../components/AuthProvider'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { MetricCard } from '../components/ui/MetricCard'
import { EmptyState } from '../components/ui/EmptyState'
import { useCurrentScoutYear } from '../hooks/useCurrentScoutYear'

// ===== Types =====
type Team = { id: string; name: string }
type Equipier = { id: string; full_name: string }

type MemberRel = { full_name: string | null }
type MemberRelMaybe = MemberRel | MemberRel[] | null | undefined

type CaseRow = {
  id: string
  team_id: string
  member_id: string
  case_type: 'medical' | 'attendance' | 'other' | string
  title: string
  details: string | null
  severity: 'low'|'medium'|'high'|string
  effective_from: string // YYYY-MM-DD
  effective_to: string | null
  status: 'open'|'archived'|string
  pinned: boolean
  created_at: string
  // Supabase nested select may return OBJECT or ARRAY depending on relation inference
  members?: MemberRelMaybe
}

function memberName(members: MemberRelMaybe): string {
  if (!members) return '—'
  if (Array.isArray(members)) return members[0]?.full_name ?? '—'
  return members.full_name ?? '—'
}

export default function TeamCases(){
  const toast = useToast()
  const { roles } = useAuth()
  const isAdmin = roles.some(r => r.role_slug === 'admin')
  const isGlobalSec = roles.some(
    r => r.role_slug === 'responsable_secretary' && (r.team_id === null || r.team_id === undefined)
  )

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState('')
  const [teamName, setTeamName] = useState('')

  const [members, setMembers] = useState<Equipier[]>([])

  // form fields
  const [memberId, setMemberId] = useState('')
  const [caseType, setCaseType] = useState<'medical'|'attendance'|'other'>('medical')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [severity, setSeverity] = useState<'low'|'medium'|'high'>('low')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [pinned, setPinned] = useState(false)

  // listing
  const [query, setQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'open'|'archived'|'all'>('open')
  const [filterType, setFilterType] = useState<'all'|'medical'|'attendance'|'other'>('all')

  const [rows, setRows] = useState<CaseRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const { currentScoutYear } = useCurrentScoutYear()

  useEffect(()=>{ init() }, [])
  async function init(){
    setLoading(true)
    try{
      if (isAdmin || isGlobalSec){
        const ts = await fetchTeams()
        setTeams(ts)
        if (ts.length){ setTeamId(ts[0].id); setTeamName(ts[0].name) }
      } else {
        const me = await fetchCurrentUserContext()
        if (!me?.team_id) throw new Error('لا يوجد فريق مرتبط بحسابك')
        setTeamId(me.team_id)
        const t = await fetchTeamById(me.team_id)
        setTeamName(t?.name || '—')
      }

      // default dates
      const now = new Date(); const pad=(n:number)=>String(n).padStart(2,'0')
      const d = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
      setFromDate(d)
    } catch(e:any){
      logError('TeamCases.init', e)
      toast.error(getErrorMessage(e, 'تعذر التحميل'))
    } finally { setLoading(false) }
  }

  // load members + cases when team changes
  useEffect(()=>{ if(teamId){ loadMembers(); refresh() } }, [teamId])

  async function loadMembers(){
    try{
      const { data, error } = await scoutYearFrom('v_members_current', 'v_members_context')
        .select('id, full_name')
        .eq('team_id', teamId)
        .eq('is_equipier', true)
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      setMembers((data as any) ?? [])
      if (data && data.length) setMemberId(data[0].id)
    }catch(e:any){ toast.error(e.message || 'تعذر تحميل الأعضاء') }
  }

  async function refresh(){
    setListLoading(true)
    try{
      // Base query — members may come as object or array
      let q = supabase
        .from('member_cases')
        .select('id, team_id, member_id, case_type, title, details, severity, effective_from, effective_to, status, pinned, created_at, members:member_id(full_name)')
        .eq('team_id', teamId)
        .lte('effective_from', currentScoutYear?.end_date ?? '2999-12-31')
        .order('pinned', { ascending: false })
        .order('status', { ascending: true })
        .order('created_at', { ascending: false })

      if (filterStatus !== 'all') q = q.eq('status', filterStatus)
      if (filterType !== 'all') q = q.eq('case_type', filterType)
      if (currentScoutYear?.start_date) q = q.or(`effective_to.is.null,effective_to.gte.${currentScoutYear.start_date}`)

      const { data, error } = await q
      if (error) throw error

      // 👇 حل تحذير TS2352: نزق لـ unknown ثم CaseRow[]
      const list = (data as unknown as CaseRow[]) ?? []
      const s = query.trim().toLowerCase()

      const filtered = s
        ? list.filter(r => {
            const name = memberName(r.members).toLowerCase()
            return (
              r.title.toLowerCase().includes(s) ||
              (r.details || '').toLowerCase().includes(s) ||
              name.includes(s)
            )
          })
        : list

      setRows(filtered)
    } catch(e:any){
      toast.error(e.message || 'تعذر تحميل الحالات')
    } finally { setListLoading(false) }
  }

  // اعمل refresh عند تغيير الفلاتر
  useEffect(()=>{ if(teamId) refresh() }, [filterStatus, filterType])
  useEffect(()=>{ if(teamId) refresh() }, [currentScoutYear?.id])
  // لو عايز بحث لحظي: ممكن تضيف useEffect على query مع debounce

  function clearForm(){
    setCaseType('medical'); setTitle(''); setDetails(''); setSeverity('low'); setPinned(false); setToDate('')
  }

  async function addCase(){
    if (!teamId) return toast.error('لم يتم تحديد الفريق')
    if (!memberId) return toast.error('اختر الطالب')
    if (!title.trim()) return toast.error('العنوان مطلوب')
    if (!fromDate) return toast.error('حدد تاريخ بداية')
    if (currentScoutYear?.start_date && fromDate < currentScoutYear.start_date) {
      return toast.error(`تاريخ الحالة يجب أن يكون داخل السنة الحالية (${currentScoutYear.name})`)
    }
    if (currentScoutYear?.end_date && fromDate > currentScoutYear.end_date) {
      return toast.error(`تاريخ الحالة يجب أن يكون داخل السنة الحالية (${currentScoutYear.name})`)
    }
    setSaving(true)
    try{
      const { error } = await supabase.from('member_cases').insert({
        team_id: teamId,
        member_id: memberId,
        case_type: caseType,
        title: title.trim(),
        details: details.trim() || null,
        severity,
        effective_from: fromDate,
        effective_to: toDate || null,
        status: 'open',
        pinned
      })
      if (error) throw error
      toast.success('تم إضافة الحالة')
      clearForm()
      await refresh()
    }catch(e:any){
      toast.error(e.message || 'تعذر إضافة الحالة')
    }finally{ setSaving(false) }
  }

  async function toggleArchive(row: CaseRow){
    try{
      const to = row.status === 'open' ? 'archived' : 'open'
      const { error } = await supabase.from('member_cases').update({ status: to }).eq('id', row.id)
      if (error) throw error
      await refresh()
    }catch(e:any){ toast.error(e.message || 'تعذر التحديث') }
  }

  async function togglePin(row: CaseRow){
    try{
      const to = !row.pinned
      const { error } = await supabase.from('member_cases').update({ pinned: to }).eq('id', row.id)
      if (error) throw error
      await refresh()
    }catch(e:any){ toast.error(e.message || 'تعذر التحديث') }
  }

  // حذف فعلي — Admin فقط. (UI حالياً يستخدم الأرشفة كـ "حذف")
  // لو عايز زرار حذف نهائي، فعّله تحت وتأكد من RLS للسماح للـadmin.
  /*
  async function removeCase(row: CaseRow){
    if (!isAdmin) {
      toast.error('لا تملك صلاحية الحذف — يمكنك أرشفة الحالة بدلًا من ذلك')
      return
    }
    if (!confirm('حذف هذه الحالة نهائيًا؟')) return
    try{
      const { data, error } = await supabase
        .from('member_cases')
        .delete()
        .eq('id', row.id)
        .select('id') // verify RLS deleted something
      if (error) throw error
      if (!data || data.length === 0) throw new Error('تعذر الحذف (RLS؟)')
      toast.success('تم الحذف')
      await refresh()
    }catch(e:any){ toast.error(e.message || 'تعذر الحذف') }
  }
  */

  const severityColor: Record<string,string> = {
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    high: 'bg-rose-50 text-rose-700 border-rose-200'
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        title="حالات وأعذار الفريق"
        eyebrow={teamName ? `الفريق: ${teamName}` : 'إدارة الحالات'}
        description={`تسجيل الحالات الطبية أو أعذار الغياب أو الملاحظات المهمة ومتابعتها داخل السنة الكشفية الحالية${currentScoutYear ? ` (${currentScoutYear.name})` : ''} مع إمكان التثبيت والأرشفة السريعة.`}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="إجمالي الحالات" value={rows.length} hint="طبقًا للفلاتر الحالية" accent="indigo" />
        <MetricCard label="الأعضاء المتاحون" value={members.length} hint="للإسناد في هذا الفريق" accent="emerald" />
        <MetricCard label="الحالة الحالية" value={filterStatus === 'all' ? 'الكل' : filterStatus === 'open' ? 'نشطة' : 'مؤرشفة'} hint="فلتر العرض" accent="amber" />
        <MetricCard label="نوع الحالة" value={filterType === 'all' ? 'الكل' : filterType} hint="فلتر النوع" accent="sky" />
      </div>

      {(isAdmin || isGlobalSec) ? (
        <SectionCard title="اختيار الفريق" description="يمكن للإدارة أو السكرتير العام التبديل بين الفرق قبل إضافة الحالات أو مراجعتها.">
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
        <SectionCard title="الفريق الحالي" description="أنت ترى بيانات فريقك الحالي فقط من هذه الشاشة.">
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border">
            فريقك: <b>{teamName}</b>
          </span>
        </SectionCard>
      )}

      {/* Add form */}
      <SectionCard title="إضافة حالة أو عذر" description="سجّل الحالة مع النوع ودرجة الأهمية والنطاق الزمني، ويمكنك تثبيتها أعلى القائمة لسهولة المتابعة.">
        <div className="grid md:grid-cols-6 gap-2 items-end">
          <div className="md:col-span-2">
            <label className="text-sm">الطالب</label>
            <select className="border rounded-xl p-2 w-full cursor-pointer" value={memberId} onChange={e=>setMemberId(e.target.value)}>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm">النوع</label>
            <select className="border rounded-xl p-2 w-full cursor-pointer" value={caseType} onChange={e=>setCaseType(e.target.value as any)}>
              <option value="medical">طبي</option>
              <option value="attendance">غياب/ظروف</option>
              <option value="other">أخرى</option>
            </select>
          </div>
          <div>
            <label className="text-sm">درجة الأهمية</label>
            <select className="border rounded-xl p-2 w-full cursor-pointer" value={severity} onChange={e=>setSeverity(e.target.value as any)}>
              <option value="low">منخفض</option>
              <option value="medium">متوسط</option>
              <option value="high">مرتفع</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm">العنوان</label>
            <input className="border rounded-xl p-2 w-full" value={title} onChange={e=>setTitle(e.target.value)} placeholder="مثال: مريض سكري — يحتاج متابعة" />
          </div>

          <div className="md:col-span-3">
            <label className="text-sm">الوصف/التفاصيل</label>
            <textarea className="border rounded-xl p-2 w-full" rows={2} value={details} onChange={e=>setDetails(e.target.value)} placeholder="تفاصيل مختصرة (أدوية، تعليمات، ظروف السفر...)"></textarea>
          </div>
          <div>
            <label className="text-sm">من تاريخ</label>
            <input type="date" className="border rounded-xl p-2 w-full" value={fromDate} onChange={e=>setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">إلى تاريخ (اختياري)</label>
            <input type="date" className="border rounded-xl p-2 w-full" value={toDate} onChange={e=>setToDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">تثبيت أعلى القائمة</label>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={pinned} onChange={e=>setPinned(e.target.checked)} />
              <span className="text-xs text-gray-600">إظهار هذه الحالة أولاً</span>
            </div>
          </div>
          <div className="md:col-span-6 text-end">
            <LoadingButton loading={saving} onClick={addCase}>إضافة الحالة</LoadingButton>
          </div>
        </div>
      </SectionCard>

      {/* Filters */}
      <SectionCard title="الفلاتر والبحث" description="فلترة الحالات حسب النوع والحالة، مع بحث سريع بالاسم أو العنوان أو التفاصيل.">
      <section className="flex flex-wrap items-end gap-2">
        <div className="grow md:grow-0">
          <label className="text-sm">بحث</label>
          <input
            className="border rounded-xl p-2 w-full md:w-[260px]"
            placeholder="ابحث بالاسم/العنوان/التفاصيل"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') refresh() }}
          />
        </div>
        <div>
          <label className="text-sm">الحالة</label>
          <select className="border rounded-xl p-2 w-full cursor-pointer" value={filterStatus} onChange={e=>setFilterStatus(e.target.value as any)}>
            <option value="open">نشطة</option>
            <option value="archived">محذوفة</option>
            <option value="all">الكل</option>
          </select>
        </div>
        <div>
          <label className="text-sm">النوع</label>
          <select className="border rounded-xl p-2 w-full cursor-pointer" value={filterType} onChange={e=>setFilterType(e.target.value as any)}>
            <option value="all">الكل</option>
            <option value="medical">طبي</option>
            <option value="attendance">غياب/ظروف</option>
            <option value="other">أخرى</option>
          </select>
        </div>
        <div className="md:ml-auto">
          <button className="btn border" onClick={refresh} disabled={listLoading}>{listLoading ? '…' : 'تحديث'}</button>
        </div>
      </section>
      </SectionCard>

      {/* Cards list */}
      <SectionCard title="قائمة الحالات" description="جميع الحالات المطابقة للفلاتر الحالية، مع إمكانية التثبيت أو الأرشفة السريعة.">
      <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {rows.map(r => (
          <article key={r.id} className={`border rounded-2xl p-3 ${r.pinned ? 'ring-1 ring-blue-200' : ''}`}>
            <div className="flex items-start gap-2">
              <div className={`px-2 py-1 rounded-full border text-xs ${severityColor[r.severity] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                {r.severity === 'high' ? 'مرتفع' : r.severity === 'medium' ? 'متوسط' : 'منخفض'}
              </div>
              <div className="px-2 py-1 rounded-full bg-gray-50 border text-xs">
                {r.case_type === 'medical' ? 'طبي' : r.case_type === 'attendance' ? 'غياب/ظروف' : 'أخرى'}
              </div>
              {r.status === 'archived' && (
                <div className="px-2 py-1 rounded-full bg-gray-100 border text-[11px]">مؤرشفة</div>
              )}
              {r.pinned && (
                <div className="px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-[11px]">مثبّت</div>
              )}
              <div className="ml-auto text-[11px] text-gray-500">
                {r.effective_from}{r.effective_to ? ` → ${r.effective_to}` : ''}
              </div>
            </div>

            <h3 className="mt-2 font-semibold text-base">{r.title}</h3>
            <div className="text-sm text-gray-700">{memberName(r.members)}</div>
            {r.details && (
              <p className="mt-2 text-sm whitespace-pre-wrap">{r.details}</p>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button className="btn border text-xs text-rose-700" onClick={()=>toggleArchive(r)}>
                {r.status === 'open' ? 'حذف' : 'استرجاع'}
              </button>
              <button className="btn border text-xs" onClick={()=>togglePin(r)}>
                {r.pinned ? 'إلغاء التثبيت' : 'تثبيت'}
              </button>
              {/* زرار حذف نهائي (Admin فقط) — فعّله لو محتاج
              {isAdmin && (
                <button className="btn border text-xs text-rose-700" onClick={()=>removeCase(r)}>حذف نهائي</button>
              )} */}
            </div>
          </article>
        ))}
        {rows.length === 0 && (
          <div className="col-span-full"><EmptyState title="لا توجد حالات مطابقة" description="جرّب تغيير الفلاتر أو إضافة حالة جديدة لهذا الفريق." /></div>
        )}
      </section>
      </SectionCard>
    </div>
  )
}
