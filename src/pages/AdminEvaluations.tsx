import { useEffect, useState } from 'react'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/PageLoader'
import { useToast } from '../components/ui/Toaster'
import { LoadingButton } from '../components/ui/LoadingButton'
import { EmptyState } from '../components/ui/EmptyState'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { InlineAlert } from '../components/ui/InlineAlert'
import { fetchTerms } from '../features/reference/api'
import { useScoutYear } from '../components/ScoutYearProvider'
import { TermVoiceNotes } from '../features/evaluations/TermVoiceNotes'
import { SHOW_EVALUATION_QUESTIONS } from '../features/evaluations/config'

type Team = { id: string; name: string }
type Rank = { id: number; rank_slug: string; rank_label: string }
type Term = { id: string; name: string; year: number; start_date?: string | null; end_date?: string | null }
type Member = { id: string; full_name: string; team_id: string; team_name?: string | null; rank_slug?: string | null; rank_label?: string | null }
type Question = { id: number; question_text: string; weight: number }
type EvaluationStatus = { hasPositive: boolean; hasNegative: boolean; voiceCount: number }

function hasText(value?: string | null) {
  return Boolean((value || '').trim())
}

function isEvaluated(status?: EvaluationStatus) {
  return Boolean(status && (status.hasPositive || status.hasNegative || status.voiceCount > 0))
}

function emptyStatus(): EvaluationStatus {
  return { hasPositive: false, hasNegative: false, voiceCount: 0 }
}

export default function AdminEvaluations() {
  const toast = useToast()
  const { currentScoutYear } = useScoutYear()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [terms, setTerms] = useState<Term[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [ranks, setRanks] = useState<Rank[]>([])

  const [termId, setTermId] = useState<string>('')
  const [teamId, setTeamId] = useState<string>('all')
  const [rankSlug, setRankSlug] = useState<string>('all')

  const [members, setMembers] = useState<Member[]>([])
  const [evaluationStatus, setEvaluationStatus] = useState<Record<string, EvaluationStatus>>({})

  const [openId, setOpenId] = useState<string | null>(null)
  const [evalId, setEvalId] = useState<string | null>(null)
  const [present, setPresent] = useState<number>(0)
  const [absent, setAbsent] = useState<number>(0)
  const [positive, setPositive] = useState<string>('')
  const [negative, setNegative] = useState<string>('')
  const [plan, setPlan] = useState<string>('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, boolean>>({})

  useEffect(() => {
    void init()
  }, [])

  async function init() {
    setLoading(true)
    try {
      const [ts, { data: tms, error: tme }, { data: rk, error: rke }, { data: qs, error: qse }] = await Promise.all([
        fetchTerms(),
        supabase.from('teams').select('id,name').order('name'),
        supabase.from('ranks').select('id,rank_slug,rank_label').order('id'),
        supabase.from('evaluation_questions').select('id,question_text,weight').eq('active', true).order('id'),
      ])
      if (tme) throw tme
      if (rke) throw rke
      if (qse) throw qse
      setTerms(ts)
      setTeams((tms as any) ?? [])
      setRanks((rk as any) ?? [])
      setQuestions((qs as any) ?? [])
      if (ts.length) setTermId(ts[0].id)
    } catch (e: any) {
      toast.error(e.message || 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (termId) void loadMembers()
  }, [termId, teamId, rankSlug])

  async function loadMembers() {
    try {
      let q = scoutYearFrom('v_members_current', 'v_members_context')
        .select('id,full_name,team_id, team_name, rank_slug, rank_label')
        .eq('is_equipier', false)
        .eq('is_active', true)
        .order('full_name') as any
      if (teamId !== 'all') q = q.eq('team_id', teamId)
      if (rankSlug !== 'all') q = q.eq('rank_slug', rankSlug)
      const { data, error } = await q
      if (error) throw error
      setMembers((data as any) ?? [])
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحميل الأعضاء')
    }
  }

  useEffect(() => {
    if (members.length && termId) void loadEvaluationStatus()
    else setEvaluationStatus({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, termId])

  async function loadEvaluationStatus(memberIds = members.map((m) => m.id)) {
    if (!termId || memberIds.length === 0) {
      setEvaluationStatus({})
      return
    }

    const next: Record<string, EvaluationStatus> = {}
    memberIds.forEach((id) => { next[id] = emptyStatus() })

    try {
      const { data: evalRows, error: evalError } = await supabase
        .from('evaluations')
        .select('evaluatee_member_id, positive_note, negative_note')
        .eq('term_id', termId)
        .in('evaluatee_member_id', memberIds as any)
      if (evalError) throw evalError

      ;((evalRows as any[]) || []).forEach((row) => {
        const id = row.evaluatee_member_id as string
        next[id] = {
          ...(next[id] || emptyStatus()),
          hasPositive: hasText(row.positive_note),
          hasNegative: hasText(row.negative_note),
        }
      })
    } catch (e: any) {
      console.warn('admin evaluation status load failed:', e?.message || e)
    }

    try {
      const { data: voiceRows, error: voiceError } = await supabase
        .from('evaluation_voice_notes')
        .select('evaluatee_member_id')
        .eq('term_id', termId)
        .in('evaluatee_member_id', memberIds as any)
        .is('soft_deleted_at', null)
      if (voiceError) throw voiceError

      ;((voiceRows as any[]) || []).forEach((row) => {
        const id = row.evaluatee_member_id as string
        next[id] = {
          ...(next[id] || emptyStatus()),
          voiceCount: (next[id]?.voiceCount || 0) + 1,
        }
      })
    } catch (e: any) {
      console.warn('admin voice evaluation status load failed:', e?.message || e)
    }

    setEvaluationStatus(next)
  }

  function updateMemberEvaluationStatus(memberId: string, patch: Partial<EvaluationStatus>) {
    setEvaluationStatus((prev) => ({
      ...prev,
      [memberId]: { ...(prev[memberId] || emptyStatus()), ...patch },
    }))
  }

  function resetForm() {
    setEvalId(null)
    setPresent(0)
    setAbsent(0)
    setPositive('')
    setNegative('')
    setPlan('')
    setAnswers({})
  }

  async function openEditor(member: Member) {
    resetForm()
    setOpenId(member.id)
    try {
      const { data: ev, error: ee } = await supabase
        .from('evaluations')
        .select('id, auto_present_count, auto_absent_count, positive_note, negative_note, development_plan, evaluation_answers(question_id, answer)')
        .eq('evaluatee_member_id', member.id)
        .eq('term_id', termId)
        .maybeSingle()
      if (ee) throw ee
      if (ev) {
        setEvalId(ev.id)
        setPresent(ev.auto_present_count ?? 0)
        setAbsent(ev.auto_absent_count ?? 0)
        setPositive(ev.positive_note ?? '')
        setNegative(ev.negative_note ?? '')
        setPlan(ev.development_plan ?? '')
        const map: Record<number, boolean> = {}
        ;(ev.evaluation_answers ?? []).forEach((a: any) => {
          map[a.question_id] = !!a.answer
        })
        setAnswers(map)
      }
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحميل التقييم')
    }
  }

  async function save(member: Member) {
    if (!termId) return toast.error('اختر الترم')
    setSaving(true)
    try {
      const up = {
        evaluatee_member_id: member.id,
        evaluator_user_id: (await supabase.auth.getUser()).data.user?.id,
        team_id: member.team_id,
        term_id: termId,
        positive_note: positive || null,
        negative_note: negative || null,
        development_plan: plan || null,
      }
      const { data: evalRow, error: e1 } = await supabase
        .from('evaluations')
        .upsert(up, { onConflict: 'evaluatee_member_id,term_id' })
        .select('id')
        .maybeSingle()
      if (e1) throw e1

      const eid = evalRow?.id
      if (!eid) throw new Error('تعذر تحديد التقييم')
      setEvalId(eid)

      if (SHOW_EVALUATION_QUESTIONS) {
        const rows = Object.entries(answers).map(([qid, ans]) => ({ evaluation_id: eid, question_id: Number(qid), answer: !!ans }))
        if (rows.length) {
          const { error: e2 } = await supabase.from('evaluation_answers').upsert(rows, { onConflict: 'evaluation_id,question_id' })
          if (e2) throw e2
        }
      }

      await supabase.rpc('recompute_eval_presence', { p_evaluation_id: eid })
      updateMemberEvaluationStatus(member.id, {
        hasPositive: hasText(positive),
        hasNegative: hasText(negative),
      })
      toast.success('تم الحفظ')
      setOpenId(null)
    } catch (e: any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const selectedMember = openId ? members.find((m) => m.id === openId) || null : null

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        eyebrow="إدارة التقييمات"
        title="فتح وتحديث تقييمات القادة"
        description={`اختر الترم والفريق والرتبة، ثم افتح نموذج التقييم وراجع ملاحظات التطوير داخل السنة الكشفية الحالية${currentScoutYear ? ` (${currentScoutYear.name})` : ''} بشكل أوضح من نفس الصفحة.`}
      />

      {currentScoutYear && (
        <InlineAlert tone="info" title="السنة الكشفية الحالية">
          يتم عرض ترمات وأعضاء السنة الحالية فقط: {currentScoutYear.name}
        </InlineAlert>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="عدد الترمات" value={terms.length} accent="indigo" />
        <MetricCard label="عدد الفرق" value={teams.length} accent="sky" />
        <MetricCard label="الأعضاء الظاهرون" value={members.length} accent="emerald" />
      </div>

      <SectionCard title="نطاق التقييم" description="حدد الترم والفريق والرتبة ثم افتح التقييم المطلوب من الجدول بالأسفل.">
        <div className="grid gap-3 md:grid-cols-3 md:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الترم</label>
            <select className="w-full rounded-2xl border border-slate-300 px-3 py-2 cursor-pointer" value={termId} onChange={(e) => setTermId(e.target.value)}>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.year} — {t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الفريق</label>
            <select className="w-full rounded-2xl border border-slate-300 px-3 py-2 cursor-pointer" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="all">كل الفرق</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الرتبة</label>
            <select className="w-full rounded-2xl border border-slate-300 px-3 py-2 cursor-pointer" value={rankSlug} onChange={(e) => setRankSlug(e.target.value)}>
              <option value="all">الكل</option>
              {ranks.map((r) => <option key={r.id} value={r.rank_slug}>{r.rank_label}</option>)}
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="قائمة الأعضاء">
        {members.length === 0 ? (
          <EmptyState title="لا توجد بيانات" description="جرّب تغيير الفلاتر أو إضافة أعضاء مناسبين لهذا الترم والرتبة." />
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/80 text-slate-700">
                <tr>
                  <th className="p-3 text-start">الاسم</th>
                  <th className="p-3 text-start">الفريق</th>
                  <th className="p-3 text-start">الرتبة</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">تقييم</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const status = evaluationStatus[m.id]
                  const done = isEvaluated(status)
                  return (
                    <tr key={m.id} className="border-t border-slate-200 bg-white">
                      <td className="p-3 font-semibold text-slate-800">{m.full_name}</td>
                      <td className="p-3 text-slate-600">{m.team_name || '—'}</td>
                      <td className="p-3 text-slate-600">{m.rank_label || '—'}</td>
                      <td className="p-3 text-center">
                        {done ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" title="ظهر لأن لديه ملاحظات إيجابية/سلبية أو Voice Note محفوظة">
                            ✅ تم التقييم
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button className="btn border" onClick={() => openEditor(m)}>فتح</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {openId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-3">
          <div className="max-h-[90vh] w-[min(900px,95vw)] overflow-auto rounded-3xl bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-500">يتم تقييم</div>
                <h2 className="truncate text-xl font-black text-slate-950">{selectedMember?.full_name || 'العضو المحدد'}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>نموذج التقييم</span>
                  <span>•</span>
                  <span>{selectedMember?.team_name || 'بدون فريق محدد'}</span>
                  <span>•</span>
                  <span>{selectedMember?.rank_label || 'بدون رتبة محددة'}</span>
                </div>
              </div>
              <button className="btn" onClick={() => setOpenId(null)}>إغلاق</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">ملاحظات إيجابية</label>
                <textarea className="w-full rounded-2xl border border-slate-300 px-3 py-2" rows={3} value={positive} onChange={(e) => setPositive(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">ملاحظات سلبية</label>
                <textarea className="w-full rounded-2xl border border-slate-300 px-3 py-2" rows={3} value={negative} onChange={(e) => setNegative(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">خطة التطوير</label>
                <textarea className="w-full rounded-2xl border border-slate-300 px-3 py-2" rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} />
              </div>
            </div>

            {openId && members.find((m) => m.id === openId) && (
              <TermVoiceNotes
                evaluateeMemberId={openId}
                termId={termId}
                teamId={members.find((m) => m.id === openId)!.team_id}
                canManage={true}
                onNotesChanged={(count) => updateMemberEvaluationStatus(openId, { voiceCount: count })}
              />
            )}

            {SHOW_EVALUATION_QUESTIONS && (
              <SectionCard title="الأسئلة" tone="subtle">
              {questions.length === 0 ? (
                <EmptyState title="لا توجد أسئلة تفعيلًا" description="فعّل أسئلة التقييم أولًا من صفحة إدارة الأسئلة حتى تظهر هنا." />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="p-3 text-start">السؤال</th>
                        <th className="p-3 text-center">نعم</th>
                        <th className="p-3 text-center">لا</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q) => (
                        <tr key={q.id} className="border-t border-slate-200 bg-white">
                          <td className="p-3 text-slate-700">{q.question_text}</td>
                          <td className="p-3 text-center"><input type="radio" name={`q${q.id}`} checked={answers[q.id] === true} onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: true }))} /></td>
                          <td className="p-3 text-center"><input type="radio" name={`q${q.id}`} checked={answers[q.id] === false} onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: false }))} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              </SectionCard>
            )}

            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <div>الحضور: {present} — الغياب: {absent} {evalId ? `• رقم التقييم: ${evalId}` : ''}</div>
              <LoadingButton loading={saving} onClick={() => save(members.find((m) => m.id === openId)!)}>حفظ</LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
