import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { LoadingButton } from '../../components/ui/LoadingButton'
import { InlineAlert } from '../../components/ui/InlineAlert'
import { useToast } from '../../components/ui/Toaster'

const VOICE_BUCKET = 'evaluation-voice-notes'
const MAX_VOICE_NOTES = 2
const MAX_DURATION_SECONDS = 180

export type TermVoiceNote = {
  id: string
  evaluatee_member_id: string
  term_id: string
  team_id: string
  storage_path: string
  mime_type: string | null
  duration_seconds: number | null
  file_size_bytes: number | null
  evaluator_user_id: string
  evaluator_member_id: string | null
  evaluator_display_name: string | null
  created_at: string
}

type CurrentEvaluator = {
  memberId: string | null
  displayName: string
}

type VoiceNoteWithUrl = TermVoiceNote & { signedUrl: string | null }

type Props = {
  evaluateeMemberId: string
  termId: string
  teamId: string
  canManage: boolean
  compact?: boolean
  onNotesChanged?: (count: number) => void
}

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0))
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0')
  const seconds = (safe % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function readableDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function audioExtension(mimeType: string) {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mpeg')) return 'mp3'
  return 'webm'
}

async function fetchEvaluatorIdentity(): Promise<CurrentEvaluator> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  const userId = userData.user?.id
  if (!userId) throw new Error('لم يتم تحديد المستخدم الحالي')

  const { data: memberRow, error: memberError } = await supabase
    .from('v_members_current')
    .select('id,full_name')
    .eq('auth_user_id', userId)
    .maybeSingle()

  if (memberError) throw memberError

  return {
    memberId: (memberRow as any)?.id ?? null,
    displayName: ((memberRow as any)?.full_name as string | undefined) || userData.user.email || 'مستخدم غير محدد',
  }
}

export function TermVoiceNotes({ evaluateeMemberId, termId, teamId, canManage, compact = false, onNotesChanged }: Props) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [notes, setNotes] = useState<VoiceNoteWithUrl[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [pendingDurationSeconds, setPendingDurationSeconds] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startedAtRef = useRef<number>(0)
  const intervalRef = useRef<number | null>(null)
  const autoStopRef = useRef<number | null>(null)

  const remainingCount = Math.max(0, MAX_VOICE_NOTES - notes.length)
  const canAddMore = canManage && notes.length < MAX_VOICE_NOTES
  const usageText = useMemo(() => `${notes.length} / ${MAX_VOICE_NOTES}`, [notes.length])

  useEffect(() => {
    void loadNotes()
    return () => cleanupRecorder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluateeMemberId, termId, teamId])

  function cleanupRecorder() {
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current)
    intervalRef.current = null
    autoStopRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }

  async function loadNotes() {
    if (!evaluateeMemberId || !termId) {
      setNotes([])
      onNotesChanged?.(0)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('evaluation_voice_notes')
        .select('id,evaluatee_member_id,term_id,team_id,storage_path,mime_type,duration_seconds,file_size_bytes,evaluator_user_id,evaluator_member_id,evaluator_display_name,created_at')
        .eq('evaluatee_member_id', evaluateeMemberId)
        .eq('term_id', termId)
        .is('soft_deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = ((data as any[]) || []) as TermVoiceNote[]
      const withUrls = await Promise.all(
        rows.map(async (row) => {
          const { data: signed } = await supabase.storage
            .from(VOICE_BUCKET)
            .createSignedUrl(row.storage_path, 60 * 60)
          return { ...row, signedUrl: signed?.signedUrl ?? null }
        })
      )
      setNotes(withUrls)
      onNotesChanged?.(withUrls.length)
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحميل التقييمات الصوتية')
    } finally {
      setLoading(false)
    }
  }

  async function startRecording() {
    if (!canAddMore) return
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('المتصفح لا يدعم تسجيل الصوت')
      return
    }

    try {
      setPendingBlob(null)
      setPendingDurationSeconds(0)
      setElapsedSeconds(0)
      chunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ]
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      startedAtRef.current = Date.now()

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const duration = Math.min(MAX_DURATION_SECONDS, Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)))
        const type = recorder.mimeType || mimeType || 'audio/webm'
        setPendingBlob(new Blob(chunksRef.current, { type }))
        setPendingDurationSeconds(duration)
        setIsRecording(false)
        cleanupRecorder()
      }

      recorder.start()
      setIsRecording(true)
      intervalRef.current = window.setInterval(() => {
        const next = Math.min(MAX_DURATION_SECONDS, Math.floor((Date.now() - startedAtRef.current) / 1000))
        setElapsedSeconds(next)
      }, 500)
      autoStopRef.current = window.setTimeout(() => stopRecording(), MAX_DURATION_SECONDS * 1000)
    } catch (e: any) {
      cleanupRecorder()
      setIsRecording(false)
      toast.error(e.message || 'تعذر بدء تسجيل الصوت')
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    } else {
      cleanupRecorder()
      setIsRecording(false)
    }
  }

  async function savePendingVoiceNote() {
    if (!pendingBlob) return
    if (!evaluateeMemberId || !termId || !teamId) return toast.error('بيانات التقييم غير مكتملة')
    if (pendingDurationSeconds > MAX_DURATION_SECONDS) return toast.error('مدة التسجيل لا يمكن أن تزيد عن 3 دقائق')
    if (notes.length >= MAX_VOICE_NOTES) return toast.error('تم الوصول للحد الأقصى: 2 تسجيل صوتي لهذا الترم')

    setSaving(true)
    let uploadedPath = ''
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      const userId = userData.user?.id
      if (!userId) throw new Error('لم يتم تحديد المستخدم الحالي')

      const evaluator = await fetchEvaluatorIdentity()
      const extension = audioExtension(pendingBlob.type || 'audio/webm')
      uploadedPath = `${teamId}/${evaluateeMemberId}/${termId}/${userId}-${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage.from(VOICE_BUCKET).upload(uploadedPath, pendingBlob, {
        contentType: pendingBlob.type || 'audio/webm',
        upsert: false,
      })
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('evaluation_voice_notes').insert({
        evaluatee_member_id: evaluateeMemberId,
        evaluator_user_id: userId,
        evaluator_member_id: evaluator.memberId,
        evaluator_display_name: evaluator.displayName,
        team_id: teamId,
        term_id: termId,
        storage_path: uploadedPath,
        mime_type: pendingBlob.type || 'audio/webm',
        duration_seconds: pendingDurationSeconds,
        file_size_bytes: pendingBlob.size,
      })
      if (insertError) throw insertError

      toast.success('تم حفظ التقييم الصوتي')
      setPendingBlob(null)
      setPendingDurationSeconds(0)
      setElapsedSeconds(0)
      await loadNotes()
    } catch (e: any) {
      if (uploadedPath) {
        await supabase.storage.from(VOICE_BUCKET).remove([uploadedPath])
      }
      toast.error(e.message || 'تعذر حفظ التقييم الصوتي')
    } finally {
      setSaving(false)
    }
  }

  async function deleteVoiceNote(note: VoiceNoteWithUrl) {
    if (!canManage) return
    const ok = window.confirm('هل تريد حذف هذا التقييم الصوتي؟')
    if (!ok) return

    setDeletingId(note.id)
    try {
      const { error } = await supabase
        .from('evaluation_voice_notes')
        .update({ soft_deleted_at: new Date().toISOString() })
        .eq('id', note.id)
      if (error) throw error

      await supabase.storage.from(VOICE_BUCKET).remove([note.storage_path])
      toast.success('تم حذف التقييم الصوتي')
      await loadNotes()
    } catch (e: any) {
      toast.error(e.message || 'تعذر حذف التقييم الصوتي')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className={`voice-notes-panel rounded-3xl border border-indigo-100 bg-indigo-50/40 ${compact ? 'p-3' : 'p-4'} space-y-4`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="voice-title text-base font-bold text-indigo-950">🎙️ التقييم الصوتي للترم</div>
          <div className="text-sm text-indigo-900/70">بحد أقصى تسجيلين لكل شخص في كل ترم، ومدة كل تسجيل 3 دقائق.</div>
        </div>
        <div className="voice-count rounded-full border border-indigo-200 bg-white px-3 py-1 text-sm font-semibold text-indigo-900">
          المسجل: {usageText}
        </div>
      </div>

      {!canManage && (
        <InlineAlert tone="info" title="استماع فقط">
          يمكنك تشغيل التسجيلات الصوتية المحفوظة، ولا يمكنك إضافة أو حذف تسجيلات من هذه الصفحة.
        </InlineAlert>
      )}

      {canManage && (
        <div className="voice-recorder rounded-2xl border border-white bg-white p-3 shadow-sm space-y-3">
          {!isRecording && !pendingBlob && (
            <button
              type="button"
              className="btn w-full justify-center border border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canAddMore || loading}
              onClick={startRecording}
            >
              🎙️ تسجيل Voice Note جديد
            </button>
          )}

          {isRecording && (
            <div className="space-y-3 text-center">
              <div className="text-sm font-semibold text-red-700">جاري التسجيل...</div>
              <div className="voice-timer text-3xl font-black tabular-nums text-slate-900">{formatSeconds(elapsedSeconds)} / 03:00</div>
              <div className="voice-progress h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${Math.min(100, (elapsedSeconds / MAX_DURATION_SECONDS) * 100)}%` }} />
              </div>
              <button type="button" className="btn border border-red-200 bg-red-50 text-red-700" onClick={stopRecording}>
                إيقاف التسجيل
              </button>
            </div>
          )}

          {pendingBlob && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-semibold text-slate-700">تسجيل جاهز للحفظ — المدة {formatSeconds(pendingDurationSeconds)}</div>
                <button type="button" className="text-sm font-semibold text-slate-500 underline" onClick={() => { setPendingBlob(null); setPendingDurationSeconds(0); setElapsedSeconds(0) }}>
                  إلغاء التسجيل
                </button>
              </div>
              <audio className="w-full" controls src={URL.createObjectURL(pendingBlob)} />
              <LoadingButton loading={saving} onClick={savePendingVoiceNote} className="w-full justify-center">
                حفظ التسجيل الصوتي
              </LoadingButton>
            </div>
          )}

          {!canAddMore && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              تم الوصول للحد الأقصى: 2 تسجيل صوتي لهذا الترم.
            </div>
          )}

          {canAddMore && !isRecording && !pendingBlob && (
            <div className="text-center text-xs text-slate-500">متبقي {remainingCount} تسجيل صوتي لهذا الترم.</div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-indigo-200 bg-white p-4 text-center text-sm text-slate-500">جاري تحميل التسجيلات...</div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-indigo-200 bg-white p-4 text-center text-sm text-slate-500">لا توجد تسجيلات صوتية محفوظة لهذا الترم حتى الآن.</div>
        ) : (
          notes.map((note, index) => (
            <article key={note.id} className="voice-note-item rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-3">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-bold text-slate-900">Voice Note {notes.length - index}</div>
                  <div className="text-sm text-slate-500">تم التقييم بواسطة: {note.evaluator_display_name || '—'}</div>
                </div>
                <div className="text-sm text-slate-500">{readableDate(note.created_at)} • {formatSeconds(note.duration_seconds || 0)}</div>
              </div>
              {note.signedUrl ? (
                <audio className="w-full" controls preload="metadata" src={note.signedUrl} />
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">تعذر تجهيز رابط التشغيل. أعد فتح الصفحة أو تحقق من صلاحيات Storage.</div>
              )}
              {canManage && (
                <div className="flex justify-end">
                  <LoadingButton loading={deletingId === note.id} onClick={() => deleteVoiceNote(note)} className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-100">
                    حذف التسجيل
                  </LoadingButton>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  )
}
