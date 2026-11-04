export function formatAuditDate(value?: string | null) {
  if (!value) return '—'
  try {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
    const date = isDateOnly ? new Date(`${value}T00:00:00`) : new Date(value)
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

export function formatAuditTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

export function buildFieldReservationSummary(params: {
  action: 'create' | 'update' | 'cancel'
  zoneName?: string | null
  teamName?: string | null
  startsAt?: string | null
  endsAt?: string | null
}) {
  const actionLabel =
    params.action === 'create'
      ? 'حجز'
      : params.action === 'update'
      ? 'عدّل حجز'
      : 'ألغى حجز'

  const zone = params.zoneName || 'قطاع غير محدد'
  const team = params.teamName || 'فريق غير محدد'
  const date = formatAuditDate(params.startsAt)
  const start = formatAuditTime(params.startsAt)
  const end = formatAuditTime(params.endsAt)

  return `${actionLabel} قطاع الأرض ${zone} لفريق ${team} يوم ${date} من ${start} إلى ${end}`
}

export function buildAttendanceSummary(params: {
  teamName?: string | null
  meetingDate?: string | null
  presentCount: number
  absentCount: number
  subject?: string
}) {
  const subject = params.subject || 'الحضور والغياب'
  const team = params.teamName || 'فريق غير محدد'
  const date = formatAuditDate(params.meetingDate)
  return `سجّل ${subject} لفريق ${team} يوم ${date}: ${params.presentCount} حاضر و${params.absentCount} غائب`
}
