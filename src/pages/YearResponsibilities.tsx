import { FormEvent, useEffect, useMemo, useState } from 'react'
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
import { getErrorMessage, logError } from '../lib/errors'
import {
  assignMembersToYearResponsibilityEvent,
  createYearResponsibilityEvent,
  deleteYearResponsibilityEvent,
  listTeams,
  listYearResponsibilityAssignments,
  listYearResponsibilityEvents,
  listYearResponsibilityMembers,
  removeMembersFromYearResponsibilityEvent,
  type TeamOption,
  type YearResponsibilityAssignment,
  type YearResponsibilityEvent,
  type YearResponsibilityMember,
} from '../features/yearResponsibilities/api'

type AssignmentFilter = 'all' | 'assigned_selected' | 'not_assigned_selected' | 'never_assigned'

function formatDate(value?: string | null) {
  if (!value) return 'بدون تاريخ'
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase() || '👤'
}

export default function YearResponsibilities() {
  const { roles, user } = useAuth()
  const { currentScoutYear } = useScoutYear()
  const toast = useToast()
  const isAdmin = roles.some((role) => role.role_slug === 'admin')

  const [loading, setLoading] = useState(true)
  const [savingEvent, setSavingEvent] = useState(false)
  const [savingAssignments, setSavingAssignments] = useState(false)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [events, setEvents] = useState<YearResponsibilityEvent[]>([])
  const [assignments, setAssignments] = useState<YearResponsibilityAssignment[]>([])
  const [members, setMembers] = useState<YearResponsibilityMember[]>([])
  const [teams, setTeams] = useState<TeamOption[]>([])

  const [selectedEventId, setSelectedEventId] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [search, setSearch] = useState('')
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all')

  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventDescription, setEventDescription] = useState('')

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  )

  const assignmentsByMember = useMemo(() => {
    const map = new Map<string, YearResponsibilityAssignment[]>()
    for (const assignment of assignments) {
      const list = map.get(assignment.member_id) || []
      list.push(assignment)
      map.set(assignment.member_id, list)
    }
    return map
  }, [assignments])

  const assignedMemberIdsForSelectedEvent = useMemo(() => {
    return new Set(assignments.filter((assignment) => assignment.event_id === selectedEventId).map((assignment) => assignment.member_id))
  }, [assignments, selectedEventId])

  const assignmentCountByEvent = useMemo(() => {
    const map = new Map<string, number>()
    for (const assignment of assignments) {
      map.set(assignment.event_id, (map.get(assignment.event_id) || 0) + 1)
    }
    return map
  }, [assignments])

  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events])

  const neverAssignedCount = useMemo(
    () => members.filter((member) => (assignmentsByMember.get(member.id) || []).length === 0).length,
    [assignmentsByMember, members]
  )

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return members.filter((member) => {
      const memberAssignments = assignmentsByMember.get(member.id) || []
      const assignedToSelected = selectedEventId ? assignedMemberIdsForSelectedEvent.has(member.id) : false
      const neverAssigned = memberAssignments.length === 0

      if (teamFilter && member.team_id !== teamFilter) return false
      if (assignmentFilter === 'assigned_selected' && !assignedToSelected) return false
      if (assignmentFilter === 'not_assigned_selected' && (!selectedEventId || assignedToSelected)) return false
      if (assignmentFilter === 'never_assigned' && !neverAssigned) return false

      if (q) {
        const memberEventTitles = memberAssignments.map((assignment) => eventById.get(assignment.event_id)?.title || '').join(' ')
        const hay = `${member.full_name} ${member.team_name || ''} ${member.rank_label || ''} ${memberEventTitles}`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      return true
    })
  }, [assignedMemberIdsForSelectedEvent, assignmentFilter, assignmentsByMember, eventById, members, search, selectedEventId, teamFilter])

  const selectedEventAssignedCount = selectedEventId ? assignedMemberIdsForSelectedEvent.size : 0

  async function loadAll(preferredEventId?: string) {
    if (!currentScoutYear?.id) {
      setEvents([])
      setAssignments([])
      setMembers([])
      setTeams([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [eventRows, assignmentRows, memberRows, teamRows] = await Promise.all([
        listYearResponsibilityEvents(currentScoutYear.id),
        listYearResponsibilityAssignments(currentScoutYear.id),
        listYearResponsibilityMembers(),
        listTeams(),
      ])

      setEvents(eventRows)
      setAssignments(assignmentRows)
      setMembers(memberRows)
      setTeams(teamRows)
      setSelectedEventId((prev) => {
        const next = preferredEventId || prev
        if (next && eventRows.some((event) => event.id === next)) return next
        return eventRows[0]?.id || ''
      })
    } catch (error) {
      logError('YearResponsibilities.loadAll', error as any)
      setError(getErrorMessage(error as any, 'تعذر تحميل مسؤوليات السنة'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    void loadAll()
  }, [currentScoutYear?.id, isAdmin])

  async function handleCreateEvent(event: FormEvent) {
    event.preventDefault()
    if (!currentScoutYear?.id) {
      toast.error('لا توجد سنة كشفية حالية')
      return
    }

    setSavingEvent(true)
    setError(null)
    try {
      const created = await createYearResponsibilityEvent({
        scoutYearId: currentScoutYear.id,
        title: eventTitle,
        eventDate: eventDate || null,
        description: eventDescription,
        createdBy: user?.id ?? null,
      })
      setEventTitle('')
      setEventDate('')
      setEventDescription('')
      toast.success('تم إضافة Event/تنظيم جديد')
      await loadAll(created.id)
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر إضافة الـ event')
      setError(msg)
      toast.error(msg)
    } finally {
      setSavingEvent(false)
    }
  }

  async function handleDeleteEvent(event: YearResponsibilityEvent) {
    const ok = window.confirm(`سيتم حذف ${event.title} وكل التكليفات المرتبطة به. هل تريد المتابعة؟`)
    if (!ok) return

    setDeletingEventId(event.id)
    setError(null)
    try {
      await deleteYearResponsibilityEvent(event)
      toast.success('تم حذف الـ event')
      await loadAll()
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر حذف الـ event')
      setError(msg)
      toast.error(msg)
    } finally {
      setDeletingEventId(null)
    }
  }

  async function toggleMemberAssignment(member: YearResponsibilityMember) {
    if (!currentScoutYear?.id) {
      toast.error('لا توجد سنة كشفية حالية')
      return
    }
    if (!selectedEventId) {
      toast.error('اختار Event/تنظيم الأول')
      return
    }

    const alreadyAssigned = assignedMemberIdsForSelectedEvent.has(member.id)
    setSavingAssignments(true)
    setError(null)
    try {
      if (alreadyAssigned) {
        await removeMembersFromYearResponsibilityEvent({
          scoutYearId: currentScoutYear.id,
          eventId: selectedEventId,
          memberIds: [member.id],
        })
        toast.success('تم إلغاء التكليف')
      } else {
        await assignMembersToYearResponsibilityEvent({
          scoutYearId: currentScoutYear.id,
          eventId: selectedEventId,
          memberIds: [member.id],
          assignedBy: user?.id ?? null,
        })
        toast.success('تم تكليف الشخص')
      }
      await loadAll(selectedEventId)
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر تحديث التكليف')
      setError(msg)
      toast.error(msg)
    } finally {
      setSavingAssignments(false)
    }
  }

  async function bulkAssignVisible(assign: boolean) {
    if (!currentScoutYear?.id) {
      toast.error('لا توجد سنة كشفية حالية')
      return
    }
    if (!selectedEventId) {
      toast.error('اختار Event/تنظيم الأول')
      return
    }

    const memberIds = filteredMembers
      .filter((member) => (assign ? !assignedMemberIdsForSelectedEvent.has(member.id) : assignedMemberIdsForSelectedEvent.has(member.id)))
      .map((member) => member.id)

    if (!memberIds.length) {
      toast.info(assign ? 'كل النتائج الظاهرة مكلفة بالفعل' : 'مفيش تكليفات ظاهرة للإلغاء')
      return
    }

    const ok = window.confirm(`${assign ? 'تكليف' : 'إلغاء تكليف'} ${memberIds.length} شخص من النتائج الظاهرة؟`)
    if (!ok) return

    setSavingAssignments(true)
    setError(null)
    try {
      if (assign) {
        await assignMembersToYearResponsibilityEvent({
          scoutYearId: currentScoutYear.id,
          eventId: selectedEventId,
          memberIds,
          assignedBy: user?.id ?? null,
        })
        toast.success('تم تكليف النتائج الظاهرة')
      } else {
        await removeMembersFromYearResponsibilityEvent({
          scoutYearId: currentScoutYear.id,
          eventId: selectedEventId,
          memberIds,
        })
        toast.success('تم إلغاء تكليف النتائج الظاهرة')
      }
      await loadAll(selectedEventId)
    } catch (error) {
      const msg = getErrorMessage(error as any, 'تعذر تحديث التكليفات')
      setError(msg)
      toast.error(msg)
    } finally {
      setSavingAssignments(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageHero
          eyebrow="🧭 مسؤوليات السنة"
          title="هذه الصفحة للإدارة فقط"
          description="تعيين مسؤوليات السنة والـ events يحتاج صلاحية Admin حتى لا تتغير التكليفات العامة بالخطأ."
        />
        <InlineAlert tone="error" title="صلاحية غير كافية">
          لا يمكنك فتح هذه الصفحة بالحساب الحالي.
        </InlineAlert>
      </div>
    )
  }

  if (loading) return <PageLoader visible text="جاري تحميل مسؤوليات السنة..." />

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="🧭 مسؤوليات السنة"
        title="توزيع الشيفات على Events وتنظيمات السنة"
        description={
          <>
            السنة الحالية: <span className="font-black text-slate-800">{currentScoutYear?.name || 'غير محددة'}</span> — الصفحة دي مخصصة لتكليف الشيفات أصحاب الأكونتات فقط، مع فلتر واضح للي ما نزلش في أي event قبل كده.
          </>
        }
        badge={
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            {members.length} شيف/قائد
          </span>
        }
        actions={
          <LoadingButton type="button" variant="outline" loading={loading} onClick={() => loadAll(selectedEventId)}>
            تحديث البيانات
          </LoadingButton>
        }
      />

      {error ? <InlineAlert tone="error" title="حدث خطأ">{error}</InlineAlert> : null}
      {!currentScoutYear?.id ? (
        <InlineAlert tone="error" title="لا توجد سنة حالية">
          عيّن سنة كشفية حالية الأول من صفحة إدارة السنة حتى تظهر قائمة الشيفات والتكليفات.
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Events/تنظيمات" value={events.length} hint="المضافة في السنة الحالية" accent="indigo" />
        <MetricCard label="الشيفات المتاحون" value={members.length} hint="أصحاب أكونتات فقط" accent="sky" />
        <MetricCard label="لم يُكلّفوا قبل كده" value={neverAssignedCount} hint="Flag واضح للمراجعة" accent={neverAssignedCount > 0 ? 'amber' : 'emerald'} />
        <MetricCard label="مكلفون في الحدث المختار" value={selectedEventAssignedCount} hint={selectedEvent?.title || 'اختار event'} accent="rose" />
      </div>

      <SectionCard
        title="إضافة Event أو تنظيم جديد"
        description="اكتب اسم الحاجة اللي الناس هتتنزل عليها؛ ممكن تكون حفلة، رحلة، اجتماع خاص، لجنة تنظيم، خدمة، أو أي مسؤولية في السنة."
      >
        <form className="grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_.7fr_1.4fr_auto]" onSubmit={handleCreateEvent}>
          <input
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            placeholder="مثال: حفلة بداية السنة / لجنة النظام / Camp service"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          />
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          />
          <input
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            placeholder="وصف مختصر اختياري"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          />
          <LoadingButton type="submit" loading={savingEvent} disabled={!eventTitle.trim() || !currentScoutYear?.id}>
            إضافة
          </LoadingButton>
        </form>
      </SectionCard>

      <SectionCard
        title="اختيار الـ Event/التنظيم"
        description="اختار event علشان تبدأ تعمل assign لأكتر من شخص أو تلغي تكليفهم منه."
      >
        {events.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => {
              const active = event.id === selectedEventId
              return (
                <article
                  key={event.id}
                  className={`rounded-[26px] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${active ? 'border-indigo-300 bg-indigo-50/80' : 'border-slate-200 bg-white/78 hover:border-indigo-200'}`}
                >
                  <button type="button" onClick={() => setSelectedEventId(event.id)} className="w-full text-right">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-black text-slate-900">{event.title}</div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">{formatDate(event.event_date)}</div>
                      </div>
                      <span className="rounded-2xl border border-white/80 bg-white px-2.5 py-1 text-xs font-black text-indigo-700 shadow-sm">
                        {assignmentCountByEvent.get(event.id) || 0} مكلف
                      </span>
                    </div>
                    {event.description ? <div className="mt-2 text-sm leading-6 text-slate-500">{event.description}</div> : null}
                  </button>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {active ? <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">محدد الآن</span> : null}
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(event)}
                      className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      disabled={deletingEventId === event.id}
                    >
                      {deletingEventId === event.id ? 'جاري الحذف...' : 'حذف'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState title="لسه مفيش Events" description="ابدأ بإضافة أول event أو تنظيم، وبعدها اختار الشيفات اللي هيتكلفوا عليه." />
        )}
      </SectionCard>

      <SectionCard
        title="الشيفات والتكليفات"
        description="فلتر بالفريق أو الاسم، وراجع الفلاج اللي بيقول مين ما اتكلفش في أي event قبل كده."
        actions={
          <div className="flex flex-wrap gap-2">
            <LoadingButton type="button" variant="outline" loading={savingAssignments} disabled={!selectedEventId || !filteredMembers.length} onClick={() => bulkAssignVisible(true)}>
              تكليف النتائج الظاهرة
            </LoadingButton>
            <LoadingButton type="button" variant="soft" loading={savingAssignments} disabled={!selectedEventId || !filteredMembers.length} onClick={() => bulkAssignVisible(false)}>
              إلغاء تكليف الظاهر
            </LoadingButton>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_.8fr_.8fr] xl:grid-cols-[1.25fr_.75fr_.8fr_.75fr]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرتبة أو الفريق أو اسم event"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          />
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          >
            <option value="">كل الفرق</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
          <select
            value={assignmentFilter}
            onChange={(e) => setAssignmentFilter(e.target.value as AssignmentFilter)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          >
            <option value="all">كل الشيفات</option>
            <option value="assigned_selected">مكلف في الـ event المختار</option>
            <option value="not_assigned_selected">غير مكلف في الـ event المختار</option>
            <option value="never_assigned">ما نزلش في أي event</option>
          </select>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
          >
            <option value="">اختار Event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>{event.title}</option>
            ))}
          </select>
        </div>

        {selectedEvent ? (
          <InlineAlert tone="info" title={`الـ event المختار: ${selectedEvent.title}`}>
            أي زر تكليف أو إلغاء هيطبق على هذا الـ event فقط. الشخص ممكن يتكلف في أكتر من event عادي.
          </InlineAlert>
        ) : (
          <InlineAlert tone="info" title="اختار Event للتكليف">
            الكروت هتظهر للمراجعة، لكن التكليف يحتاج اختيار event أو إضافة واحد جديد.
          </InlineAlert>
        )}

        {filteredMembers.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredMembers.map((member) => {
              const memberAssignments = assignmentsByMember.get(member.id) || []
              const assignedToSelected = selectedEventId ? assignedMemberIdsForSelectedEvent.has(member.id) : false
              const neverAssigned = memberAssignments.length === 0
              return (
                <article key={member.id} className={`rounded-[28px] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${assignedToSelected ? 'border-emerald-200 bg-emerald-50/70' : neverAssigned ? 'border-amber-200 bg-amber-50/68' : 'border-slate-200 bg-white/76'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/80 bg-gradient-to-br from-indigo-100 to-sky-100 text-sm font-black text-indigo-800 shadow-sm">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="h-full w-full rounded-2xl object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                      ) : initials(member.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-black text-slate-900">{member.full_name}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-bold text-slate-600">
                        <span className="rounded-full bg-white/80 px-2.5 py-1 shadow-sm">{member.team_name || 'بدون فريق'}</span>
                        <span className="rounded-full bg-white/80 px-2.5 py-1 shadow-sm">{member.rank_label || 'بدون رتبة'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {neverAssigned ? (
                      <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                        ⚠️ ما نزلش في أي event
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                        ✅ له {memberAssignments.length} event
                      </span>
                    )}
                    {assignedToSelected ? (
                      <span className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-black text-emerald-700">
                        مكلف هنا
                      </span>
                    ) : null}
                  </div>

                  {memberAssignments.length ? (
                    <div className="mt-3 space-y-1.5">
                      <div className="text-xs font-black text-slate-500">Events الحالية</div>
                      <div className="flex flex-wrap gap-1.5">
                        {memberAssignments.slice(0, 5).map((assignment) => (
                          <span key={assignment.id} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 shadow-sm">
                            {eventById.get(assignment.event_id)?.title || 'Event'}
                          </span>
                        ))}
                        {memberAssignments.length > 5 ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">+{memberAssignments.length - 5}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <LoadingButton
                      type="button"
                      variant={assignedToSelected ? 'soft' : 'brand'}
                      loading={savingAssignments}
                      disabled={!selectedEventId}
                      onClick={() => toggleMemberAssignment(member)}
                      className="w-full"
                    >
                      {assignedToSelected ? 'إلغاء من الحدث المختار' : 'تكليف على الحدث المختار'}
                    </LoadingButton>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState title="لا توجد نتائج" description="غيّر الفلاتر أو امسح البحث علشان تظهر الشيفات المتاحة." />
        )}
      </SectionCard>
    </div>
  )
}
