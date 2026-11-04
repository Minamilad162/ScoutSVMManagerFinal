import { useEffect, useMemo, useRef, useState } from 'react'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/PageLoader'
import { LoadingButton } from '../components/ui/LoadingButton'
import { useToast } from '../components/ui/Toaster'
import { fetchCurrentUserRoles, fetchTerms } from '../features/reference/api'
import { useScoutYear } from '../components/ScoutYearProvider'
import { getScoutYearDateRange, getScoutYearNumericValue } from '../lib/scoutYear'

// ===== Types =====
type Team = { id: string; name: string }
type Rank = { id: number; rank_label: string | null; rank_slug?: string | null }
type Member = { id: string; full_name: string; is_equipier: boolean; team_id: string; rank_id: number | null }

type EvalRow = { member_id: string; year: number; review_text: string | null; score: number | null; updated_at?: string | null }
type VoteRow = { member_id: string; year: number; voter_user_id: string; promote: boolean | null; exceptional: boolean | null }

type AttendanceSummary = { present: number; absent: number; total: number; pct: number; source?: 'attendance' | 'term_evaluations' | 'mixed' | 'manual' }
type AttendanceOverrideRow = { member_id: string; year: number; present_count: number; total_count: number; updated_at?: string | null; updated_by?: string | null }
type NextYearExclusionRow = { member_id: string; year: number; exclude_from_next_year_stats: boolean; updated_at?: string | null; updated_by?: string | null }
type PotentialFlagRow = { member_id: string; year: number; is_potential: boolean; updated_at?: string | null; updated_by?: string | null }
type RankStatAdjustmentRow = { rank_id: number; year: number; extra_count: number; updated_at?: string | null; updated_by?: string | null }

type RoleRow = { role_slug: string; team_id: string | null }

type Term = { id: string; name: string; year: number }
// تقييم ترم (from public.evaluations)
type TermEvaluation = {
  id: string
  evaluatee_member_id: string
  evaluator_user_id: string
  team_id: string | null
  term_id: string | null
  auto_present_count: number | null
  auto_absent_count: number | null
  positive_note: string | null
  negative_note: string | null
  development_plan: string | null
  created_at: string | null
  updated_at: string | null
}

type Voter = { user_id: string; name: string; team_id: string | null }
type AdminVoteDraft = Record<string, { promote: boolean|null; exceptional: boolean|null }>

type OutcomeCard = {
  member: Member
  teamName: string
  currentRankLabel: string
  targetRankLabel?: string
  attendance: AttendanceSummary
  score: number | null | undefined
  promoted: boolean
  exceptional: boolean
}

type OutcomeGroup = { key: string; title: string; subtitle?: string; sort: number; members: OutcomeCard[] }

// ===== Helpers =====
const THIS_YEAR = new Date().getFullYear()
const pctBadge = (p: number) =>
  p >= 80 ? 'bg-emerald-50 border border-emerald-300 text-emerald-700'
: p >= 60 ? 'bg-amber-50 border border-amber-300 text-amber-700'
:           'bg-rose-50 border border-rose-300 text-rose-700'

function cls(...xs: (string|false|undefined)[]) { return xs.filter(Boolean).join(' ') }

// ترتيب الترقية من الأقل للأعلى
const PROMOTION_ORDER = ['sous_chef','aide','assistant','chef_de_legion','chef_de_mouvement'] as const

// ==== Modal (mobile-first, fullscreen on small screens, centered card on desktop) ====
function Modal(props: { open: boolean; onClose: ()=>void; title?: string; children: any; footer?: any }) {
  if (!props.open) return null
  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <button
        className="fixed inset-0 bg-black/30"
        onClick={props.onClose}
        aria-label="Close overlay"
      />
      {/* Shell: full height on mobile, centered card on ≥sm */}
      <div className="fixed inset-x-0 bottom-0 top-0 sm:inset-0 sm:grid sm:place-items-center p-0 sm:p-3 z-[80]">
        <div className="flex h-full w-full flex-col bg-white sm:h-auto sm:max-h-[85vh] sm:w-[min(100%,900px)] sm:rounded-2xl sm:border sm:shadow-xl">
          {/* Header (sticky) */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b sticky top-0 bg-white z-10">
            <div className="text-base sm:text-lg font-bold truncate">{props.title}</div>
            <button className="burger -mr-1 p-2" onClick={props.onClose} aria-label="Close">×</button>
          </div>
          {/* Content (scrollable) */}
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{props.children}</div>
          {/* Footer (sticky) */}
          {props.footer && (
            <div className="border-t px-4 py-3 bg-white sticky bottom-0">
              <div className="flex items-center justify-end gap-2 flex-wrap">
                {props.footer}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Toggle pill (نعم/لا) — الضغط على الاختيار النشط يلغي الاختيار ويرجعه فارغًا
function TogglePill({active, onClick, yes}:{active:boolean; onClick:()=>void; yes:boolean}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? 'اضغط مرة أخرى لإلغاء الاختيار' : undefined}
      aria-pressed={active}
      className={cls('px-3 py-1 rounded-full text-xs border transition shadow-sm active:scale-95',
        yes ? (active ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-100'
                      : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50')
            : (active ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-100'
                      : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50')
      )}
    >{yes ? 'نعم' : 'لا'}</button>
  )
}

function nextNullableChoice(current: boolean | null | undefined, choice: boolean): boolean | null {
  return current === choice ? null : choice
}

function booleanVoteStats(rows: VoteRow[] | undefined, field: 'promote' | 'exceptional') {
  const valid = (rows || []).filter(v => v[field] !== null && v[field] !== undefined)
  const yes = valid.filter(v => v[field] === true).length
  return { yes, total: valid.length, majority: valid.length ? yes > valid.length / 2 : false }
}

function ChefsEvaluationOverviewContent() {
  const toast = useToast()
  const { currentScoutYear } = useScoutYear()

  // load state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // filters
  const [year, setYear] = useState<number>(THIS_YEAR)
  const [teams, setTeams] = useState<Team[]>([])
  const [allowedTeamIds, setAllowedTeamIds] = useState<string[]>([])
  const [teamId, setTeamId] = useState<'all'|string>('all')
  const [ranks, setRanks] = useState<Rank[]>([])
  const [rankId, setRankId] = useState<'all'|number>('all')
  const [search, setSearch] = useState('')
  const [onlyPromoted, setOnlyPromoted] = useState(false)
  const [onlyExceptional, setOnlyExceptional] = useState(false)
  const [onlyExcludedFromStats, setOnlyExcludedFromStats] = useState(false)
  const [onlyNextYearIncluded, setOnlyNextYearIncluded] = useState(false)
  const [onlyPotential, setOnlyPotential] = useState(false)

  // role flags
  const [isAdmin, setIsAdmin] = useState(false)
  const [canVote, setCanVote] = useState(false)
  const [myUserId, setMyUserId] = useState<string|undefined>()

  // data
  const [members, setMembers] = useState<Member[]>([])
  const [evaluations, setEvaluations] = useState<Record<string, EvalRow>>({})
  const [votes, setVotes] = useState<Record<string, VoteRow[]>>({})
  const [attendance, setAttendance] = useState<Record<string, AttendanceSummary>>({})
  const [calculatedAttendance, setCalculatedAttendance] = useState<Record<string, AttendanceSummary>>({})
  const [attendanceOverrides, setAttendanceOverrides] = useState<Record<string, AttendanceOverrideRow>>({})
  const [nextYearExclusions, setNextYearExclusions] = useState<Record<string, NextYearExclusionRow>>({})
  const [savingNextYearFlagId, setSavingNextYearFlagId] = useState<string | null>(null)
  const [potentialFlags, setPotentialFlags] = useState<Record<string, PotentialFlagRow>>({})
  const [savingPotentialFlagId, setSavingPotentialFlagId] = useState<string | null>(null)
  const [rankStatAdjustments, setRankStatAdjustments] = useState<Record<number, RankStatAdjustmentRow>>({})
  const [rankStatDrafts, setRankStatDrafts] = useState<Record<number, string>>({})
  const [savingRankStatAdjustments, setSavingRankStatAdjustments] = useState(false)

  // modal core
  const [activeId, setActiveId] = useState<string|null>(null)
  const activeModalRequestRef = useRef(0)
  const [modalDataLoading, setModalDataLoading] = useState(false)
  const [reviewText, setReviewText] = useState('') // التقييم النهائي
  const [score, setScore] = useState('')           // الدرجة النهائية
  const [manualPresent, setManualPresent] = useState('')
  const [manualTotal, setManualTotal] = useState('')
  const [savingAttendanceOverride, setSavingAttendanceOverride] = useState(false)

  // chef vote (self) & admin bulk votes
  const [myVote, setMyVote] = useState<{ promote: boolean|null; exceptional: boolean|null }>({ promote: null, exceptional: null })
  const [voters, setVoters] = useState<Voter[]>([])
  const [adminVotesDraft, setAdminVotesDraft] = useState<AdminVoteDraft>({})

  // terms (for viewing per-term evaluations and Q&A)
  const [terms, setTerms] = useState<Term[]>([])
  const [termViewId, setTermViewId] = useState<string>('')
  const [termEval, setTermEval] = useState<TermEvaluation | null>(null)
  const [termQuestions, setTermQuestions] = useState<Array<{id:any; text:string}>>([])
  const [termAnswers, setTermAnswers] = useState<Record<string, string|number|null>>({}) // (احتياطي للعرض فقط)

  // نموذج الأسئلة (نعم/لا + نسبة) + حفظه
  const [qaDraft, setQaDraft] = useState<Record<string, { yes: boolean|null; pct: number|null }>>({})
  const [savingQA, setSavingQA] = useState(false)

  const scoutYearRange = getScoutYearDateRange(currentScoutYear)
  const seasonYearKey = getScoutYearNumericValue(currentScoutYear, THIS_YEAR)

  // maps
  const teamMap = useMemo(() => Object.fromEntries(teams.map(t => [t.id, t.name])), [teams])
  const rankMap = useMemo(() => Object.fromEntries(ranks.map(r => [r.id, r.rank_label || '—'])), [ranks])

  // خرائط إضافية للترقية حسب الـslug
  const idToSlug = useMemo(() => {
    const m = new Map<number, string|null>()
    ranks.forEach(r => m.set(r.id, r.rank_slug ?? null))
    return m
  }, [ranks])
  const slugToId = useMemo(() => {
    const m = new Map<string, number>()
    ranks.forEach(r => { if (r.rank_slug) m.set(r.rank_slug, r.id) })
    return m
  }, [ranks])

  // ===== Init: roles + teams + ranks + terms + voters =====
  useEffect(() => { init() }, [])

  useEffect(() => {
    setYear(seasonYearKey)
  }, [seasonYearKey])
  async function init() {
    setLoading(true)
    try {
      try { const { data } = await supabase.auth.getUser(); setMyUserId(data.user?.id) } catch {}

      // roles
      const rr = await fetchCurrentUserRoles() as RoleRow[]
      const _isAdmin = rr.some(r => r.role_slug === 'admin' || (r.role_slug === 'responsable_secretary' && r.team_id == null))
      setIsAdmin(_isAdmin)
      const _canVote = _isAdmin
      setCanVote(_canVote)

      // allowed teams
      let teamsData: Team[] = []
      if (_isAdmin) {
        const { data: ts } = await supabase.from('teams').select('id,name').order('name')
        teamsData = (ts as any) ?? []
        setAllowedTeamIds(teamsData.map(t => t.id))
        setTeamId('all')
      } else {
        const myTeamIds = rr.filter(r => r.role_slug === 'chef_de_legion').map(r => String(r.team_id)).filter(Boolean)
        setAllowedTeamIds(myTeamIds)
        if (myTeamIds.length) setTeamId(myTeamIds[0]!)
        const { data: ts } = await supabase.from('teams').select('id,name').in('id', myTeamIds as any)
        teamsData = (ts as any) ?? []
      }
      setTeams(teamsData)

      // ranks (جابنا كمان rank_slug)
      const { data: rs } = await supabase.from('ranks').select('id,rank_label,rank_slug').order('id')
      setRanks((rs as any) ?? [])

      // terms (for term evaluations viewer)
      const ts2 = await fetchTerms()
      setTerms((ts2 as any) ?? [])

      // ===== voters (admin only): استخدم user_roles_view =====
      if (_isAdmin) {
        const { data: vr, error: vrErr } = await scoutYearFrom('v_user_roles_current', 'v_user_roles_context')
          .select('user_id, role_slug')
          .in('role_slug', ['chef_de_legion', 'admin'])
        if (vrErr) throw vrErr

        const vrRows = ((vr as any[]) ?? [])
        const userIds = Array.from(new Set(vrRows.map(r => r.user_id)))

        // أسماء من members حسب auth_user_id (غير الإكويبيير)
        const { data: ms } = await scoutYearFrom('v_members_current', 'v_members_context')
          .select('auth_user_id, full_name')
          .eq('is_equipier', false)
          .eq('is_active', true)
          .in('auth_user_id', userIds as any)

        const mMap = new Map<string, string>()
        ;((ms as any[]) ?? []).forEach((m:any)=>{ if (m.auth_user_id) mMap.set(m.auth_user_id, m.full_name) })

        const uniq = new Map<string, Voter>()
        vrRows.forEach((r:any) => {
          const name = mMap.get(r.user_id) || (r.role_slug === 'admin' ? 'Admin' : 'Chef')
          if (!uniq.has(r.user_id)) uniq.set(r.user_id, { user_id: r.user_id, name, team_id: null })
        })
        const votersList = Array.from(uniq.values()).sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'ar'))
        setVoters(votersList)
      }
      // ===== /voters =====

    } catch (e:any) {
      toast.error(e.message || 'تعذر التحميل')
    } finally { setLoading(false) }
  }

  // ===== Load members when team/year change =====
  useEffect(() => { if (allowedTeamIds.length) loadMembers() }, [allowedTeamIds, teamId, seasonYearKey, scoutYearRange?.start, scoutYearRange?.end])
  async function loadMembers() {
    setLoading(true)
    try {
      let q = scoutYearFrom('v_members_current', 'v_members_context').select('id,full_name,is_equipier,team_id,rank_id').eq('is_equipier', false).eq('is_active', true) as any
      if (teamId !== 'all') q = q.eq('team_id', teamId)
      else q = q.in('team_id', allowedTeamIds as any)
      const { data, error } = await q.order('full_name', { ascending: true })
      if (error) throw error
      const arr: Member[] = (data as any) ?? []
      setMembers(arr)

      const ids = arr.map(m => m.id)
      if (ids.length) {
        await Promise.all([loadEvaluations(ids), loadVotes(ids), loadAttendance(ids, arr), loadNextYearExclusions(ids), loadPotentialFlags(ids), loadRankStatAdjustments()])
      } else {
        setEvaluations({}); setVotes({}); setAttendance({}); setCalculatedAttendance({}); setAttendanceOverrides({}); setNextYearExclusions({}); setPotentialFlags({}); await loadRankStatAdjustments()
      }
    } catch (e:any) { toast.error(e.message || 'تعذر تحميل القادة') }
    finally { setLoading(false) }
  }

  async function loadEvaluations(memberIds: string[]) {
    try {
      const { data } = await supabase
        .from('final_evaluations')
        .select('member_id,year,review_text,score,updated_at')
        .eq('year', seasonYearKey).in('member_id', memberIds)
      const map: Record<string, EvalRow> = {}
      ;((data as any[]) ?? []).forEach(r => { map[r.member_id] = r })
      setEvaluations(map)
    } catch { setEvaluations({}) }
  }

  async function loadVotes(memberIds: string[]) {
    try {
      const { data } = await supabase
        .from('final_votes')
        .select('member_id,year,voter_user_id,promote,exceptional')
        .eq('year', seasonYearKey)
        .in('member_id', memberIds)
      const map: Record<string, VoteRow[]> = {}
      ;((data as any[]) ?? []).forEach(v => { (map[v.member_id] ||= []).push(v) })
      setVotes(prev => {
        const next = { ...prev }
        memberIds.forEach(id => {
          if (map[id]) next[id] = map[id]
          else delete next[id]
        })
        return next
      })
    } catch {
      setVotes(prev => {
        const next = { ...prev }
        memberIds.forEach(id => delete next[id])
        return next
      })
    }
  }


  async function loadNextYearExclusions(memberIds: string[]) {
    if (!memberIds.length) { setNextYearExclusions({}); return }
    try {
      const map: Record<string, NextYearExclusionRow> = {}
      const chunk = <T,>(arr: T[], size = 100): T[][] => {
        const out: T[][] = []
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
        return out
      }
      for (const idChunk of chunk(memberIds)) {
        const { data, error } = await supabase
          .from('final_next_year_exclusions')
          .select('member_id,year,exclude_from_next_year_stats,updated_at,updated_by')
          .eq('year', seasonYearKey)
          .in('member_id', idChunk as any)
        if (error) throw error
        ;((data as any[]) ?? []).forEach((r:any) => {
          if (r.exclude_from_next_year_stats) map[r.member_id] = {
            member_id: r.member_id,
            year: Number(r.year),
            exclude_from_next_year_stats: true,
            updated_at: r.updated_at ?? null,
            updated_by: r.updated_by ?? null,
          }
        })
      }
      setNextYearExclusions(map)
    } catch (e:any) {
      console.warn('next year exclusions unavailable:', e?.message || e)
      setNextYearExclusions({})
    }
  }

  async function loadPotentialFlags(memberIds: string[]) {
    if (!memberIds.length) { setPotentialFlags({}); return }
    try {
      const map: Record<string, PotentialFlagRow> = {}
      const chunk = <T,>(arr: T[], size = 100): T[][] => {
        const out: T[][] = []
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
        return out
      }
      for (const idChunk of chunk(memberIds)) {
        const { data, error } = await supabase
          .from('final_potential_flags')
          .select('member_id,year,is_potential,updated_at,updated_by')
          .eq('year', seasonYearKey)
          .in('member_id', idChunk as any)
        if (error) throw error
        ;((data as any[]) ?? []).forEach((r:any) => {
          if (r.is_potential) map[r.member_id] = {
            member_id: r.member_id,
            year: Number(r.year),
            is_potential: true,
            updated_at: r.updated_at ?? null,
            updated_by: r.updated_by ?? null,
          }
        })
      }
      setPotentialFlags(map)
    } catch (e:any) {
      console.warn('potential flags unavailable:', e?.message || e)
      setPotentialFlags({})
    }
  }

  async function loadRankStatAdjustments() {
    try {
      const { data, error } = await supabase
        .from('final_rank_stat_adjustments')
        .select('rank_id,year,extra_count,updated_at,updated_by')
        .eq('year', seasonYearKey)
      if (error) throw error
      const map: Record<number, RankStatAdjustmentRow> = {}
      const drafts: Record<number, string> = {}
      ;((data as any[]) ?? []).forEach((r:any) => {
        const rankIdValue = Number(r.rank_id)
        const extra = Math.max(0, Number(r.extra_count || 0))
        map[rankIdValue] = {
          rank_id: rankIdValue,
          year: Number(r.year),
          extra_count: extra,
          updated_at: r.updated_at ?? null,
          updated_by: r.updated_by ?? null,
        }
        drafts[rankIdValue] = extra ? String(extra) : ''
      })
      setRankStatAdjustments(map)
      setRankStatDrafts(drafts)
    } catch (e:any) {
      console.warn('rank stat adjustments unavailable:', e?.message || e)
      setRankStatAdjustments({})
      setRankStatDrafts({})
    }
  }

  async function loadAttendance(memberIds: string[], memberRows: Member[] = members, mergeExisting = false) {
    const empty = () => { setAttendance({}); setCalculatedAttendance({}); setAttendanceOverrides({}) }
    if (!memberIds.length) { empty(); return }

    const memberIdSet = new Set(memberIds)
    const scopedMembers = (memberRows || []).filter(m => memberIdSet.has(m.id))
    const memberTeamMap = new Map(scopedMembers.map(m => [m.id, m.team_id]))

    const buildPct = (row: AttendanceSummary): AttendanceSummary => {
      const present = Number(row.present || 0)
      const absent = Number(row.absent || 0)
      const total = present + absent
      return {
        ...row,
        present,
        absent,
        total,
        pct: total ? Math.round((present / total) * 100) : 0,
      }
    }

    const chunk = <T,>(arr: T[], size = 35): T[][] => {
      const out: T[][] = []
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
      return out
    }

    const fetchPaged = async (makeQuery: () => any) => {
      const all: any[] = []
      const pageSize = 1000
      for (let page = 0; page < 25; page += 1) {
        const from = page * pageSize
        const to = from + pageSize - 1
        const { data, error } = await makeQuery().range(from, to)
        if (error) throw error
        const rows = (data as any[]) ?? []
        all.push(...rows)
        if (rows.length < pageSize) break
      }
      return all
    }

    const attendanceMap: Record<string, AttendanceSummary> = {}

    try {
      const start = scoutYearRange?.start || `${seasonYearKey}-01-01`
      const end = scoutYearRange?.end || `${seasonYearKey}-12-31`

      // مهم: في وضع الأدمن كان الاستعلام السابق بيطلب حضور كل الفرق مرة واحدة.
      // Supabase/PostgREST قد يرجع أول صفحة فقط من النتائج عند كثرة سجلات الحضور،
      // فيظهر بعض القادة 0/0 رغم أن لهم حضور داخل شاشة قائد الفريق.
      // لذلك بنحسب الحضور حسب فريق كل عضو وبـ pagination واضح، حتى تكون نتيجة الأدمن
      // مطابقة لنفس نتيجة قائد الفريق.
      const idsByTeam = new Map<string, string[]>()
      scopedMembers.forEach(m => {
        if (!m.team_id) return
        const key = String(m.team_id)
        if (!idsByTeam.has(key)) idsByTeam.set(key, [])
        idsByTeam.get(key)!.push(m.id)
      })

      const seenAttendanceRows = new Set<string>()
      const applyAttendanceRows = (rows: any[]) => {
        rows.forEach(r => {
          const meeting = Array.isArray(r.meetings) ? r.meetings[0] : r.meetings
          if (!meeting) return
          const expectedTeamId = memberTeamMap.get(r.member_id)
          if (!expectedTeamId || String(meeting.team_id) !== String(expectedTeamId)) return

          const key = `${r.meeting_id || ''}:${r.member_id || ''}`
          if (seenAttendanceRows.has(key)) return
          seenAttendanceRows.add(key)

          if (!attendanceMap[r.member_id]) attendanceMap[r.member_id] = { present: 0, absent: 0, total: 0, pct: 0, source: 'attendance' }
          if (r.is_present) attendanceMap[r.member_id].present += 1
          else attendanceMap[r.member_id].absent += 1
        })
      }

      for (const [memberTeamId, ids] of idsByTeam.entries()) {
        for (const idChunk of chunk(ids)) {
          const rows = await fetchPaged(() => supabase
            .from('attendance')
            .select('meeting_id,member_id,is_present,meetings!inner(team_id,meeting_date,mtype)')
            .eq('meetings.team_id', memberTeamId)
            .gte('meetings.meeting_date', start)
            .lte('meetings.meeting_date', end)
            .in('member_id', idChunk as any)
          )
          applyAttendanceRows(rows)
        }
      }

      Object.keys(attendanceMap).forEach(id => { attendanceMap[id] = buildPct(attendanceMap[id]) })

      // Fallback/validation من evaluations.auto_present_count / auto_absent_count.
      // نستخدمه لو هو أكمل من raw attendance، لأنه يتولد أصلًا من شاشة تقييم القائد.
      try {
        const evalMap: Record<string, AttendanceSummary> = {}
        for (const [memberTeamId, ids] of idsByTeam.entries()) {
          for (const idChunk of chunk(ids)) {
            const evalRows = await fetchPaged(() => supabase
              .from('evaluations')
              .select('evaluatee_member_id,team_id,auto_present_count,auto_absent_count,terms!inner(id,year,start_date,end_date)')
              .eq('team_id', memberTeamId)
              .eq('terms.year', seasonYearKey)
              .in('evaluatee_member_id', idChunk as any)
            )

            evalRows.forEach((r:any) => {
              const id = r.evaluatee_member_id
              if (!memberIdSet.has(id)) return
              const expectedTeamId = memberTeamMap.get(id)
              if (expectedTeamId && r.team_id && String(r.team_id) !== String(expectedTeamId)) return
              if (!evalMap[id]) evalMap[id] = { present: 0, absent: 0, total: 0, pct: 0, source: 'term_evaluations' }
              evalMap[id].present += Number(r.auto_present_count || 0)
              evalMap[id].absent += Number(r.auto_absent_count || 0)
            })
          }
        }

        Object.keys(evalMap).forEach(id => { evalMap[id] = buildPct(evalMap[id]) })
        Object.entries(evalMap).forEach(([id, evalSummary]) => {
          const rawSummary = attendanceMap[id]
          if (!rawSummary || evalSummary.total > rawSummary.total) {
            attendanceMap[id] = { ...evalSummary, source: rawSummary ? 'mixed' : 'term_evaluations' }
          }
        })
      } catch (fallbackError) {
        console.warn('evaluation attendance fallback failed:', fallbackError)
      }

      const calculatedMap: Record<string, AttendanceSummary> = { ...attendanceMap }
      const overridesMap: Record<string, AttendanceOverrideRow> = {}

      try {
        for (const idChunk of chunk(memberIds, 100)) {
          const { data: overrideRows, error: overrideErr } = await supabase
            .from('final_attendance_overrides')
            .select('member_id,year,present_count,total_count,updated_at,updated_by')
            .eq('year', seasonYearKey)
            .in('member_id', idChunk as any)
          if (overrideErr) throw overrideErr
          ;((overrideRows as any[]) ?? []).forEach((r:any) => {
            const present = Number(r.present_count || 0)
            const total = Number(r.total_count || 0)
            overridesMap[r.member_id] = {
              member_id: r.member_id,
              year: Number(r.year),
              present_count: present,
              total_count: total,
              updated_at: r.updated_at ?? null,
              updated_by: r.updated_by ?? null,
            }
            calculatedMap[r.member_id] = calculatedMap[r.member_id] || { present: 0, absent: 0, total: 0, pct: 0, source: 'attendance' }
            attendanceMap[r.member_id] = buildPct({
              present,
              absent: Math.max(0, total - present),
              total,
              pct: 0,
              source: 'manual'
            })
          })
        }
      } catch (overrideError:any) {
        // لو جدول التعديلات اليدوية لم يتم تشغيله بعد، نكمل بالحساب التلقائي بدون كسر الصفحة.
        console.warn('attendance overrides unavailable:', overrideError?.message || overrideError)
      }

      if (mergeExisting) {
        setCalculatedAttendance(prev => {
          const next = { ...prev }
          memberIds.forEach(id => {
            if (calculatedMap[id]) next[id] = calculatedMap[id]
            else delete next[id]
          })
          return next
        })
        setAttendanceOverrides(prev => {
          const next = { ...prev }
          memberIds.forEach(id => {
            if (overridesMap[id]) next[id] = overridesMap[id]
            else delete next[id]
          })
          return next
        })
        setAttendance(prev => {
          const next = { ...prev }
          memberIds.forEach(id => {
            if (attendanceMap[id]) next[id] = attendanceMap[id]
            else delete next[id]
          })
          return next
        })
      } else {
        setCalculatedAttendance(calculatedMap)
        setAttendanceOverrides(overridesMap)
        setAttendance(attendanceMap)
      }
    } catch (e:any) {
      console.warn('loadAttendance failed:', e?.message || e)
      if (!mergeExisting) setAttendance({})
    }
  }

  // ===== Derived =====
  const rankById = useMemo(() => {
    const m = new Map<number, Rank>()
    ranks.forEach(r => m.set(r.id, r))
    return m
  }, [ranks])

  const getRankSort = (rankIdValue: number | null | undefined) => {
    if (rankIdValue == null) return 9999
    const slug = idToSlug.get(rankIdValue) || rankById.get(rankIdValue)?.rank_slug || null
    const idx = slug ? PROMOTION_ORDER.indexOf(slug as any) : -1
    return idx >= 0 ? idx : 5000 + Number(rankIdValue || 0)
  }

  const getRankLabel = (rankIdValue: number | null | undefined) => {
    if (rankIdValue == null) return 'بدون رتبة'
    return rankMap[rankIdValue] || rankById.get(rankIdValue)?.rank_label || 'بدون رتبة'
  }

  const getPromotionTargetRankId = (rankIdValue: number | null | undefined): number | null => {
    if (rankIdValue == null) return null
    const slug = idToSlug.get(rankIdValue) || null
    const idx = slug ? PROMOTION_ORDER.indexOf(slug as any) : -1
    if (idx >= 0 && idx < PROMOTION_ORDER.length - 1) {
      const nextSlug = PROMOTION_ORDER[idx + 1]
      const nextId = slugToId.get(nextSlug)
      return typeof nextId === 'number' ? nextId : null
    }
    return null
  }

  const getPromotionTargetLabel = (rankIdValue: number | null | undefined) => {
    const nextId = getPromotionTargetRankId(rankIdValue)
    if (nextId != null) return getRankLabel(nextId)
    if (rankIdValue == null) return 'الرتبة التالية غير محددة'
    return 'أعلى رتبة / لا توجد رتبة تالية'
  }

  const baseFiltered = useMemo(() => {
    let arr = members
    if (teamId !== 'all') arr = arr.filter(m => m.team_id === teamId)
    if (rankId !== 'all') arr = arr.filter(m => (m.rank_id ?? -1) === rankId)
    if (search.trim()) {
      const s = search.toLowerCase()
      arr = arr.filter(m => m.full_name.toLowerCase().includes(s) || (teamMap[m.team_id]?.toLowerCase().includes(s)))
    }
    if (onlyExcludedFromStats) arr = arr.filter(m => !!nextYearExclusions[m.id]?.exclude_from_next_year_stats)
    if (onlyNextYearIncluded) arr = arr.filter(m => !nextYearExclusions[m.id]?.exclude_from_next_year_stats)
    if (onlyPotential) arr = arr.filter(m => !!potentialFlags[m.id]?.is_potential)
    return arr
  }, [members, teamId, rankId, search, teamMap, onlyExcludedFromStats, onlyNextYearIncluded, onlyPotential, nextYearExclusions, potentialFlags])

  const filtered = useMemo(() => {
    if (!onlyPromoted && !onlyExceptional) return baseFiltered
    return baseFiltered.filter(m => {
      const vs = votes[m.id] || []
      const promoted = booleanVoteStats(vs, 'promote').majority
      const exc = booleanVoteStats(vs, 'exceptional').majority
      // عند اختيار الفلترين معًا نعرض Union، لأن الهدف تقرير: من ترقى + من تميز، وليس تقاطعًا يخفي النتائج.
      return (onlyPromoted && promoted) || (onlyExceptional && exc)
    })
  }, [baseFiltered, onlyPromoted, onlyExceptional, votes])

  // إحصائيات الرتب لا يجب أن تعتمد على فلاتر العرض مثل وعد/Meilleurs/Potential/بحث.
  // المطلوب أن تكون مبنية على نطاق الفريق المحدد فقط، ثم يتم استبعاد الأسماء المعلمة كـ
  // غير موجود السنة القادمة من أرقام قبل/بعد الوعد.
  const statsScopeMembers = useMemo(() => {
    let arr = members
    if (teamId !== 'all') arr = arr.filter(m => m.team_id === teamId)
    return arr
  }, [members, teamId])

  const statsMembers = useMemo(() => {
    return statsScopeMembers.filter(m => !nextYearExclusions[m.id]?.exclude_from_next_year_stats)
  }, [statsScopeMembers, nextYearExclusions])

  const excludedStatsCount = useMemo(() => {
    return statsScopeMembers.filter(m => nextYearExclusions[m.id]?.exclude_from_next_year_stats).length
  }, [statsScopeMembers, nextYearExclusions])

  const outcomeGroups = useMemo(() => {
    const promotionMap = new Map<string, OutcomeGroup>()
    const exceptionalMap = new Map<string, OutcomeGroup>()

    baseFiltered.forEach(member => {
      const vs = votes[member.id] || []
      const promoted = booleanVoteStats(vs, 'promote').majority
      const exceptional = booleanVoteStats(vs, 'exceptional').majority
      const currentRankLabel = getRankLabel(member.rank_id)
      const targetRankLabel = getPromotionTargetLabel(member.rank_id)
      const teamName = teamMap[member.team_id] || member.team_id || '—'
      const common: OutcomeCard = {
        member,
        teamName,
        currentRankLabel,
        targetRankLabel,
        attendance: attendance[member.id] || { present: 0, absent: 0, total: 0, pct: 0 },
        score: evaluations[member.id]?.score,
        promoted,
        exceptional,
      }

      if (promoted) {
        const key = `promotion-${member.rank_id ?? 'none'}-${targetRankLabel}`
        if (!promotionMap.has(key)) {
          promotionMap.set(key, {
            key,
            title: `من ${currentRankLabel} إلى ${targetRankLabel}`,
            subtitle: `المرقّون من ${currentRankLabel} إلى ${targetRankLabel}`,
            sort: getRankSort(member.rank_id),
            members: []
          })
        }
        promotionMap.get(key)!.members.push(common)
      }

      if (exceptional) {
        const key = `exceptional-${member.rank_id ?? 'none'}`
        if (!exceptionalMap.has(key)) {
          exceptionalMap.set(key, {
            key,
            title: `Meilleurs — ${currentRankLabel}`,
            subtitle: `${currentRankLabel}`,
            sort: getRankSort(member.rank_id),
            members: []
          })
        }
        exceptionalMap.get(key)!.members.push(common)
      }
    })

    const normalize = (groups: OutcomeGroup[]) => groups
      .map(g => ({ ...g, members: [...g.members].sort((a, b) => a.member.full_name.localeCompare(b.member.full_name, 'ar')) }))
      .sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, 'ar'))

    return {
      promotions: normalize(Array.from(promotionMap.values())),
      exceptional: normalize(Array.from(exceptionalMap.values())),
    }
  }, [baseFiltered, votes, attendance, evaluations, teamMap, rankMap, rankById, idToSlug, slugToId])

  // ===== Rank counts (cards) — before =====
  const countsBefore = useMemo(() => {
    const beforeByRank = new Map<number, number>()
    statsMembers.forEach(member => {
      if (member.rank_id != null) {
        beforeByRank.set(member.rank_id, (beforeByRank.get(member.rank_id) || 0) + 1)
      }
    })

    return ranks.map(rank => {
      const systemCount = beforeByRank.get(rank.id) || 0
      const manualExtra = Math.max(0, Number(rankStatAdjustments[rank.id]?.extra_count || 0))
      return {
        id: rank.id,
        label: rank.rank_label || '—',
        systemCount,
        manualExtra,
        count: systemCount + manualExtra,
      }
    })
  }, [statsMembers, ranks, rankStatAdjustments])

  // ===== Rank counts (cards) — after promotion by majority =====
  const countsAfter = useMemo(() => {
    // نبدأ من أرقام قبل الوعد بعد خصم المستبعدين، ثم ننقل كل شخص مرقّى
    // من رتبته الحالية إلى الرتبة الأعلى. هذا يمنع الخطأ القديم الذي كان يتأثر
    // بفلاتر العرض أو يضيف المرقّين دون خصمهم من رتبتهم الأصلية.
    const beforeByRank = new Map<number, number>()
    const afterByRank = new Map<number, number>()
    const incomingByRank = new Map<number, number>()
    const outgoingByRank = new Map<number, number>()

    statsMembers.forEach(member => {
      if (member.rank_id != null) {
        beforeByRank.set(member.rank_id, (beforeByRank.get(member.rank_id) || 0) + 1)
        afterByRank.set(member.rank_id, (afterByRank.get(member.rank_id) || 0) + 1)
      }
    })

    statsMembers.forEach(member => {
      const currentRankId = member.rank_id
      if (currentRankId == null) return
      const promoted = booleanVoteStats(votes[member.id] || [], 'promote').majority
      if (!promoted) return

      const targetRankId = getPromotionTargetRankId(currentRankId)
      if (targetRankId == null || targetRankId === currentRankId) return

      afterByRank.set(currentRankId, Math.max(0, (afterByRank.get(currentRankId) || 0) - 1))
      afterByRank.set(targetRankId, (afterByRank.get(targetRankId) || 0) + 1)
      outgoingByRank.set(currentRankId, (outgoingByRank.get(currentRankId) || 0) + 1)
      incomingByRank.set(targetRankId, (incomingByRank.get(targetRankId) || 0) + 1)
    })

    return ranks.map(rank => {
      const systemBefore = beforeByRank.get(rank.id) || 0
      const outgoing = outgoingByRank.get(rank.id) || 0
      const incoming = incomingByRank.get(rank.id) || 0
      const systemCount = afterByRank.get(rank.id) || 0
      const manualExtra = Math.max(0, Number(rankStatAdjustments[rank.id]?.extra_count || 0))
      return {
        id: rank.id,
        label: rank.rank_label || '—',
        systemBefore,
        outgoing,
        incoming,
        systemCount,
        manualExtra,
        count: systemCount + manualExtra,
      }
    })
  }, [statsMembers, ranks, votes, rankStatAdjustments, getPromotionTargetRankId])

  // ===== Term evaluation viewer (with Q&A) =====
  useEffect(() => {
    if (activeId && termViewId) {
      ;(async () => {
        await loadTermEval(activeId, termViewId)
        await loadTermQA(activeId, termViewId)
      })()
    }
  }, [activeId, termViewId])

  function defaultTermIdForYear(_y:number) {
    return terms[0]?.id || ''
  }

  async function loadTermEval(memberId: string, tId: string) {
    try {
      const { data } = await supabase
        .from('evaluations')
        .select('id,evaluatee_member_id,evaluator_user_id,team_id,term_id,auto_present_count,auto_absent_count,positive_note,negative_note,development_plan,created_at,updated_at')
        .eq('evaluatee_member_id', memberId)
        .eq('term_id', tId)
        .maybeSingle()
      setTermEval((data as any) ?? null)
    } catch { setTermEval(null) }
  }

  async function loadTermQA(memberId: string, tId: string) {
    try {
      const { data: qs } = await supabase.from('evaluation_questions').select('*').order('id')
      const qList: Array<{id:any; text:string}> = ((qs as any[]) ?? []).map((q:any)=>({
        id: q.id,
        text: q.question_text || q.text || q.title || q.content || `سؤال ${q.id}`
      }))
      setTermQuestions(qList)

      let evalId: string | null = termEval?.id || null
      if (!evalId) {
        const { data: ev } = await supabase
          .from('evaluations')
          .select('id')
          .eq('evaluatee_member_id', memberId)
          .eq('term_id', tId)
          .maybeSingle()
        evalId = (ev as any)?.id || null
      }

      if (!evalId) {
        setTermAnswers({})
        setQaDraft({})
        return
      }

      const { data: ans, error: ansErr } = await supabase
        .from('evaluation_answers')
        .select('question_id, answer, weight_percent')
        .eq('evaluation_id', evalId)
      if (ansErr) throw ansErr

      const answersMap: Record<string, string|number|null> = {}
      const draft: Record<string, { yes: boolean|null; pct: number|null }> = {}

      ;((ans as any[]) ?? []).forEach((a:any)=>{
        const qid = String(a.question_id)
        answersMap[qid] = a.weight_percent ?? null
        draft[qid] = {
          yes: (a.answer === true ? true : (a.answer === false ? false : null)),
          pct: (a.weight_percent === null || a.weight_percent === undefined) ? null : Number(a.weight_percent)
        }
      })

      setTermAnswers(answersMap)
      setQaDraft(draft)
    } catch {
      setTermQuestions([]); setTermAnswers({}); setQaDraft({})
    }
  }

  async function saveTermQA() {
    if (!activeId || !termViewId) { toast.error('اختر الترم أولاً'); return }
    if (!termEval?.id) {
      toast.error('لا يوجد تقييم لهذا الترم — أنشئ تقييم الترم أولاً.')
      return
    }
    setSavingQA(true)
    try {
      const rows = termQuestions.map(q => {
        const st = qaDraft[String(q.id)] || { yes: null, pct: null }
        return {
          evaluation_id: termEval!.id,
          question_id: q.id,
          answer: st.yes,
          weight_percent: st.pct
        }
      })
      const { error } = await supabase
        .from('evaluation_answers')
        .upsert(rows, { onConflict: 'evaluation_id,question_id' })
      if (error) throw error
      toast.success('تم حفظ إجابات الأسئلة')
      await loadTermQA(activeId, termViewId)
    } catch (e:any) {
      toast.error(e.message || 'تعذر حفظ الإجابات')
    } finally {
      setSavingQA(false)
    }
  }

  // ===== Prefill admin draft votes when modal opens OR votes/voters change =====
  useEffect(() => {
    if (!isAdmin || !activeId) return
    const vs = votes[activeId] || []
    const draft: AdminVoteDraft = {}
    voters.forEach(v => {
      const ex = vs.find(x => x.voter_user_id === v.user_id)
      if (ex) draft[v.user_id] = { promote: ex.promote, exceptional: ex.exceptional }
    })
    setAdminVotesDraft(draft)
  }, [isAdmin, activeId, voters, votes])

  useEffect(() => {
    if (!activeId) {
      setManualPresent('')
      setManualTotal('')
      return
    }
    const override = attendanceOverrides[activeId]
    setManualPresent(override ? String(override.present_count) : '')
    setManualTotal(override ? String(override.total_count) : '')
  }, [activeId, attendanceOverrides])

  async function reloadModalData(memberId: string, requestId: number) {
    setModalDataLoading(true)
    try {
      const [evaluationResult, voteResult] = await Promise.all([
        supabase
          .from('final_evaluations')
          .select('member_id,year,review_text,score,updated_at')
          .eq('member_id', memberId)
          .eq('year', seasonYearKey)
          .maybeSingle(),
        supabase
          .from('final_votes')
          .select('member_id,year,voter_user_id,promote,exceptional')
          .eq('member_id', memberId)
          .eq('year', seasonYearKey)
      ])

      if (evaluationResult.error) throw evaluationResult.error
      if (voteResult.error) throw voteResult.error
      if (activeModalRequestRef.current !== requestId) return

      const freshEvaluation = (evaluationResult.data as any as EvalRow | null) ?? null
      setEvaluations(prev => {
        const next = { ...prev }
        if (freshEvaluation) next[memberId] = freshEvaluation
        else delete next[memberId]
        return next
      })
      setReviewText(freshEvaluation?.review_text || '')
      setScore(freshEvaluation?.score != null ? String(freshEvaluation.score) : '')

      const freshVotes = ((voteResult.data as any[]) ?? []) as VoteRow[]
      setVotes(prev => ({ ...prev, [memberId]: freshVotes }))

      if (canVote) {
        const mine = myUserId ? freshVotes.find(v => v.voter_user_id === myUserId) : undefined
        setMyVote({ promote: mine?.promote ?? null, exceptional: mine?.exceptional ?? null })
      }

      if (isAdmin) {
        const draft: AdminVoteDraft = {}
        voters.forEach(v => {
          const ex = freshVotes.find(x => x.voter_user_id === v.user_id)
          draft[v.user_id] = { promote: ex?.promote ?? null, exceptional: ex?.exceptional ?? null }
        })
        setAdminVotesDraft(draft)
      }

      const member = members.find(m => m.id === memberId)
      if (member) {
        await loadAttendance([memberId], [member], true)
      }
    } catch (e:any) {
      if (activeModalRequestRef.current === requestId) {
        toast.error(e.message || 'تعذر تحديث بيانات التقييم')
      }
    } finally {
      if (activeModalRequestRef.current === requestId) setModalDataLoading(false)
    }
  }

  // ===== Modal open/close =====
  function openModal(id: string) {
    const requestId = activeModalRequestRef.current + 1
    activeModalRequestRef.current = requestId

    setActiveId(id)
    setModalDataLoading(true)

    // نظف بيانات الشخص السابق فورًا حتى لا تظهر بيانات قديمة أو فاضية بسبب state سابق.
    setReviewText('')
    setScore('')
    setMyVote({ promote: null, exceptional: null })
    setAdminVotesDraft({})
    setTermEval(null)
    setTermQuestions([])
    setTermAnswers({})
    setQaDraft({})
    setManualPresent('')
    setManualTotal('')

    const def = defaultTermIdForYear(seasonYearKey)
    setTermViewId(def)
    void reloadModalData(id, requestId)
  }
  function closeModal() {
    activeModalRequestRef.current += 1
    setModalDataLoading(false)
    setActiveId(null)
  }

  async function saveEvaluation() {
    if (!activeId) return
    setSaving(true)
    try {
      const payload = { member_id: activeId, year: seasonYearKey, review_text: reviewText.trim() || null, score: score !== '' ? Number(score) : null }
      const { error } = await supabase.from('final_evaluations').upsert(payload, { onConflict: 'member_id,year' })
      if (error) throw error
      if (isAdmin) await persistAdminVotes(activeId, false)
      toast.success(isAdmin ? 'تم حفظ التقييم النهائي والتصويت' : 'تم حفظ التقييم النهائي')
      await reloadModalData(activeId, activeModalRequestRef.current)
    } catch (e:any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally { setSaving(false) }
  }

  async function saveMyVote() {
    if (!activeId || !myUserId || !canVote) { toast.error('لا يمكن حفظ التصويت'); return }
    setSaving(true)
    try {
      if (myVote.promote === null && myVote.exceptional === null) {
        const { error } = await supabase
          .from('final_votes')
          .delete()
          .eq('member_id', activeId)
          .eq('year', seasonYearKey)
          .eq('voter_user_id', myUserId)
        if (error) throw error
      } else {
        const payload = { member_id: activeId, year: seasonYearKey, voter_user_id: myUserId, promote: myVote.promote, exceptional: myVote.exceptional }
        const { error } = await supabase.from('final_votes').upsert(payload, { onConflict: 'member_id,year,voter_user_id' })
        if (error) throw error
      }
      toast.success('تم حفظ تصويتك')
      await loadVotes([activeId])
    } catch (e:any) { toast.error(e.message || 'تعذر الحفظ') }
    finally { setSaving(false) }
  }

  async function persistAdminVotes(memberId: string, showToast = true) {
    if (!memberId || !isAdmin) return
    const entries = voters.map(v => {
      const draft = adminVotesDraft[v.user_id] || { promote: null, exceptional: null }
      return [v.user_id, draft] as const
    })
    const rows = entries
      .filter(([, v]) => v.promote !== null || v.exceptional !== null)
      .map(([user_id, v]) => ({
        member_id: memberId,
        year: seasonYearKey,
        voter_user_id: user_id,
        promote: v.promote,
        exceptional: v.exceptional
      }))
    const clearedUserIds = entries
      .filter(([, v]) => v.promote === null && v.exceptional === null)
      .map(([user_id]) => user_id)

    if (rows.length) {
      const { error } = await supabase.from('final_votes').upsert(rows, { onConflict: 'member_id,year,voter_user_id' })
      if (error) throw error
    }
    if (clearedUserIds.length) {
      const { error } = await supabase
        .from('final_votes')
        .delete()
        .eq('member_id', memberId)
        .eq('year', seasonYearKey)
        .in('voter_user_id', clearedUserIds as any)
      if (error) throw error
    }
    await loadVotes([memberId])
    if (showToast) toast.success('تم حفظ التصويتات')
  }

  async function saveAdminVotes() {
    if (!activeId || !isAdmin) return
    setSaving(true)
    try {
      await persistAdminVotes(activeId, true)
      await reloadModalData(activeId, activeModalRequestRef.current)
    } catch (e:any) { toast.error(e.message || 'تعذر الحفظ') }
    finally { setSaving(false) }
  }

  async function saveAttendanceOverride() {
    if (!activeId) return
    const present = Number(manualPresent)
    const total = Number(manualTotal)
    if (manualPresent.trim() === '' || manualTotal.trim() === '') {
      toast.error('اكتب الحضور والإجمالي أولاً أو استخدم زر إلغاء التعديل اليدوي')
      return
    }
    if (!Number.isInteger(present) || !Number.isInteger(total) || present < 0 || total < 0) {
      toast.error('الحضور والإجمالي لازم يكونوا أرقام صحيحة موجبة')
      return
    }
    if (present > total) {
      toast.error('عدد الحضور لا يمكن أن يكون أكبر من الإجمالي')
      return
    }

    setSavingAttendanceOverride(true)
    try {
      const payload = {
        member_id: activeId,
        year: seasonYearKey,
        present_count: present,
        total_count: total,
        updated_by: myUserId || null,
        updated_at: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from('final_attendance_overrides')
        .upsert(payload, { onConflict: 'member_id,year' })
        .select('member_id,year,present_count,total_count,updated_at,updated_by')
        .single()
      if (error) throw error

      const row = data as any as AttendanceOverrideRow
      const summary: AttendanceSummary = {
        present,
        absent: Math.max(0, total - present),
        total,
        pct: total ? Math.round((present / total) * 100) : 0,
        source: 'manual'
      }
      setAttendanceOverrides(prev => ({ ...prev, [activeId]: row }))
      setAttendance(prev => ({ ...prev, [activeId]: summary }))
      toast.success('تم حفظ تعديل الحضور اليدوي')
    } catch (e:any) {
      toast.error(e.message || 'تعذر حفظ تعديل الحضور')
    } finally {
      setSavingAttendanceOverride(false)
    }
  }

  async function clearAttendanceOverride() {
    if (!activeId) return
    setSavingAttendanceOverride(true)
    try {
      const { error } = await supabase
        .from('final_attendance_overrides')
        .delete()
        .eq('member_id', activeId)
        .eq('year', seasonYearKey)
      if (error) throw error

      setAttendanceOverrides(prev => {
        const next = { ...prev }
        delete next[activeId]
        return next
      })
      setAttendance(prev => ({
        ...prev,
        [activeId]: calculatedAttendance[activeId] || { present: 0, absent: 0, total: 0, pct: 0, source: 'attendance' }
      }))
      setManualPresent('')
      setManualTotal('')
      toast.success('تم إلغاء التعديل اليدوي والرجوع للحساب التلقائي')
    } catch (e:any) {
      toast.error(e.message || 'تعذر إلغاء التعديل اليدوي')
    } finally {
      setSavingAttendanceOverride(false)
    }
  }


  async function toggleNextYearStatsExclusion(memberId: string) {
    if (!isAdmin) return
    setSavingNextYearFlagId(memberId)
    const currentlyExcluded = !!nextYearExclusions[memberId]?.exclude_from_next_year_stats
    try {
      if (currentlyExcluded) {
        const { error } = await supabase
          .from('final_next_year_exclusions')
          .delete()
          .eq('member_id', memberId)
          .eq('year', seasonYearKey)
        if (error) throw error
        setNextYearExclusions(prev => {
          const next = { ...prev }
          delete next[memberId]
          return next
        })
        toast.success('تم رجوع الاسم للإحصائيات')
      } else {
        const payload = {
          member_id: memberId,
          year: seasonYearKey,
          exclude_from_next_year_stats: true,
          updated_by: myUserId || null,
          updated_at: new Date().toISOString(),
        }
        const { data, error } = await supabase
          .from('final_next_year_exclusions')
          .upsert(payload, { onConflict: 'member_id,year' })
          .select('member_id,year,exclude_from_next_year_stats,updated_at,updated_by')
          .single()
        if (error) throw error
        setNextYearExclusions(prev => ({ ...prev, [memberId]: data as any as NextYearExclusionRow }))
        toast.success('تم استبعاد الاسم من إحصائيات السنة القادمة')
      }
    } catch (e:any) {
      toast.error(e.message || 'تعذر حفظ علامة الإحصائيات')
    } finally {
      setSavingNextYearFlagId(null)
    }
  }

  async function togglePotentialFlag(memberId: string) {
    if (!isAdmin) return
    setSavingPotentialFlagId(memberId)
    const currentlyPotential = !!potentialFlags[memberId]?.is_potential
    try {
      if (currentlyPotential) {
        const { error } = await supabase
          .from('final_potential_flags')
          .delete()
          .eq('member_id', memberId)
          .eq('year', seasonYearKey)
        if (error) throw error
        setPotentialFlags(prev => {
          const next = { ...prev }
          delete next[memberId]
          return next
        })
        toast.success('تم إزالة علامة Potential')
      } else {
        const payload = {
          member_id: memberId,
          year: seasonYearKey,
          is_potential: true,
          updated_by: myUserId || null,
          updated_at: new Date().toISOString(),
        }
        const { data, error } = await supabase
          .from('final_potential_flags')
          .upsert(payload, { onConflict: 'member_id,year' })
          .select('member_id,year,is_potential,updated_at,updated_by')
          .single()
        if (error) throw error
        setPotentialFlags(prev => ({ ...prev, [memberId]: data as any as PotentialFlagRow }))
        toast.success('تم وضع علامة Potential')
      }
    } catch (e:any) {
      toast.error(e.message || 'تعذر حفظ علامة Potential')
    } finally {
      setSavingPotentialFlagId(null)
    }
  }

  async function saveRankStatAdjustments() {
    if (!isAdmin) return
    setSavingRankStatAdjustments(true)
    try {
      const entries = ranks.map(r => {
        const raw = rankStatDrafts[r.id] ?? ''
        const extra = raw.trim() === '' ? 0 : Number(raw)
        return { rank_id: r.id, extra_count: extra }
      })
      const invalid = entries.find(x => !Number.isInteger(x.extra_count) || x.extra_count < 0)
      if (invalid) {
        toast.error('الأرقام اليدوية لازم تكون أرقام صحيحة موجبة')
        return
      }

      const rows = entries
        .filter(x => x.extra_count > 0)
        .map(x => ({
          year: seasonYearKey,
          rank_id: x.rank_id,
          extra_count: x.extra_count,
          updated_by: myUserId || null,
          updated_at: new Date().toISOString(),
        }))
      const zeroRankIds = entries.filter(x => x.extra_count === 0).map(x => x.rank_id)

      if (rows.length) {
        const { error } = await supabase
          .from('final_rank_stat_adjustments')
          .upsert(rows, { onConflict: 'year,rank_id' })
        if (error) throw error
      }
      if (zeroRankIds.length) {
        const { error } = await supabase
          .from('final_rank_stat_adjustments')
          .delete()
          .eq('year', seasonYearKey)
          .in('rank_id', zeroRankIds as any)
        if (error) throw error
      }
      await loadRankStatAdjustments()
      toast.success('تم حفظ الأرقام اليدوية للإحصائيات')
    } catch (e:any) {
      toast.error(e.message || 'تعذر حفظ الأرقام اليدوية')
    } finally {
      setSavingRankStatAdjustments(false)
    }
  }

  const renderOutcomeSections = (
    title: string,
    description: string,
    groups: OutcomeGroup[],
    variant: 'promotion' | 'exceptional'
  ) => (
    <div className="rounded-3xl border bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-extrabold text-slate-900">{title}</div>
          <div className="text-sm text-slate-500 mt-1">{description}</div>
        </div>
        <span className={cls(
          'px-3 py-1 rounded-full border text-xs font-bold',
          variant === 'promotion'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-indigo-50 border-indigo-200 text-indigo-700'
        )}>
          {groups.reduce((sum, g) => sum + g.members.length, 0)} اسم
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-slate-50 p-5 text-center text-slate-500">
          لا توجد أسماء مطابقة لهذا الفلتر.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <div key={group.key} className="overflow-hidden rounded-3xl border bg-slate-50/70">
              <div className={cls(
                'px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap',
                variant === 'promotion' ? 'bg-emerald-50/80 border-emerald-100' : 'bg-indigo-50/80 border-indigo-100'
              )}>
                <div>
                  <div className="font-extrabold text-slate-900">{group.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{group.subtitle}</div>
                </div>
                <span className="px-3 py-1 rounded-full bg-white border text-xs font-bold text-slate-700">
                  {group.members.length} قائد
                </span>
              </div>

              <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
                {group.members.map(item => (
                  <div key={`${group.key}-${item.member.id}`} className="rounded-2xl border bg-white p-3 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-base font-extrabold text-slate-950">{item.member.full_name}</div>
                        <div className="text-xs text-slate-500 mt-1">الفريق: {item.teamName}</div>
                      </div>
                      <span className={cls(
                        'shrink-0 px-2 py-1 rounded-full border text-xs font-bold',
                        variant === 'promotion'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      )}>
                        {variant === 'promotion' ? 'وعد' : 'Meilleur'}
                      </span>
                      {nextYearExclusions[item.member.id]?.exclude_from_next_year_stats && (
                        <span className="shrink-0 px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold">
                          خارج إحصائيات السنة القادمة
                        </span>
                      )}
                      {potentialFlags[item.member.id]?.is_potential && (
                        <span className="shrink-0 px-2 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 text-xs font-bold">
                          Potential
                        </span>
                      )}
                    </div>

                    {variant === 'promotion' ? (
                      <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-center">
                        <div className="text-xs text-emerald-700 font-semibold">وعد</div>
                        <div className="text-sm font-extrabold text-emerald-900 mt-1">
                          من {item.currentRankLabel} إلى {item.targetRankLabel}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-indigo-50 border border-indigo-100 px-3 py-2 text-center">
                        <div className="text-xs text-indigo-700 font-semibold">الرتبة الحالية</div>
                        <div className="text-sm font-extrabold text-indigo-900 mt-1">{item.currentRankLabel}</div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={cls('px-2 py-1 rounded-full', pctBadge(item.attendance.pct))}>
                        الحضور: {item.attendance.present} / {item.attendance.total} — {item.attendance.pct}%
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-50 border text-slate-700">
                        التقييم النهائي: {item.score != null ? `${item.score}%` : '—'}
                      </span>
                      {item.promoted && variant !== 'promotion' && (
                        <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">مرقّى أيضًا</span>
                      )}
                      {item.exceptional && variant !== 'exceptional' && (
                        <span className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">مميّز أيضًا</span>
                      )}
                    </div>

                    {isAdmin && (
                      <div className="space-y-2">
                        <label className="flex items-center justify-between gap-2 rounded-2xl border bg-amber-50/60 px-3 py-2 text-xs text-amber-800 cursor-pointer">
                          <span>استبعاد من إحصائيات السنة القادمة</span>
                          <input
                            type="checkbox"
                            checked={!!nextYearExclusions[item.member.id]?.exclude_from_next_year_stats}
                            disabled={savingNextYearFlagId === item.member.id}
                            onChange={() => toggleNextYearStatsExclusion(item.member.id)}
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2 rounded-2xl border bg-violet-50/70 px-3 py-2 text-xs text-violet-800 cursor-pointer">
                          <span>Potential</span>
                          <input
                            type="checkbox"
                            checked={!!potentialFlags[item.member.id]?.is_potential}
                            disabled={savingPotentialFlagId === item.member.id}
                            onChange={() => togglePotentialFlag(item.member.id)}
                          />
                        </label>
                      </div>
                    )}
                    <div className="text-end">
                      <button className="btn border" onClick={() => openModal(item.member.id)}>عرض / تعديل</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ===== UI =====
  return (
    <div className="p-6 space-y-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold">التقييم العام للقادة</h1>
        <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm text-slate-700">
          <span className="font-medium">السنة الحالية:</span>
          <span className="font-bold">{currentScoutYear?.name || String(seasonYearKey)}</span>
        </div>
      </div>

      {/* {currentScoutYear && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        </div>
      )} */}

      {/* Filters */}
      <div className="card">
        <div className="grid gap-2 items-end sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <div>
            <label className="text-sm">الفرق</label>
            <select className="border rounded-xl p-2 w-full" value={teamId} onChange={e=>setTeamId(e.target.value as any)}>
              {allowedTeamIds.length>1 && <option value="all">كل الفرق</option>}
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm">الرتبة</label>
            <select className="border rounded-xl p-2 w-full" value={String(rankId)} onChange={e=>setRankId(e.target.value==='all'?'all':Number(e.target.value))}>
              <option value="all">كل الرتب</option>
              {ranks.map(r => <option key={r.id} value={r.id}>{r.rank_label || '—'}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm">بحث</label>
            <input className="border rounded-xl p-2 w-full" placeholder="ابحث بالاسم أو الفريق" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <label className="inline-flex items-center gap-2 text-sm bg-gray-50 border rounded-xl px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={onlyPromoted} onChange={e=>setOnlyPromoted(e.target.checked)} /> وعد
          </label>
          <label className="inline-flex items-center gap-2 text-sm bg-gray-50 border rounded-xl px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={onlyExceptional} onChange={e=>setOnlyExceptional(e.target.checked)} />Meilleurs 
          </label>
          <label className="inline-flex items-center gap-2 text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 cursor-pointer" title="يعرض الأسماء التي ستدخل في تشكيل السنة القادمة فقط، ويخفي المستبعدين من كل رتبة">
            <input
              type="checkbox"
              checked={onlyNextYearIncluded}
              onChange={e=>{
                setOnlyNextYearIncluded(e.target.checked)
                if (e.target.checked) setOnlyExcludedFromStats(false)
              }}
            /> السنة القادمة
          </label>
          <label className="inline-flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 cursor-pointer" title="يعرض الأسماء المستبعدة فقط">
            <input
              type="checkbox"
              checked={onlyExcludedFromStats}
              onChange={e=>{
                setOnlyExcludedFromStats(e.target.checked)
                if (e.target.checked) setOnlyNextYearIncluded(false)
              }}
            /> المستبعدون
          </label>
          <label className="inline-flex items-center gap-2 text-sm bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={onlyPotential} onChange={e=>setOnlyPotential(e.target.checked)} /> Potential
          </label>
        </div>
      </div>

      {onlyNextYearIncluded && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          فلتر <b>السنة القادمة</b> مفعل: يتم عرض الأسماء غير المستبعدة فقط داخل كل رتبة/فريق، حتى تراجع التشكيل المتوقع للسنة القادمة بدون الأسماء المعلمة كمستبعدة.
        </div>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center justify-between gap-3 flex-wrap">
        <div>
          الإحصائيات مبنية على <b>الفريق المحدد</b> فقط، ولا تتأثر بفلاتر العرض مثل وعد/Meilleurs/Potential/بحث. يتم خصم الأسماء المعلّمة كـ <b>غير موجود السنة القادمة</b> من أرقام قبل/بعد الوعد.
        </div>
        <span className="px-3 py-1 rounded-full bg-white border border-amber-200 font-bold">
          المستبعدون من الإحصائيات: {excludedStatsCount}
        </span>
      </div>

      {/* ===== Rank stats as CARDS (before) ===== */}
      <div className="space-y-2">
        <div className="font-semibold">إحصائيات الرتب — قبل الوعد</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {countsBefore.map(rc => (
            <div key={`before-${rc.id}`} className="card text-center space-y-2">
              <div className="text-sm text-gray-600 mb-1">{rc.label}</div>
              <div className="text-xs text-slate-500">السيستم: <b>{rc.systemCount}</b></div>
              {isAdmin ? (
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">إضافي يدوي</label>
                  <input
                    type="number"
                    min={0}
                    className="border rounded-xl p-2 w-full text-center font-bold"
                    value={rankStatDrafts[rc.id] ?? ''}
                    onChange={e=>setRankStatDrafts(prev=>({...prev, [rc.id]: e.target.value.replace(/[^0-9]/g, '')}))}
                    placeholder="0"
                  />
                </div>
              ) : (
                <div className="text-xs text-slate-500">إضافي يدوي: <b>{rc.manualExtra}</b></div>
              )}
              <div className="rounded-2xl bg-slate-900 text-white py-2">
                <div className="text-xs opacity-80">الإجمالي</div>
                <div className="text-2xl font-extrabold">{rc.count}</div>
              </div>
            </div>
          ))}
          {countsBefore.every(x=>x.count===0) && <div className="card text-center text-gray-500 sm:col-span-2 lg:col-span-4">لا توجد نتائج</div>}
        </div>
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <LoadingButton loading={savingRankStatAdjustments} onClick={saveRankStatAdjustments}>حفظ الأرقام اليدوية للإحصائيات</LoadingButton>
        </div>
      )}

      {/* ===== Rank stats as CARDS (after) ===== */}
      <div className="space-y-2">
        <div className="font-semibold">إحصائيات الرتب — بعد الوعد </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {countsAfter.map(rc => (
            <div key={`after-${rc.id}`} className="card text-center space-y-2">
              <div className="text-sm text-gray-600 mb-1">{rc.label}</div>
              <div className="grid grid-cols-2 gap-1 text-xs text-slate-500">
                <div>قبل الوعد: <b>{rc.systemBefore}</b></div>
                <div>قادمين: <b className="text-emerald-700">+{rc.incoming}</b></div>
                <div>خارجين: <b className="text-rose-700">-{rc.outgoing}</b></div>
                <div>بعد الوعد: <b>{rc.systemCount}</b></div>
              </div>
              <div className="text-xs text-slate-500">إضافي يدوي: <b>{rc.manualExtra}</b></div>
              <div className="rounded-2xl bg-emerald-700 text-white py-2">
                <div className="text-xs opacity-80">الإجمالي</div>
                <div className="text-2xl font-extrabold">{rc.count}</div>
              </div>
            </div>
          ))}
          {countsAfter.every(x=>x.count===0) && <div className="card text-center text-gray-500 sm:col-span-2 lg:col-span-4">لا توجد نتائج</div>}
        </div>
      </div>

      {/* Cards / outcome grouped results */}
      {(onlyPromoted || onlyExceptional) ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            {/* يتم عرض نتائج الفلتر مجمعة حسب الرتبة والفريق: الترقية تظهر كمسار من الرتبة الحالية إلى الرتبة التالية، والتميّز يظهر منفصلًا حسب رتبة كل قائد. */}
          </div>
          {onlyPromoted && renderOutcomeSections(
            'وعد حسب الرتبة',
            teamId === 'all' ? 'كل الفرق — الأسماء مقسمة حسب مسار الوعد للرتبة الأعلى.' : `الفريق المحدد: ${teamMap[teamId as string] || teamId} — من ترقى داخل هذا الفريق.`,
            outcomeGroups.promotions,
            'promotion'
          )}
          {onlyExceptional && renderOutcomeSections(
            'Meilleur حسب الرتبة',
            teamId === 'all' ? 'كل الفرق — الأسماء المميزة مقسمة حسب الرتبة الحالية.' : `الفريق المحدد: ${teamMap[teamId as string] || teamId} — من حصل على تميّز داخل هذا الفريق.`,
            outcomeGroups.exceptional,
            'exceptional'
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => {
            const att = attendance[m.id] || { present:0,absent:0,total:0,pct:0 }
            const vs = votes[m.id] || []
            const promoted = booleanVoteStats(vs, 'promote').majority
            const exceptional = booleanVoteStats(vs, 'exceptional').majority
            return (
              <div key={m.id} className="card space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold">{m.full_name}</div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {promoted && <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs">تم الوعد</span>}
                    {exceptional && <span className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-300 text-indigo-700 text-xs">Meilleur</span>}
                    {nextYearExclusions[m.id]?.exclude_from_next_year_stats && <span className="px-2 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-700 text-xs">خارج إحصائيات السنة القادمة</span>}
                    {potentialFlags[m.id]?.is_potential && <span className="px-2 py-1 rounded-full bg-violet-50 border border-violet-300 text-violet-700 text-xs">Potential</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="px-2 py-1 rounded-full bg-gray-50 border">{rankMap[m.rank_id ?? 0] || '—'}</span>
                  <span className="px-2 py-1 rounded-full bg-gray-50 border">الفريق: {teamMap[m.team_id] || m.team_id}</span>
                  <span className={cls('px-2 py-1 rounded-full text-xs', pctBadge(att.pct))} title={`حاضر: ${att.present} — غياب: ${att.absent}`}>الحضور: {att.present} / {att.total} — {att.pct}%</span>
                </div>
                <div className="text-xs text-gray-600">التقييم النهائي: {evaluations[m.id]?.score != null ? `${evaluations[m.id]!.score}%` : '—'}</div>
                {isAdmin && (
                  <div className="space-y-2">
                    <label className="flex items-center justify-between gap-2 rounded-2xl border bg-amber-50/60 px-3 py-2 text-xs text-amber-800 cursor-pointer">
                      <span>غير موجود السنة القادمة / لا يدخل في الإحصائيات</span>
                      <input
                        type="checkbox"
                        checked={!!nextYearExclusions[m.id]?.exclude_from_next_year_stats}
                        disabled={savingNextYearFlagId === m.id}
                        onChange={() => toggleNextYearStatsExclusion(m.id)}
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-2xl border bg-violet-50/70 px-3 py-2 text-xs text-violet-800 cursor-pointer">
                      <span>Potential</span>
                      <input
                        type="checkbox"
                        checked={!!potentialFlags[m.id]?.is_potential}
                        disabled={savingPotentialFlagId === m.id}
                        onChange={() => togglePotentialFlag(m.id)}
                      />
                    </label>
                  </div>
                )}
                <div className="text-end">
                  <button className="btn border" onClick={()=>openModal(m.id)}>عرض / تعديل</button>
                </div>
              </div>
            )
          })}
          {filtered.length===0 && (
            <div className="p-6 text-center text-gray-500 border rounded-2xl bg-white md:col-span-2 lg:col-span-3">لا توجد نتائج لعرضها</div>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={!!activeId}
        onClose={closeModal}
        title={activeId ? members.find(x=>x.id===activeId)?.full_name : ''}
        footer={
          <div className="flex items-center gap-2">
            {isAdmin && <LoadingButton loading={saving} onClick={saveAdminVotes}>حفظ التصويت</LoadingButton>}
            <LoadingButton loading={saving} onClick={saveEvaluation}>حفظ التقييم النهائي</LoadingButton>
          </div>
        }
      >
        {activeId && (
          <div className="space-y-5">
            {modalDataLoading && (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
                جاري تحديث بيانات التقييم والتصويت لهذا الشخص...
              </div>
            )}
            {isAdmin && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <div className="font-semibold text-amber-900">غير موجود السنة القادمة</div>
                    <div className="text-xs text-amber-700 mt-1">
                      عند التفعيل، الاسم يظل موجودًا في التقييمات والتفاصيل، لكنه لا يدخل في إحصائيات الرتب قبل/بعد الوعد.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!nextYearExclusions[activeId]?.exclude_from_next_year_stats}
                    disabled={savingNextYearFlagId === activeId}
                    onChange={() => toggleNextYearStatsExclusion(activeId)}
                    className="h-5 w-5"
                  />
                </label>
              </div>
            )}
            {isAdmin && (
              <label className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-violet-800 cursor-pointer">
                <div>
                  <div className="font-semibold">Potential</div>
                  <div className="text-xs mt-1">علامة ترشيح/متابعة تظهر في الفلاتر والكروت فقط.</div>
                </div>
                <input
                  type="checkbox"
                  checked={!!potentialFlags[activeId]?.is_potential}
                  disabled={savingPotentialFlagId === activeId}
                  onChange={() => togglePotentialFlag(activeId)}
                  className="h-5 w-5"
                />
              </label>
            )}

            {!isAdmin && nextYearExclusions[activeId]?.exclude_from_next_year_stats && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 text-sm text-amber-800">
                هذا الاسم معلّم من الإدارة بأنه خارج إحصائيات السنة القادمة، لكنه يظل ظاهرًا للتقييم والمتابعة.
              </div>
            )}
            {!isAdmin && potentialFlags[activeId]?.is_potential && (
              <div className="border border-violet-200 bg-violet-50 rounded-xl p-3 text-sm text-violet-800">
                هذا الاسم معلّم من الإدارة كـ Potential.
              </div>
            )}

            {/* Final evaluation */}
            <div className="border rounded-xl p-3">
              <div className="font-semibold mb-2">التقييم النهائي للسنة {year}</div>
              <div className="grid sm:grid-cols-[1fr,200px] gap-3">
                <div>
                  <label className="text-sm">ملاحظات القائد</label>
                  <textarea className="border rounded-xl p-2 w-full min-h-[110px]" placeholder="اكتب التقييم النهائي..." value={reviewText} onChange={e=>setReviewText(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm">الدرجة النهائية</label>
                  <input type="number" className="border rounded-xl p-2 w-full" placeholder="0–100" value={score}
                    onChange={e=>{ const v=e.target.value; if (v===''||(/^\d{0,3}$/.test(v)&&Number(v)<=100)) setScore(v) }} />
                </div>
              </div>
            </div>

            {/* Term evaluation viewer (questions + answers from DB) */}
            <div className="border rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="font-semibold">تقييم الترم</div>
                <select className="border rounded-xl p-2 ml-2" value={termViewId} onChange={e=>setTermViewId(e.target.value)}>
                  {terms.map(t => <option key={t.id} value={t.id}>{t.year} — {t.name}</option>)}
                </select>
              </div>
              {termEval ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-sm">Positive note</label>
                      <textarea className="border rounded-xl p-2 w-full min-h-[90px]" value={termEval.positive_note || ''} readOnly />
                    </div>
                    <div>
                      <label className="text-sm">Negative note</label>
                      <textarea className="border rounded-xl p-2 w-full min-h-[90px]" value={termEval.negative_note || ''} readOnly />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm">خطة التطوير</label>
                      <textarea className="border rounded-xl p-2 w-full min-h-[80px]" value={termEval.development_plan || ''} readOnly />
                    </div>
                  </div>

                  {/* Q&A — Editable (نعم/لا + نسبة) */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold">أسئلة التقييم وإجابات القائد</div>
                      <LoadingButton loading={savingQA} onClick={saveTermQA}>حفظ الإجابات</LoadingButton>
                    </div>
                    <div className="rounded-2xl border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-sm table-auto">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-start">السؤال</th>
                              <th className="p-2 text-center w-[220px]">الإجابة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {termQuestions.map(q => {
                              const st = qaDraft[String(q.id)] || { yes: null, pct: null }
                              return (
                                <tr key={String(q.id)} className="border-t">
                                  <td className="p-2 align-top">{q.text}</td>
                                  <td className="p-2 text-center align-top">
                                    <div className="flex items-center justify-center gap-2">
                                      <div className="inline-flex gap-2">
                                        <TogglePill yes active={st.yes===true}  onClick={()=>setQaDraft(prev=>{ const curr = prev[String(q.id)] || { yes:null, pct:null }; return {...prev, [String(q.id)]: {...curr, yes: nextNullableChoice(curr.yes, true)}} })} />
                                        <TogglePill yes={false} active={st.yes===false} onClick={()=>setQaDraft(prev=>{ const curr = prev[String(q.id)] || { yes:null, pct:null }; return {...prev, [String(q.id)]: {...curr, yes: nextNullableChoice(curr.yes, false)}} })} />
                                      </div>
                                      <input
                                        type="number"
                                        className="border rounded-xl p-1 w-20 text-center"
                                        placeholder="%"
                                        value={st.pct ?? ''}
                                        onChange={e=>{
                                          const v = e.target.value
                                          const n = Number(v)
                                          if (v==='' || (!Number.isNaN(n) && n>=0 && n<=100)) {
                                            setQaDraft(prev=>({...prev, [String(q.id)]: {...(prev[String(q.id)]||{yes:null}), pct: v===''? null : n }}))
                                          }
                                        }}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                            {termQuestions.length===0 && <tr><td className="p-3 text-center text-gray-500" colSpan={2}>لا توجد أسئلة</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2 flex-wrap text-sm">
                    <span className="px-2 py-1 rounded-full bg-white border text-xs">حضور تلقائي: {termEval.auto_present_count ?? 0}</span>
                    <span className="px-2 py-1 rounded-full bg-white border text-xs">غياب تلقائي: {termEval.auto_absent_count ?? 0}</span>
                    <span className="px-2 py-1 rounded-full bg-white border text-xs">آخر تحديث: {termEval.updated_at ? new Date(termEval.updated_at).toLocaleString() : '—'}</span>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">لا يوجد تقييم لهذا الترم.</div>
              )}
            </div>

            {/* Attendance summary */}
            <div className="border rounded-xl p-3 text-sm">
              <div className="font-semibold mb-2">الحضور ({currentScoutYear?.name || `السنة ${seasonYearKey}`})</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-1 rounded-full bg-white border text-xs">المجموع: {attendance[activeId]?.total ?? 0}</span>
                <span className="px-2 py-1 rounded-full bg-white border text-xs">حضر: {attendance[activeId]?.present ?? 0}</span>
                <span className="px-2 py-1 rounded-full bg-white border text-xs">غاب: {attendance[activeId]?.absent ?? 0}</span>
                <span className={cls('px-2 py-1 rounded-full text-xs', pctBadge(attendance[activeId]?.pct ?? 0))}>النسبة: {attendance[activeId]?.pct ?? 0}%</span>
                {attendance[activeId]?.source === 'manual' && (
                  <span className="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs">تعديل يدوي محفوظ</span>
                )}
              </div>

              <div className="mt-3 rounded-2xl border bg-slate-50 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-semibold">تعديل يدوي للحضور</div>
                    {/* <div className="text-xs text-slate-500 mt-1">
                      لو سبتها فاضية يستخدم الحساب التلقائي من قاعدة البيانات. لو حفظت أرقام هنا، هيتم استخدامها بدل الحساب التلقائي.
                    </div> */}
                  </div>
                  <div className="text-xs text-slate-600">
                    التلقائي: {calculatedAttendance[activeId]?.present ?? 0} / {calculatedAttendance[activeId]?.total ?? 0} — {calculatedAttendance[activeId]?.pct ?? 0}%
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr,1fr,auto,auto]">
                  <div>
                    <label className="text-xs text-slate-600">حضر</label>
                    <input
                      type="number"
                      min={0}
                      className="border rounded-xl p-2 w-full text-center font-bold"
                      value={manualPresent}
                      onChange={e=>setManualPresent(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder={String(calculatedAttendance[activeId]?.present ?? 0)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">من إجمالي</label>
                    <input
                      type="number"
                      min={0}
                      className="border rounded-xl p-2 w-full text-center font-bold"
                      value={manualTotal}
                      onChange={e=>setManualTotal(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder={String(calculatedAttendance[activeId]?.total ?? 0)}
                    />
                  </div>
                  <div className="flex items-end">
                    <LoadingButton loading={savingAttendanceOverride} onClick={saveAttendanceOverride}>حفظ الحضور</LoadingButton>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="btn border"
                      disabled={savingAttendanceOverride || !attendanceOverrides[activeId]}
                      onClick={clearAttendanceOverride}
                    >
                      إلغاء اليدوي
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Votes */}
            {isAdmin ? (
              <div className="border rounded-xl p-3">
                <div className="font-semibold mb-3">التصويت (بالأسماء) — وعد / Meilleur</div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-start">القائد</th>
                        <th className="p-2 text-center">وعد</th>
                        <th className="p-2 text-center">Meilleur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {voters.map(v => {
                        const st = adminVotesDraft[v.user_id] || { promote:null, exceptional:null }
                        return (
                          <tr key={v.user_id} className="border-t">
                            <td className="p-2">{v.name}</td>
                            <td className="p-2 text-center">
                              <div className="inline-flex gap-2">
                                <TogglePill yes active={st.promote===true}  onClick={()=>setAdminVotesDraft(p=>({...p, [v.user_id]:{...st, promote: nextNullableChoice(st.promote, true)}}))} />
                                <TogglePill yes={false} active={st.promote===false} onClick={()=>setAdminVotesDraft(p=>({...p, [v.user_id]:{...st, promote: nextNullableChoice(st.promote, false)}}))} />
                              </div>
                            </td>
                            <td className="p-2 text-center">
                              <div className="inline-flex gap-2">
                                <TogglePill yes active={st.exceptional===true}  onClick={()=>setAdminVotesDraft(p=>({...p, [v.user_id]:{...st, exceptional: nextNullableChoice(st.exceptional, true)}}))} />
                                <TogglePill yes={false} active={st.exceptional===false} onClick={()=>setAdminVotesDraft(p=>({...p, [v.user_id]:{...st, exceptional: nextNullableChoice(st.exceptional, false)}}))} />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {voters.length===0 && <tr><td className="p-3 text-center text-gray-500" colSpan={3}>لا يوجد قادة للتصويت</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function ChefsEvaluationOverview() {
  return <ChefsEvaluationOverviewContent />
}
