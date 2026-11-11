/** Shared booking model for the read-only reservations register and direct admin management. */
export type BookingKind = 'material' | 'field'
export type BookingStatus = 'upcoming' | 'active' | 'overdue' | 'partial' | 'returned' | 'completed'
export type BookingRecord = {
  id: string
  kind: BookingKind
  teamId: string
  resourceId: string
  startsAt: string
  endsAt: string
  createdAt: string | null
  qty: number | null
  qtyReturned: number
  approvedAt: string | null
}
export type NamedItem = { id: string; name: string }

const cairo = 'Africa/Cairo'

function dateParts(instant: Date, timeZone = cairo) {
  const values = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant)
  return Object.fromEntries(values.map(({ type, value }) => [type, value]))
}

export function cairoDay(instant: Date = new Date()) {
  const parts = dateParts(instant)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function cairoDatetimeLocal(iso: string) {
  const instant = new Date(iso)
  if (!Number.isFinite(instant.getTime())) return ''
  const parts = dateParts(instant)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** Converts a Cairo local datetime-local input into UTC, including Egypt DST. */
export function cairoLocalToISO(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const [day, clock] = value.split('T')
  const [year, month, date] = day.split('-').map(Number)
  const [hour, minute] = clock.split(':').map(Number)
  if (!(month >= 1 && month <= 12 && date >= 1 && date <= 31 && hour <= 23 && minute <= 59)) return null
  const target = Date.UTC(year, month - 1, date, hour, minute)
  let guess = target
  for (let i = 0; i < 3; i += 1) {
    const parts = dateParts(new Date(guess))
    const asUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second))
    guess = target - (asUTC - Math.floor(guess / 1000) * 1000)
  }
  const result = new Date(guess)
  return cairoDatetimeLocal(result.toISOString()) === value ? result.toISOString() : null
}

export function cairoRangeISO(startDate: string, endDate: string) {
  // Cairo's DST spring-forward skips 00:00–00:59 on some Fridays.
  // Use the first valid hour of that day instead of losing all reservations.
  const start = cairoLocalToISO(`${startDate}T00:00`) || cairoLocalToISO(`${startDate}T01:00`)
  const end = cairoLocalToISO(`${endDate}T23:59`)
  return start && end ? { start, end: new Date(new Date(end).getTime() + 59999).toISOString() } : null
}

const cairoFormatter = new Intl.DateTimeFormat('ar-EG', {
  timeZone: cairo, year: 'numeric', month: 'short', day: '2-digit',
  hour: 'numeric', minute: '2-digit', hour12: true,
})
export function bookingDateLabel(value: string | null | undefined) {
  const time = value ? new Date(value) : null
  return time && Number.isFinite(time.getTime()) ? cairoFormatter.format(time) : '—'
}

export function bookingStatus(booking: BookingRecord, now: number = Date.now()): { id: BookingStatus; label: string } {
  const qty = Math.max(0, Number(booking.qty) || 0)
  const returned = Math.max(0, Number(booking.qtyReturned) || 0)
  if (booking.kind === 'material' && qty > 0 && returned >= qty) return { id: 'returned', label: 'مكتمل الاسترجاع' }
  if (booking.kind === 'material' && returned > 0) return { id: 'partial', label: 'استرجاع جزئي' }
  const start = new Date(booking.startsAt).getTime()
  const end = new Date(booking.endsAt).getTime()
  if (Number.isFinite(end) && now > end) {
    return booking.kind === 'material'
      ? { id: 'overdue', label: 'انتهى موعده – دون اعتماد الاسترجاع' }
      : { id: 'completed', label: 'مكتمل' }
  }
  if (Number.isFinite(start) && Number.isFinite(end) && start <= now && now <= end) return { id: 'active', label: 'جاري' }
  return { id: 'upcoming', label: 'قادم' }
}

export function validateBookingEdit(booking: BookingRecord, draft: {
  startsAt: string; endsAt: string; qty: number; teamId: string; resourceId: string
}, yearBounds: {start: string; end: string} | null) {
  if (!yearBounds) return 'لا توجد سنة كشفية صالحة.'
  if (!draft.teamId || !draft.resourceId) return 'اختر الفريق والأداة أو قطاع الأرض.'
  if (booking.kind === 'material' && (!Number.isSafeInteger(draft.qty) || draft.qty <= 0)) return 'الكمية يجب أن تكون عددًا صحيحًا أكبر من صفر.'
  if (!draft.startsAt || !draft.endsAt) return 'حدد تاريخ البداية والنهاية.'
  if (draft.startsAt.slice(0, 10) < yearBounds.start || draft.endsAt.slice(0, 10) > yearBounds.end) return 'الحجز المعدل يجب أن يكون داخل السنة الكشفية المختارة.'
  const start = cairoLocalToISO(draft.startsAt)
  const end = cairoLocalToISO(draft.endsAt)
  if (!start || !end) return 'صيغة التاريخ غير صالحة أو التوقيت غير موجود بالتوقيت المحلي.'
  if (new Date(end).getTime() <= new Date(start).getTime()) return 'موعد النهاية يجب أن يكون بعد موعد البداية.'
  return null
}
