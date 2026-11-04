import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { useScoutYear } from '../components/ScoutYearProvider'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { InlineAlert } from '../components/ui/InlineAlert'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingButton } from '../components/ui/LoadingButton'
import { MetricCard } from '../components/ui/MetricCard'
import { useToast } from '../components/ui/Toaster'
import { fetchCurrentScoutYearId } from '../features/reference/api'
import scoutSvmLogo from '../assets/scout-svm-logo.png'

type RoleRow = { role_slug: string; team_id?: string | null }
type TeamRow = { id: string; name: string }
type MaterialRow = { id: string; name: string; total_qty?: number | string | null }
type MemberRow = { id: string; auth_user_id?: string | null; full_name: string; team_id: string | null; team_name?: string | null; is_equipier?: boolean | null }
type CampRow = {
  id: string
  title: string
  description?: string | null
  start_date?: string | null
  due_date?: string | null
  status?: string | null
  created_at?: string | null
}
type PlanRow = {
  id: string
  camp_id: string
  team_id: string
  plan_date: string
  day_title: string | null
  day_theme: string | null
  notes: string | null
  assistant_day_leader_member_id: string | null
  assistant_day_leader_name: string | null
  assistant_day_leader_note: string | null
  first_sergeant_member_id: string | null
  first_sergeant_name: string | null
  first_sergeant_note: string | null
  created_at?: string | null
  updated_at?: string | null
}
type ItemRow = {
  id: string
  plan_id: string
  title: string
  start_time: string
  end_time: string
  location: string | null
  manual_materials: string | null
  manual_assignees: string | null
  notes: string | null
  sort_order: number | null
  row_background_color: string | null
  row_text_color: string | null
}
type ItemMaterialRow = {
  id: string
  item_id: string
  material_id: string
  material_name: string
  qty: number | string | null
}
type ItemMemberRow = {
  id: string
  item_id: string
  member_id: string
  member_name: string
}
type ItemTeamRow = {
  id: string
  item_id: string
  team_id: string
  team_name: string
}
type ItemRoomRow = {
  id: string
  item_id: string
  room_key: string
  room_name: string
}
type ActivityView = ItemRow & {
  materials: ItemMaterialRow[]
  members: ItemMemberRow[]
  teams: ItemTeamRow[]
  rooms: ItemRoomRow[]
  plan?: PlanRow | null
  is_fixed?: boolean
}
type MaterialRequest = { material_id: string; qty: number }
type ActivityFormState = {
  id: string | null
  title: string
  start_time: string
  end_time: string
  location: string
  room_key: string
  material_requests: MaterialRequest[]
  manual_materials: string
  member_ids: string[]
  assigned_team_ids: string[]
  manual_assignees: string
  notes: string
  row_background_color: string
  row_text_color: string
}
type ValidationResult = { errors: string[]; warnings: string[] }
type ResourceBooking = {
  id: string
  title: string
  start_time: string
  end_time: string
  team_id: string
  team_name: string
  qty?: number
}

type CampLocationOption = {
  name: string
  group: 'القاعات' | 'الملاعب' | 'أماكن مفتوحة' | 'خدمات ومعالم'
  room_key?: string
}

const CAMP_LOCATIONS: CampLocationOption[] = [
  { name: 'قاعة كبيرة', group: 'القاعات', room_key: 'large_hall' },
  { name: 'قاعة صغيرة ٢', group: 'القاعات', room_key: 'small_hall' },
  { name: 'قاعة صغيرة ٣', group: 'القاعات', room_key: 'small_hall_3' },

  { name: 'ملعب ١ كبير قدم', group: 'الملاعب' },
  { name: 'ملعب ٢ كبير', group: 'الملاعب' },
  { name: 'ملعب ٣', group: 'الملاعب' },
  { name: 'ملعب ٤', group: 'الملاعب' },
  { name: 'ملعب Basketball', group: 'الملاعب' },
  { name: 'ملعب Volleyball', group: 'الملاعب' },

  { name: 'أرض الجراج', group: 'أماكن مفتوحة' },
  { name: 'التبة', group: 'أماكن مفتوحة' },
  { name: 'برجولة ١', group: 'أماكن مفتوحة' },
  { name: 'برجولة ٢ قديمة', group: 'أماكن مفتوحة' },
  { name: 'برجولة ٣', group: 'أماكن مفتوحة' },
  { name: 'نخيلة', group: 'أماكن مفتوحة' },
  { name: 'البيسين', group: 'أماكن مفتوحة' },

  { name: 'المطبخ', group: 'خدمات ومعالم' },
  { name: 'الكانتين', group: 'خدمات ومعالم' },
  { name: 'المراجيح', group: 'خدمات ومعالم' },
  { name: 'البوابة', group: 'خدمات ومعالم' },
  { name: 'طريق السيارات', group: 'خدمات ومعالم' },
  { name: 'طريق أسفلت أمام المبنى', group: 'خدمات ومعالم' },
  { name: 'سلم المبنى', group: 'خدمات ومعالم' },
]

const CAMP_LOCATION_GROUPS: CampLocationOption['group'][] = ['القاعات', 'الملاعب', 'أماكن مفتوحة', 'خدمات ومعالم']

const CAMP_ROOMS = CAMP_LOCATIONS
  .filter((location): location is CampLocationOption & { room_key: string } => Boolean(location.room_key))
  .map((location) => ({ key: location.room_key, name: location.name }))

const CAMP_WORKDAY_START = '06:00'
const CAMP_WORKDAY_END = '04:00'
const CAMP_DAY_ROLLOVER_START_MINUTES = 6 * 60
const ALTERNATIVE_STEP_MINUTES = 15
const DEFAULT_ROW_BACKGROUND = '#ffffff'
const DEFAULT_ROW_TEXT = '#0f172a'

const FIXED_DAILY_ACTIVITIES = [
  {
    key: 'breakfast',
    title: 'الإفطار',
    start_time: '10:00',
    end_time: '11:00',
    row_background_color: '#fef3c7',
    row_text_color: '#78350f',
  },
  {
    key: 'lunch',
    title: 'الغداء',
    start_time: '16:00',
    end_time: '17:00',
    row_background_color: '#dcfce7',
    row_text_color: '#14532d',
  },
  {
    key: 'rovo',
    title: 'الروفو',
    start_time: '17:00',
    end_time: '18:00',
    row_background_color: '#dbeafe',
    row_text_color: '#1e3a8a',
  },
  {
    key: 'dinner',
    title: 'العشاء',
    start_time: '22:00',
    end_time: '23:00',
    row_background_color: '#ede9fe',
    row_text_color: '#4c1d95',
  },
] as const

const ROW_COLOR_PRESETS = [
  { label: 'افتراضي', background: '#ffffff', text: '#0f172a' },
  { label: 'أزرق هادئ', background: '#dbeafe', text: '#1e3a8a' },
  { label: 'أخضر هادئ', background: '#dcfce7', text: '#14532d' },
  { label: 'أصفر هادئ', background: '#fef3c7', text: '#78350f' },
  { label: 'أحمر هادئ', background: '#fee2e2', text: '#7f1d1d' },
  { label: 'بنفسجي هادئ', background: '#ede9fe', text: '#4c1d95' },
  { label: 'كحلي Premium', background: '#172554', text: '#ffffff' },
  { label: 'نبيتي Premium', background: '#7f1d1d', text: '#ffffff' },
] as const

const emptyActivityForm: ActivityFormState = {
  id: null,
  title: '',
  start_time: '09:00',
  end_time: '10:00',
  location: '',
  room_key: '',
  material_requests: [],
  manual_materials: '',
  member_ids: [],
  assigned_team_ids: [],
  manual_assignees: '',
  notes: '',
  row_background_color: DEFAULT_ROW_BACKGROUND,
  row_text_color: DEFAULT_ROW_TEXT,
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(value: string, days: number) {
  const base = value ? new Date(`${value}T00:00:00`) : new Date()
  if (Number.isNaN(+base)) return todayISO()
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

function fmtDate(value?: string | null) {
  if (!value) return '-'
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

function fmtShortDate(value?: string | null) {
  if (!value) return '-'
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('ar-EG', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

function fmtTime(value?: string | null) {
  if (!value) return '-'
  return String(value).slice(0, 5)
}

function fmtDisplayTime(value?: string | null) {
  const clean = fmtTime(value)
  if (clean === '-') return clean
  const [hoursText, minutesText = '00'] = clean.split(':')
  const hours = Number(hoursText)
  if (!Number.isFinite(hours)) return clean
  const suffix = hours < 12 ? 'ص' : 'م'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutesText} ${suffix}`
}

function fmtDisplayRange(start?: string | null, end?: string | null) {
  return `${fmtDisplayTime(start)} - ${fmtDisplayTime(end)}`
}

function dayDefaultTitle(index: number) {
  const labels = ['اليوم الأول', 'اليوم الثاني', 'اليوم الثالث', 'اليوم الرابع', 'اليوم الخامس', 'اليوم السادس', 'اليوم السابع']
  return labels[index - 1] || `اليوم ${index}`
}

function statusLabel(status?: string | null) {
  if (status === 'draft') return 'مسودة'
  if (status === 'open') return 'مفتوح'
  if (status === 'closed') return 'مغلق'
  if (status === 'cancelled') return 'ملغي'
  return status || '-'
}

function textOrDash(value?: string | null) {
  const clean = (value || '').trim()
  return clean || '-'
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function normalizeHexColor(value: string | null | undefined, fallback: string) {
  const clean = String(value || '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean.toLowerCase() : fallback
}

function activityRowColors(item: Pick<ItemRow, 'row_background_color' | 'row_text_color'>) {
  return {
    background: normalizeHexColor(item.row_background_color, DEFAULT_ROW_BACKGROUND),
    text: normalizeHexColor(item.row_text_color, DEFAULT_ROW_TEXT),
  }
}

function safeFileNamePart(value: string) {
  return value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'camp-plan'
}

function hasTimeOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return timeToCampMinutes(aStart) < timeToCampMinutes(bEnd) && timeToCampMinutes(bStart) < timeToCampMinutes(aEnd)
}

function isBackToBack(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return timeToCampMinutes(aEnd) === timeToCampMinutes(bStart) || timeToCampMinutes(bEnd) === timeToCampMinutes(aStart)
}

function timeToMinutes(value?: string | null) {
  const clean = fmtTime(value)
  const [hh, mm] = clean.split(':').map((part) => Number(part))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  return hh * 60 + mm
}

function timeToCampMinutes(value?: string | null) {
  const minutes = timeToMinutes(value)
  // A camp day starts at 6:00 AM and continues after midnight until 4:00 AM.
  // Times before 6:00 AM belong to the tail of the previous camp day.
  return minutes < CAMP_DAY_ROLLOVER_START_MINUTES ? minutes + 24 * 60 : minutes
}

function minutesToTime(totalMinutes: number) {
  const wrapped = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60)
  const hh = Math.floor(wrapped / 60)
  const mm = wrapped % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function durationMinutes(start?: string | null, end?: string | null) {
  return timeToCampMinutes(end) - timeToCampMinutes(start)
}

function campTimeCompare(a?: string | null, b?: string | null) {
  return timeToCampMinutes(a) - timeToCampMinutes(b)
}

function isWithinCampWorkday(start?: string | null, end?: string | null) {
  const dayStart = timeToCampMinutes(CAMP_WORKDAY_START)
  const dayEnd = timeToCampMinutes(CAMP_WORKDAY_END)
  const startMinutes = timeToCampMinutes(start)
  const endMinutes = timeToCampMinutes(end)
  return startMinutes >= dayStart && endMinutes <= dayEnd && endMinutes > startMinutes
}

function findFixedDailyActivityConflict(start: string, end: string) {
  return FIXED_DAILY_ACTIVITIES.find((fixed) => hasTimeOverlap(start, end, fixed.start_time, fixed.end_time)) || null
}

function normalizeQty(value: unknown, fallback = 1) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function materialCapacity(material?: MaterialRow | null) {
  return normalizeQty(material?.total_qty, 1)
}

function toArrayFromMultiSelect(select: HTMLSelectElement) {
  return Array.from(select.selectedOptions).map((option) => option.value).filter(Boolean)
}

function teamNameById(teams: TeamRow[], id?: string | null) {
  return teams.find((team) => team.id === id)?.name || 'فريق غير محدد'
}

function campTitleById(camps: CampRow[], id?: string | null) {
  return camps.find((camp) => camp.id === id)?.title || 'معسكر غير محدد'
}

function roomLabel(roomKey?: string | null) {
  if (!roomKey) return '-'
  return CAMP_ROOMS.find((room) => room.key === roomKey)?.name || roomKey
}

function roomNames(item: ActivityView) {
  return item.rooms.map((room) => room.room_name).join('، ') || '-'
}

function activityPlaceName(item: ActivityView) {
  const location = (item.location || '').trim()
  return location || roomNames(item)
}

function materialNames(item: ActivityView) {
  const selected = item.materials.map((m) => `${m.material_name}${normalizeQty(m.qty, 1) > 1 ? ` × ${normalizeQty(m.qty, 1)}` : ''}`)
  const manual = (item.manual_materials || '').trim()
  return [...selected, manual].filter(Boolean).join('، ') || '-'
}

function assigneeNames(item: ActivityView) {
  const selectedMembers = item.members.map((m) => m.member_name)
  const selectedTeams = item.teams.map((t) => `فريق ${t.team_name}`)
  const manual = (item.manual_assignees || '').trim()
  return [...selectedMembers, ...selectedTeams, manual].filter(Boolean).join('، ') || '-'
}


function pdfText(value?: string | null) {
  // Force a stable RTL base direction for canvas-based PDF export.
  // English words/names remain readable, while Arabic text is no longer flipped or reordered by html2canvas.
  return `<span class="pdf-bidi-text" dir="rtl" lang="ar">${escapeHtml(textOrDash(value))}</span>`
}

function estimatePdfTextLines(value?: string | null, charactersPerLine = 42) {
  const raw = String(value || '').trim()
  if (!raw) return 1
  return raw
    .split(/\r?\n/)
    .map((line) => Math.max(1, Math.ceil(line.trim().length / charactersPerLine)))
    .reduce((sum, count) => sum + count, 0)
}

function estimatePdfRowWeight(item: ActivityView) {
  const cellValues = [
    fmtDisplayRange(item.start_time, item.end_time),
    item.title || '-',
    activityPlaceName(item),
    materialNames(item),
    assigneeNames(item),
    textOrDash(item.notes),
  ]
  const estimatedLines = Math.max(...cellValues.map((value) => estimatePdfTextLines(value)))
  return Math.min(3.4, Math.max(1, 0.85 + (estimatedLines - 1) * 0.42))
}

function paginatePdfItems(items: ActivityView[], firstPageBudget: number, continuationBudget: number) {
  if (!items.length) return [[]]
  const groups: ActivityView[][] = []
  let current: ActivityView[] = []
  let usedBudget = 0
  let budget = firstPageBudget

  items.forEach((item) => {
    const weight = estimatePdfRowWeight(item)
    if (current.length && usedBudget + weight > budget) {
      groups.push(current)
      current = []
      usedBudget = 0
      budget = continuationBudget
    }
    current.push(item)
    usedBudget += weight
  })

  if (current.length) groups.push(current)
  return groups.length ? groups : [[]]
}

function getActivityRoomKey(item: ActivityView) {
  return item.rooms[0]?.room_key || ''
}

function buildBookingText(booking: ResourceBooking) {
  const qtyText = booking.qty && booking.qty > 0 ? ` - كمية ${booking.qty}` : ''
  return `${booking.team_name} من ${fmtDisplayTime(booking.start_time)} إلى ${fmtDisplayTime(booking.end_time)} (${booking.title})${qtyText}`
}

function buildFixedActivities(plan: PlanRow): ActivityView[] {
  return FIXED_DAILY_ACTIVITIES.map((fixed, index) => ({
    id: `fixed-${plan.id}-${fixed.key}`,
    plan_id: plan.id,
    title: fixed.title,
    start_time: fixed.start_time,
    end_time: fixed.end_time,
    location: '-',
    manual_materials: null,
    manual_assignees: null,
    notes: 'موعد ثابت',
    sort_order: -100 + index,
    row_background_color: fixed.row_background_color,
    row_text_color: fixed.row_text_color,
    materials: [],
    members: [],
    teams: [],
    rooms: [],
    plan,
    is_fixed: true,
  }))
}

function memberNameById(members: MemberRow[], memberId?: string | null, storedName?: string | null) {
  if (!memberId) return '-'
  return members.find((member) => member.id === memberId)?.full_name || storedName || 'عضو غير متاح'
}

export default function CampProgram() {
  const toast = useToast()
  const { roles, user, myTeamId } = useAuth() as {
    roles: RoleRow[]
    user: { id?: string; email?: string; name?: string } | null
    myTeamId: string | null
  }
  const { currentScoutYear } = useScoutYear()

  const [loading, setLoading] = useState(true)
  const [savingDay, setSavingDay] = useState(false)
  const [savingActivity, setSavingActivity] = useState(false)
  const [savingAccess, setSavingAccess] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [accessLoading, setAccessLoading] = useState(true)
  const [isMapOpen, setIsMapOpen] = useState(false)
  const [isActivityEditorOpen, setIsActivityEditorOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [teams, setTeams] = useState<TeamRow[]>([])
  const [materials, setMaterials] = useState<MaterialRow[]>([])
  const [camps, setCamps] = useState<CampRow[]>([])
  const [teamChefs, setTeamChefs] = useState<MemberRow[]>([])
  const [delegatedTeamIds, setDelegatedTeamIds] = useState<string[]>([])
  const [selectedAccessMemberIds, setSelectedAccessMemberIds] = useState<string[]>([])

  const [selectedCampId, setSelectedCampId] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('')

  const [plans, setPlans] = useState<PlanRow[]>([])
  const [activities, setActivities] = useState<ActivityView[]>([])

  const [dayDate, setDayDate] = useState(todayISO())
  const [dayTitle, setDayTitle] = useState('')
  const [dayTheme, setDayTheme] = useState('')
  const [dayNotes, setDayNotes] = useState('')
  const [dayAssistantLeaderMemberId, setDayAssistantLeaderMemberId] = useState('')
  const [dayAssistantLeaderNote, setDayAssistantLeaderNote] = useState('')
  const [dayFirstSergeantMemberId, setDayFirstSergeantMemberId] = useState('')
  const [dayFirstSergeantNote, setDayFirstSergeantNote] = useState('')
  const [activityForm, setActivityForm] = useState<ActivityFormState>(emptyActivityForm)
  const [materialToAdd, setMaterialToAdd] = useState('')
  const lastLocationConflictToast = useRef('')
  const daySwipeStartRef = useRef<{ x: number; y: number } | null>(null)

  const isAdmin = useMemo(() => roles.some((r) => r.role_slug === 'admin'), [roles])
  const chefTeamIds = useMemo(
    () => Array.from(new Set(roles.filter((r) => r.role_slug === 'chef_de_legion' && r.team_id).map((r) => r.team_id as string))),
    [roles]
  )
  const editableTeamIds = useMemo(
    () => Array.from(new Set([...chefTeamIds, ...delegatedTeamIds])),
    [chefTeamIds, delegatedTeamIds]
  )
  const canAccess = isAdmin || editableTeamIds.length > 0
  const canEditSelectedTeam = Boolean(isAdmin || (selectedTeamId && editableTeamIds.includes(selectedTeamId)))
  const canExportSelectedTeam = Boolean(isAdmin || (selectedTeamId && editableTeamIds.includes(selectedTeamId)))
  const canManageSelectedTeamAccess = Boolean(isAdmin || (selectedTeamId && chefTeamIds.includes(selectedTeamId)))

  const selectedTeamPlans = useMemo(
    () => plans.filter((plan) => plan.team_id === selectedTeamId).sort((a, b) => a.plan_date.localeCompare(b.plan_date)),
    [plans, selectedTeamId]
  )

  const selectedPlan = useMemo(
    () => selectedTeamPlans.find((plan) => plan.id === selectedPlanId) || selectedTeamPlans[0] || null,
    [selectedPlanId, selectedTeamPlans]
  )

  const selectedPlanActivities = useMemo(
    () => activities.filter((item) => item.plan_id === selectedPlan?.id).sort((a, b) => {
      const timeCompare = campTimeCompare(a.start_time, b.start_time)
      if (timeCompare !== 0) return timeCompare
      return Number(a.sort_order || 0) - Number(b.sort_order || 0)
    }),
    [activities, selectedPlan?.id]
  )

  const selectedPlanDisplayActivities = useMemo(() => {
    if (!selectedPlan) return [] as ActivityView[]
    return [...selectedPlanActivities, ...buildFixedActivities(selectedPlan)].sort((a, b) => {
      const timeCompare = campTimeCompare(a.start_time, b.start_time)
      if (timeCompare !== 0) return timeCompare
      if (a.is_fixed !== b.is_fixed) return a.is_fixed ? -1 : 1
      return Number(a.sort_order || 0) - Number(b.sort_order || 0)
    })
  }, [selectedPlan, selectedPlanActivities])

  const plansByTeam = useMemo(() => {
    const map = new Map<string, number>()
    for (const plan of plans) map.set(plan.team_id, (map.get(plan.team_id) || 0) + 1)
    return map
  }, [plans])

  const materialMap = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials])

  const selectedResourceDuration = useMemo(() => durationMinutes(activityForm.start_time, activityForm.end_time), [activityForm.end_time, activityForm.start_time])

  const selectedDayAllActivities = useMemo(() => {
    if (!selectedCampId || !selectedPlan) return [] as ActivityView[]
    return activities.filter((item) => item.plan?.camp_id === selectedCampId && item.plan?.plan_date === selectedPlan.plan_date)
  }, [activities, selectedCampId, selectedPlan])

  const selectedTeamRoomBookingsToday = useMemo(() => {
    if (!selectedPlan || !selectedTeamId) return [] as ActivityView[]
    return selectedDayAllActivities.filter((item) => item.plan?.team_id === selectedTeamId && item.rooms.length > 0 && (!activityForm.id || item.id !== activityForm.id))
  }, [activityForm.id, selectedDayAllActivities, selectedPlan, selectedTeamId])

  const selectedLocationOption = useMemo(
    () => CAMP_LOCATIONS.find((location) => location.name === activityForm.location) || null,
    [activityForm.location]
  )

  const selectedLocationConflicts = useMemo<ResourceBooking[]>(() => {
    if (!selectedPlan || !activityForm.location || selectedLocationOption?.room_key) return []

    return selectedDayAllActivities
      .filter((item) => {
        if (activityForm.id && item.id === activityForm.id) return false
        if (item.plan?.team_id === selectedTeamId) return false
        if ((item.location || '').trim() !== activityForm.location.trim()) return false
        return hasTimeOverlap(activityForm.start_time, activityForm.end_time, item.start_time, item.end_time)
      })
      .map((item) => ({
        id: item.id,
        title: item.title,
        start_time: fmtTime(item.start_time),
        end_time: fmtTime(item.end_time),
        team_id: item.plan?.team_id || '',
        team_name: teamNameById(teams, item.plan?.team_id),
      }))
      .sort((a, b) => campTimeCompare(a.start_time, b.start_time))
  }, [
    activityForm.end_time,
    activityForm.id,
    activityForm.location,
    activityForm.start_time,
    selectedDayAllActivities,
    selectedLocationOption?.room_key,
    selectedPlan,
    selectedTeamId,
    teams,
  ])

  const nextSuggestedDate = useMemo(() => {
    if (selectedTeamPlans.length) return addDaysISO(selectedTeamPlans[selectedTeamPlans.length - 1].plan_date, 1)
    const camp = camps.find((c) => c.id === selectedCampId)
    return camp?.start_date || todayISO()
  }, [camps, selectedCampId, selectedTeamPlans])

  const resetActivityForm = useCallback(() => {
    setActivityForm({ ...emptyActivityForm, material_requests: [] })
    setMaterialToAdd('')
  }, [])

  const openNewActivityEditor = useCallback(() => {
    resetActivityForm()
    setIsActivityEditorOpen(true)
  }, [resetActivityForm])

  const closeActivityEditor = useCallback(() => {
    resetActivityForm()
    setIsActivityEditorOpen(false)
  }, [resetActivityForm])

  function selectAdjacentPlan(direction: -1 | 1) {
    if (!selectedPlan || selectedTeamPlans.length < 2) return
    const currentIndex = selectedTeamPlans.findIndex((plan) => plan.id === selectedPlan.id)
    if (currentIndex < 0) return
    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= selectedTeamPlans.length) return
    setSelectedPlanId(selectedTeamPlans[nextIndex].id)
    resetActivityForm()
    setIsActivityEditorOpen(false)
  }

  function handleDaySwipeStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.changedTouches[0]
    daySwipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  function handleDaySwipeEnd(event: React.TouchEvent<HTMLDivElement>) {
    const start = daySwipeStartRef.current
    const touch = event.changedTouches[0]
    daySwipeStartRef.current = null
    if (!start || !touch) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 65 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return
    selectAdjacentPlan(deltaX < 0 ? 1 : -1)
  }

  function handleLocationChange(locationName: string) {
    const location = CAMP_LOCATIONS.find((option) => option.name === locationName)
    setActivityForm((previous) => ({
      ...previous,
      location: locationName,
      room_key: location?.room_key || '',
    }))
  }

  function resourceBookingsForRoom(roomKey: string): ResourceBooking[] {
    if (!selectedPlan) return []
    return selectedDayAllActivities
      .filter((item) => item.rooms.some((room) => room.room_key === roomKey) && (!activityForm.id || item.id !== activityForm.id))
      .map((item) => ({
        id: item.id,
        title: item.title,
        start_time: fmtTime(item.start_time),
        end_time: fmtTime(item.end_time),
        team_id: item.plan?.team_id || '',
        team_name: teamNameById(teams, item.plan?.team_id),
      }))
      .sort((a, b) => campTimeCompare(a.start_time, b.start_time))
  }

  function resourceBookingsForMaterial(materialId: string): ResourceBooking[] {
    if (!selectedPlan) return []
    const bookings: ResourceBooking[] = []

    for (const item of selectedDayAllActivities) {
      if (activityForm.id && item.id === activityForm.id) continue
      const material = item.materials.find((row) => row.material_id === materialId)
      if (!material) continue

      bookings.push({
        id: item.id,
        title: item.title,
        start_time: fmtTime(item.start_time),
        end_time: fmtTime(item.end_time),
        team_id: item.plan?.team_id || '',
        team_name: teamNameById(teams, item.plan?.team_id),
        qty: normalizeQty(material.qty, 1),
      })
    }

    return bookings.sort((a, b) => campTimeCompare(a.start_time, b.start_time))
  }

  function overlappingBookings(bookings: ResourceBooking[], start = activityForm.start_time, end = activityForm.end_time) {
    if (!start || !end || timeToCampMinutes(end) <= timeToCampMinutes(start)) return [] as ResourceBooking[]
    return bookings.filter((booking) => hasTimeOverlap(start, end, booking.start_time, booking.end_time))
  }

  function findRoomAlternative(roomKey: string, duration = Math.max(selectedResourceDuration, 15)) {
    const bookings = resourceBookingsForRoom(roomKey)
    return findAlternativeWindow({
      duration,
      isAvailable: (start, end) => !findFixedDailyActivityConflict(start, end) && !overlappingBookings(bookings, start, end).length,
    })
  }

  function findMaterialAlternative(materialId: string, requestedQty: number, duration = Math.max(selectedResourceDuration, 15)) {
    const material = materialMap.get(materialId)
    const capacity = materialCapacity(material)
    const bookings = resourceBookingsForMaterial(materialId)
    return findAlternativeWindow({
      duration,
      isAvailable: (start, end) => {
        if (findFixedDailyActivityConflict(start, end)) return false
        const bookedQty = overlappingBookings(bookings, start, end).reduce((sum, booking) => sum + normalizeQty(booking.qty, 1), 0)
        return bookedQty + requestedQty <= capacity
      },
      isConsecutiveBlocked: (start, end) => selectedDayAllActivities.some((item) => {
        if (item.plan?.team_id !== selectedTeamId) return false
        if (activityForm.id && item.id === activityForm.id) return false
        if (!item.materials.some((row) => row.material_id === materialId)) return false
        return isBackToBack(start, end, item.start_time, item.end_time)
      }),
    })
  }

  function findAlternativeWindow(args: { duration: number; isAvailable: (start: string, end: string) => boolean; isConsecutiveBlocked?: (start: string, end: string) => boolean }) {
    const dayStart = timeToCampMinutes(CAMP_WORKDAY_START)
    const dayEnd = timeToCampMinutes(CAMP_WORKDAY_END)
    const duration = Math.max(args.duration || 60, 15)
    const preferredStart = Math.max(dayStart, timeToCampMinutes(activityForm.end_time))

    const candidates: number[] = []
    for (let start = preferredStart; start + duration <= dayEnd; start += ALTERNATIVE_STEP_MINUTES) candidates.push(start)
    for (let start = dayStart; start + duration <= Math.min(preferredStart, dayEnd); start += ALTERNATIVE_STEP_MINUTES) candidates.push(start)

    for (const startMinutes of candidates) {
      const start = minutesToTime(startMinutes)
      const end = minutesToTime(startMinutes + duration)
      if (args.isConsecutiveBlocked?.(start, end)) continue
      if (args.isAvailable(start, end)) return fmtDisplayRange(start, end)
    }
    return ''
  }

  function validateActivity(): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    if (!activityForm.start_time || !activityForm.end_time || !isWithinCampWorkday(activityForm.start_time, activityForm.end_time)) {
      errors.push('تأكد من توقيت البداية والنهاية. اليوم يبدأ 6:00 ص وينتهي 4:00 ص، ولا يمكن الحجز في فترة 4:00 ص إلى 6:00 ص.')
      return { errors, warnings }
    }

    const fixedConflict = findFixedDailyActivityConflict(activityForm.start_time, activityForm.end_time)

    if (fixedConflict) {
      errors.push(
        `لا يمكن إضافة فقرة أو حجز من ${fmtDisplayTime(activityForm.start_time)} إلى ${fmtDisplayTime(activityForm.end_time)} لأنه يتداخل مع موعد ${fixedConflict.title} الثابت من ${fmtDisplayTime(fixedConflict.start_time)} إلى ${fmtDisplayTime(fixedConflict.end_time)}.`
      )
    }

    if (!activityForm.location.trim()) {
      errors.push('اختار مكان الفقرة أو القاعة من قائمة أماكن المعسكر.')
    }

    if (selectedLocationConflicts.length) {
      warnings.push(
        `${activityForm.location} مستخدم في نفس التوقيت بواسطة: ${selectedLocationConflicts.map(buildBookingText).join(' / ')}. هذا تنبيه فقط ويمكنك الحفظ لأن بعض الأماكن تستوعب أكثر من فريق.`
      )
    }

    if (selectedResourceDuration <= 0) {
      errors.push('مدة الفقرة غير صحيحة.')
    }

    if (activityForm.room_key) {
      const roomBookings = resourceBookingsForRoom(activityForm.room_key)
      const conflicts = overlappingBookings(roomBookings)
      if (conflicts.length) {
        errors.push(`${roomLabel(activityForm.room_key)} محجوزة بالفعل: ${conflicts.map(buildBookingText).join(' / ')}`)
        const alternative = findRoomAlternative(activityForm.room_key)
        if (alternative) warnings.push(`أقرب وقت متاح لـ ${roomLabel(activityForm.room_key)}: ${alternative}`)
      }

    }

    for (const request of activityForm.material_requests) {
      const material = materialMap.get(request.material_id)
      if (!material) continue
      const requestedQty = normalizeQty(request.qty, 1)
      const capacity = materialCapacity(material)
      if (requestedQty > capacity) {
        errors.push(`الكمية المطلوبة من ${material.name} أكبر من إجمالي المتاح (${capacity}).`)
      }

      const bookings = resourceBookingsForMaterial(request.material_id)
      const conflicts = overlappingBookings(bookings)
      const bookedQty = conflicts.reduce((sum, booking) => sum + normalizeQty(booking.qty, 1), 0)
      if (bookedQty + requestedQty > capacity) {
        const available = Math.max(0, capacity - bookedQty)
        errors.push(`${material.name}: الكمية غير كافية في هذا التوقيت. المطلوب ${requestedQty} والمتاح ${available} من إجمالي ${capacity}. الحجوزات: ${conflicts.map(buildBookingText).join(' / ') || 'لا يوجد'}`)
        const alternative = findMaterialAlternative(request.material_id, requestedQty)
        if (alternative) warnings.push(`أقرب وقت متاح لـ ${material.name} بالكمية المطلوبة: ${alternative}`)
      }

      const consecutiveMaterial = selectedDayAllActivities.find((item) => {
        if (item.plan?.team_id !== selectedTeamId) return false
        if (activityForm.id && item.id === activityForm.id) return false
        if (!item.materials.some((row) => row.material_id === request.material_id)) return false
        return isBackToBack(activityForm.start_time, activityForm.end_time, item.start_time, item.end_time)
      })
      if (consecutiveMaterial) {
        errors.push(`لا يمكن حجز ${material.name} في توقيت متواصل مباشرة مع حجز آخر لنفس الفريق (${fmtDisplayRange(consecutiveMaterial.start_time, consecutiveMaterial.end_time)}). لازم يكون فيه فاصل.`)
      }
    }

    if (activityForm.material_requests.length && activityForm.manual_materials.trim()) {
      warnings.push('الأدوات المكتوبة يدويًا ستظهر في البرنامج والـ PDF فقط، ولن تدخل في حساب الكميات أو التعارضات.')
    }

    return { errors, warnings }
  }

  const validationPreview = useMemo(
    () => validateActivity(),
    [activityForm, activities, materialMap, selectedDayAllActivities, selectedLocationConflicts, selectedResourceDuration, selectedTeamId, selectedTeamRoomBookingsToday, teams]
  )

  useEffect(() => {
    let mounted = true

    const loadDelegatedTeams = async () => {
      if (!user?.id) {
        if (mounted) {
          setDelegatedTeamIds([])
          setAccessLoading(false)
        }
        return
      }

      try {
        const { data, error: accessError } = await supabase
          .from('camp_program_team_access')
          .select('team_id')
          .eq('user_id', user.id)
          .eq('is_active', true)

        if (accessError) throw accessError
        if (mounted) setDelegatedTeamIds(Array.from(new Set((data || []).map((row: any) => row.team_id).filter(Boolean))))
      } catch {
        if (mounted) setDelegatedTeamIds([])
      } finally {
        if (mounted) setAccessLoading(false)
      }
    }

    void loadDelegatedTeams()
    return () => {
      mounted = false
    }
  }, [user?.id])

  const loadBaseData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (!canAccess) {
        setLoading(false)
        return
      }

      const currentScoutYearId = await fetchCurrentScoutYearId().catch(() => null)

      let campsQuery = supabase
        .from('camp_installments')
        .select('id, title, description, start_date, due_date, status, created_at')
        .order('created_at', { ascending: false }) as any

      if (currentScoutYearId) campsQuery = campsQuery.eq('scout_year_id', currentScoutYearId)

      const [teamsRes, materialsRes, campsRes] = await Promise.all([
        supabase.from('teams').select('id, name').order('name', { ascending: true }),
        supabase.from('materials').select('id, name, total_qty').eq('active', true).order('name', { ascending: true }),
        campsQuery,
      ])

      if (teamsRes.error) throw teamsRes.error
      if (materialsRes.error) throw materialsRes.error
      if (campsRes.error) throw campsRes.error

      const nextTeams = ((teamsRes.data || []) as TeamRow[])
      const nextMaterials = ((materialsRes.data || []) as MaterialRow[])
      const nextCamps = ((campsRes.data || []) as CampRow[])

      setTeams(nextTeams)
      setMaterials(nextMaterials)
      setCamps(nextCamps)

      setSelectedCampId((prev) => prev || nextCamps[0]?.id || '')
      setSelectedTeamId((prev) => prev || myTeamId || editableTeamIds[0] || nextTeams[0]?.id || '')
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل بيانات نظام المعسكر')
    } finally {
      setLoading(false)
    }
  }, [canAccess, editableTeamIds, myTeamId])

  const loadPlans = useCallback(async () => {
    if (!selectedCampId || !canAccess) {
      setPlans([])
      setActivities([])
      return
    }

    setError(null)

    try {
      const { data: planData, error: planError } = await supabase
        .from('camp_daily_plans')
        .select('id, camp_id, team_id, plan_date, day_title, day_theme, notes, assistant_day_leader_member_id, assistant_day_leader_name, assistant_day_leader_note, first_sergeant_member_id, first_sergeant_name, first_sergeant_note, created_at, updated_at')
        .eq('camp_id', selectedCampId)
        .is('soft_deleted_at', null)
        .order('plan_date', { ascending: true })

      if (planError) throw planError

      const loadedPlans = (planData || []) as PlanRow[]
      setPlans(loadedPlans)

      const planIds = loadedPlans.map((plan) => plan.id)
      if (!planIds.length) {
        setActivities([])
        setSelectedPlanId('')
        return
      }

      const { data: itemData, error: itemError } = await supabase
        .from('camp_program_items')
        .select('id, plan_id, title, start_time, end_time, location, manual_materials, manual_assignees, notes, sort_order, row_background_color, row_text_color')
        .in('plan_id', planIds)
        .is('soft_deleted_at', null)
        .order('sort_order', { ascending: true })

      if (itemError) throw itemError

      const items = (itemData || []) as ItemRow[]
      const itemIds = items.map((item) => item.id)

      let itemMaterials: ItemMaterialRow[] = []
      let itemMembers: ItemMemberRow[] = []
      let itemTeams: ItemTeamRow[] = []
      let itemRooms: ItemRoomRow[] = []

      if (itemIds.length) {
        const [materialsRes, membersRes, teamsRes, roomsRes] = await Promise.all([
          supabase
            .from('camp_program_item_materials')
            .select('id, item_id, material_id, material_name, qty')
            .in('item_id', itemIds)
            .order('material_name', { ascending: true }),
          supabase
            .from('camp_program_item_members')
            .select('id, item_id, member_id, member_name')
            .in('item_id', itemIds)
            .order('member_name', { ascending: true }),
          supabase
            .from('camp_program_item_teams')
            .select('id, item_id, team_id, team_name')
            .in('item_id', itemIds)
            .order('team_name', { ascending: true }),
          supabase
            .from('camp_program_item_rooms')
            .select('id, item_id, room_key, room_name')
            .in('item_id', itemIds)
            .order('room_name', { ascending: true }),
        ])

        if (materialsRes.error) throw materialsRes.error
        if (membersRes.error) throw membersRes.error
        if (teamsRes.error) throw teamsRes.error
        if (roomsRes.error) throw roomsRes.error

        itemMaterials = (materialsRes.data || []) as ItemMaterialRow[]
        itemMembers = (membersRes.data || []) as ItemMemberRow[]
        itemTeams = (teamsRes.data || []) as ItemTeamRow[]
        itemRooms = (roomsRes.data || []) as ItemRoomRow[]
      }

      const planMap = new Map(loadedPlans.map((plan) => [plan.id, plan]))
      const materialRowsMap = new Map<string, ItemMaterialRow[]>()
      const memberRowsMap = new Map<string, ItemMemberRow[]>()
      const teamRowsMap = new Map<string, ItemTeamRow[]>()
      const roomRowsMap = new Map<string, ItemRoomRow[]>()

      for (const row of itemMaterials) materialRowsMap.set(row.item_id, [...(materialRowsMap.get(row.item_id) || []), row])
      for (const row of itemMembers) memberRowsMap.set(row.item_id, [...(memberRowsMap.get(row.item_id) || []), row])
      for (const row of itemTeams) teamRowsMap.set(row.item_id, [...(teamRowsMap.get(row.item_id) || []), row])
      for (const row of itemRooms) roomRowsMap.set(row.item_id, [...(roomRowsMap.get(row.item_id) || []), row])

      setActivities(items.map((item) => ({
        ...item,
        materials: materialRowsMap.get(item.id) || [],
        members: memberRowsMap.get(item.id) || [],
        teams: teamRowsMap.get(item.id) || [],
        rooms: roomRowsMap.get(item.id) || [],
        plan: planMap.get(item.plan_id) || null,
      })))
    } catch (e: any) {
      const message = e?.message || 'تعذر تحميل برنامج المعسكر'
      setError(message.includes('camp_') || message.includes('relation') ? 'جداول نظام المعسكر غير مكتملة في Supabase. طبّق ملف supabase/07_camp_program.sql أولًا.' : message)
      setPlans([])
      setActivities([])
    }
  }, [canAccess, selectedCampId])

  const loadTeamChefs = useCallback(async () => {
    if (!selectedTeamId || !canAccess) {
      setTeamChefs([])
      return
    }

    try {
      const { data, error } = await scoutYearFrom('v_members_current', 'v_members_context')
        .select('id, auth_user_id, full_name, team_id, team_name, is_equipier')
        .eq('team_id', selectedTeamId)
        .eq('is_equipier', false)
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      if (error) throw error
      setTeamChefs((data || []) as MemberRow[])
    } catch {
      setTeamChefs([])
    }
  }, [canAccess, selectedTeamId])

  const loadTeamAccessAssignments = useCallback(async () => {
    if (!selectedTeamId || !canManageSelectedTeamAccess) {
      setSelectedAccessMemberIds([])
      return
    }

    try {
      const { data, error: accessError } = await supabase
        .from('camp_program_team_access')
        .select('id, team_id, member_id, user_id, is_active')
        .eq('team_id', selectedTeamId)
        .order('created_at', { ascending: true })

      if (accessError) throw accessError
      const rows = (data || []) as { member_id: string; is_active: boolean }[]
      setSelectedAccessMemberIds(rows.filter((row) => row.is_active).map((row) => row.member_id))
    } catch {
      setSelectedAccessMemberIds([])
    }
  }, [canManageSelectedTeamAccess, selectedTeamId])

  async function saveTeamAccessAssignments() {
    if (!selectedTeamId || !canManageSelectedTeamAccess) return

    const selectedMembers = teamChefs.filter((member) => member.auth_user_id && selectedAccessMemberIds.includes(member.id))
    setSavingAccess(true)
    try {
      const { error: deactivateError } = await supabase
        .from('camp_program_team_access')
        .update({ is_active: false, updated_at: new Date().toISOString(), updated_by: user?.id || null })
        .eq('team_id', selectedTeamId)

      if (deactivateError) throw deactivateError

      if (selectedMembers.length) {
        const { error: upsertError } = await supabase
          .from('camp_program_team_access')
          .upsert(
            selectedMembers.map((member) => ({
              team_id: selectedTeamId,
              member_id: member.id,
              user_id: member.auth_user_id as string,
              is_active: true,
              granted_by: user?.id || null,
              updated_by: user?.id || null,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: 'team_id,member_id' }
          )

        if (upsertError) throw upsertError
      }

      toast.success('تم تحديث صلاحيات نظام المعسكر للفريق')
      await loadTeamAccessAssignments()
    } catch (e: any) {
      toast.error(e?.message || 'تعذر تحديث صلاحيات نظام المعسكر')
    } finally {
      setSavingAccess(false)
    }
  }

  useEffect(() => {
    loadBaseData()
  }, [loadBaseData])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  useEffect(() => {
    loadTeamChefs()
  }, [loadTeamChefs])

  useEffect(() => {
    loadTeamAccessAssignments()
  }, [loadTeamAccessAssignments])

  useEffect(() => {
    const signature = selectedLocationConflicts.length
      ? `${activityForm.location}|${activityForm.start_time}|${activityForm.end_time}|${selectedLocationConflicts.map((booking) => booking.id).join(',')}`
      : ''

    if (signature && signature !== lastLocationConflictToast.current) {
      toast.info(
        `${activityForm.location} مستخدم في نفس التوقيت بواسطة ${selectedLocationConflicts.map((booking) => booking.team_name).join('، ')}. يمكنك الحفظ، وهذا تنبيه للتنسيق فقط.`,
        '⚠️ تنبيه حجز المكان',
        6500
      )
    }

    lastLocationConflictToast.current = signature
  }, [activityForm.end_time, activityForm.location, activityForm.start_time, selectedLocationConflicts, toast])

  useEffect(() => {
    if (!isActivityEditorOpen || typeof window === 'undefined') return undefined
    const isMobile = window.matchMedia('(max-width: 639px)').matches
    if (!isMobile) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isActivityEditorOpen])

  useEffect(() => {
    if (!selectedPlanId && selectedTeamPlans[0]?.id) setSelectedPlanId(selectedTeamPlans[0].id)
    if (selectedPlanId && !selectedTeamPlans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(selectedTeamPlans[0]?.id || '')
    }
  }, [selectedPlanId, selectedTeamPlans])

  useEffect(() => {
    if (!selectedTeamPlans.length) {
      setDayDate(nextSuggestedDate)
      setDayTitle(dayDefaultTitle(1))
      setDayTheme('')
      setDayNotes('')
      setDayAssistantLeaderMemberId('')
      setDayAssistantLeaderNote('')
      setDayFirstSergeantMemberId('')
      setDayFirstSergeantNote('')
      return
    }
    setDayDate(nextSuggestedDate)
    setDayTitle(dayDefaultTitle(selectedTeamPlans.length + 1))
    setDayTheme('')
    setDayNotes('')
    setDayAssistantLeaderMemberId('')
    setDayAssistantLeaderNote('')
    setDayFirstSergeantMemberId('')
    setDayFirstSergeantNote('')
  }, [nextSuggestedDate, selectedTeamPlans.length])

  async function saveDay() {
    if (!selectedCampId || !selectedTeamId) {
      toast.error('اختار المعسكر والفريق أولًا')
      return
    }
    if (!canEditSelectedTeam) {
      toast.error('تقدر تشوف بلان الفرق الأخرى فقط بدون تعديل')
      return
    }
    if (!dayDate) {
      toast.error('اختار تاريخ اليوم')
      return
    }
    if (!dayAssistantLeaderMemberId) {
      toast.error('اختار مساعد قائد اليوم قبل حفظ اليوم')
      return
    }

    const assistantLeader = teamChefs.find((member) => member.id === dayAssistantLeaderMemberId)
    if (!assistantLeader) {
      toast.error('مساعد قائد اليوم المختار غير موجود ضمن شيفات الفريق')
      return
    }
    const firstSergeant = dayFirstSergeantMemberId
      ? teamChefs.find((member) => member.id === dayFirstSergeantMemberId) || null
      : null

    setSavingDay(true)
    try {
      const payload = {
        camp_id: selectedCampId,
        team_id: selectedTeamId,
        plan_date: dayDate,
        day_title: dayTitle.trim() || dayDefaultTitle(selectedTeamPlans.length + 1),
        day_theme: dayTheme.trim() || null,
        notes: dayNotes.trim() || null,
        assistant_day_leader_member_id: assistantLeader.id,
        assistant_day_leader_name: assistantLeader.full_name,
        assistant_day_leader_note: dayAssistantLeaderNote.trim() || null,
        first_sergeant_member_id: firstSergeant?.id || null,
        first_sergeant_name: firstSergeant?.full_name || null,
        first_sergeant_note: dayFirstSergeantNote.trim() || null,
        created_by: user?.id || null,
        updated_by: user?.id || null,
      }

      const { data, error } = await supabase
        .from('camp_daily_plans')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw error
      toast.success('تم إضافة اليوم للبرنامج')
      await loadPlans()
      if (data?.id) setSelectedPlanId(data.id)
    } catch (e: any) {
      const message = e?.message || 'تعذر حفظ اليوم'
      toast.error(message.includes('duplicate') || message.includes('unique') ? 'هذا اليوم مضاف بالفعل لنفس الفريق والمعسكر' : message)
    } finally {
      setSavingDay(false)
    }
  }

  async function updateSelectedDay() {
    if (!selectedPlan) return
    if (!canEditSelectedTeam) return

    if (!selectedPlan.assistant_day_leader_member_id) {
      toast.error('اختار مساعد قائد اليوم قبل حفظ بيانات اليوم')
      return
    }

    const assistantLeader = teamChefs.find((member) => member.id === selectedPlan.assistant_day_leader_member_id)
    if (!assistantLeader && !selectedPlan.assistant_day_leader_name) {
      toast.error('مساعد قائد اليوم المختار غير موجود ضمن شيفات الفريق')
      return
    }
    const firstSergeant = selectedPlan.first_sergeant_member_id
      ? teamChefs.find((member) => member.id === selectedPlan.first_sergeant_member_id) || null
      : null

    setSavingDay(true)
    try {
      const { error } = await supabase
        .from('camp_daily_plans')
        .update({
          plan_date: selectedPlan.plan_date,
          day_title: selectedPlan.day_title,
          day_theme: selectedPlan.day_theme,
          notes: selectedPlan.notes,
          assistant_day_leader_member_id: selectedPlan.assistant_day_leader_member_id,
          assistant_day_leader_name: assistantLeader?.full_name || selectedPlan.assistant_day_leader_name,
          assistant_day_leader_note: selectedPlan.assistant_day_leader_note,
          first_sergeant_member_id: selectedPlan.first_sergeant_member_id || null,
          first_sergeant_name: firstSergeant?.full_name || selectedPlan.first_sergeant_name || null,
          first_sergeant_note: selectedPlan.first_sergeant_note,
          updated_by: user?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPlan.id)

      if (error) throw error
      toast.success('تم تحديث بيانات اليوم')
      await loadPlans()
    } catch (e: any) {
      toast.error(e?.message || 'تعذر تحديث اليوم')
    } finally {
      setSavingDay(false)
    }
  }

  async function softDeleteSelectedDay() {
    if (!selectedPlan || !canEditSelectedTeam) return
    if (!window.confirm('هل تريد حذف اليوم بكل فقراته من البرنامج؟')) return

    setSavingDay(true)
    try {
      const { error } = await supabase
        .from('camp_daily_plans')
        .update({ soft_deleted_at: new Date().toISOString(), updated_by: user?.id || null })
        .eq('id', selectedPlan.id)

      if (error) throw error
      toast.success('تم حذف اليوم')
      resetActivityForm()
      await loadPlans()
    } catch (e: any) {
      toast.error(e?.message || 'تعذر حذف اليوم')
    } finally {
      setSavingDay(false)
    }
  }

  function startEditActivity(item: ActivityView) {
    const roomKey = getActivityRoomKey(item)
    setActivityForm({
      id: item.id,
      title: item.title || '',
      start_time: fmtTime(item.start_time),
      end_time: fmtTime(item.end_time),
      location: item.location || (roomKey ? roomLabel(roomKey) : ''),
      room_key: roomKey,
      material_requests: item.materials.map((m) => ({ material_id: m.material_id, qty: normalizeQty(m.qty, 1) })),
      manual_materials: item.manual_materials || '',
      member_ids: item.members.map((m) => m.member_id),
      assigned_team_ids: item.teams.map((t) => t.team_id),
      manual_assignees: item.manual_assignees || '',
      notes: item.notes || '',
      row_background_color: normalizeHexColor(item.row_background_color, DEFAULT_ROW_BACKGROUND),
      row_text_color: normalizeHexColor(item.row_text_color, DEFAULT_ROW_TEXT),
    })
    setIsActivityEditorOpen(true)
  }

  function duplicateActivity(item: ActivityView) {
    const roomKey = getActivityRoomKey(item)
    setActivityForm({
      id: null,
      title: `${item.title || ''} - نسخة`.trim(),
      start_time: fmtTime(item.start_time),
      end_time: fmtTime(item.end_time),
      location: item.location || (roomKey ? roomLabel(roomKey) : ''),
      room_key: roomKey,
      material_requests: item.materials.map((m) => ({ material_id: m.material_id, qty: normalizeQty(m.qty, 1) })),
      manual_materials: item.manual_materials || '',
      member_ids: item.members.map((m) => m.member_id),
      assigned_team_ids: item.teams.map((t) => t.team_id),
      manual_assignees: item.manual_assignees || '',
      notes: item.notes || '',
      row_background_color: normalizeHexColor(item.row_background_color, DEFAULT_ROW_BACKGROUND),
      row_text_color: normalizeHexColor(item.row_text_color, DEFAULT_ROW_TEXT),
    })
    setIsActivityEditorOpen(true)
    toast.info('تم نسخ الفقرة في نموذج الإضافة. راجع التوقيت والحجوزات قبل الحفظ.')
  }

  function addMaterialRequest() {
    if (!materialToAdd) return
    if (activityForm.material_requests.some((request) => request.material_id === materialToAdd)) {
      toast.error('الأداة مضافة بالفعل')
      return
    }
    setActivityForm((prev) => ({ ...prev, material_requests: [...prev.material_requests, { material_id: materialToAdd, qty: 1 }] }))
    setMaterialToAdd('')
  }

  function updateMaterialQty(materialId: string, qty: number) {
    setActivityForm((prev) => ({
      ...prev,
      material_requests: prev.material_requests.map((request) => request.material_id === materialId ? { ...request, qty: normalizeQty(qty, 1) } : request),
    }))
  }

  function removeMaterialRequest(materialId: string) {
    setActivityForm((prev) => ({ ...prev, material_requests: prev.material_requests.filter((request) => request.material_id !== materialId) }))
  }

  async function saveActivity() {
    if (!selectedPlan) {
      toast.error('أضف يوم أولًا قبل إضافة الفقرات')
      return
    }
    if (!canEditSelectedTeam) {
      toast.error('تقدر تشوف بلان الفرق الأخرى فقط بدون تعديل')
      return
    }
    if (!activityForm.title.trim()) {
      toast.error('اكتب اسم الفقرة')
      return
    }
    if (!activityForm.start_time || !activityForm.end_time || selectedResourceDuration <= 0 || !isWithinCampWorkday(activityForm.start_time, activityForm.end_time)) {
      toast.error('تأكد من توقيت البداية والنهاية. اليوم التشغيلي يبدأ 6:00 ص وينتهي 4:00 ص من اليوم التالي.')
      return
    }

    const validation = validateActivity()
    if (validation.errors.length) {
      toast.error(validation.errors[0])
      return
    }

    setSavingActivity(true)
    try {
      const basePayload = {
        plan_id: selectedPlan.id,
        title: activityForm.title.trim(),
        start_time: activityForm.start_time,
        end_time: activityForm.end_time,
        location: activityForm.location.trim() || null,
        manual_materials: activityForm.manual_materials.trim() || null,
        manual_assignees: activityForm.manual_assignees.trim() || null,
        notes: activityForm.notes.trim() || null,
        row_background_color: normalizeHexColor(activityForm.row_background_color, DEFAULT_ROW_BACKGROUND),
        row_text_color: normalizeHexColor(activityForm.row_text_color, DEFAULT_ROW_TEXT),
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }

      let itemId = activityForm.id

      if (itemId) {
        const { error } = await supabase.from('camp_program_items').update(basePayload).eq('id', itemId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('camp_program_items')
          .insert({
            ...basePayload,
            sort_order: selectedPlanActivities.length + 1,
            created_by: user?.id || null,
          })
          .select('id')
          .single()
        if (error) throw error
        itemId = data?.id || null
      }

      if (!itemId) throw new Error('تعذر تحديد الفقرة بعد الحفظ')

      const deleteResults = await Promise.all([
        supabase.from('camp_program_item_materials').delete().eq('item_id', itemId),
        supabase.from('camp_program_item_members').delete().eq('item_id', itemId),
        supabase.from('camp_program_item_teams').delete().eq('item_id', itemId),
        supabase.from('camp_program_item_rooms').delete().eq('item_id', itemId),
      ])

      for (const result of deleteResults) {
        if (result?.error) throw result.error
      }

      const selectedMembers = teamChefs.filter((m) => activityForm.member_ids.includes(m.id))
      const selectedTeams = teams.filter((t) => activityForm.assigned_team_ids.includes(t.id))
      const inserts: PromiseLike<any>[] = []

      if (activityForm.room_key) {
        inserts.push(
          supabase.from('camp_program_item_rooms').insert({
            item_id: itemId,
            room_key: activityForm.room_key,
            room_name: roomLabel(activityForm.room_key),
          }) as any
        )
      }

      if (activityForm.material_requests.length) {
        const materialRows = activityForm.material_requests
          .map((request) => {
            const material = materialMap.get(request.material_id)
            if (!material) return null
            return {
              item_id: itemId,
              material_id: material.id,
              material_name: material.name,
              qty: normalizeQty(request.qty, 1),
            }
          })
          .filter(Boolean)

        if (materialRows.length) {
          inserts.push(supabase.from('camp_program_item_materials').insert(materialRows as any[]) as any)
        }
      }

      if (selectedMembers.length) {
        inserts.push(
          supabase.from('camp_program_item_members').insert(
            selectedMembers.map((member) => ({
              item_id: itemId,
              member_id: member.id,
              member_name: member.full_name,
            }))
          ) as any
        )
      }

      if (selectedTeams.length) {
        inserts.push(
          supabase.from('camp_program_item_teams').insert(
            selectedTeams.map((team) => ({
              item_id: itemId,
              team_id: team.id,
              team_name: team.name,
            }))
          ) as any
        )
      }

      const results = await Promise.all(inserts)
      for (const result of results) {
        if (result?.error) throw result.error
      }

      toast.success(activityForm.id ? 'تم تحديث الفقرة' : 'تم إضافة الفقرة')
      resetActivityForm()
      setIsActivityEditorOpen(false)
      await loadPlans()
    } catch (e: any) {
      toast.error(e?.message || 'تعذر حفظ الفقرة')
    } finally {
      setSavingActivity(false)
    }
  }

  async function softDeleteActivity(item: ActivityView) {
    if (!canEditSelectedTeam) return
    if (!window.confirm('هل تريد حذف هذه الفقرة؟ سيتم إلغاء حجوزات القاعة والأدوات المرتبطة بها.')) return

    setSavingActivity(true)
    try {
      const { error } = await supabase
        .from('camp_program_items')
        .update({ soft_deleted_at: new Date().toISOString(), updated_by: user?.id || null })
        .eq('id', item.id)
      if (error) throw error
      toast.success('تم حذف الفقرة وإلغاء حجوزاتها')
      if (activityForm.id === item.id) {
        resetActivityForm()
        setIsActivityEditorOpen(false)
      }
      await loadPlans()
    } catch (e: any) {
      toast.error(e?.message || 'تعذر حذف الفقرة')
    } finally {
      setSavingActivity(false)
    }
  }

  function updatePlanLocal(patch: Partial<PlanRow>) {
    if (!selectedPlan) return
    setPlans((prev) => prev.map((plan) => (plan.id === selectedPlan.id ? { ...plan, ...patch } : plan)))
  }

  function renderTimeline(resourceLabel: string, bookings: ResourceBooking[], capacity?: number) {
    const dayStart = timeToCampMinutes(CAMP_WORKDAY_START)
    const dayEnd = timeToCampMinutes(CAMP_WORKDAY_END)
    const span = Math.max(1, dayEnd - dayStart)
    const selectedStart = timeToCampMinutes(activityForm.start_time)
    const selectedEnd = timeToCampMinutes(activityForm.end_time)
    const selectedVisible = Boolean(activityForm.start_time && activityForm.end_time && selectedStart < selectedEnd && isWithinCampWorkday(activityForm.start_time, activityForm.end_time))

    return (
      <div className="camp100-resource-timeline rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-black text-slate-900">{resourceLabel}</div>
            <div className="text-xs text-slate-500" dir="rtl">{fmtDisplayRange(CAMP_WORKDAY_START, CAMP_WORKDAY_END)}</div>
          </div>
          {capacity ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">إجمالي الكمية: {capacity}</span> : null}
        </div>
        <div className="relative mt-4 h-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {FIXED_DAILY_ACTIVITIES.map((fixed) => {
            const start = timeToCampMinutes(fixed.start_time)
            const end = timeToCampMinutes(fixed.end_time)
            const right = Math.max(0, Math.min(100, ((start - dayStart) / span) * 100))
            const width = Math.max(3, Math.min(100 - right, ((end - start) / span) * 100))
            return (
              <div
                key={`fixed-${fixed.key}`}
                className="absolute inset-y-0 z-0 border-x border-amber-400/70 bg-amber-200/55"
                style={{ right: `${right}%`, width: `${width}%` }}
                title={`${fixed.title}: ${fmtDisplayRange(fixed.start_time, fixed.end_time)} — موعد ثابت لا يقبل حجوزات`}
              >
                <div className="hidden h-full items-center justify-center text-[9px] font-black text-amber-900 xl:flex">{fixed.title}</div>
              </div>
            )
          })}
          {selectedVisible ? (
            <div
              className="absolute top-0 z-10 h-full border-x-2 border-indigo-500 bg-indigo-200/50"
              style={{
                right: `${Math.max(0, Math.min(100, ((selectedStart - dayStart) / span) * 100))}%`,
                width: `${Math.max(2, Math.min(100, ((selectedEnd - selectedStart) / span) * 100))}%`,
              }}
              title="التوقيت المختار"
            />
          ) : null}
          {bookings.map((booking) => {
            const start = timeToCampMinutes(booking.start_time)
            const end = timeToCampMinutes(booking.end_time)
            const right = Math.max(0, Math.min(100, ((start - dayStart) / span) * 100))
            const width = Math.max(4, Math.min(100 - right, ((end - start) / span) * 100))
            return (
              <div
                key={`${booking.id}-${booking.start_time}-${booking.end_time}`}
                className="absolute top-2 z-20 h-12 rounded-2xl bg-slate-900 px-2 py-1 text-[11px] font-bold leading-5 text-white shadow-sm"
                style={{ right: `${right}%`, width: `${width}%` }}
                title={buildBookingText(booking)}
              >
                <div className="truncate">{booking.team_name}</div>
                <div className="truncate opacity-80" dir="rtl">{fmtDisplayRange(booking.start_time, booking.end_time)}{booking.qty ? ` × ${booking.qty}` : ''}</div>
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-400" dir="ltr">
          <span>{fmtDisplayTime(CAMP_WORKDAY_START)}</span>
          <span>{fmtDisplayTime(CAMP_WORKDAY_END)}</span>
        </div>
      </div>
    )
  }

  function renderAvailabilityPanel() {
    if (!selectedPlan) return null
    const chosenMaterials = activityForm.material_requests
      .map((request) => ({ request, material: materialMap.get(request.material_id) }))
      .filter((entry): entry is { request: MaterialRequest; material: MaterialRow } => Boolean(entry.material))

    if (!activityForm.room_key && !chosenMaterials.length) {
      return (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          اختار قاعة أو أداة من الأدوات علشان يظهر لك Calendar الإتاحة والحجوزات في اليوم المحدد.
        </div>
      )
    }

    return (
      <div className="camp100-resource-panel space-y-4 rounded-[26px] border border-cyan-200 bg-cyan-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-900">Resource Availability Panel</h3>
            <p className="text-sm text-slate-600">بيوضح المتاح والمحجوز في {fmtDate(selectedPlan.plan_date)} حسب التوقيت المختار.</p>
          </div>
          <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
            مدة الحجز: {selectedResourceDuration > 0 ? selectedResourceDuration : 0} دقيقة
          </div>
        </div>

        {activityForm.room_key ? renderTimeline(roomLabel(activityForm.room_key), resourceBookingsForRoom(activityForm.room_key)) : null}

        {chosenMaterials.map(({ request, material }) => renderTimeline(
          `${material.name} - المطلوب ${normalizeQty(request.qty, 1)}`,
          resourceBookingsForMaterial(material.id),
          materialCapacity(material)
        ))}

        {validationPreview.errors.length ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">
            <div className="mb-1 font-black">⛔ لا يمكن الحفظ للأسباب التالية</div>
            <ul className="list-inside list-disc space-y-1">
              {validationPreview.errors.map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        ) : (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            ✅ الموارد المختارة متاحة حسب القيود الحالية.
          </div>
        )}

        {validationPreview.warnings.length ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
            <div className="mb-1 font-black">⚠️ اقتراحات وتنبيهات</div>
            <ul className="list-inside list-disc space-y-1">
              {validationPreview.warnings.map((message) => <li key={message}>{message}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    )
  }

  function buildPrintHtml(mode: 'day' | 'all') {
    const printablePlans = mode === 'day' ? (selectedPlan ? [selectedPlan] : []) : selectedTeamPlans
    const campTitle = campTitleById(camps, selectedCampId)
    const teamTitle = teamNameById(teams, selectedTeamId)
    const generatedAt = new Date().toLocaleString('ar-EG')

    const planBlocks = printablePlans.map((plan, planIndex) => {
      const planItems = [
        ...activities.filter((item) => item.plan_id === plan.id),
        ...buildFixedActivities(plan),
      ].sort((a, b) => campTimeCompare(a.start_time, b.start_time))

      const textLoad = [
        plan.day_theme || '',
        plan.notes || '',
        plan.assistant_day_leader_note || '',
        plan.first_sergeant_note || '',
      ].join(' ').length
      const firstPageBudget = textLoad > 620 ? 5.1 : textLoad > 360 ? 6.1 : 7.1
      const continuationPageBudget = 11.4
      const pageGroups = paginatePdfItems(planItems, firstPageBudget, continuationPageBudget)

      const themeValue = plan.day_theme || '—'
      const notesValue = plan.notes || '—'
      const assistantLeaderName = memberNameById(teamChefs, plan.assistant_day_leader_member_id, plan.assistant_day_leader_name)
      const assistantLeaderNote = plan.assistant_day_leader_note || 'لا توجد ملاحظات'
      const firstSergeantName = memberNameById(teamChefs, plan.first_sergeant_member_id, plan.first_sergeant_name)
      const firstSergeantNote = plan.first_sergeant_note || 'لا توجد ملاحظات'

      return pageGroups.map((pageItems, pageIndex) => {
        const isFirstPage = pageIndex === 0
        const rows = pageItems.length
          ? pageItems.map((item) => {
            const colors = activityRowColors(item)
            return `
            <tr style="background:${colors.background};color:${colors.text};">
              <td>${pdfText(fmtDisplayRange(item.start_time, item.end_time))}</td>
              <td>${pdfText(item.title || '-')}</td>
              <td>${pdfText(activityPlaceName(item))}</td>
              <td>${pdfText(materialNames(item))}</td>
              <td>${pdfText(assigneeNames(item))}</td>
              <td>${pdfText(textOrDash(item.notes))}</td>
            </tr>`
          }).join('')
          : '<tr><td colspan="6" class="empty">لا توجد فقرات مسجلة لهذا اليوم</td></tr>'

        return `
          <section class="pdf-day" data-plan-index="${planIndex}" data-page-index="${pageIndex}">
            <div class="top">
              <div class="title-wrap">
                <h1>${escapeHtml(mode === 'day' ? 'برنامج اليوم' : 'برنامج المعسكر')}</h1>
                <div class="meta">
                  <div><strong>المعسكر:</strong> ${pdfText(campTitle)}</div>
                  <div><strong>الفريق:</strong> ${pdfText(teamTitle)}</div>
                  <div><strong>السنة الكشفية:</strong> ${pdfText(currentScoutYear?.name || '-')}</div>
                </div>
              </div>
              <div class="brand-logo-wrap"><img class="brand-logo" src="${escapeHtml(scoutSvmLogo)}" alt="شعار المجموعة" /></div>
            </div>

            <div class="day-block">
              <div class="day-header">
                <div>
                  <h2>${escapeHtml(plan.day_title || dayDefaultTitle(planIndex + 1))}</h2>
                  <p>${escapeHtml(fmtDate(plan.plan_date))}${isFirstPage ? '' : ' — تكملة'}</p>
                </div>
                <span>${escapeHtml(`صفحة ${pageIndex + 1} من ${pageGroups.length}`)}</span>
              </div>

              ${isFirstPage ? `
                <div class="theme-banner">
                  <div class="theme-banner-label">Theme اليوم</div>
                  <div class="theme-banner-value">${pdfText(themeValue)}</div>
                </div>

                <div class="day-leadership-grid">
                  <div class="day-leadership-card assistant-card">
                    <div class="leader-icon">⭐</div>
                    <div class="day-info-label">مساعد قائد اليوم</div>
                    <div class="leader-name">${pdfText(assistantLeaderName)}</div>
                    <div class="leader-note">${pdfText(assistantLeaderNote)}</div>
                  </div>
                  <div class="day-leadership-card sergeant-card">
                    <div class="leader-icon">⚜️</div>
                    <div class="day-info-label">عريف أول اليوم</div>
                    <div class="leader-name">${pdfText(firstSergeantName)}</div>
                    <div class="leader-note">${pdfText(firstSergeantNote)}</div>
                  </div>
                </div>

                <div class="day-notes-panel">
                  <div class="day-info-label">ملاحظات اليوم</div>
                  <div class="day-notes-value">${pdfText(notesValue)}</div>
                </div>
              ` : `
                <div class="continuation-banner">تكملة فقرات ${escapeHtml(plan.day_title || dayDefaultTitle(planIndex + 1))}</div>
              `}

              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>التوقيت</th>
                      <th>الفقرة</th>
                      <th>المكان / القاعة</th>
                      <th>الأدوات</th>
                      <th>المسؤولين</th>
                      <th>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>
            </div>
            <div class="footer">
              <span>تم الإنشاء: ${escapeHtml(generatedAt)}</span>
              <span>${escapeHtml(plan.day_title || dayDefaultTitle(planIndex + 1))} • صفحة ${pageIndex + 1} من ${pageGroups.length}</span>
            </div>
          </section>`
      }).join('')
    }).join('')

    return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(campTitle)} - ${escapeHtml(teamTitle)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { width: 1280px; min-width: 1280px; max-width: 1280px; margin: 0; padding: 0; background: #ffffff; direction: rtl; overflow: hidden; }
    body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #0f172a; font-weight: 700; text-rendering: geometricPrecision; -webkit-font-smoothing: antialiased; }
    #pdf-root { width: 1280px; min-width: 1280px; max-width: 1280px; margin: 0; padding: 0; overflow: hidden; }
    .pdf-day { --pdf-inner-width: 1230px; width: 1280px !important; min-width: 1280px !important; max-width: 1280px !important; height: 892px !important; min-height: 892px !important; max-height: 892px !important; padding: 10px 0; background: #ffffff; overflow: hidden; text-align: center; direction: rtl; display: flex; flex-direction: column; position: relative; contain: layout paint size; isolation: isolate; transform: none !important; }
    .pdf-day + .pdf-day { margin-top: 0; }
    .top { width: var(--pdf-inner-width); min-width: var(--pdf-inner-width); max-width: var(--pdf-inner-width); margin-left: auto; margin-right: auto; position: relative; display: flex; min-height: 78px; align-items: center; justify-content: center; gap: 16px; border: 2px solid #d6b456; border-radius: 17px; padding: 8px 112px; background: linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #fff8dc 100%); box-shadow: 0 5px 14px rgba(15, 23, 42, .06); text-align: center; flex: 0 0 auto; }
    .title-wrap { min-width: 0; width: 100%; text-align: center; }
    .brand-logo-wrap { position: absolute; left: 15px; top: 50%; width: 62px; min-width: 62px; height: 62px; transform: translateY(-50%); display: flex; align-items: center; justify-content: center; border-radius: 16px; background: rgba(255,255,255,.98); border: 1px solid rgba(30,41,59,.12); box-shadow: 0 4px 12px rgba(30, 41, 59, .10); }
    .brand-logo { width: 54px; height: 54px; object-fit: contain; display: block; }
    h1 { margin: 0 0 4px; font-size: 29px; line-height: 1.06; font-weight: 900; color: #172554; text-align: center; }
    .meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px 18px; color: #334155; font-size: 15px; font-weight: 850; line-height: 1.25; text-align: center; }
    .meta > div { text-align: center; }
    .meta .pdf-bidi-text { display: inline; }
    .day-block { width: var(--pdf-inner-width) !important; min-width: var(--pdf-inner-width) !important; max-width: var(--pdf-inner-width) !important; margin-left: auto; margin-right: auto; margin-top: 7px; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 3px 10px rgba(15,23,42,.045); flex: 0 0 auto; display: flex; flex-direction: column; }
    .day-header { position: relative; display: flex; min-height: 52px; justify-content: center; align-items: center; gap: 8px; padding: 6px 118px; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; text-align: center; flex: 0 0 auto; }
    .day-header > div { text-align: center; }
    .day-header h2 { margin: 0; font-size: 25px; line-height: 1.1; font-weight: 900; text-align: center; }
    .day-header p { margin: 2px 0 0; color: #475569; font-size: 16px; font-weight: 850; line-height: 1.2; text-align: center; }
    .day-header span { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); background: white; border: 1px solid #cbd5e1; border-radius: 999px; padding: 5px 11px; color: #334155; font-size: 12.5px; font-weight: 900; text-align: center; }
    .theme-banner { margin: 7px 10px; min-height: 48px; border-radius: 14px; padding: 6px 18px 7px; background: linear-gradient(135deg, #172554 0%, #293b8f 55%, #b9912e 150%); color: #ffffff; border: 1px solid #d6b456; box-shadow: 0 3px 10px rgba(23,37,84,.11); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; flex: 0 0 auto; }
    .theme-banner-label { margin-bottom: 2px; color: #fde68a; font-size: 13.5px; font-weight: 900; letter-spacing: .2px; text-align: center; }
    .theme-banner-value { width: 100%; color: #ffffff; font-size: 19px; font-weight: 900; line-height: 1.28; white-space: pre-line; overflow-wrap: break-word; text-align: center; }
    .day-leadership-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 10px 7px; background: #ffffff; flex: 0 0 auto; }
    .day-leadership-card { min-height: 66px; border-radius: 13px; padding: 6px 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-shadow: 0 3px 8px rgba(15,23,42,.04); }
    .assistant-card { border: 2px solid #93c5fd; background: linear-gradient(180deg,#eff6ff,#ffffff); }
    .sergeant-card { border: 2px solid #d8b4fe; background: linear-gradient(180deg,#faf5ff,#ffffff); }
    .leader-icon { font-size: 17px; line-height: 1; margin-bottom: 1px; }
    .day-info-label { margin-bottom: 2px; font-size: 13.5px; font-weight: 900; color: #334155; text-align: center; }
    .leader-name { width: 100%; font-size: 17px; font-weight: 900; color: #0f172a; line-height: 1.25; text-align: center; }
    .leader-note { width: 100%; min-height: 18px; margin-top: 2px; font-size: 12.5px; font-weight: 850; color: #475569; line-height: 1.28; white-space: pre-line; overflow-wrap: break-word; text-align: center; }
    .day-notes-panel { margin: 0 10px 7px; min-height: 40px; border: 1px solid #fde68a; border-radius: 13px; padding: 5px 14px; background: #fffbeb; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; flex: 0 0 auto; }
    .day-notes-value { width: 100%; min-height: 20px; font-size: 14.5px; font-weight: 850; line-height: 1.34; color: #422006; white-space: pre-line; overflow-wrap: break-word; text-align: center; }
    .continuation-banner { margin: 7px 10px; border-radius: 12px; padding: 6px 14px; background: #eef2ff; border: 1px solid #c7d2fe; color: #3730a3; font-size: 16px; font-weight: 900; text-align: center; flex: 0 0 auto; }
    .table-wrap { width: var(--pdf-inner-width) !important; min-width: var(--pdf-inner-width) !important; max-width: var(--pdf-inner-width) !important; overflow: hidden; border-top: 1px solid #cbd5e1; flex: 0 0 auto; }
    table { width: var(--pdf-inner-width) !important; min-width: var(--pdf-inner-width) !important; max-width: var(--pdf-inner-width) !important; border-collapse: collapse; table-layout: fixed; text-align: center; direction: rtl; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th { background: #0f172a; color: white; padding: 8px 7px; font-size: 16px; line-height: 1.15; font-weight: 900; text-align: center; vertical-align: middle; border-left: 1px solid rgba(255,255,255,.12); }
    td { border-top: 1px solid rgba(100, 116, 139, .28); border-left: 1px solid rgba(148, 163, 184, .18); padding: 7px 7px; vertical-align: middle; line-height: 1.22; font-size: 15.4px; font-weight: 850; direction: rtl; unicode-bidi: isolate; color: inherit; background: transparent; overflow-wrap: anywhere; white-space: pre-line; text-align: center; }
    .pdf-bidi-text { display: block; width: 100%; text-align: center; direction: rtl; unicode-bidi: plaintext; white-space: pre-line; overflow-wrap: anywhere; word-break: normal; }
    th:last-child, td:last-child { border-left: 0; }
    th:nth-child(1), td:nth-child(1) { width: 13%; }
    th:nth-child(2), td:nth-child(2) { width: 18%; }
    th:nth-child(3), td:nth-child(3) { width: 17%; }
    th:nth-child(4), td:nth-child(4) { width: 19%; }
    th:nth-child(5), td:nth-child(5) { width: 22%; }
    th:nth-child(6), td:nth-child(6) { width: 11%; }
    .empty { text-align: center; color: #64748b; padding: 18px; font-size: 16px; font-weight: 850; }
    .footer { width: var(--pdf-inner-width); min-width: var(--pdf-inner-width); max-width: var(--pdf-inner-width); margin: 5px auto 0; padding: 0 4px; color: #64748b; font-size: 10.5px; font-weight: 850; display: flex; align-items: center; justify-content: space-between; gap: 12px; direction: rtl; text-align: center; flex: 0 0 auto; }
  </style>
</head>
<body>
  <main id="pdf-root">
    ${planBlocks || '<section class="pdf-day"><div class="empty">لا توجد أيام مسجلة للتصدير</div></section>'}
  </main>
</body>
</html>`
  }

  async function exportPdf(mode: 'day' | 'all') {
    if (!canExportSelectedTeam) {
      toast.error('التصدير متاح لفريقك فقط')
      return
    }
    if (mode === 'day' && !selectedPlan) {
      toast.error('اختار يوم للتصدير')
      return
    }
    if (mode === 'all' && !selectedTeamPlans.length) {
      toast.error('لا توجد أيام مسجلة للتصدير')
      return
    }

    const plansToValidate = mode === 'day' ? (selectedPlan ? [selectedPlan] : []) : selectedTeamPlans
    const missingAssistantPlan = plansToValidate.find((plan) => !plan.assistant_day_leader_member_id)
    if (missingAssistantPlan) {
      toast.error(`اختار مساعد قائد اليوم في ${missingAssistantPlan.day_title || fmtDate(missingAssistantPlan.plan_date)} قبل إنشاء ملف PDF`)
      return
    }

    setExportingPdf(true)
    let iframe: HTMLIFrameElement | null = null

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.position = 'fixed'
      iframe.style.left = '-10000px'
      iframe.style.top = '0'
      iframe.style.width = '1280px'
      iframe.style.height = '892px'
      iframe.style.pointerEvents = 'none'
      iframe.style.border = '0'
      document.body.appendChild(iframe)

      await new Promise<void>((resolve, reject) => {
        if (!iframe) {
          reject(new Error('تعذر تجهيز ملف PDF'))
          return
        }
        iframe.onload = () => resolve()
        iframe.onerror = () => reject(new Error('تعذر تجهيز صفحة PDF'))
        iframe.srcdoc = buildPrintHtml(mode)
      })

      const pdfDocument = iframe.contentDocument
      const pageNodes = Array.from(pdfDocument?.querySelectorAll('.pdf-day') || []) as HTMLElement[]
      if (!pdfDocument || !pageNodes.length) throw new Error('تعذر قراءة محتوى البرنامج للتصدير')

      if (pdfDocument.fonts?.ready) await pdfDocument.fonts.ready
      const pdfImages = Array.from(pdfDocument.images)
      await Promise.all(pdfImages.map((image) => image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true })
            image.addEventListener('error', () => resolve(), { once: true })
          })))

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true,
      })

      const margin = 0
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const usableWidth = pageWidth
      const usableHeight = pageHeight

      for (let index = 0; index < pageNodes.length; index += 1) {
        const pageNode = pageNodes[index]
        pageNode.style.width = '1280px'
        pageNode.style.minWidth = '1280px'
        pageNode.style.maxWidth = '1280px'
        pageNode.style.height = '892px'
        pageNode.style.minHeight = '892px'
        pageNode.style.maxHeight = '892px'
        const canvas = await html2canvas(pageNode, {
          backgroundColor: '#ffffff',
          scale: 2.75,
          useCORS: true,
          logging: false,
          width: 1280,
          height: 892,
          windowWidth: 1280,
          windowHeight: 892,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDocument) => {
            const clonedPages = Array.from(clonedDocument.querySelectorAll('.pdf-day')) as HTMLElement[]
            clonedPages.forEach((node) => {
              node.style.width = '1280px'
              node.style.minWidth = '1280px'
              node.style.maxWidth = '1280px'
              node.style.height = '892px'
              node.style.minHeight = '892px'
              node.style.maxHeight = '892px'
              node.style.transform = 'none'
            })
          },
        })

        if (index > 0) pdf.addPage('a4', 'landscape')

        // All pages are rendered from the same fixed-size A4-ratio canvas so
        // page widths remain consistent. Pagination happens before rendering.
        const imageWidth = usableWidth
        const imageHeight = usableHeight
        const x = 0
        const y = 0
        const imageData = canvas.toDataURL('image/png')

        pdf.addImage(imageData, 'PNG', x, y, imageWidth, imageHeight, undefined, 'FAST')
      }

      const campTitle = safeFileNamePart(campTitleById(camps, selectedCampId))
      const teamTitle = safeFileNamePart(teamNameById(teams, selectedTeamId))
      const scopeTitle = mode === 'day'
        ? safeFileNamePart(selectedPlan?.day_title || selectedPlan?.plan_date || 'اليوم')
        : 'البرنامج-الكامل'

      pdf.save(`برنامج-${campTitle}-${teamTitle}-${scopeTitle}.pdf`)
      toast.success('تم إنشاء ملف PDF بعرض صفحات موحد واليوم التشغيلي حتى 4:00 ص')
    } catch (e: any) {
      console.error('Camp PDF export failed', e)
      toast.error(e?.message || 'تعذر إنشاء ملف PDF')
    } finally {
      iframe?.remove()
      setExportingPdf(false)
    }
  }

  if (accessLoading && !isAdmin && chefTeamIds.length === 0) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          جاري التحقق من صلاحية نظام المعسكر...
        </div>
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <InlineAlert tone="error" title="غير مسموح">
          نظام المعسكر متاح لـ Admin و Chef de legion والقادة الذين منحهم قائد الفريق صلاحية إدارة برنامج المعسكر.
        </InlineAlert>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          جاري تحميل نظام المعسكر...
        </div>
      </div>
    )
  }

  const selectedCamp = camps.find((camp) => camp.id === selectedCampId) || null

  return (
    <div className="camp100-page camp100-program-page space-y-6 p-4 md:p-6" dir="rtl">
      <PageHero
        className="camp100-hero"
        eyebrow="🏕️ نظام المعسكر"
        title="برنامج المعسكر اليومي"
        description="ابنِ برنامج كل يوم فقرة بفقرة حسب الفريق، مع حجز القاعات والأدوات من داخل نفس الفقرة وفحص الإتاحة قبل الحفظ."
        badge={
          <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            {currentScoutYear?.name || 'السنة غير محددة'}
          </span>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => exportPdf('day')}
              disabled={exportingPdf || !selectedPlan || !canExportSelectedTeam}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingPdf ? 'جاري إنشاء PDF...' : 'تنزيل PDF لليوم'}
            </button>
            <button
              type="button"
              onClick={() => exportPdf('all')}
              disabled={exportingPdf || !selectedTeamPlans.length || !canExportSelectedTeam}
              className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingPdf ? 'جاري إنشاء PDF...' : 'تنزيل PDF للمعسكر'}
            </button>
          </>
        }
      />

      {error ? (
        <InlineAlert tone="error" title="تنبيه">
          {error}
        </InlineAlert>
      ) : null}

      {!canEditSelectedTeam ? (
        <InlineAlert tone="info" title="وضع مشاهدة فقط">
          أنت تشاهد خطة فريق آخر. يمكنك المتابعة والقراءة فقط، والتعديل متاح لخطة فريقك أنت فقط.
        </InlineAlert>
      ) : null}

      {!canExportSelectedTeam ? (
        <InlineAlert tone="info" title="التصدير مقيد">
          يمكنك مشاهدة خطط الفرق الأخرى، لكن تصدير PDF متاح لخطة فريقك فقط.
        </InlineAlert>
      ) : null}

      <div className="camp100-metrics grid gap-4 md:grid-cols-4">
        <MetricCard label="أيام الفريق المختار" value={selectedTeamPlans.length} hint="داخل المعسكر الحالي" accent="navy" />
        <MetricCard label="فقرات اليوم المحدد" value={selectedPlanDisplayActivities.length} hint={selectedPlan?.day_title || 'لا يوجد يوم محدد'} accent="orange" />
        <MetricCard label="حجوزات القاعات اليوم" value={selectedTeamRoomBookingsToday.length + (activityForm.room_key && !activityForm.id ? 1 : 0)} hint="بدون حد أقصى يومي" accent="gold" />
        <MetricCard label="فرق لها خطط" value={plansByTeam.size} hint="يمكنك استعراضها بدون تعديل" accent="sky" />
      </div>

      <SectionCard className="camp100-selector-card" title="اختيار المعسكر والفريق" description="اختار المعسكر ثم الفريق الذي تريد مشاهدة أو تعديل برنامجه.">
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-1 text-sm font-semibold text-slate-700">
            <span>المعسكر</span>
            <select
              value={selectedCampId}
              onChange={(e) => {
                setSelectedCampId(e.target.value)
                setSelectedPlanId('')
                resetActivityForm()
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5"
            >
              {camps.length ? null : <option value="">لا توجد معسكرات</option>}
              {camps.map((camp) => (
                <option key={camp.id} value={camp.id}>{camp.title} - {statusLabel(camp.status)}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-semibold text-slate-700">
            <span>الفريق</span>
            <select
              value={selectedTeamId}
              onChange={(e) => {
                setSelectedTeamId(e.target.value)
                setSelectedPlanId('')
                resetActivityForm()
              }}
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </label>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            <div><strong className="text-slate-800">المعسكر:</strong> {selectedCamp?.title || '-'}</div>
            <div><strong className="text-slate-800">الفترة:</strong> {fmtShortDate(selectedCamp?.start_date)} → {fmtShortDate(selectedCamp?.due_date)}</div>
            <div><strong className="text-slate-800">صلاحيتك:</strong> {canEditSelectedTeam ? 'تعديل كامل' : 'مشاهدة فقط'}</div>
          </div>
        </div>
      </SectionCard>

      {canManageSelectedTeamAccess ? (
        <SectionCard
          className="camp100-access-card"
          title="صلاحيات نظام المعسكر"
          description="قائد الفريق يحدد من قائمة الـ Chefs من يمكنه رؤية نظام المعسكر في المنيو وإضافة أو تعديل برنامج هذا الفريق."
          actions={
            <LoadingButton loading={savingAccess} variant="soft" onClick={saveTeamAccessAssignments}>
              حفظ الصلاحيات
            </LoadingButton>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {teamChefs.length ? teamChefs.map((member) => {
              const hasAccount = Boolean(member.auth_user_id)
              const checked = selectedAccessMemberIds.includes(member.id)
              const isCurrentLeader = member.auth_user_id === user?.id && chefTeamIds.includes(selectedTeamId)
              return (
                <label
                  key={member.id}
                  className={`flex items-start gap-3 rounded-2xl border p-3 transition ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'} ${!hasAccount ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-indigo-200'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!hasAccount || isCurrentLeader}
                    onChange={(event) => {
                      const isChecked = event.currentTarget.checked
                      setSelectedAccessMemberIds((current) => isChecked
                        ? Array.from(new Set([...current, member.id]))
                        : current.filter((id) => id !== member.id))
                    }}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <span className="min-w-0">
                    <span className="block font-bold text-slate-900">{member.full_name}</span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      {isCurrentLeader ? 'قائد الفريق لديه الصلاحية تلقائيًا' : hasAccount ? (checked ? 'مسموح له بإدارة برنامج الفريق' : 'بدون صلاحية حاليًا') : 'لا يوجد حساب دخول مرتبط بهذا الـ Chef'}
                    </span>
                  </span>
                </label>
              )
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
                لا توجد أسماء Chefs متاحة لهذا الفريق أو تعذر تحميلها.
              </div>
            )}
          </div>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            🔐 الصلاحية تخص <strong>نظام المعسكر فقط</strong>، ولا تمنح أي دور أو صلاحية إضافية في باقي أجزاء السيستم. تظهر المنيو للمستخدم بعد تحديث الصفحة أو تسجيل الدخول مرة أخرى.
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SectionCard
          className="camp100-days-card"
          title="أيام المعسكر"
          description="أضف أيام المعسكر لفريقك، ثم اختار اليوم لإضافة الفقرات."
          actions={
            canEditSelectedTeam ? (
              <LoadingButton loading={savingDay} variant="soft" onClick={saveDay}>
                إضافة يوم
              </LoadingButton>
            ) : null
          }
        >
          {canEditSelectedTeam ? (
            <div className="space-y-3 rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/40 p-3">
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                <span>تاريخ اليوم</span>
                <input type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5" />
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                <span>عنوان اليوم</span>
                <input value={dayTitle} onChange={(e) => setDayTitle(e.target.value)} placeholder="مثال: اليوم الأول" className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5" />
              </label>
              <div className="rounded-[22px] border border-blue-200 bg-blue-50/70 p-3">
                <div className="mb-3 text-sm font-black text-blue-950">قيادة اليوم</div>
                <div className="space-y-3">
                  <label className="space-y-1 text-sm font-semibold text-slate-700">
                    <span>مساعد قائد اليوم <span className="text-rose-600">*</span></span>
                    <select
                      value={dayAssistantLeaderMemberId}
                      onChange={(e) => setDayAssistantLeaderMemberId(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5"
                    >
                      <option value="">اختار مساعد قائد اليوم</option>
                      {teamChefs.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-semibold text-slate-700">
                    <span>ملاحظة مساعد قائد اليوم <span className="font-normal text-slate-400">(اختياري)</span></span>
                    <textarea
                      value={dayAssistantLeaderNote}
                      onChange={(e) => setDayAssistantLeaderNote(e.target.value)}
                      rows={2}
                      placeholder="اكتب أي ملاحظة خاصة بمساعد قائد اليوم"
                      className="min-h-[76px] w-full resize-y rounded-2xl border border-slate-300 bg-white px-3 py-2.5 leading-7"
                    />
                  </label>
                  <label className="space-y-1 text-sm font-semibold text-slate-700">
                    <span>عريف أول اليوم <span className="font-normal text-slate-400">(اختياري)</span></span>
                    <select
                      value={dayFirstSergeantMemberId}
                      onChange={(e) => setDayFirstSergeantMemberId(e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5"
                    >
                      <option value="">بدون عريف أول</option>
                      {teamChefs.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-semibold text-slate-700">
                    <span>ملاحظة عريف أول اليوم <span className="font-normal text-slate-400">(اختياري)</span></span>
                    <textarea
                      value={dayFirstSergeantNote}
                      onChange={(e) => setDayFirstSergeantNote(e.target.value)}
                      rows={2}
                      placeholder="اكتب أي ملاحظة خاصة بعريف أول اليوم"
                      className="min-h-[76px] w-full resize-y rounded-2xl border border-slate-300 bg-white px-3 py-2.5 leading-7"
                    />
                  </label>
                </div>
              </div>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                <span>Theme اليوم <span className="font-normal text-slate-400">(اختياري)</span></span>
                <textarea
                  value={dayTheme}
                  onChange={(e) => setDayTheme(e.target.value)}
                  rows={4}
                  placeholder={`مثال:
التعاون والعمل الجماعي
روح الفريق`}
                  className="min-h-[120px] w-full resize-y rounded-2xl border border-slate-300 bg-white px-3 py-3 leading-7"
                />
              </label>
              <label className="space-y-1 text-sm font-semibold text-slate-700">
                <span>ملاحظات اليوم <span className="font-normal text-slate-400">(اختياري)</span></span>
                <textarea
                  value={dayNotes}
                  onChange={(e) => setDayNotes(e.target.value)}
                  rows={5}
                  placeholder={`اكتب ملاحظات اليوم هنا...
يمكنك النزول لسطر جديد لكل ملاحظة.`}
                  className="min-h-[140px] w-full resize-y rounded-2xl border border-slate-300 bg-white px-3 py-3 leading-7"
                />
              </label>
            </div>
          ) : null}

          {selectedTeamPlans.length ? (
            <div className="space-y-2">
              {selectedTeamPlans.map((plan, index) => {
                const active = selectedPlan?.id === plan.id
                const count = activities.filter((item) => item.plan_id === plan.id).length + FIXED_DAILY_ACTIVITIES.length
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => {
                      setSelectedPlanId(plan.id)
                      resetActivityForm()
                    }}
                    className={`w-full rounded-3xl border p-4 text-right shadow-sm transition ${active ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-black text-slate-900">{plan.day_title || dayDefaultTitle(index + 1)}</div>
                        <div className="mt-1 text-xs text-slate-500">{fmtDate(plan.plan_date)}</div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{count} فقرة</span>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <EmptyState title="لا يوجد برنامج بعد" description="ابدأ بإضافة اليوم الأول لهذا الفريق داخل المعسكر." />
          )}
        </SectionCard>

        <div className="camp100-day-workspace space-y-6">
          {selectedPlan && selectedTeamPlans.length > 1 ? (
            <div
              className="camp100-day-swipe rounded-[24px] border border-indigo-200 bg-gradient-to-l from-indigo-50 to-white p-3 shadow-sm sm:hidden"
              onTouchStart={handleDaySwipeStart}
              onTouchEnd={handleDaySwipeEnd}
              style={{ touchAction: 'pan-y' }}
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => selectAdjacentPlan(-1)}
                  disabled={selectedTeamPlans.findIndex((plan) => plan.id === selectedPlan.id) <= 0}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-200 bg-white text-xl font-black text-indigo-700 shadow-sm disabled:opacity-30"
                  aria-label="اليوم السابق"
                >
                  →
                </button>
                <div className="min-w-0 flex-1 text-center">
                  <div className="truncate text-sm font-black text-slate-900">{selectedPlan.day_title || 'برنامج اليوم'}</div>
                  <div className="mt-1 text-[11px] font-bold text-indigo-600">اسحب يمين أو شمال للتنقل بين الأيام</div>
                </div>
                <button
                  type="button"
                  onClick={() => selectAdjacentPlan(1)}
                  disabled={selectedTeamPlans.findIndex((plan) => plan.id === selectedPlan.id) >= selectedTeamPlans.length - 1}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-200 bg-white text-xl font-black text-indigo-700 shadow-sm disabled:opacity-30"
                  aria-label="اليوم التالي"
                >
                  ←
                </button>
              </div>
            </div>
          ) : null}

          <SectionCard
            className="camp100-day-card"
            title={selectedPlan ? `${selectedPlan.day_title || 'برنامج اليوم'} - ${fmtDate(selectedPlan.plan_date)}` : 'برنامج اليوم'}
            description="راجع تفاصيل اليوم، ثم أضف الفقرات مع حجز القاعة والأدوات وفحص الإتاحة قبل الحفظ."
            actions={
              selectedPlan && canEditSelectedTeam ? (
                <div className="flex flex-wrap gap-2">
                  <LoadingButton loading={savingDay} variant="outline" onClick={updateSelectedDay}>حفظ بيانات اليوم</LoadingButton>
                  <LoadingButton loading={savingDay} variant="outline" onClick={softDeleteSelectedDay}>حذف اليوم</LoadingButton>
                </div>
              ) : null
            }
          >
            {selectedPlan ? (
              <div className="space-y-4">
                {canEditSelectedTeam ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm font-semibold text-slate-700">
                      <span>التاريخ</span>
                      <input value={selectedPlan.plan_date} type="date" onChange={(e) => updatePlanLocal({ plan_date: e.target.value })} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5" />
                    </label>
                    <label className="space-y-1 text-sm font-semibold text-slate-700">
                      <span>عنوان اليوم</span>
                      <input value={selectedPlan.day_title || ''} onChange={(e) => updatePlanLocal({ day_title: e.target.value })} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5" />
                    </label>
                    <div className="rounded-[24px] border border-blue-200 bg-blue-50/70 p-4 md:col-span-2">
                      <div className="mb-3 text-sm font-black text-blue-950">قيادة اليوم</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>مساعد قائد اليوم <span className="text-rose-600">*</span></span>
                          <select
                            value={selectedPlan.assistant_day_leader_member_id || ''}
                            onChange={(e) => {
                              const member = teamChefs.find((row) => row.id === e.target.value)
                              updatePlanLocal({
                                assistant_day_leader_member_id: e.target.value || null,
                                assistant_day_leader_name: member?.full_name || null,
                              })
                            }}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5"
                          >
                            <option value="">اختار مساعد قائد اليوم</option>
                            {teamChefs.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                          </select>
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>ملاحظة مساعد قائد اليوم <span className="font-normal text-slate-400">(اختياري)</span></span>
                          <textarea
                            value={selectedPlan.assistant_day_leader_note || ''}
                            onChange={(e) => updatePlanLocal({ assistant_day_leader_note: e.target.value })}
                            rows={3}
                            className="min-h-[92px] w-full resize-y rounded-2xl border border-slate-300 bg-white px-3 py-2.5 leading-7"
                          />
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>عريف أول اليوم <span className="font-normal text-slate-400">(اختياري)</span></span>
                          <select
                            value={selectedPlan.first_sergeant_member_id || ''}
                            onChange={(e) => {
                              const member = teamChefs.find((row) => row.id === e.target.value)
                              updatePlanLocal({
                                first_sergeant_member_id: e.target.value || null,
                                first_sergeant_name: member?.full_name || null,
                              })
                            }}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5"
                          >
                            <option value="">بدون عريف أول</option>
                            {teamChefs.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                          </select>
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>ملاحظة عريف أول اليوم <span className="font-normal text-slate-400">(اختياري)</span></span>
                          <textarea
                            value={selectedPlan.first_sergeant_note || ''}
                            onChange={(e) => updatePlanLocal({ first_sergeant_note: e.target.value })}
                            rows={3}
                            className="min-h-[92px] w-full resize-y rounded-2xl border border-slate-300 bg-white px-3 py-2.5 leading-7"
                          />
                        </label>
                      </div>
                    </div>
                    <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                      <span>Theme اليوم <span className="font-normal text-slate-400">(اختياري)</span></span>
                      <textarea
                        value={selectedPlan.day_theme || ''}
                        onChange={(e) => updatePlanLocal({ day_theme: e.target.value })}
                        rows={4}
                        placeholder={`مثال:
التعاون والعمل الجماعي
روح الفريق`}
                        className="min-h-[120px] w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base leading-8"
                      />
                    </label>
                    <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                      <span>ملاحظات اليوم <span className="font-normal text-slate-400">(اختياري)</span></span>
                      <textarea
                        value={selectedPlan.notes || ''}
                        onChange={(e) => updatePlanLocal({ notes: e.target.value })}
                        rows={5}
                        placeholder={`اكتب ملاحظات اليوم هنا...
يمكنك النزول لسطر جديد لكل ملاحظة.`}
                        className="min-h-[150px] w-full resize-y rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base leading-8"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <InlineAlert tone="info" title="مساعد قائد اليوم">
                        {memberNameById(teamChefs, selectedPlan.assistant_day_leader_member_id, selectedPlan.assistant_day_leader_name)}
                        {selectedPlan.assistant_day_leader_note ? ` — ${selectedPlan.assistant_day_leader_note}` : ''}
                      </InlineAlert>
                      <InlineAlert tone="info" title="عريف أول اليوم">
                        {memberNameById(teamChefs, selectedPlan.first_sergeant_member_id, selectedPlan.first_sergeant_name)}
                        {selectedPlan.first_sergeant_note ? ` — ${selectedPlan.first_sergeant_note}` : ''}
                      </InlineAlert>
                    </div>
                    {(selectedPlan.day_theme || selectedPlan.notes) ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <InlineAlert tone="info" title="Theme اليوم">{selectedPlan.day_theme || '-'}</InlineAlert>
                        <InlineAlert tone="info" title="ملاحظات اليوم">{selectedPlan.notes || '-'}</InlineAlert>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="camp100-fixed-schedule rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
                  <div className="font-black">المواعيد الثابتة لليوم</div>
                  <div className="mt-1">الإفطار {fmtDisplayRange('10:00', '11:00')} • الغداء {fmtDisplayRange('16:00', '17:00')} • الروفو {fmtDisplayRange('17:00', '18:00')} • العشاء {fmtDisplayRange('22:00', '23:00')}</div>
                  <div className="mt-1 text-xs font-semibold text-amber-800">تظهر تلقائيًا في الجدول والـ PDF، ولا يمكن إضافة فقرة أو حجز يتداخل معها.</div>
                </div>

                {canEditSelectedTeam ? (
                  <div
                    id="camp-activity-editor"
                    className={`camp100-activity-editor ${isActivityEditorOpen ? 'fixed inset-0 z-[1300] block overflow-y-auto bg-slate-50 pb-28' : 'hidden'} sm:static sm:block sm:overflow-visible sm:rounded-[26px] sm:border sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:pb-4`}
                  >
                    <div className="sticky top-0 z-30 mb-3 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                      <div className="min-w-0">
                        <h3 className="text-lg font-black text-slate-900 sm:text-base">{activityForm.id ? 'تعديل فقرة' : 'إضافة فقرة جديدة'}</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">اختار التوقيت من/إلى، ثم المكان والأدوات والمسؤولين. كل الاختيارات محسنة للموبايل.</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {activityForm.id ? (
                          <button type="button" onClick={closeActivityEditor} className="hidden rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 sm:inline-flex">إلغاء التعديل</button>
                        ) : null}
                        <button
                          type="button"
                          onClick={closeActivityEditor}
                          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg font-black text-slate-700 shadow-sm sm:hidden"
                          aria-label="إغلاق نموذج الفقرة"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    <div className="px-4 sm:px-0">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <label className="space-y-1 text-sm font-semibold text-slate-700 xl:col-span-2">
                        <span>اسم الفقرة / Round</span>
                        <input value={activityForm.title} onChange={(e) => setActivityForm((p) => ({ ...p, title: e.target.value }))} placeholder="مثال: Round One" className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5" />
                      </label>
                      <label className="space-y-1 text-sm font-semibold text-slate-700">
                        <span>من</span>
                        <input type="time" value={activityForm.start_time} onChange={(e) => setActivityForm((p) => ({ ...p, start_time: e.target.value }))} className="min-h-[56px] w-full rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-center text-lg font-black text-slate-900 shadow-sm" dir="ltr" />
                      </label>
                      <label className="space-y-1 text-sm font-semibold text-slate-700">
                        <span>إلى</span>
                        <input type="time" value={activityForm.end_time} onChange={(e) => setActivityForm((p) => ({ ...p, end_time: e.target.value }))} className="min-h-[56px] w-full rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-center text-lg font-black text-slate-900 shadow-sm" dir="ltr" />
                      </label>
                      <div className="md:col-span-2 xl:col-span-4 rounded-[24px] border border-slate-200 bg-white p-4">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                          <div className="space-y-3">
                            <label className="block space-y-1 text-sm font-semibold text-slate-700">
                              <span>المكان / القاعة</span>
                              <select
                                value={activityForm.location}
                                onChange={(e) => handleLocationChange(e.target.value)}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5"
                              >
                                <option value="">اختار مكان الفقرة من خريطة المعسكر</option>
                                {activityForm.location && !CAMP_LOCATIONS.some((location) => location.name === activityForm.location) ? (
                                  <option value={activityForm.location}>{activityForm.location} - مكان محفوظ سابقًا</option>
                                ) : null}
                                {CAMP_LOCATION_GROUPS.map((group) => (
                                  <optgroup key={group} label={group}>
                                    {CAMP_LOCATIONS.filter((location) => location.group === group).map((location) => (
                                      <option key={location.name} value={location.name}>{location.name}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </label>

                            {selectedLocationOption?.room_key ? (
                              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900">
                                🏠 هذا المكان قاعة، لذلك سيُسجل تلقائيًا كحجز قاعة. لا يوجد حد أقصى يومي لعدد حجوزات القاعات، لكن يظل منع تعارض نفس القاعة مع فريق آخر شغالًا.
                              </div>
                            ) : activityForm.location ? (
                              selectedLocationConflicts.length ? (
                                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm leading-7 text-amber-950 shadow-sm">
                                  <div className="mb-1 font-black">⚠️ تنبيه: المكان مستخدم في نفس التوقيت</div>
                                  <div>
                                    {selectedLocationConflicts.map((booking) => (
                                      <div key={booking.id}>• {buildBookingText(booking)}</div>
                                    ))}
                                  </div>
                                  <div className="mt-2 font-semibold">يمكنك الحفظ رغم هذا التنبيه لأن بعض الأماكن تستوعب أكثر من فريق.</div>
                                </div>
                              ) : (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
                                  ✅ لا يوجد فريق آخر مسجل في هذا المكان خلال التوقيت المختار.
                                </div>
                              )
                            ) : (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                اختار المكان ليظهر لك فورًا إذا كان فريق آخر يستخدمه في نفس التوقيت.
                              </div>
                            )}

                            <p className="text-xs leading-5 text-slate-500">
                              التعارض في الأماكن المفتوحة يظهر كتنبيه فقط ولا يمنع الحفظ. أما القاعات فتظل Resources مستقلة وتخضع لقواعد الحجز المتفق عليها.
                            </p>
                          </div>

                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => setIsMapOpen(true)}
                              className="group block w-full text-right"
                              title="اضغط لتكبير خريطة المعسكر"
                            >
                              <img
                                src="/field-maps/camp-ground-map.png"
                                alt="خريطة أماكن المعسكر"
                                className="h-56 w-full object-contain p-2 transition group-hover:scale-[1.02]"
                              />
                              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                                <span>🗺️ خريطة أماكن المعسكر</span>
                                <span className="text-indigo-700">اضغط للتكبير</span>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="min-w-[240px] flex-1 space-y-1 text-sm font-semibold text-slate-700">
                          <span>إضافة أداة من المخزن</span>
                          <select value={materialToAdd} onChange={(e) => setMaterialToAdd(e.target.value)} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5">
                            <option value="">اختار أداة</option>
                            {materials.map((material) => (
                              <option key={material.id} value={material.id}>{material.name} - إجمالي {materialCapacity(material)}</option>
                            ))}
                          </select>
                        </label>
                        <button type="button" onClick={addMaterialRequest} className="rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800">إضافة الأداة</button>
                      </div>

                      {activityForm.material_requests.length ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {activityForm.material_requests.map((request) => {
                            const material = materialMap.get(request.material_id)
                            if (!material) return null
                            return (
                              <div key={request.material_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-black text-slate-900">{material.name}</div>
                                    <div className="text-xs text-slate-500">إجمالي المتاح في المخزن: {materialCapacity(material)}</div>
                                  </div>
                                  <button type="button" onClick={() => removeMaterialRequest(request.material_id)} className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">حذف</button>
                                </div>
                                <label className="mt-3 block space-y-1 text-sm font-semibold text-slate-700">
                                  <span>الكمية المطلوبة</span>
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={request.qty}
                                    onChange={(e) => updateMaterialQty(request.material_id, Number(e.target.value))}
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2"
                                  />
                                </label>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">لم يتم اختيار أدوات من المخزن بعد.</div>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                        <span>أدوات مكتوبة يدويًا</span>
                        <textarea value={activityForm.manual_materials} onChange={(e) => setActivityForm((p) => ({ ...p, manual_materials: e.target.value }))} rows={3} placeholder="مثال: أوراق مطبوعة، كروت خاصة، setup معين..." className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5" />
                      </label>
                    </div>

                    <div className="mt-4">
                      {renderAvailabilityPanel()}
                    </div>

                    <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="font-black text-slate-900">🎨 ألوان الفقرة في PDF</h4>
                          <p className="mt-1 text-sm text-slate-500">اختار Palette جاهزة أو حدد لون الخلفية ولون الكتابة بنفسك. الافتراضي خلفية بيضاء.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActivityForm((current) => ({ ...current, row_background_color: DEFAULT_ROW_BACKGROUND, row_text_color: DEFAULT_ROW_TEXT }))}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          إعادة الافتراضي
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {ROW_COLOR_PRESETS.map((preset) => {
                          const active = normalizeHexColor(activityForm.row_background_color, DEFAULT_ROW_BACKGROUND) === preset.background
                            && normalizeHexColor(activityForm.row_text_color, DEFAULT_ROW_TEXT) === preset.text
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => setActivityForm((current) => ({ ...current, row_background_color: preset.background, row_text_color: preset.text }))}
                              className={`rounded-xl border px-3 py-2 text-xs font-black shadow-sm transition ${active ? 'ring-2 ring-indigo-400 ring-offset-2' : 'hover:-translate-y-0.5'}`}
                              style={{ backgroundColor: preset.background, color: preset.text, borderColor: active ? '#4f46e5' : '#cbd5e1' }}
                              title={preset.label}
                            >
                              {preset.label}
                            </button>
                          )
                        })}
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_2fr]">
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>لون خلفية الـ Row</span>
                          <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-2">
                            <input
                              type="color"
                              value={normalizeHexColor(activityForm.row_background_color, DEFAULT_ROW_BACKGROUND)}
                              onChange={(event) => setActivityForm((current) => ({ ...current, row_background_color: event.target.value }))}
                              className="h-9 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                            />
                            <span className="font-mono text-xs text-slate-500">{normalizeHexColor(activityForm.row_background_color, DEFAULT_ROW_BACKGROUND)}</span>
                          </div>
                        </label>
                        <label className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>لون الكتابة</span>
                          <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white p-2">
                            <input
                              type="color"
                              value={normalizeHexColor(activityForm.row_text_color, DEFAULT_ROW_TEXT)}
                              onChange={(event) => setActivityForm((current) => ({ ...current, row_text_color: event.target.value }))}
                              className="h-9 w-14 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                            />
                            <span className="font-mono text-xs text-slate-500">{normalizeHexColor(activityForm.row_text_color, DEFAULT_ROW_TEXT)}</span>
                          </div>
                        </label>
                        <div className="space-y-1 text-sm font-semibold text-slate-700">
                          <span>Preview</span>
                          <div
                            className="rounded-2xl border border-slate-200 px-4 py-3 shadow-sm"
                            style={{
                              backgroundColor: normalizeHexColor(activityForm.row_background_color, DEFAULT_ROW_BACKGROUND),
                              color: normalizeHexColor(activityForm.row_text_color, DEFAULT_ROW_TEXT),
                            }}
                          >
                            <div className="font-black">{activityForm.title || 'اسم الفقرة سيظهر هنا'}</div>
                            <div className="mt-1 text-xs opacity-80">{fmtDisplayRange(activityForm.start_time, activityForm.end_time)} • {activityForm.location || 'المكان'}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-black text-slate-800">اختيار أكثر من Chef من نفس الفريق</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">اضغط على الأسماء لاختيار أكثر من شخص. الواجهة مناسبة للموبايل ولا تحتاج Ctrl.</div>
                          </div>
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">
                            {activityForm.member_ids.length} مختار
                          </span>
                        </div>

                        {activityForm.member_ids.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {activityForm.member_ids.map((memberId) => {
                              const member = teamChefs.find((row) => row.id === memberId)
                              if (!member) return null
                              return (
                                <button
                                  key={memberId}
                                  type="button"
                                  onClick={() => setActivityForm((current) => ({ ...current, member_ids: current.member_ids.filter((id) => id !== memberId) }))}
                                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800"
                                  title="إزالة من الاختيار"
                                >
                                  <span className="truncate">{member.full_name}</span>
                                  <span aria-hidden="true">×</span>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">لم يتم اختيار مسؤولين بعد.</div>
                        )}

                        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                          {teamChefs.length ? teamChefs.map((member) => {
                            const selected = activityForm.member_ids.includes(member.id)
                            return (
                              <button
                                key={member.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setActivityForm((current) => ({
                                  ...current,
                                  member_ids: selected
                                    ? current.member_ids.filter((id) => id !== member.id)
                                    : [...current.member_ids, member.id],
                                }))}
                                className={`flex min-h-[50px] w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-right transition ${selected ? 'border-indigo-300 bg-indigo-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50'}`}
                              >
                                <span className="min-w-0 flex-1 break-words text-sm font-bold">{member.full_name}</span>
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-black ${selected ? 'border-white/70 bg-white text-indigo-700' : 'border-slate-300 bg-slate-50 text-transparent'}`}>
                                  ✓
                                </span>
                              </button>
                            )
                          }) : (
                            <div className="p-3 text-center text-sm text-slate-500">لا يوجد Chefs مسجلون لهذا الفريق.</div>
                          )}
                        </div>

                        {activityForm.member_ids.length ? (
                          <button
                            type="button"
                            onClick={() => setActivityForm((current) => ({ ...current, member_ids: [] }))}
                            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                          >
                            مسح كل اختيارات الأشخاص
                          </button>
                        ) : null}
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-black text-slate-800">اختيار فريق أو أكثر للمساعدة</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">اختيار متعدد واضح على الموبايل؛ اضغط مرة للإضافة ومرة أخرى للإزالة.</div>
                          </div>
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                            {activityForm.assigned_team_ids.length} مختار
                          </span>
                        </div>

                        {activityForm.assigned_team_ids.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {activityForm.assigned_team_ids.map((teamId) => {
                              const team = teams.find((row) => row.id === teamId)
                              if (!team) return null
                              return (
                                <button
                                  key={teamId}
                                  type="button"
                                  onClick={() => setActivityForm((current) => ({ ...current, assigned_team_ids: current.assigned_team_ids.filter((id) => id !== teamId) }))}
                                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"
                                  title="إزالة من الاختيار"
                                >
                                  <span className="truncate">{team.name}</span>
                                  <span aria-hidden="true">×</span>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">لم يتم اختيار فرق مساعدة بعد.</div>
                        )}

                        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                          {teams.map((team) => {
                            const selected = activityForm.assigned_team_ids.includes(team.id)
                            return (
                              <button
                                key={team.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setActivityForm((current) => ({
                                  ...current,
                                  assigned_team_ids: selected
                                    ? current.assigned_team_ids.filter((id) => id !== team.id)
                                    : [...current.assigned_team_ids, team.id],
                                }))}
                                className={`flex min-h-[50px] w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-right transition ${selected ? 'border-emerald-300 bg-emerald-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50'}`}
                              >
                                <span className="min-w-0 flex-1 break-words text-sm font-bold">{team.name}</span>
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-black ${selected ? 'border-white/70 bg-white text-emerald-700' : 'border-slate-300 bg-slate-50 text-transparent'}`}>
                                  ✓
                                </span>
                              </button>
                            )
                          })}
                        </div>

                        {activityForm.assigned_team_ids.length ? (
                          <button
                            type="button"
                            onClick={() => setActivityForm((current) => ({ ...current, assigned_team_ids: [] }))}
                            className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                          >
                            مسح كل اختيارات الفرق
                          </button>
                        ) : null}
                      </div>
                      <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                        <span>أسماء مكتوبة يدويًا</span>
                        <input value={activityForm.manual_assignees} onChange={(e) => setActivityForm((p) => ({ ...p, manual_assignees: e.target.value }))} placeholder="مثال: مينا، بيشوي، فريق الخدمة الخارجي" className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5" />
                      </label>
                      <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
                        <span>ملاحظات الفقرة</span>
                        <textarea value={activityForm.notes} onChange={(e) => setActivityForm((p) => ({ ...p, notes: e.target.value }))} rows={3} className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5" />
                      </label>
                    </div>

                    </div>

                    <div className="camp100-editor-savebar sticky bottom-0 z-30 mt-5 border-t border-slate-200 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.10)] backdrop-blur sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                      <div className="flex items-center gap-3 sm:justify-end">
                        <button
                          type="button"
                          onClick={closeActivityEditor}
                          className="min-h-[48px] flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-700 sm:hidden"
                        >
                          إلغاء
                        </button>
                        <div className="flex-1 sm:flex-none">
                          <LoadingButton loading={savingActivity} onClick={saveActivity} disabled={validationPreview.errors.length > 0} className="min-h-[48px] w-full px-6 text-base font-black sm:w-auto">
                            {activityForm.id ? 'حفظ تعديل الفقرة' : 'حفظ وإضافة الفقرة'}
                          </LoadingButton>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedPlanDisplayActivities.length ? (
                  <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white">
                    <div className="overflow-x-auto" dir="rtl">
                      <table className="camp100-activity-table min-w-[1020px] w-full text-sm">
                        <thead className="bg-slate-900 text-white">
                          <tr>
                            <th className="px-4 py-3 text-right">التوقيت</th>
                            <th className="px-4 py-3 text-right">الفقرة</th>
                            <th className="px-4 py-3 text-right">المكان / القاعة</th>
                            <th className="px-4 py-3 text-right">الأدوات</th>
                            <th className="px-4 py-3 text-right">المسؤولين</th>
                            <th className="px-4 py-3 text-right">ملاحظات</th>
                            {canEditSelectedTeam ? <th className="px-4 py-3 text-right">إجراءات</th> : null}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedPlanDisplayActivities.map((item) => {
                            const colors = activityRowColors(item)
                            return (
                            <tr
                              key={item.id}
                              className="align-top transition"
                              style={{ backgroundColor: colors.background, color: colors.text }}
                            >
                              <td className="whitespace-nowrap px-4 py-3 font-bold" dir="rtl">{fmtDisplayRange(item.start_time, item.end_time)}</td>
                              <td className="px-4 py-3 font-semibold" dir="auto">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span>{item.title}</span>
                                  {item.is_fixed ? <span className="rounded-full border border-current/20 bg-white/60 px-2 py-0.5 text-[10px] font-black">ثابتة</span> : null}
                                </div>
                              </td>
                              <td className="px-4 py-3" dir="auto">{activityPlaceName(item)}</td>
                              <td className="px-4 py-3" dir="auto">{materialNames(item)}</td>
                              <td className="px-4 py-3" dir="auto">{assigneeNames(item)}</td>
                              <td className="px-4 py-3 opacity-90" dir="auto">{textOrDash(item.notes)}</td>
                              {canEditSelectedTeam ? (
                                <td className="px-4 py-3">
                                  {item.is_fixed ? (
                                    <span className="inline-flex rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-black text-slate-600">موعد ثابت</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      <button type="button" onClick={() => startEditActivity(item)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">تعديل</button>
                                      <button type="button" onClick={() => duplicateActivity(item)} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">نسخ</button>
                                      <button type="button" onClick={() => softDeleteActivity(item)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">حذف</button>
                                    </div>
                                  )}
                                </td>
                              ) : null}
                            </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="لا توجد فقرات لهذا اليوم" description={canEditSelectedTeam ? 'أضف أول فقرة من النموذج بالأعلى.' : 'الفريق لم يضف فقرات لهذا اليوم بعد.'} />
                )}
              </div>
            ) : (
              <EmptyState title="اختار أو أضف يوم" description="بعد اختيار اليوم ستظهر الفقرات والتصدير." />
            )}
          </SectionCard>
        </div>
      </div>

      {selectedPlan && canEditSelectedTeam && !isActivityEditorOpen ? (
        <button
          type="button"
          onClick={openNewActivityEditor}
          className="camp100-mobile-add fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] left-4 right-4 z-[1100] flex min-h-[58px] items-center justify-center gap-2 rounded-[20px] bg-indigo-600 px-5 py-3 text-base font-black text-white shadow-[0_14px_35px_rgba(79,70,229,0.38)] ring-1 ring-white/30 transition active:scale-[0.98] sm:hidden"
        >
          <span className="text-2xl leading-none">＋</span>
          إضافة فقرة جديدة
        </button>
      ) : null}

      {isMapOpen ? (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onClick={() => setIsMapOpen(false)}
        >
          <div
            className="relative max-h-[94vh] w-full max-w-6xl overflow-auto rounded-[28px] border border-white/20 bg-white p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsMapOpen(false)}
              className="sticky top-2 z-10 mr-auto mb-2 block rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-lg"
            >
              إغلاق الخريطة ✕
            </button>
            <img
              src="/field-maps/camp-ground-map.png"
              alt="خريطة أماكن المعسكر بالحجم الكامل"
              className="mx-auto h-auto w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
