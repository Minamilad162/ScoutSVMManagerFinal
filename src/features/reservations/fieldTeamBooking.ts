import type { DateBounds } from '../../lib/scoutYearScope'

/** Field booking uses registered meetings only; never borrow dates from another term/year. */
export type FieldMeetingDay = { id: string; meeting_date: string }
export type FieldBookingRole = { role_slug: string; team_id?: string | null }

export function scopedFieldMeetingDays(days: FieldMeetingDay[], bounds: DateBounds | null): FieldMeetingDay[] {
  if (!bounds) return []
  const unique = new Set<string>()
  return days.filter(({ meeting_date }) => {
    const day = meeting_date?.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '') || day < bounds.start || day > bounds.end || unique.has(day)) return false
    unique.add(day)
    return true
  }).sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
}

/** Show next scheduled meeting; past meetings remain selectable for viewing records. */
export function preferredFieldMeeting(days: FieldMeetingDay[], today: string): string {
  return days.find(({ meeting_date }) => meeting_date >= today)?.meeting_date
    || days[days.length - 1]?.meeting_date || ''
}

/** RLS allows team-owned bookings; the UI must not silently disable a valid global materials lead. */
export function canBookFieldForTeam(
  roles: FieldBookingRole[], teamId: string, memberTeamId: string,
  historicalOrReadOnly: boolean,
): boolean {
  if (historicalOrReadOnly || !teamId) return false
  if (roles.some(({ role_slug }) => role_slug === 'admin')) return true
  if (!memberTeamId || teamId !== memberTeamId) return false
  return roles.some(({ role_slug, team_id }) =>
    (role_slug === 'chef_de_legion' || role_slug === 'responsable_materials')
    && (team_id === teamId || (role_slug === 'responsable_materials' && team_id == null))
  )
}

export function fieldBookingUnavailableReason(args: {
  canBook: boolean
  readOnly: boolean
  hasTeam: boolean
  hasTerm: boolean
  hasZone: boolean
  selectedDate: string
  registeredDates: FieldMeetingDay[]
  today: string
}): string {
  if (args.readOnly) return 'السنة الكشفية المؤرشفة للعرض فقط؛ لا يمكن إضافة أو إلغاء حجوزات فيها.'
  if (!args.hasTeam) return 'لا يوجد فريق حالي مرتبط بحسابك. راجع توزيع الفرق للسنة الكشفية.'
  if (!args.canBook) return 'حجز الأرض متاح لقائد الفريق أو مسؤول الأدوات المكلّف بنفس الفريق. راجع صلاحياتك في السنة الحالية.'
  if (!args.hasTerm) return 'لا يوجد ترم صالح داخل السنة الكشفية المختارة.'
  if (!args.hasZone) return 'لا توجد قطاعات أرض مفعّلة للحجز. راجع صفحة إدارة الأرض.'
  if (!args.registeredDates.length) return 'لا توجد اجتماعات مسجلة لهذا الترم. أضف مواعيد الاجتماعات من إدارة الترمات أولًا.'
  if (!args.selectedDate) return 'اختَر تاريخ اجتماع من قائمة اجتماعات الترم.'
  if (!args.registeredDates.some(x => x.meeting_date === args.selectedDate)) return 'الاجتماع المختار لا ينتمي للترم الحالي.'
  if (args.selectedDate < args.today) return 'الاجتماع المختار انتهى بالفعل. اختر اجتماعًا قادمًا لإضافة حجز جديد.'
  return ''
}
