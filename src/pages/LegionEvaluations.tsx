import { useEffect, useMemo, useState } from 'react'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/PageLoader'
import { useToast } from '../components/ui/Toaster'
import { LoadingButton } from '../components/ui/LoadingButton'
import { fetchCurrentUserChefTeamIds, fetchCurrentUserContext, fetchTerms } from '../features/reference/api'
import { InlineAlert } from '../components/ui/InlineAlert'
import { useScoutYear } from '../components/ScoutYearProvider'
import { TermVoiceNotes } from '../features/evaluations/TermVoiceNotes'
import { SHOW_EVALUATION_QUESTIONS } from '../features/evaluations/config'

type Term = { id: string; name: string; year: number; start_date: string | null; end_date: string | null }
type Member = { id: string; full_name: string; rank_slug?: string | null; rank_label?: string | null }
type Question = { id: number; question_text: string; weight: number }

type AnsCell = { answer: boolean | null; weight: number }   // وزن قابل للتحرير لكل سؤال
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

export default function LegionEvaluations() {
  const toast = useToast()
  const { currentScoutYear } = useScoutYear()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [termId, setTermId] = useState<string>('')
  const [terms, setTerms] = useState<Term[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [evaluationStatus, setEvaluationStatus] = useState<Record<string, EvaluationStatus>>({})
  const [questions, setQuestions] = useState<Question[]>([])

  const [openId, setOpenId] = useState<string | null>(null)
  const [evalId, setEvalId] = useState<string | null>(null)

  const [present, setPresent] = useState<number>(0)
  const [absent, setAbsent] = useState<number>(0)
  const [positive, setPositive] = useState<string>('')
  const [negative, setNegative] = useState<string>('')
  const [plan, setPlan] = useState<string>('')

  const [ansMap, setAnsMap] = useState<Record<number, AnsCell>>({}) // qid -> {answer, weight}
  const [teamId, setTeamId] = useState<string>('')

  const currentTerm = useMemo(() => terms.find(t => t.id === termId) || null, [terms, termId])
  const presentPct = useMemo(() => {
    const total = present + absent
    return total > 0 ? Math.round((present / total) * 100) : 0
  }, [present, absent])
  const selectedMember = useMemo(() => members.find((m) => m.id === openId) || null, [members, openId])

  useEffect(() => { init() }, [])
  async function init() {
    setLoading(true)
    try {
      const [t, { data: qs, error: qe }] = await Promise.all([
        fetchTerms(),
        supabase.from('evaluation_questions').select('id,question_text,weight').eq('active', true).order('id')
      ])
      if (qe) throw qe
      setTerms(t)
      if (t.length) setTermId(t[0].id)
      setQuestions((qs as any) ?? [])

      // team for this chef
      let tId: string | null = null
      const me = await fetchCurrentUserContext()
      if (me?.team_id) tId = me.team_id
      if (!tId) {
        const chefTeams = await fetchCurrentUserChefTeamIds()
        if (chefTeams.length) tId = chefTeams[0] || null
      }
      if (!tId) throw new Error('لا يوجد فريق مرتبط بحسابك كـ Chef de legion')

      setTeamId(tId)
      await loadMembers(tId)
    } catch (e:any) {
      toast.error(e.message || 'تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }

  async function loadMembers(teamId: string) {
    try {
      const { data, error } = await scoutYearFrom('v_members_current', 'v_members_context')
        .select('id, full_name, rank_slug, rank_label')
        .eq('team_id', teamId)
        .eq('is_equipier', false)
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error

      // استبعد قائد الفيلق نفسه
      const filtered = (data as any[] ?? []).filter(m => m.rank_slug !== 'chef_de_legion')
      setMembers(filtered as any)
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل الأعضاء')
    }
  }

  function resetForm() {
    setEvalId(null)
    setPresent(0)
    setAbsent(0)
    setPositive('')
    setNegative('')
    setPlan('')
    // عبّي ansMap بوزن السؤال الافتراضي مبدئيًا
    const seed: Record<number, AnsCell> = {}
    questions.forEach(q => { seed[q.id] = { answer: null, weight: q.weight } })
    setAnsMap(seed)
  }

  useEffect(() => {
    if (members.length && termId) void loadEvaluationStatus()
    else setEvaluationStatus({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, termId])

  useEffect(() => {
    if (openId) openEditor(openId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId])

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
      console.warn('evaluation status load failed:', e?.message || e)
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
      console.warn('voice evaluation status load failed:', e?.message || e)
    }

    setEvaluationStatus(next)
  }

  function updateMemberEvaluationStatus(memberId: string, patch: Partial<EvaluationStatus>) {
    setEvaluationStatus((prev) => ({
      ...prev,
      [memberId]: { ...(prev[memberId] || emptyStatus()), ...patch },
    }))
  }

  async function openEditor(memberId: string) {
    resetForm()
    setOpenId(memberId)
    try {
      // تقييم سابق إن وجد
      const { data: ev, error: ee } = await supabase
        .from('evaluations')
        .select('id, auto_present_count, auto_absent_count, positive_note, negative_note, development_plan, evaluation_answers(question_id, answer, weight_percent)')
        .eq('evaluatee_member_id', memberId)
        .eq('term_id', termId)
        .maybeSingle()
      if (ee) throw ee

      // اجابات/أوزان
      const next: Record<number, AnsCell> = {}
      questions.forEach(q => next[q.id] = { answer: null, weight: q.weight })

      if (ev) {
        setEvalId(ev.id)
        setPositive(ev.positive_note ?? '')
        setNegative(ev.negative_note ?? '')
        setPlan(ev.development_plan ?? '')
        ;(ev.evaluation_answers ?? []).forEach((a:any) => {
          next[a.question_id] = {
            answer: a.answer ?? null,
            weight: (typeof a.weight_percent === 'number') ? a.weight_percent : (questions.find(q => q.id === a.question_id)?.weight ?? 0)
          }
        })
      }
      setAnsMap(next)

      // احسب حضور/غياب الترم من attendance
      if (!currentTerm?.start_date || !currentTerm?.end_date) {
        setPresent(0); setAbsent(0)
      } else {
        const { data: attRows, error: attErr } = await supabase
          .from('attendance')
          .select('is_present, meetings!inner(meeting_date, team_id)')
          .eq('member_id', memberId)
          .eq('meetings.team_id', teamId)
          .gte('meetings.meeting_date', currentTerm.start_date)
          .lte('meetings.meeting_date', currentTerm.end_date)
        if (attErr) throw attErr

        let p = 0, a = 0
        ;(attRows as any[] ?? []).forEach(r => { if (r.is_present) p++; else a++; })
        setPresent(p); setAbsent(a)
      }
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل التقييم')
    }
  }

  async function save(memberId: string) {
    if (!termId) return toast.error('اختر الترم')

    setSaving(true)
    try {
      const up = {
        evaluatee_member_id: memberId,
        evaluator_user_id: (await supabase.auth.getUser()).data.user?.id,
        team_id: teamId,
        term_id: termId,
        positive_note: positive || null,
        negative_note: negative || null,
        development_plan: plan || null
      }
      const { data: evalRow, error: e1 } = await supabase
        .from('evaluations')
        .upsert(up, { onConflict: 'evaluatee_member_id,term_id' })
        .select('id').maybeSingle()
      if (e1) throw e1

      const eid = evalRow?.id
      if (!eid) throw new Error('تعذر تحديد التقييم')

      if (SHOW_EVALUATION_QUESTIONS) {
        const rows = Object.entries(ansMap).map(([qid, cell]) => ({
          evaluation_id: eid,
          question_id: Number(qid),
          answer: cell.answer === true,           // default false لو null
          weight_percent: Number(cell.weight) || 0
        }))

        if (rows.length) {
          const { error: e2 } = await supabase
            .from('evaluation_answers')
            .upsert(rows, { onConflict: 'evaluation_id,question_id' })
          if (e2) throw e2
        }
      }

      // ✅ بدون .catch — تعامل مع الخطأ بالأسلوب القياسي
      const { error: rpcErr } = await supabase.rpc('recompute_eval_presence', { p_evaluation_id: eid })
      if (rpcErr) {
        // مش هنفشل الحفظ بسببها — بس نكتب تحذير
        console.warn('recompute_eval_presence failed:', rpcErr.message)
      }

      updateMemberEvaluationStatus(memberId, {
        hasPositive: hasText(positive),
        hasNegative: hasText(negative),
      })
      toast.success('تم الحفظ')
      setOpenId(null)
    } catch (e:any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <h1 className="text-xl font-bold">التقييمات — (Chef de legion)</h1>

      {currentScoutYear && (
        <InlineAlert tone="info" title="السنة الكشفية الحالية">
          يتم عرض الترمات والتقييمات الخاصة بالسنة الحالية فقط: {currentScoutYear.name}
        </InlineAlert>
      )}

      <div className="grid md:grid-cols-3 gap-2 items-end">
        <div>
          <label className="text-sm">الترم</label>
          <select className="border rounded-xl p-2 w-full cursor-pointer" value={termId} onChange={e=>setTermId(e.target.value)}>
            {terms.map(t => <option key={t.id} value={t.id}>{t.year} — {t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-start">الاسم</th>
              <th className="p-2 text-start">الرتبة</th>
              <th className="p-2 text-center">الحالة</th>
              <th className="p-2 text-center">تقييم</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => {
              const status = evaluationStatus[m.id]
              const done = isEvaluated(status)
              return (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{m.full_name}</td>
                  <td className="p-2">{m.rank_label || '—'}</td>
                  <td className="p-2 text-center">
                    {done ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" title="ظهر لأن لديه ملاحظات إيجابية/سلبية أو Voice Note محفوظة">
                        ✅ تم التقييم
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <button className="btn border" onClick={()=>openEditor(m.id)}>فتح</button>
                  </td>
                </tr>
              )
            })}
            {members.length === 0 && <tr><td className="p-3 text-center text-gray-500" colSpan={4}>لا توجد بيانات</td></tr>}
          </tbody>
        </table>
      </div>

      {openId && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[min(900px,95vw)] max-h-[90vh] overflow-auto p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-500">يتم تقييم</div>
                <h2 className="truncate text-xl font-black text-slate-950">{selectedMember?.full_name || 'العضو المحدد'}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                  <span>نموذج التقييم</span>
                  <span>•</span>
                  <span>{selectedMember?.rank_label || 'بدون رتبة محددة'}</span>
                </div>
              </div>
              <button className="btn" onClick={()=>setOpenId(null)}>إغلاق</button>
            </div>

            {/* ملخص حضور/غياب الترم */}
            <div className="grid md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border bg-gray-50">
                <div className="text-xs text-gray-600">الحضور في الترم</div>
                <div className="text-xl font-bold">{present}</div>
              </div>
              <div className="p-3 rounded-xl border bg-gray-50">
                <div className="text-xs text-gray-600">الغياب في الترم</div>
                <div className="text-xl font-bold">{absent}</div>
              </div>
              <div className="p-3 rounded-xl border bg-gray-50">
                <div className="text-xs text-gray-600 mb-1">نسبة الحضور</div>
                <div className="text-xl font-bold">{presentPct}%</div>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{width: `${presentPct}%`}} />
                </div>
              </div>
            </div>

            {/* الملاحظات */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm">ملاحظات إيجابية</label>
                <textarea className="border rounded-xl p-2 w-full" rows={3} value={positive} onChange={e=>setPositive(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">ملاحظات سلبية</label>
                <textarea className="border rounded-xl p-2 w-full" rows={3} value={negative} onChange={e=>setNegative(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm">خطة التطوير</label>
                <textarea className="border rounded-xl p-2 w-full" rows={3} value={plan} onChange={e=>setPlan(e.target.value)} />
              </div>
            </div>

            <TermVoiceNotes
              evaluateeMemberId={openId!}
              termId={termId}
              teamId={teamId}
              canManage={true}
              onNotesChanged={(count) => updateMemberEvaluationStatus(openId!, { voiceCount: count })}
            />

            {SHOW_EVALUATION_QUESTIONS && (
              <div className="space-y-2">
                <div className="text-sm font-semibold">الأسئلة</div>
                <div className="border rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-start">السؤال</th>
                        <th className="p-2 text-center w-28">الوزن %</th>
                        <th className="p-2 text-center">نعم</th>
                        <th className="p-2 text-center">لا</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map(q => {
                        const cell = ansMap[q.id] || { answer: null, weight: q.weight }
                        return (
                          <tr key={q.id} className="border-t">
                            <td className="p-2">{q.question_text}</td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min={0} max={100}
                                className="border rounded-lg p-1 w-20 text-center"
                                value={cell.weight}
                                onChange={(e)=> {
                                  const v = Math.max(0, Math.min(100, Number(e.target.value)||0))
                                  setAnsMap(prev => ({ ...prev, [q.id]: { ...prev[q.id], answer: cell.answer, weight: v }}))
                                }}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="radio"
                                name={`q${q.id}`}
                                checked={cell.answer === true}
                                onChange={()=>setAnsMap(prev => ({ ...prev, [q.id]: { ...prev[q.id], answer: true }}))}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="radio"
                                name={`q${q.id}`}
                                checked={cell.answer === false}
                                onChange={()=>setAnsMap(prev => ({ ...prev, [q.id]: { ...prev[q.id], answer: false }}))}
                              />
                            </td>
                          </tr>
                        )
                      })}
                      {questions.length === 0 && <tr><td className="p-3 text-center text-gray-500" colSpan={4}>لا توجد أسئلة</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">الحضور: {present} — الغياب: {absent} — نسبة الحضور: {presentPct}%</div>
              <LoadingButton loading={saving} onClick={()=>save(openId!)}>حفظ</LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
