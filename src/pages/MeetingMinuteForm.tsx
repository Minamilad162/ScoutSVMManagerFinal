import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { PageHero } from '../components/ui/PageHero'
import { InlineAlert } from '../components/ui/InlineAlert'
import { useCurrentScoutYear } from '../hooks/useCurrentScoutYear'

type RoleRow = { role_slug: string; team_id?: string | null }

type MinuteRow = {
  id: string
  meeting_date: string
  title: string | null
  attendees: string[] | null
  discussion_points: string[] | null
  general_notes: string | null
  created_at?: string
  updated_at?: string
}

type TaskRow = {
  id?: string
  minute_id?: string
  task_text: string
  owner_name: string
  due_date: string
  status: 'pending' | 'in_progress' | 'done' | 'cancelled'
  sort_order: number
  completed_at?: string | null
  status_updated_by?: string | null
  status_updated_at?: string | null
  created_at?: string
  updated_at?: string
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'لم يبدأ' },
  { value: 'in_progress', label: 'جارٍ التنفيذ' },
  { value: 'done', label: 'تم' },
  { value: 'cancelled', label: 'ملغي' },
] as const

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(value?: string | null) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

function parseGeneralNotes(value?: string | null) {
  return (value || '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-•]+\s*/, '').replace(/^\d+[.)-]\s*/, '').trim())
    .filter(Boolean)
}

function serializeGeneralNotes(items: string[]) {
  const clean = items.map((item) => item.trim()).filter(Boolean)
  return clean.length ? clean.map((item) => `- ${item}`).join('\n') : null
}

function statusLabel(status: TaskRow['status']) {
  return STATUS_OPTIONS.find((x) => x.value === status)?.label || status
}

function newBlankTask(): TaskRow {
  return {
    task_text: '',
    owner_name: '',
    due_date: todayISO(),
    status: 'pending',
    sort_order: 0,
    completed_at: null,
    status_updated_by: null,
    status_updated_at: null,
  }
}

export default function MeetingMinuteForm() {
  const navigate = useNavigate()
  const { id } = useParams()

  const { roles, user } = useAuth() as {
    roles: RoleRow[]
    user: { id?: string; name?: string; email?: string } | null
  }

  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [meetingDate, setMeetingDate] = useState(todayISO())
  const [title, setTitle] = useState('')
  const [generalNotes, setGeneralNotes] = useState<string[]>([])
  const [generalNoteInput, setGeneralNoteInput] = useState('')
  const [savingGeneralNote, setSavingGeneralNote] = useState(false)

  const [attendees, setAttendees] = useState<string[]>([])
  const [attendeeInput, setAttendeeInput] = useState('')

  const [discussionPoints, setDiscussionPoints] = useState<string[]>([])
  const [pointInput, setPointInput] = useState('')

  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [originalTasks, setOriginalTasks] = useState<TaskRow[]>([])
  const { currentScoutYear } = useCurrentScoutYear()

  const hasRole = useCallback(
    (slug: string) => (roles || []).some((r) => r.role_slug === slug),
    [roles]
  )

  const isAdmin = useMemo(() => hasRole('admin'), [hasRole])
  const canAccess = useMemo(
    () => isAdmin || hasRole('chef_de_legion'),
    [hasRole, isAdmin]
  )

  const isEdit = !!id

  const loadData = useCallback(async () => {
    if (!id || !canAccess) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: minute, error: minuteError } = await supabase
        .from('meeting_minutes')
        .select('*')
        .eq('id', id)
        .single()

      if (minuteError) throw minuteError

      const { data: taskRows, error: taskError } = await supabase
        .from('meeting_minute_tasks')
        .select('*')
        .eq('minute_id', id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (taskError) throw taskError

      const m = minute as MinuteRow
      const t = ((taskRows || []) as TaskRow[]).map((x, idx) => ({
        ...x,
        sort_order: typeof x.sort_order === 'number' ? x.sort_order : idx,
      }))

      setMeetingDate(m.meeting_date || todayISO())
      setTitle(m.title || '')
      setAttendees(Array.isArray(m.attendees) ? m.attendees : [])
      setDiscussionPoints(Array.isArray(m.discussion_points) ? m.discussion_points : [])
      setGeneralNotes(parseGeneralNotes(m.general_notes))
      setGeneralNoteInput('')
      setTasks(t)
      setOriginalTasks(t)
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء تحميل المحضر')
    } finally {
      setLoading(false)
    }
  }, [id, canAccess])

  useEffect(() => {
    loadData()
  }, [loadData])

  const addAttendee = () => {
    const value = attendeeInput.trim()
    if (!value) return
    setAttendees((prev) => [...prev, value])
    setAttendeeInput('')
  }

  const addPoint = () => {
    const value = pointInput.trim()
    if (!value) return
    setDiscussionPoints((prev) => [...prev, value])
    setPointInput('')
  }

  const persistGeneralNotesOnly = async (nextNotes: string[]) => {
    if (!isEdit || !id) return

    const { error } = await supabase
      .from('meeting_minutes')
      .update({ general_notes: serializeGeneralNotes(nextNotes) })
      .eq('id', id)

    if (error) throw error
  }

  const addGeneralNote = async () => {
    const value = generalNoteInput.trim()
    if (!value || savingGeneralNote) return

    const nextNotes = [...generalNotes, value]
    setSavingGeneralNote(true)
    setError(null)

    try {
      await persistGeneralNotesOnly(nextNotes)
      setGeneralNotes(nextNotes)
      setGeneralNoteInput('')
    } catch (e: any) {
      setError(e?.message || 'تعذر حفظ نقطة الملاحظة')
    } finally {
      setSavingGeneralNote(false)
    }
  }

  const removeGeneralNote = async (index: number) => {
    if (savingGeneralNote) return

    const nextNotes = generalNotes.filter((_, i) => i !== index)
    setSavingGeneralNote(true)
    setError(null)

    try {
      await persistGeneralNotesOnly(nextNotes)
      setGeneralNotes(nextNotes)
    } catch (e: any) {
      setError(e?.message || 'تعذر حذف نقطة الملاحظة')
    } finally {
      setSavingGeneralNote(false)
    }
  }

  const updateGeneralNote = (index: number, value: string) => {
    setGeneralNotes((prev) => prev.map((item, i) => (i === index ? value : item)))
  }

  const addTask = () => {
    setTasks((prev) => [...prev, { ...newBlankTask(), sort_order: prev.length }])
  }

  const updateTask = <K extends keyof TaskRow>(index: number, key: K, value: TaskRow[K]) => {
    setTasks((prev) =>
      prev.map((task, i) => {
        if (i !== index) return task

        if (key === 'status' && !isAdmin) {
          return task
        }

        return { ...task, [key]: value }
      })
    )
  }

  const removeTask = (index: number) => {
    setTasks((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((task, idx) => ({ ...task, sort_order: idx }))
    )
  }

  const moveTask = (index: number, dir: -1 | 1) => {
    setTasks((prev) => {
      const newIndex = index + dir
      if (newIndex < 0 || newIndex >= prev.length) return prev

      const copy = [...prev]
      const current = copy[index]
      copy[index] = copy[newIndex]
      copy[newIndex] = current

      return copy.map((task, idx) => ({ ...task, sort_order: idx }))
    })
  }

  const validate = () => {
    if (!meetingDate) return 'تاريخ الاجتماع مطلوب'
    if (!isEdit && currentScoutYear?.start_date && meetingDate < currentScoutYear.start_date) {
      return `تاريخ الاجتماع يجب أن يكون داخل السنة الكشفية الحالية (${currentScoutYear.name})`
    }
    if (!isEdit && currentScoutYear?.end_date && meetingDate > currentScoutYear.end_date) {
      return `تاريخ الاجتماع يجب أن يكون داخل السنة الكشفية الحالية (${currentScoutYear.name})`
    }

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i]
      if (!t.task_text.trim()) return `وصف التاسك رقم ${i + 1} مطلوب`
      if (!t.owner_name.trim()) return `اسم المسؤول في التاسك رقم ${i + 1} مطلوب`
      if (!t.due_date) return `تاريخ الاستحقاق في التاسك رقم ${i + 1} مطلوب`
    }

    return null
  }

  const handleSave = async () => {
    if (!canAccess) return

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      let minuteId = id

      const minutePayload = {
        meeting_date: meetingDate,
        title: title.trim() || null,
        attendees,
        discussion_points: discussionPoints,
        general_notes: serializeGeneralNotes(generalNotes),
      }

      if (minuteId) {
        const { error } = await supabase
          .from('meeting_minutes')
          .update(minutePayload)
          .eq('id', minuteId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('meeting_minutes')
          .insert(minutePayload)
          .select('id')
          .single()

        if (error) throw error
        minuteId = data.id as string
      }

      if (!minuteId) throw new Error('تعذر تحديد رقم المحضر')

      const originalMap = new Map(
        originalTasks
          .filter((t) => t.id)
          .map((t) => [t.id as string, t])
      )

      const currentIds = new Set(
        tasks.filter((t) => t.id).map((t) => t.id as string)
      )

      const deletedIds = originalTasks
        .filter((t) => t.id && !currentIds.has(t.id))
        .map((t) => t.id as string)

      if (deletedIds.length > 0) {
        const { error } = await supabase
          .from('meeting_minute_tasks')
          .delete()
          .in('id', deletedIds)

        if (error) throw error
      }

      const existingTasks = tasks.filter((t) => t.id)
      for (let i = 0; i < existingTasks.length; i++) {
        const t = existingTasks[i]
        const old = originalMap.get(t.id as string)

        const updatePayload: Partial<TaskRow> = {
          task_text: t.task_text.trim(),
          owner_name: t.owner_name.trim(),
          due_date: t.due_date,
          sort_order: i,
        }

        if (isAdmin) {
          updatePayload.status = t.status
        } else if (old) {
          updatePayload.status = old.status
        }

        const { error } = await supabase
          .from('meeting_minute_tasks')
          .update(updatePayload)
          .eq('id', t.id as string)

        if (error) throw error
      }

      const newTasks = tasks.filter((t) => !t.id)
      if (newTasks.length > 0) {
        const insertPayload = newTasks.map((t, idx) => ({
          minute_id: minuteId,
          task_text: t.task_text.trim(),
          owner_name: t.owner_name.trim(),
          due_date: t.due_date,
          sort_order: existingTasks.length + idx,
          status: isAdmin ? t.status : 'pending',
        }))

        const { error } = await supabase
          .from('meeting_minute_tasks')
          .insert(insertPayload)

        if (error) throw error
      }

      navigate(`/app/meeting-minutes/${minuteId}`)
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء حفظ المحضر')
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    const now = todayISO()
    return tasks.reduce(
      (acc, t) => {
        acc.total += 1
        if (t.status === 'pending') acc.pending += 1
        if (t.status === 'in_progress') acc.inProgress += 1
        if (t.status === 'done') acc.done += 1
        if (t.status === 'cancelled') acc.cancelled += 1
        if (t.status !== 'done' && t.status !== 'cancelled' && t.due_date < now) {
          acc.overdue += 1
        }
        return acc
      },
      {
        total: 0,
        pending: 0,
        inProgress: 0,
        done: 0,
        cancelled: 0,
        overdue: 0,
      }
    )
  }, [tasks])

  if (!canAccess) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
          <div className="text-lg font-bold mb-2">غير مسموح</div>
          <p className="text-sm">هذه الصفحة متاحة فقط لـ Admin و Chef de Legion.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          جاري تحميل المحضر...
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <PageHero
        eyebrow={isEdit ? 'تحديث المحضر الحالي' : 'إنشاء محضر جديد'}
        title={isEdit ? 'تعديل المحضر' : 'إضافة محضر جديد'}
        description={isEdit ? 'عدّل المحضر الحالي وتابع التاسكات المرتبطة به. في حالة المحاضر القديمة يمكنك مراجعتها وتعديلها بدون أن تختفي بسبب فلاتر السنة أو الشهر.' : `أدخل بيانات الاجتماع والحضور والنقاط المتفق عليها داخل السنة الكشفية الحالية${currentScoutYear ? ` (${currentScoutYear.name})` : ''}، ثم أنشئ التاسكات وربطها بالمسؤولين ومواعيد الاستحقاق.`}
        actions={
          <>
            <Link
              to="/app/meeting-minutes"
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              رجوع
            </Link>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ المحضر'}
            </button>
          </>
        }
      />

      {error && (
        <InlineAlert tone="error" title="تعذر حفظ المحضر أو تحميل بياناته">
          {error}
        </InlineAlert>
      )}

      {currentScoutYear && (
        <InlineAlert tone="info" title="السنة الكشفية الحالية">
          {currentScoutYear.name} — من {fmtDate(currentScoutYear.start_date)} إلى {fmtDate(currentScoutYear.end_date)}
        </InlineAlert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="إجمالي التاسكات" value={summary.total} />
        <StatCard label="لم يبدأ" value={summary.pending} />
        <StatCard label="جارٍ التنفيذ" value={summary.inProgress} />
        <StatCard label="تم" value={summary.done} />
        <StatCard label="ملغي" value={summary.cancelled} />
        <StatCard label="متأخر" value={summary.overdue} danger={summary.overdue > 0} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              تاريخ الاجتماع <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              عنوان المحضر
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: اجتماع متابعة الأنشطة"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <SectionCard title="الحضور">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={attendeeInput}
            onChange={(e) => setAttendeeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAttendee()
              }
            }}
            placeholder="اكتب اسم الحاضر"
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={addAttendee}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            إضافة
          </button>
        </div>

        {attendees.length === 0 ? (
          <p className="text-sm text-slate-500">لم يتم إضافة حضور بعد</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {attendees.map((name, idx) => (
              <Chip
                key={`${name}-${idx}`}
                label={name}
                onRemove={() =>
                  setAttendees((prev) => prev.filter((_, i) => i !== idx))
                }
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="النقاط المتفق عليها">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={pointInput}
            onChange={(e) => setPointInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addPoint()
              }
            }}
            placeholder="اكتب نقطة الاتفاق"
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={addPoint}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            إضافة
          </button>
        </div>

        {discussionPoints.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد نقاط مسجلة بعد</p>
        ) : (
          <div className="space-y-2">
            {discussionPoints.map((point, idx) => (
              <div
                key={`${point}-${idx}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="text-sm text-slate-800">
                  {idx + 1}. {point}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setDiscussionPoints((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-sm font-medium text-red-600 hover:text-red-700"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="ملاحظات عامة">
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 text-sm leading-7 text-slate-600">
          اكتب كل ملاحظة كنقطة مستقلة، واضغط حفظ النقطة. عند إنشاء محضر جديد، النقاط تُحفظ مع زر حفظ المحضر الرئيسي.
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            value={generalNoteInput}
            onChange={(e) => setGeneralNoteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addGeneralNote()
              }
            }}
            placeholder="اكتب ملاحظة عامة كنقطة واحدة"
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
          />
          <button
            type="button"
            onClick={() => void addGeneralNote()}
            disabled={savingGeneralNote || !generalNoteInput.trim()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {savingGeneralNote ? 'جارٍ الحفظ...' : 'حفظ النقطة'}
          </button>
        </div>

        {generalNotes.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد ملاحظات عامة بعد</p>
        ) : (
          <div className="space-y-2">
            {generalNotes.map((note, idx) => (
              <div
                key={`general-note-${idx}`}
                className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700 shadow-sm">
                  {idx + 1}
                </div>
                <textarea
                  value={note}
                  onChange={(e) => updateGeneralNote(idx, e.target.value)}
                  rows={2}
                  placeholder="نقطة ملاحظة"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => void removeGeneralNote(idx)}
                  disabled={savingGeneralNote}
                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="التاسكات"
        extra={
          <button
            type="button"
            onClick={addTask}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + إضافة تاسك
          </button>
        }
      >
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            لا توجد تاسكات بعد
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task, idx) => {
              const overdue =
                task.status !== 'done' &&
                task.status !== 'cancelled' &&
                task.due_date < todayISO()

              return (
                <div
                  key={task.id || `new-${idx}`}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="font-semibold text-slate-800">
                      تاسك #{idx + 1}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <StatusPill label={statusLabel(task.status)} tone={toneFromStatus(task.status)} />
                      {overdue && <StatusPill label="متأخر" tone="red" />}
                      {task.completed_at && (
                        <StatusPill
                          label={`اكتملت: ${fmtDate(task.completed_at)}`}
                          tone="green"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        وصف التاسك <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={task.task_text}
                        onChange={(e) => updateTask(idx, 'task_text', e.target.value)}
                        rows={3}
                        placeholder="اكتب وصف التاسك"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        المسؤول <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={task.owner_name}
                        onChange={(e) => updateTask(idx, 'owner_name', e.target.value)}
                        placeholder="اسم الشخص المسؤول"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        تاريخ الاستحقاق <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={task.due_date}
                        onChange={(e) => updateTask(idx, 'due_date', e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        الحالة
                      </label>
                      <select
                        value={task.status}
                        onChange={(e) =>
                          updateTask(idx, 'status', e.target.value as TaskRow['status'])
                        }
                        disabled={!isAdmin}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {!isAdmin && (
                        <p className="mt-1 text-xs text-slate-500">
                          تعديل الحالة متاح للأدمن فقط
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                      <div>آخر تحديث للحالة: {fmtDate(task.status_updated_at)}</div>
                      <div className="mt-1">تاريخ الإكمال: {fmtDate(task.completed_at)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => moveTask(idx, -1)}
                      disabled={idx === 0}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-40"
                    >
                      ↑ لأعلى
                    </button>

                    <button
                      type="button"
                      onClick={() => moveTask(idx, 1)}
                      disabled={idx === tasks.length - 1}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-40"
                    >
                      ↓ لأسفل
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('هل تريد حذف هذه التاسك؟')) {
                          removeTask(idx)
                        }
                      }}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      حذف التاسك
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="ملخص التنفيذ">
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500">لا يوجد ملخص لأن المحضر لا يحتوي على تاسكات بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-2 text-right">#</th>
                  <th className="px-3 py-2 text-right">التاسك</th>
                  <th className="px-3 py-2 text-right">المسؤول</th>
                  <th className="px-3 py-2 text-right">Due Date</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, idx) => {
                  const overdue =
                    task.status !== 'done' &&
                    task.status !== 'cancelled' &&
                    task.due_date < todayISO()

                  return (
                    <tr key={task.id || `summary-${idx}`} className="border-b border-slate-100">
                      <td className="px-3 py-3">{idx + 1}</td>
                      <td className="px-3 py-3 text-slate-800">{task.task_text || '-'}</td>
                      <td className="px-3 py-3">{task.owner_name || '-'}</td>
                      <td className="px-3 py-3">{fmtDate(task.due_date)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <StatusPill
                            label={statusLabel(task.status)}
                            tone={toneFromStatus(task.status)}
                          />
                          {overdue && <StatusPill label="متأخر" tone="red" />}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div>المستخدم الحالي: {user?.name || user?.email || '-'}</div>
        {isEdit && <div>رقم المحضر: {id}</div>}
      </div>
    </div>
  )
}

function SectionCard({
  title,
  extra,
  children,
}: {
  title: string
  extra?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {extra}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Chip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-red-600 hover:text-red-700"
      >
        ×
      </button>
    </span>
  )
}

function StatCard({
  label,
  value,
  danger = false,
}: {
  label: string
  value: number
  danger?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        danger ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className={`text-sm ${danger ? 'text-red-700' : 'text-slate-500'}`}>
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${danger ? 'text-red-700' : 'text-slate-800'}`}>
        {value}
      </div>
    </div>
  )
}

function StatusPill({
  label,
  tone = 'slate',
}: {
  label: string
  tone?: 'slate' | 'green' | 'yellow' | 'red' | 'blue'
}) {
  const cls =
    tone === 'green'
      ? 'bg-green-100 text-green-700 border-green-200'
      : tone === 'yellow'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : tone === 'red'
      ? 'bg-red-100 text-red-700 border-red-200'
      : tone === 'blue'
      ? 'bg-blue-100 text-blue-700 border-blue-200'
      : 'bg-slate-100 text-slate-700 border-slate-200'

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function toneFromStatus(status: TaskRow['status']): 'slate' | 'green' | 'yellow' | 'red' | 'blue' {
  if (status === 'done') return 'green'
  if (status === 'in_progress') return 'blue'
  if (status === 'cancelled') return 'red'
  if (status === 'pending') return 'yellow'
  return 'slate'
}