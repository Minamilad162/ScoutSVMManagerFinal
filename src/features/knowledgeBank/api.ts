import { scoutYearFrom, supabase } from '../../lib/supabase'
import { fetchScoutYearById } from '../reference/api'
import { getScoutYearBounds, getTermYearBounds, inDateBounds } from '../../lib/scoutYearScope'

export type KnowledgeRole = { role_slug: string; team_id: string | null }
export type KnowledgeAnswerStatus = 'answered' | 'blocked' | 'unsupported' | 'empty'
export type KnowledgeAnswerItem = {
  label: string
  value?: string | number
  note?: string
  badge?: string
}
export type KnowledgeReference = {
  label: string
  value: string | number
  detail?: string
}
export type KnowledgeAnswer = {
  status: KnowledgeAnswerStatus
  title: string
  message: string
  items?: KnowledgeAnswerItem[]
  source?: string
  guardrail?: string
  interpretation?: string
  confidence?: 'high' | 'medium' | 'low'
  references?: KnowledgeReference[]
}
export type KnowledgeQuestionContext = {
  question: string
  roles: KnowledgeRole[]
  myTeamId: string | null
  scoutYearId: string | null
  scoutYearName?: string | null
}

type Team = { id: string; name: string }
type CurrentMember = {
  id: string
  full_name: string
  auth_user_id: string | null
  team_id: string | null
  team_name: string | null
  rank_label: string | null
  rank_slug?: string | null
  is_equipier: boolean
  is_active: boolean
}
type MeetingRow = { id: string; team_id: string | null; meeting_date?: string | null; mtype?: string | null }
type AttendanceRow = { member_id: string; is_present: boolean; is_excused?: boolean | null }
type MaterialRow = {
  id: string
  name: string
  description: string | null
  total_qty: number | null
  storage_location_id?: string | null
}
type StorageLocation = { id: string; name: string; description: string | null }
type MaterialReservationRow = { material_id: string; qty: number | null; team_id?: string | null }
type YearResponsibilityEvent = { id: string; title: string; event_date: string | null }
type YearResponsibilityAssignment = { event_id: string; member_id: string }
type TermRow = { id: string; name: string; scout_year_id?: string | null; year?: number | null; start_date?: string | null; end_date?: string | null; is_current?: boolean | null }
type BudgetRow = { team_id: string; term_id: string; amount_total: number | string | null }
type ExpenseRow = { team_id: string; term_id: string; total: number | string | null; item_name?: string | null; expense_date?: string | null }
type FinanceEventRow = { id: string; name: string; event_date: string | null; notes?: string | null }
type FinanceEventBudgetRow = { event_id: string; item_name: string; qty: number | string | null; unit_price: number | string | null; line_total: number | string | null }
type FinanceEventExpenseRow = { event_id: string; expense_date: string | null; item_name: string; qty: number | string | null; unit_price: number | string | null; total: number | string | null }

type QuestionIntent =
  | 'attendance'
  | 'material_location'
  | 'responsibilities'
  | 'evaluation_status'
  | 'members'
  | 'finance'
  | 'help'
  | 'unsupported'

const blockedEvaluationDetails = [
  'كام', 'كم', 'درجة', 'درجه', 'score', 'نقط', 'نقاط', 'ايجابي', 'إيجابي', 'سلبي', 'سلبى',
  'ملاحظة', 'ملاحظات', 'تفاصيل', 'خطة', 'تطوير', 'voice', 'فويس', 'تسجيل', 'اسمع', 'سمع',
  'negative', 'positive', 'افضل تقييم', 'أفضل تقييم', 'اسوا تقييم', 'أسوأ تقييم', 'ترتيب التقييم',
]
const evaluationStatusTerms = ['تم تقييم', 'اتقيم', 'اتقيمت', 'ماتقيم', 'ما تقيم', 'لم يتم تقييم', 'لسه', 'هل']
const finalBlockedTerms = ['وعد', 'الوعد', 'ميار', 'معيار', 'مميز', 'مميزه', 'متميّز', 'متميز', 'distinguished', 'promise']
const finalPeopleTerms = ['مين', 'من', 'اسماء', 'أسماء', 'لستة', 'ليسته', 'قائمة', 'قائمه', 'اخد', 'أخذ', 'ماخدش', 'ما اخدش', 'حصل', 'نجح', 'فشل']
const financeTerms = [
  'ميزانية', 'ميزانيه', 'مصروف', 'مصروفات', 'فلوس', 'budget', 'expense', 'expenses', 'تحصيل', 'قسط', 'تقسيط',
  'تكلفة', 'تكلفه', 'تكلف', 'اتكلف', 'اتكلفت', 'كلف', 'كلفة', 'كلفه', 'cost', 'spent', 'صرف', 'اتصرف',
  'تقسيم', 'تفصيل', 'تفاصيل', 'بنود', 'بند', 'line items', 'breakdown', 'اجمالي', 'إجمالي', 'متبقي', 'باقي',
]
const financeEventTerms = ['حفلة', 'حفله', 'حفل', 'event', 'ايفنت', 'ايفينت', 'تنظيم', 'نشاط', 'رحلة', 'رحله', 'خدمة', 'خدمه', 'معسكر', 'promise', 'وعد']
const financeBreakdownTerms = ['تقسيم', 'تفصيل', 'تفاصيل', 'بنود', 'بند', 'breakdown', 'line items', 'ابعتلي', 'اعرض', 'هاتلي']
const previousYearTerms = ['السنه اللي فاتت', 'السنة اللي فاتت', 'السنه السابقه', 'السنة السابقة', 'العام السابق', 'last year', 'previous year']

const helpTerms = ['اسال عن ايه', 'اسأل عن إيه', 'تقدر تجاوب', 'ممكن اسال', 'ممكن أسأل', 'ساعدني', 'امثله', 'أمثلة', 'help', 'بنك المعرفه']
const memberListTerms = ['مين في فريق', 'اعضاء فريق', 'أعضاء فريق', 'ولاد فريق', 'شيفات فريق', 'قادة فريق', 'قاده فريق', 'كام شيف', 'عدد الشيفات', 'كام ولد', 'عدد الولاد', 'كام عضو', 'عدد الاعضاء', 'عدد الأعضاء']

const commonQuestionWords = new Set([
  'مين', 'من', 'ايه', 'اي', 'ما', 'لا', 'لم', 'هل', 'كام', 'كم', 'عايز', 'عايزه', 'اعرف', 'اريد', 'اديني', 'هات', 'هاتلي',
  'في', 'فريق', 'السنه', 'السنة', 'الحاليه', 'الحالية', 'اللي', 'الى', 'الي', 'على', 'علي', 'عن', 'او', 'و', 'ده', 'دي', 'دا',
  'تم', 'لسه', 'اكثر', 'اكتر', 'اقل', 'ترتيب', 'قائمة', 'قائمه', 'لستة', 'ليسته', 'باسم', 'اسم', 'اسماء',
  'حضور', 'غياب', 'تقييم', 'تقيم', 'ميزانيه', 'ميزانية', 'مصروفات', 'مصروف', 'فلوس', 'تكلفه', 'تكلفة', 'مكان', 'فين', 'event', 'ايفنت', 'ايفينت',
])

function meaningfulTokens(input: string) {
  return normalizeArabic(input)
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !commonQuestionWords.has(word))
}

function countSignals(normalizedQuestion: string, terms: string[]) {
  return terms.reduce((count, term) => count + (normalizedQuestion.includes(normalizeArabic(term)) ? 1 : 0), 0)
}

function classifyQuestionScore(question: string, terms: string[]) {
  return countSignals(normalizeArabic(question), terms)
}

function intentArabicLabel(intent: QuestionIntent) {
  switch (intent) {
    case 'attendance': return 'حضور وغياب'
    case 'material_location': return 'أدوات وعهدة'
    case 'responsibilities': return 'مسؤوليات السنة / Events'
    case 'evaluation_status': return 'حالة تقييم فقط'
    case 'members': return 'أعضاء وشيفات'
    case 'finance': return 'ميزانيات ومصروفات'
    case 'help': return 'مساعدة وأنواع أسئلة'
    default: return 'غير مدعوم'
  }
}

function enrichAnswer(answer: KnowledgeAnswer, params: KnowledgeQuestionContext, intent: QuestionIntent): KnowledgeAnswer {
  const coreRefs: KnowledgeReference[] = [
    { label: 'نوع السؤال', value: intentArabicLabel(intent), detail: 'Question Registry + Safe Router' },
    { label: 'السنة المستخدمة', value: params.scoutYearName || 'السنة الحالية/حسب السؤال' },
  ]
  return { ...answer, references: [...coreRefs, ...(answer.references || [])] }
}

function getAskedCountMode(question: string) {
  return hasAny(normalizeArabic(question), ['كام', 'كم', 'عدد', 'count', 'how many'])
}

export const knowledgeSuggestions = [
  'أقدر أسأل بنك المعرفة عن إيه؟',
  'مين أكتر 5 غياب؟',
  'مين غاب آخر اجتماع في أشبال؟',
  'مين أكتر قائد ما بيغيبش؟',
  'كام شيف في فريق أشبال؟',
  'مين ما نزلش أي event؟',
  'فلان نزل كام event؟',
  'مين متكلف في event الخدمة؟',
  'مكان الشوم فين؟',
  'إيه أكتر أدوات مستخدمة؟',
  'ميزانية الترم الأول لفريق أشبال كانت كام؟',
  'تقسيم مصروفات الترم الأول لفريق أشبال',
  'حفلة الوعد السنة اللي فاتت اتكلفت كام؟',
  'هل فلان تم تقييمه؟',
]

export const blockedQuestionExamples = [
  'تقييم فلان كام؟',
  'إيه النقاط الإيجابية أو السلبية لفلان؟',
  'اسمعني voice note بتاع فلان',
  'مين أفضل تقييم أو أسوأ تقييم؟',
  'مين وعد أو مين ما وعدش؟',
  'مين أخذ ميار أو مين مميز؟',
  'ميزانية فريق كذا كام؟ بدون صلاحية مالية',
]

function normalizeArabic(input: string) {
  return input
    .toLowerCase()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[؟?،,.!؛:()\[\]{}"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasAny(normalizedQuestion: string, terms: string[]) {
  return terms.some((term) => normalizedQuestion.includes(normalizeArabic(term)))
}

function isAdmin(roles: KnowledgeRole[]) {
  return roles.some((role) => role.role_slug === 'admin')
}

function isFinanceAllowed(roles: KnowledgeRole[]) {
  return roles.some((role) => ['admin', 'chef_de_mouvement', 'chef_de_division', 'responsable_finance'].includes(role.role_slug))
}

function hasGlobalFinanceAccess(roles: KnowledgeRole[]) {
  return roles.some((role) => {
    if (['admin', 'chef_de_mouvement', 'chef_de_division'].includes(role.role_slug)) return true
    return role.role_slug === 'responsable_finance' && !role.team_id
  })
}

function scopedTeamIds(roles: KnowledgeRole[], myTeamId: string | null) {
  const ids = new Set<string>()
  if (myTeamId) ids.add(myTeamId)
  roles.forEach((role) => {
    if (role.team_id) ids.add(role.team_id)
  })
  return Array.from(ids)
}

function financeTeamIds(roles: KnowledgeRole[], myTeamId: string | null) {
  const ids = new Set<string>()
  roles.forEach((role) => {
    if (role.role_slug === 'responsable_finance' && role.team_id) ids.add(role.team_id)
  })
  if (!ids.size && roles.some((role) => role.role_slug === 'responsable_finance') && myTeamId) ids.add(myTeamId)
  return Array.from(ids)
}

function parseTopN(question: string) {
  const normalized = normalizeArabic(question)
  const digit = normalized.match(/\b(\d{1,2})\b/)
  if (digit) return Math.max(1, Math.min(30, Number(digit[1]) || 5))
  if (hasAny(normalized, ['خمسه', 'خمسة', 'خمس', 'five'])) return 5
  if (hasAny(normalized, ['عشره', 'عشرة', 'عشر', 'ten'])) return 10
  if (hasAny(normalized, ['ثلاثه', 'ثلاثة', 'تلاته', 'ثلاث', 'three'])) return 3
  return 5
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 100)
}

function money(value: number) {
  return `${Math.round(value).toLocaleString('ar-EG')} EGP`
}

function isFinanceQuestion(normalizedQuestion: string) {
  return hasAny(normalizedQuestion, financeTerms) || (hasAny(normalizedQuestion, ['كام', 'كم']) && hasAny(normalizedQuestion, financeEventTerms))
}

function asksPreviousYear(question: string) {
  return hasAny(normalizeArabic(question), previousYearTerms)
}

function explicitYear(question: string) {
  const normalized = normalizeArabic(question)
  const match = normalized.match(/\b(20\d{2})\b/)
  return match ? Number(match[1]) : null
}

function targetQuestionYear(question: string) {
  const explicit = explicitYear(question)
  if (explicit) return explicit
  if (asksPreviousYear(question)) return new Date().getFullYear() - 1
  return null
}

function numeric(value: number | string | null | undefined) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function dateYear(value?: string | null) {
  if (!value) return null
  const y = Number(String(value).slice(0, 4))
  return Number.isFinite(y) ? y : null
}

function stripGenericFinanceWords(question: string) {
  return normalizeArabic(question)
    .replace(/\b(ميزانيه|ميزانية|مصروف|مصروفات|فلوس|تكلفه|تكلفة|تكلف|اتكلف|اتكلفت|كلف|كلفه|كلفة|كام|كم|بكام|اجمالي|اجمالى|إجمالي|تقسيم|تفصيل|تفاصيل|بنود|بند|بتاعت|بتاع|بتاعه|بتاعة|السنه|السنة|اللي|الى|الي|فاتت|السابقه|السابقة|العام|ترم|الترم|اول|الأول|الاول|تاني|ثاني|الثاني|التاني|تالت|ثالث|الثالث|فريق|team|event|ايفنت|ايفينت|حفله|حفلة|حفل|خدمه|خدمة|نشاط|رحله|رحلة|و|في|عن|من|على|علي|كانت|كان|اديني|هات|هاتلي|ابعتلي)\b/g, ' ')
    .replace(/\b(20\d{2})\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreNameAgainstQuestion(nameInput: string, question: string, stripped?: string) {
  const name = normalizeArabic(nameInput)
  const normalized = normalizeArabic(question)
  if (!name) return 0
  if (normalized.includes(name)) return 100
  const words = (stripped || normalized).split(' ').filter((word) => word.length >= 3)
  return words.reduce((score, word) => score + (name.includes(word) ? 1 : 0), 0)
}

async function fetchTeams() {
  const { data, error } = await supabase.from('teams').select('id,name').order('name')
  if (error) throw error
  return (data || []) as Team[]
}

async function resolveTeamFromQuestion(question: string, teams?: Team[]) {
  const teamRows = teams || (await fetchTeams())
  const normalized = normalizeArabic(question)

  const aliases: Array<{ terms: string[]; match: (team: Team) => boolean }> = [
    { terms: ['براعم', 'bara3em', 'baraem'], match: (team) => normalizeArabic(team.name).includes('bara') || normalizeArabic(team.name).includes('براعم') },
    { terms: ['اشبال', 'أشبال', 'ashbal'], match: (team) => normalizeArabic(team.name).includes('ashbal') || normalizeArabic(team.name).includes('اشبال') },
    { terms: ['كشاف مبتدئ', 'مبتدئ', 'mobtade', 'mobtade2'], match: (team) => normalizeArabic(team.name).includes('mobtade') || normalizeArabic(team.name).includes('مبتد') },
    { terms: ['كشاف ثاني', 'كشاف تاني', 'تاني', 'tani'], match: (team) => normalizeArabic(team.name).includes('tani') || normalizeArabic(team.name).includes('ثاني') || normalizeArabic(team.name).includes('تاني') },
    { terms: ['كشاف اول', 'كشاف أول', 'اول', 'awal'], match: (team) => normalizeArabic(team.name).includes('awal') || normalizeArabic(team.name).includes('اول') },
    { terms: ['متقدم ثاني', 'متقدم تاني', 'm tani'], match: (team) => normalizeArabic(team.name).includes('m.tani') || normalizeArabic(team.name).includes('متقدم ثاني') || normalizeArabic(team.name).includes('متقدم تاني') },
    { terms: ['متقدم اول', 'متقدم أول', 'm awal'], match: (team) => normalizeArabic(team.name).includes('m.awal') || normalizeArabic(team.name).includes('متقدم اول') },
  ]

  for (const team of teamRows) {
    const name = normalizeArabic(team.name)
    if (name && normalized.includes(name)) return team
  }

  for (const alias of aliases) {
    if (alias.terms.some((term) => normalized.includes(normalizeArabic(term)))) {
      return teamRows.find(alias.match) || null
    }
  }

  return null
}

function buildTeamScope(params: KnowledgeQuestionContext, requestedTeam: Team | null) {
  const admin = isAdmin(params.roles)
  if (admin) return { allowed: true, teamIds: requestedTeam ? [requestedTeam.id] : [], label: requestedTeam?.name || 'كل الفرق' }

  const ids = scopedTeamIds(params.roles, params.myTeamId)
  if (requestedTeam && !ids.includes(requestedTeam.id)) {
    return { allowed: false, teamIds: [], label: requestedTeam.name }
  }
  if (requestedTeam) return { allowed: true, teamIds: [requestedTeam.id], label: requestedTeam.name }
  if (ids.length) return { allowed: true, teamIds: ids, label: 'نطاق فرقك فقط' }
  return { allowed: false, teamIds: [], label: 'بدون فريق محدد' }
}

function buildFinanceScope(params: KnowledgeQuestionContext, requestedTeam: Team | null) {
  if (!isFinanceAllowed(params.roles)) return { allowed: false, teamIds: [] as string[], label: 'بدون صلاحية مالية' }
  if (hasGlobalFinanceAccess(params.roles)) return { allowed: true, teamIds: requestedTeam ? [requestedTeam.id] : [] as string[], label: requestedTeam?.name || 'كل الفرق المالية' }

  const ids = financeTeamIds(params.roles, params.myTeamId)
  if (requestedTeam && !ids.includes(requestedTeam.id)) return { allowed: false, teamIds: [] as string[], label: requestedTeam.name }
  if (requestedTeam) return { allowed: true, teamIds: [requestedTeam.id], label: requestedTeam.name }
  if (ids.length) return { allowed: true, teamIds: ids, label: 'نطاق المالية الخاص بفريقك فقط' }
  return { allowed: false, teamIds: [] as string[], label: 'بدون فريق مالي محدد' }
}

function guardQuestion(params: KnowledgeQuestionContext): KnowledgeAnswer | null {
  const normalized = normalizeArabic(params.question)
  const financeQuestion = isFinanceQuestion(normalized)
  const asksFinalPeople = hasAny(normalized, finalPeopleTerms)

  if (hasAny(normalized, finalBlockedTerms) && (!financeQuestion || asksFinalPeople)) {
    return {
      status: 'blocked',
      title: 'السؤال ده مقفول من بنك المعرفة',
      message: 'نتائج الوعد/الميار/المميز لا تظهر من بنك المعرفة. مسموح فقط بأسئلة مالية عن تكلفة Event مثل حفلة الوعد حسب صلاحيات الميزانية.',
      guardrail: 'final-results-private',
      confidence: 'high',
      references: [{ label: 'سبب الرفض', value: 'نتائج شخصية نهائية', detail: 'Promise / Mayar / Distinguished' }],
    }
  }

  const isEvaluationQuestion = normalized.includes('تقييم') || normalized.includes('تقيم') || normalized.includes('اتقيم')
  if (isEvaluationQuestion) {
    const asksStatusOnly = hasAny(normalized, evaluationStatusTerms)
    const asksDetails = hasAny(normalized, blockedEvaluationDetails)
    if (asksDetails || !asksStatusOnly) {
      return {
        status: 'blocked',
        title: 'تفاصيل التقييم غير متاحة هنا',
        message: 'بنك المعرفة يقدر يوضح هل الشخص تم تقييمه ولا لأ فقط. الدرجات، النقاط الإيجابية/السلبية، والـvoice notes لا تظهر هنا.',
        guardrail: 'evaluation-details-private',
        confidence: 'high',
        references: [{ label: 'سبب الرفض', value: 'تفاصيل تقييم شخصية', detail: 'مسموح حالة التقييم فقط' }],
      }
    }
  }

  if (financeQuestion && !isFinanceAllowed(params.roles)) {
    return {
      status: 'blocked',
      title: 'السؤال خاص بالميزانية',
      message: 'أسئلة الميزانية متاحة فقط للإدارة أو مسؤول المالية حسب نطاق صلاحياته.',
      guardrail: 'finance-permission-required',
      confidence: 'high',
      references: [{ label: 'سبب الرفض', value: 'صلاحية مالية مطلوبة', detail: 'Admin / Chef de division / Finance فقط' }],
    }
  }

  return null
}

function classifyQuestion(question: string): QuestionIntent {
  const normalized = normalizeArabic(question)
  if (hasAny(normalized, helpTerms)) return 'help'

  const scores: Array<{ intent: QuestionIntent; score: number }> = [
    { intent: 'evaluation_status', score: classifyQuestionScore(question, ['تقييم', 'تقيم', 'اتقيم', 'تم تقييم', 'لم يتم تقييم']) },
    { intent: 'finance', score: isFinanceQuestion(normalized) ? 6 + classifyQuestionScore(question, financeTerms.concat(financeEventTerms)) : 0 },
    { intent: 'attendance', score: classifyQuestionScore(question, ['حضور', 'غياب', 'غايب', 'بيغيب', 'ما بيغيبش', 'مابيغيبش', 'ملتزم', 'انتظام', 'مواظب', 'اخر اجتماع', 'آخر اجتماع']) },
    { intent: 'responsibilities', score: classifyQuestionScore(question, ['event', 'ايفنت', 'ايفينت', 'تنظيم', 'تكليف', 'مسؤوليات', 'مسئوليات', 'نزل', 'مانزلش', 'ما نزلش']) },
    { intent: 'material_location', score: classifyQuestionScore(question, ['مكان', 'فين', 'دولاب', 'مخزن', 'تخزين', 'اداه', 'اداة', 'ادوات', 'عهدة', 'عهده', 'material', 'استخدام', 'مستخدمه', 'مستخدمة', 'كميه', 'كمية', 'قليله', 'قليلة']) },
    { intent: 'members', score: classifyQuestionScore(question, memberListTerms) },
  ]

  const ranked = scores.filter((row) => row.score > 0).sort((a, b) => b.score - a.score)
  return ranked[0]?.intent || 'unsupported'
}

async function fetchAccessibleMembers(params: KnowledgeQuestionContext, requestedTeam: Team | null, kind: 'all' | 'chefs' | 'equipiers' = 'all') {
  const scope = buildTeamScope(params, requestedTeam)
  if (!scope.allowed) {
    return { scope, members: [] as CurrentMember[] }
  }

  let query = scoutYearFrom('v_members_current', 'v_members_context')
    .select('id,auth_user_id,full_name,team_id,team_name,rank_label,rank_slug,is_equipier,is_active')
    .eq('is_active', true) as any

  if (scope.teamIds.length) query = query.in('team_id', scope.teamIds)
  if (kind === 'chefs') query = query.eq('is_equipier', false)
  if (kind === 'equipiers') query = query.eq('is_equipier', true)

  const { data, error } = await query.order('team_name', { ascending: true }).order('full_name', { ascending: true })
  if (error) throw error
  return { scope, members: (data || []) as CurrentMember[] }
}

function resolveMemberFromQuestion(question: string, members: CurrentMember[]) {
  const normalized = normalizeArabic(question)
  const exact = members.find((member) => normalized.includes(normalizeArabic(member.full_name)))
  if (exact) return exact

  const tokens = meaningfulTokens(question)
  if (!tokens.length) return null

  const scored = members
    .map((member) => {
      const name = normalizeArabic(member.full_name)
      const rank = normalizeArabic(member.rank_label || '')
      const team = normalizeArabic(member.team_name || '')
      const score = tokens.reduce((sum, word) => {
        if (name.includes(word)) return sum + 3
        if (rank.includes(word)) return sum + 1
        if (team.includes(word)) return sum + 1
        return sum
      }, 0)
      return { member, score }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.member.full_name.localeCompare(b.member.full_name, 'ar'))

  if (!scored.length) return null
  const bestScore = scored[0].score
  const tied = scored.filter((row) => row.score === bestScore)
  if (bestScore >= 6) return scored[0].member
  if (bestScore >= 3 && tied.length === 1) return scored[0].member
  return null
}

async function answerAttendance(params: KnowledgeQuestionContext): Promise<KnowledgeAnswer> {
  const teams = await fetchTeams()
  const requestedTeam = await resolveTeamFromQuestion(params.question, teams)
  const normalized = normalizeArabic(params.question)
  const kind = hasAny(normalized, ['ولد', 'ولاد', 'كشاف', 'براعم', 'اشبال', 'أشبال', 'equipier'])
    ? 'equipiers'
    : hasAny(normalized, ['قائد', 'قادة', 'قاده', 'شيف', 'chef'])
      ? 'chefs'
      : 'all'

  const { scope, members } = await fetchAccessibleMembers(params, requestedTeam, kind)
  if (!scope.allowed) {
    return {
      status: 'blocked',
      title: 'النطاق غير مسموح',
      message: `السؤال يطلب بيانات خارج نطاقك الحالي: ${scope.label}.`,
      guardrail: 'team-scope-required',
      confidence: 'high',
    }
  }
  if (!members.length) {
    return {
      status: 'empty',
      title: 'لا توجد أسماء في النطاق',
      message: 'لم أجد أعضاء مطابقين للفريق/النوع المطلوب.',
      source: `v_members_current — ${scope.label}`,
      confidence: 'high',
      references: [{ label: 'أعضاء مطابقين', value: 0, detail: scope.label }],
    }
  }

  let meetingQuery = supabase.from('meetings').select('id,team_id,meeting_date,mtype') as any
  if (params.scoutYearId) meetingQuery = meetingQuery.eq('scout_year_id', params.scoutYearId)
  if (scope.teamIds.length) meetingQuery = meetingQuery.in('team_id', scope.teamIds)
  const { data: meetingData, error: meetingError } = await meetingQuery.order('meeting_date', { ascending: true })
  if (meetingError) throw meetingError

  const meetings = (meetingData || []) as MeetingRow[]
  const meetingIds = meetings.map((meeting) => meeting.id)
  if (!meetingIds.length) {
    return {
      status: 'empty',
      title: 'لا توجد سجلات حضور',
      message: 'لا توجد اجتماعات مسجلة في نطاق السؤال الحالي.',
      source: `meetings — ${params.scoutYearName || 'السنة الحالية'} — ${scope.label}`,
      confidence: 'high',
      references: [
        { label: 'الأعضاء داخل النطاق', value: members.length },
        { label: 'الاجتماعات المسجلة', value: 0 },
      ],
    }
  }

  const { data: attendanceData, error: attendanceError } = await supabase
    .from('attendance')
    .select('meeting_id,member_id,is_present,is_excused')
    .in('meeting_id', meetingIds)
  if (attendanceError) throw attendanceError

  const stats = new Map<string, { member: CurrentMember; total: number; present: number; absent: number; excused: number }>()
  members.forEach((member) => stats.set(member.id, { member, total: 0, present: 0, absent: 0, excused: 0 }))

  ;((attendanceData || []) as AttendanceRow[]).forEach((row) => {
    const item = stats.get(row.member_id)
    if (!item) return
    item.total += 1
    if (row.is_present) item.present += 1
    else {
      item.absent += 1
      if (row.is_excused) item.excused += 1
    }
  })

  const asksLatestMeeting = hasAny(normalized, ['اخر اجتماع', 'آخر اجتماع', 'اخر مره', 'آخر مرة', 'اخر حضور', 'آخر حضور', 'اخر غياب', 'آخر غياب'])
  const topN = parseTopN(params.question)
  const asksLeastAbsent = hasAny(normalized, ['ما بيغيبش', 'مابيغيبش', 'ملتزم', 'انتظام', 'مواظب', 'اقل غياب', 'أقل غياب'])
  const asksAbsence = hasAny(normalized, ['غياب', 'غايب', 'بيغيب', 'اكثر غياب', 'أكثر غياب', 'غيابهم كتير']) && !asksLeastAbsent
  const asksRate = hasAny(normalized, ['نسبه', 'نسبة', 'rate', '%'])

  if (asksLatestMeeting) {
    const latestMeeting = [...meetings].sort((a, b) => String(b.meeting_date || '').localeCompare(String(a.meeting_date || '')))[0]
    const latestAttendance = ((attendanceData || []) as Array<AttendanceRow & { meeting_id?: string }>).filter((row: any) => row.meeting_id === latestMeeting?.id)
    const latestByMember = new Map(latestAttendance.map((row) => [row.member_id, row]))
    const latestRows = members
      .map((member) => ({ member, row: latestByMember.get(member.id) }))
      .filter((entry) => entry.row)
      .filter((entry) => asksAbsence ? !entry.row?.is_present : entry.row?.is_present)
      .sort((a, b) => a.member.full_name.localeCompare(b.member.full_name, 'ar'))

    return {
      status: latestRows.length ? 'answered' : 'empty',
      title: asksAbsence ? 'غياب آخر اجتماع' : 'حضور آخر اجتماع',
      message: latestRows.length ? 'النتيجة من آخر اجتماع مسجل داخل نطاق السؤال فقط.' : 'لا توجد أسماء مطابقة في آخر اجتماع داخل النطاق الحالي.',
      source: `meetings + attendance — آخر اجتماع — ${scope.label}`,
      interpretation: `تم فهم السؤال كسؤال عن ${asksAbsence ? 'غياب' : 'حضور'} آخر اجتماع.`,
      confidence: 'high',
      references: [
        { label: 'تاريخ آخر اجتماع', value: latestMeeting?.meeting_date || 'غير محدد', detail: latestMeeting?.mtype || 'اجتماع' },
        { label: 'الأعضاء داخل النطاق', value: members.length },
        { label: 'سجلات حضور آخر اجتماع', value: latestAttendance.length },
        { label: 'نتائج معروضة', value: latestRows.length },
      ],
      items: latestRows.slice(0, topN || 30).map(({ member, row }) => ({
        label: member.full_name,
        value: row?.is_present ? 'حاضر' : 'غائب',
        badge: member.is_equipier ? 'Equipier' : 'Chef',
        note: `${member.team_name || 'بدون فريق'}${row?.is_excused ? ' — بعذر' : ''}`,
      })),
    }
  }

  const rows = Array.from(stats.values()).filter((row) => row.total > 0)

  let sorted = rows
  let title = 'ترتيب الحضور'
  let valueLabel = 'حضور'
  let interpretation = 'تم فهم السؤال كسؤال حضور عام.'

  if (asksLeastAbsent) {
    sorted = rows
      .filter((row) => row.absent === 0)
      .sort((a, b) => b.present - a.present || a.member.full_name.localeCompare(b.member.full_name, 'ar'))
    title = `أكثر ${topN} التزامًا بالحضور`
    valueLabel = 'غياب'
    interpretation = 'تم فهم السؤال كسؤال عن أقل غياب / أعلى التزام.'
  } else if (asksAbsence) {
    sorted = rows.sort((a, b) => b.absent - a.absent || b.total - a.total || a.member.full_name.localeCompare(b.member.full_name, 'ar'))
    title = `أكثر ${topN} غيابًا`
    valueLabel = 'غياب'
    interpretation = 'تم فهم السؤال كسؤال عن أعلى عدد غياب.'
  } else if (asksRate) {
    sorted = rows.sort((a, b) => percent(b.present, b.total) - percent(a.present, a.total) || b.present - a.present || a.member.full_name.localeCompare(b.member.full_name, 'ar'))
    title = `أعلى ${topN} نسبة حضور`
    valueLabel = 'نسبة حضور'
    interpretation = 'تم فهم السؤال كسؤال عن نسبة الحضور.'
  } else {
    sorted = rows.sort((a, b) => b.present - a.present || b.total - a.total || a.member.full_name.localeCompare(b.member.full_name, 'ar'))
    title = `أكثر ${topN} حضورًا`
    valueLabel = 'حضور'
    interpretation = 'تم فهم السؤال كسؤال عن أعلى عدد حضور.'
  }

  const selected = sorted.slice(0, topN)
  if (!selected.length) {
    return {
      status: 'empty',
      title,
      message: 'لا توجد نتائج كافية حسب السؤال الحالي.',
      source: `attendance + meetings — ${params.scoutYearName || 'السنة الحالية'} — ${scope.label}`,
      interpretation,
      confidence: 'medium',
      references: [
        { label: 'الأعضاء داخل النطاق', value: members.length },
        { label: 'الاجتماعات المسجلة', value: meetings.length },
        { label: 'سجلات الحضور المقروءة', value: ((attendanceData || []) as AttendanceRow[]).length },
      ],
    }
  }

  return {
    status: 'answered',
    title,
    message: 'النتيجة مبنية على سجلات الحضور المسجلة فقط داخل نطاق صلاحياتك. لو فيه اجتماع لم يتم تسجيل حضوره، لن يدخل في الحساب.',
    source: `attendance + meetings — ${params.scoutYearName || 'السنة الحالية'} — ${scope.label}`,
    interpretation,
    confidence: rows.length && ((attendanceData || []) as AttendanceRow[]).length ? 'high' : 'medium',
    references: [
      { label: 'الأعضاء داخل النطاق', value: members.length, detail: kind === 'chefs' ? 'شيفات فقط' : kind === 'equipiers' ? 'Equipiers فقط' : 'كل الأنواع' },
      { label: 'الاجتماعات المسجلة', value: meetings.length, detail: params.scoutYearName || 'السنة الحالية' },
      { label: 'سجلات الحضور المقروءة', value: ((attendanceData || []) as AttendanceRow[]).length, detail: 'جدول attendance' },
      { label: 'نتائج معروضة', value: selected.length },
    ],
    items: selected.map((row) => {
      const rate = percent(row.present, row.total)
      const value = valueLabel === 'غياب'
        ? `${row.absent} غياب`
        : valueLabel === 'نسبة حضور'
          ? `${rate}%`
          : `${row.present} حضور`
      return {
        label: row.member.full_name,
        value,
        badge: row.member.is_equipier ? 'Equipier' : 'Chef',
        note: `${row.member.team_name || 'بدون فريق'} — إجمالي السجلات: ${row.total} — حضور: ${row.present} — غياب: ${row.absent} — نسبة الحضور: ${rate}%${row.excused ? ` — بعذر: ${row.excused}` : ''}`,
      }
    }),
  }
}

function stripMaterialWords(question: string) {
  return normalizeArabic(question)
    .replace(/\b(فين|مكان|في|انهي|انهى|دولاب|مخزن|تخزين|اداه|اداة|ادوات|العهدة|العهدة|عهده|material|ال|بتاع|بتاعة|بتاعت|كام|كم|الكمية|كميه|اكتر|أكتر|اكثر|أكثر|استخدام|مستخدمه|مستخدمة|قليله|قليلة|اقل|أقل)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function answerMaterialLocation(params: KnowledgeQuestionContext): Promise<KnowledgeAnswer> {
  const [{ data: materialData, error: materialError }, { data: locationData, error: locationError }] = await Promise.all([
    supabase.from('materials').select('id,name,description,total_qty,storage_location_id').eq('active', true).order('name', { ascending: true }) as any,
    supabase.from('storage_locations').select('id,name,description').order('name', { ascending: true }) as any,
  ])
  if (materialError) throw materialError
  if (locationError) throw locationError

  const materials = (materialData || []) as MaterialRow[]
  const locations = new Map(((locationData || []) as StorageLocation[]).map((loc) => [loc.id, loc]))
  const normalizedQuestion = normalizeArabic(params.question)
  const target = stripMaterialWords(params.question)
  const asksMostUsed = hasAny(normalizedQuestion, ['اكتر استخدام', 'أكتر استخدام', 'اكثر استخدام', 'أكثر استخدام', 'مستخدمه اكتر', 'مستخدمة أكتر', 'most used'])
  const asksLowStock = hasAny(normalizedQuestion, ['قليله', 'قليلة', 'ناقصه', 'ناقصة', 'اقل كميه', 'أقل كمية', 'low stock'])

  if (asksMostUsed) {
    const { data: reservationData, error: reservationError } = await supabase
      .from('material_reservations')
      .select('material_id,qty,team_id')
      .is('soft_deleted_at', null) as any
    if (reservationError) throw reservationError

    const byMaterial = new Map<string, { count: number; qty: number }>()
    ;((reservationData || []) as MaterialReservationRow[]).forEach((row) => {
      const current = byMaterial.get(row.material_id) || { count: 0, qty: 0 }
      current.count += 1
      current.qty += Number(row.qty || 0)
      byMaterial.set(row.material_id, current)
    })

    const rows = materials
      .map((material) => ({ material, stats: byMaterial.get(material.id) || { count: 0, qty: 0 } }))
      .filter((row) => row.stats.count > 0 || row.stats.qty > 0)
      .sort((a, b) => b.stats.qty - a.stats.qty || b.stats.count - a.stats.count || a.material.name.localeCompare(b.material.name, 'ar'))
      .slice(0, parseTopN(params.question))

    return {
      status: rows.length ? 'answered' : 'empty',
      title: 'أكثر الأدوات استخدامًا',
      message: rows.length ? 'الترتيب مبني على حجوزات الأدوات غير الملغية فقط.' : 'لا توجد حجوزات أدوات مسجلة حاليًا.',
      source: 'materials + material_reservations',
      interpretation: 'تم فهم السؤال كسؤال عن استخدام الأدوات من الحجوزات.',
      confidence: rows.length ? 'high' : 'medium',
      references: [
        { label: 'الأدوات النشطة', value: materials.length },
        { label: 'حجوزات الأدوات المقروءة', value: ((reservationData || []) as MaterialReservationRow[]).length, detail: 'غير الملغية فقط' },
        { label: 'نتائج معروضة', value: rows.length },
      ],
      items: rows.map(({ material, stats }) => ({
        label: material.name,
        value: `${stats.qty} قطعة محجوزة`,
        badge: `${stats.count} حجز`,
        note: `إجمالي المخزون: ${Number(material.total_qty || 0)} — المكان: ${material.storage_location_id ? locations.get(material.storage_location_id)?.name || 'غير محدد' : 'غير محدد'}`,
      })),
    }
  }

  if (asksLowStock) {
    const threshold = 3
    const rows = materials
      .filter((material) => Number(material.total_qty || 0) <= threshold)
      .sort((a, b) => Number(a.total_qty || 0) - Number(b.total_qty || 0) || a.name.localeCompare(b.name, 'ar'))
      .slice(0, parseTopN(params.question) || 10)

    return {
      status: rows.length ? 'answered' : 'empty',
      title: 'أدوات كميتها قليلة',
      message: rows.length ? `اعتبرت الكمية القليلة هي ${threshold} قطع أو أقل.` : `لا توجد أدوات نشطة كميتها ${threshold} قطع أو أقل.`,
      source: 'materials + storage_locations',
      interpretation: 'تم فهم السؤال كسؤال عن الأدوات قليلة الكمية.',
      confidence: 'medium',
      references: [
        { label: 'الأدوات النشطة', value: materials.length },
        { label: 'حد الكمية القليلة', value: threshold },
        { label: 'نتائج معروضة', value: rows.length },
      ],
      items: rows.map((material) => {
        const location = material.storage_location_id ? locations.get(material.storage_location_id) : null
        return {
          label: material.name,
          value: `${Number(material.total_qty || 0)} قطعة`,
          badge: location?.name || 'مكان غير محدد',
          note: location?.description || material.description || 'لا توجد تفاصيل إضافية مسجلة.',
        }
      }),
    }
  }

  const matches = materials
    .map((material) => {
      const name = normalizeArabic(material.name)
      const description = normalizeArabic(material.description || '')
      const score = normalizedQuestion.includes(name)
        ? 100
        : scoreNameAgainstQuestion(material.name, params.question, target) + (target.length > 1 && description.includes(target) ? 1 : 0)
      return { material, score }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.material.name.localeCompare(b.material.name, 'ar'))
    .map((row) => row.material)

  if (!matches.length) {
    return {
      status: 'empty',
      title: 'الأداة غير موجودة في البيانات الحالية',
      message: 'لم أجد أداة مطابقة للسؤال. جرّب كتابة اسم الأداة كما هو مسجل في إدارة الأدوات.',
      source: 'materials + storage_locations',
      interpretation: target ? `بحثت عن: ${target}` : 'تم فهم السؤال كسؤال عن مكان أداة.',
      confidence: 'low',
      references: [
        { label: 'الأدوات النشطة', value: materials.length },
        { label: 'أماكن التخزين', value: locations.size },
        { label: 'أمثلة أدوات', value: materials.slice(0, 5).map((material) => material.name).join('، ') || 'لا يوجد' },
      ],
    }
  }

  return {
    status: 'answered',
    title: 'مكان الأداة في العهدة',
    message: 'دي بيانات المكان والكمية من جدول الأدوات وأماكن التخزين.',
    source: 'materials + storage_locations',
    interpretation: 'تم فهم السؤال كسؤال عن مكان/كمية أداة محددة.',
    confidence: matches.length === 1 ? 'high' : 'medium',
    references: [
      { label: 'الأدوات النشطة', value: materials.length },
      { label: 'مطابقات السؤال', value: matches.length },
      { label: 'أماكن التخزين', value: locations.size },
    ],
    items: matches.slice(0, 8).map((material) => {
      const location = material.storage_location_id ? locations.get(material.storage_location_id) : null
      return {
        label: material.name,
        value: location?.name || 'مكان غير محدد',
        badge: `${Number(material.total_qty || 0)} قطعة`,
        note: location?.description || material.description || 'لا توجد تفاصيل إضافية مسجلة.',
      }
    }),
  }
}

function stripResponsibilityWords(question: string) {
  return normalizeArabic(question)
    .replace(/\b(event|ايفنت|ايفينت|تنظيم|تكليف|مسؤوليات|مسئوليات|نزل|نزلش|مانزلش|ما|اي|أي|مين|كام|كم|قائمة|قائمه|كل|في|على|علي|عن|السنة|السنه|الحالية|الحاليه)\b/g, ' ')
    .replace(/\b(20\d{2})\b/g, ' ')
    .replace(/\b\d{1,2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function answerResponsibilities(params: KnowledgeQuestionContext): Promise<KnowledgeAnswer> {
  const teams = await fetchTeams()
  const requestedTeam = await resolveTeamFromQuestion(params.question, teams)
  const { scope, members } = await fetchAccessibleMembers(params, requestedTeam, 'chefs')
  if (!scope.allowed) {
    return {
      status: 'blocked',
      title: 'النطاق غير مسموح',
      message: `السؤال يطلب بيانات خارج نطاقك الحالي: ${scope.label}.`,
      guardrail: 'team-scope-required',
      confidence: 'high',
    }
  }

  try {
    const [{ data: eventData, error: eventError }, { data: assignmentData, error: assignmentError }] = await Promise.all([
      supabase
        .from('year_responsibility_events')
        .select('id,title,event_date')
        .eq('scout_year_id', params.scoutYearId || '')
        .eq('is_active', true)
        .order('event_date', { ascending: true, nullsFirst: false }) as any,
      supabase
        .from('year_responsibility_assignments')
        .select('event_id,member_id')
        .eq('scout_year_id', params.scoutYearId || '') as any,
    ])
    if (eventError) throw eventError
    if (assignmentError) throw assignmentError

    const events = (eventData || []) as YearResponsibilityEvent[]
    const assignments = (assignmentData || []) as YearResponsibilityAssignment[]
    const memberMap = new Map(members.map((member) => [member.id, member]))
    const eventMap = new Map(events.map((event) => [event.id, event]))
    const validAssignments = assignments.filter((assignment) => memberMap.has(assignment.member_id))
    const assignmentByMember = new Map<string, YearResponsibilityAssignment[]>()
    validAssignments.forEach((assignment) => {
      const list = assignmentByMember.get(assignment.member_id) || []
      list.push(assignment)
      assignmentByMember.set(assignment.member_id, list)
    })

    const normalized = normalizeArabic(params.question)
    const asksNever = hasAny(normalized, ['ما نزلش', 'مانزلش', 'لم ينزل', 'ولا event', 'اي event', 'أي event', 'بدون تكليف'])
    const asksMost = hasAny(normalized, ['اكتر', 'أكتر', 'اكثر', 'أكثر', 'ترتيب', 'top']) && hasAny(normalized, ['تكليف', 'نزل', 'event', 'ايفنت', 'ايفينت'])
    const asksListEvents = hasAny(normalized, ['كل الايفنتات', 'كل الأحداث', 'كل ال events', 'قائمة الايفنتات', 'قائمه الايفنتات'])
    const requestedPerson = resolveMemberFromQuestion(params.question, members)

    if (requestedPerson && hasAny(normalized, ['نزل', 'تكليف', 'متكلف', 'event', 'ايفنت', 'ايفينت', 'كام', 'كم'])) {
      const personAssignments = (assignmentByMember.get(requestedPerson.id) || [])
        .map((assignment) => eventMap.get(assignment.event_id))
        .filter(Boolean) as YearResponsibilityEvent[]

      return {
        status: personAssignments.length ? 'answered' : 'empty',
        title: `تكليفات ${requestedPerson.full_name}`,
        message: personAssignments.length ? 'دي الـEvents المسجلة لهذا الشخص داخل مسؤوليات السنة.' : 'الشخص ده ليس له أي تكليف Event مسجل داخل السنة الحالية.',
        source: `year_responsibility_assignments — ${requestedPerson.full_name}`,
        interpretation: `تم فهم السؤال كسؤال عن تكليفات شخص محدد: ${requestedPerson.full_name}.`,
        confidence: 'high',
        references: [
          { label: 'الشخص المطابق', value: requestedPerson.full_name, detail: requestedPerson.team_name || 'بدون فريق' },
          { label: 'Events نشطة', value: events.length },
          { label: 'تكليفات الشخص', value: personAssignments.length },
        ],
        items: personAssignments.slice(0, parseTopN(params.question) || 30).map((event) => ({
          label: event.title,
          value: 'مكلف',
          badge: event.event_date || 'بدون تاريخ',
          note: requestedPerson.team_name || 'بدون فريق',
        })),
      }
    }

    if (asksListEvents) {
      return {
        status: events.length ? 'answered' : 'empty',
        title: 'Events مسؤوليات السنة',
        message: events.length ? 'دي قائمة الـEvents النشطة في السنة الحالية.' : 'لا توجد Events نشطة مسجلة في مسؤوليات السنة.',
        source: `year_responsibility_events — ${params.scoutYearName || 'السنة الحالية'}`,
        interpretation: 'تم فهم السؤال كطلب لقائمة الـEvents.',
        confidence: 'high',
        references: [
          { label: 'Events نشطة', value: events.length },
          { label: 'تكليفات مقروءة', value: validAssignments.length },
        ],
        items: events.slice(0, 30).map((event) => ({
          label: event.title,
          value: validAssignments.filter((assignment) => assignment.event_id === event.id).length,
          badge: event.event_date || 'بدون تاريخ',
          note: 'عدد التكليفات داخل نطاق صلاحياتك.',
        })),
      }
    }

    if (asksNever) {
      const never = members.filter((member) => (assignmentByMember.get(member.id) || []).length === 0)
      return {
        status: never.length ? 'answered' : 'empty',
        title: 'الشيفات اللي ما نزلتش أي Event',
        message: never.length ? 'الأسماء دي ليس لها أي تكليف مسجل في مسؤوليات السنة الحالية.' : 'كل الشيفات في نطاق السؤال لهم تكليف واحد على الأقل.',
        source: `year_responsibility_assignments — ${params.scoutYearName || 'السنة الحالية'} — ${scope.label}`,
        interpretation: 'تم فهم السؤال كسؤال عن الشيفات غير المكلفة بأي Event.',
        confidence: 'high',
        references: [
          { label: 'الشيفات داخل النطاق', value: members.length },
          { label: 'Events نشطة', value: events.length },
          { label: 'تكليفات داخل النطاق', value: validAssignments.length },
          { label: 'غير مكلفين', value: never.length },
        ],
        items: never.slice(0, 30).map((member) => ({
          label: member.full_name,
          value: 'ما نزلش',
          badge: member.rank_label || 'Chef',
          note: member.team_name || 'بدون فريق',
        })),
      }
    }

    if (asksMost) {
      const rows = members
        .map((member) => ({ member, count: (assignmentByMember.get(member.id) || []).length }))
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count || a.member.full_name.localeCompare(b.member.full_name, 'ar'))
        .slice(0, parseTopN(params.question))

      return {
        status: rows.length ? 'answered' : 'empty',
        title: 'أكثر الشيفات تكليفًا في الـEvents',
        message: rows.length ? 'الترتيب مبني على عدد التكليفات المسجلة في مسؤوليات السنة.' : 'لا توجد تكليفات مسجلة داخل نطاق السؤال.',
        source: `year_responsibility_assignments — ${params.scoutYearName || 'السنة الحالية'} — ${scope.label}`,
        interpretation: 'تم فهم السؤال كسؤال ترتيب حسب عدد التكليفات.',
        confidence: 'high',
        references: [
          { label: 'الشيفات داخل النطاق', value: members.length },
          { label: 'Events نشطة', value: events.length },
          { label: 'تكليفات داخل النطاق', value: validAssignments.length },
          { label: 'نتائج معروضة', value: rows.length },
        ],
        items: rows.map(({ member, count }) => ({
          label: member.full_name,
          value: `${count} تكليف`,
          badge: member.rank_label || 'Chef',
          note: (assignmentByMember.get(member.id) || [])
            .map((assignment) => eventMap.get(assignment.event_id)?.title)
            .filter(Boolean)
            .slice(0, 4)
            .join('، ') || member.team_name || 'بدون فريق',
        })),
      }
    }

    const event = events
      .map((row) => ({ row, score: normalized.includes(normalizeArabic(row.title)) ? 100 : scoreNameAgainstQuestion(row.title, params.question, stripResponsibilityWords(params.question)) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.row.event_date || '').localeCompare(String(b.row.event_date || '')))[0]?.row || null
    if (!event) {
      return {
        status: 'unsupported',
        title: 'محتاج اسم الـEvent',
        message: 'اكتب اسم الـEvent أو التنظيم داخل السؤال، أو اسأل: مين ما نزلش أي event؟ أو مين أكتر شيف اتكلف؟',
        source: 'year_responsibility_events',
        interpretation: 'تم فهم السؤال كمسؤوليات سنة، لكن لم أجد اسم Event واضح.',
        confidence: 'low',
        references: [
          { label: 'Events نشطة', value: events.length, detail: events.slice(0, 5).map((event) => event.title).join('، ') || 'لا يوجد' },
        ],
      }
    }

    const assignedIds = new Set(validAssignments.filter((assignment) => assignment.event_id === event.id).map((assignment) => assignment.member_id))
    const assignedMembers = members.filter((member) => assignedIds.has(member.id))

    return {
      status: assignedMembers.length ? 'answered' : 'empty',
      title: `المكلفين في ${event.title}`,
      message: assignedMembers.length ? 'دي الأسماء المكلفة على الـEvent المحدد داخل نطاق صلاحياتك.' : 'لا توجد تكليفات مسجلة لهذا الـEvent داخل نطاق السؤال.',
      source: `year_responsibility_assignments — ${event.title} — ${scope.label}`,
      interpretation: `تم فهم السؤال عن Event: ${event.title}`,
      confidence: 'high',
      references: [
        { label: 'الشيفات داخل النطاق', value: members.length },
        { label: 'تكليفات هذا الـEvent', value: assignedMembers.length },
        { label: 'تاريخ الـEvent', value: event.event_date || 'غير محدد' },
      ],
      items: assignedMembers.map((member) => ({
        label: member.full_name,
        value: 'مكلف',
        badge: member.rank_label || 'Chef',
        note: member.team_name || 'بدون فريق',
      })),
    }
  } catch (error: any) {
    return {
      status: 'unsupported',
      title: 'مسؤوليات السنة غير جاهزة في قاعدة البيانات',
      message: error?.message?.includes('year_responsibility')
        ? 'شغّل SQL رقم 13 الخاص بمسؤوليات السنة ثم جرّب السؤال مرة أخرى.'
        : error?.message || 'تعذر قراءة مسؤوليات السنة حاليًا.',
      source: 'year_responsibility_events / year_responsibility_assignments',
      confidence: 'low',
    }
  }
}

async function answerEvaluationStatus(params: KnowledgeQuestionContext): Promise<KnowledgeAnswer> {
  const teams = await fetchTeams()
  const requestedTeam = await resolveTeamFromQuestion(params.question, teams)
  const { scope, members } = await fetchAccessibleMembers(params, requestedTeam, 'all')
  if (!scope.allowed) {
    return {
      status: 'blocked',
      title: 'النطاق غير مسموح',
      message: `السؤال يطلب بيانات خارج نطاقك الحالي: ${scope.label}.`,
      guardrail: 'team-scope-required',
      confidence: 'high',
    }
  }

  const { data: termData, error: termError } = await scoutYearFrom('v_terms_with_scout_year', 'v_terms_context')
    .select('id,name,scout_year_id')
    .eq('scout_year_id', params.scoutYearId || '')
  if (termError) throw termError
  const termIds = ((termData || []) as TermRow[]).map((term) => term.id)
  if (!termIds.length) {
    return {
      status: 'empty',
      title: 'لا توجد ترمات',
      message: 'لا توجد ترمات مسجلة للسنة الحالية، لذلك لا يمكن تحديد حالة التقييم.',
      source: 'v_terms_with_scout_year',
      confidence: 'high',
      references: [{ label: 'الترمات المقروءة', value: 0 }],
    }
  }

  const [{ data: evaluationData, error: evaluationError }, { data: voiceData, error: voiceError }] = await Promise.all([
    supabase.from('evaluations').select('evaluatee_member_id,positive_note,negative_note').in('term_id', termIds) as any,
    supabase.from('evaluation_voice_notes').select('evaluatee_member_id').in('term_id', termIds).is('soft_deleted_at', null) as any,
  ])
  if (evaluationError) throw evaluationError
  if (voiceError) throw voiceError

  const evaluated = new Set<string>()
  ;((evaluationData || []) as Array<{ evaluatee_member_id: string; positive_note?: string | null; negative_note?: string | null }>).forEach((row) => {
    if ((row.positive_note || '').trim() || (row.negative_note || '').trim()) evaluated.add(row.evaluatee_member_id)
  })
  ;((voiceData || []) as Array<{ evaluatee_member_id: string }>).forEach((row) => evaluated.add(row.evaluatee_member_id))

  const normalized = normalizeArabic(params.question)
  const asksNotEvaluated = hasAny(normalized, ['ماتقيم', 'ما تقيم', 'لم يتم', 'لسه'])
  const requestedPerson = resolveMemberFromQuestion(params.question, members)

  const targetMembers = requestedPerson
    ? [requestedPerson]
    : members.filter((member) => asksNotEvaluated ? !evaluated.has(member.id) : evaluated.has(member.id))

  if (!targetMembers.length) {
    return {
      status: 'empty',
      title: asksNotEvaluated ? 'لا توجد أسماء غير مقيّمة' : 'لا توجد أسماء مقيّمة',
      message: requestedPerson ? 'لم أجد حالة تقييم مطابقة لهذا الشخص.' : 'لا توجد نتائج مطابقة داخل نطاق السؤال الحالي.',
      source: `evaluations + evaluation_voice_notes — حالة فقط — ${scope.label}`,
      interpretation: 'تم فهم السؤال كحالة تقييم فقط بدون تفاصيل.',
      confidence: 'medium',
      references: [
        { label: 'الأعضاء داخل النطاق', value: members.length },
        { label: 'الترمات المقروءة', value: termIds.length },
        { label: 'سجلات تقييم بها ملاحظات', value: evaluated.size },
      ],
    }
  }

  return {
    status: 'answered',
    title: requestedPerson ? `حالة تقييم ${requestedPerson.full_name}` : (asksNotEvaluated ? 'أسماء لم يتم تقييمها' : 'أسماء تم تقييمها'),
    message: 'الرد يعرض حالة التقييم فقط بدون درجات أو نقاط أو تفاصيل صوتية. يعتبر الشخص مقيّمًا لو عنده نقطة إيجابية/سلبية أو Voice Note محفوظة.',
    source: `evaluations + evaluation_voice_notes — حالة فقط — ${scope.label}`,
    interpretation: requestedPerson ? `تم تحديد الشخص: ${requestedPerson.full_name}` : 'تم فهم السؤال كقائمة حالة تقييم.',
    confidence: requestedPerson ? 'high' : 'medium',
    references: [
      { label: 'الأعضاء داخل النطاق', value: members.length },
      { label: 'الترمات المقروءة', value: termIds.length },
      { label: 'سجلات التقييم المقروءة', value: ((evaluationData || []) as any[]).length },
      { label: 'Voice notes المقروءة', value: ((voiceData || []) as any[]).length },
      { label: 'أسماء بحالة تم التقييم', value: evaluated.size },
    ],
    items: targetMembers.slice(0, 30).map((member) => ({
      label: member.full_name,
      value: evaluated.has(member.id) ? 'تم التقييم' : 'لم يتم التقييم',
      badge: member.is_equipier ? 'Equipier' : 'Chef',
      note: member.team_name || 'بدون فريق',
    })),
  }
}

async function answerMembers(params: KnowledgeQuestionContext): Promise<KnowledgeAnswer> {
  const teams = await fetchTeams()
  const requestedTeam = await resolveTeamFromQuestion(params.question, teams)
  const normalized = normalizeArabic(params.question)
  const kind = hasAny(normalized, ['شيف', 'قائد', 'قادة', 'قاده', 'chef'])
    ? 'chefs'
    : hasAny(normalized, ['ولد', 'ولاد', 'كشاف', 'equipier'])
      ? 'equipiers'
      : 'all'
  const { scope, members } = await fetchAccessibleMembers(params, requestedTeam, kind)
  if (!scope.allowed) {
    return {
      status: 'blocked',
      title: 'النطاق غير مسموح',
      message: `السؤال يطلب بيانات خارج نطاقك الحالي: ${scope.label}.`,
      guardrail: 'team-scope-required',
      confidence: 'high',
    }
  }
  const asksCount = getAskedCountMode(params.question)
  if (asksCount) {
    const byTeam = new Map<string, { team: string; total: number; chefs: number; equipiers: number }>()
    members.forEach((member) => {
      const key = member.team_id || 'none'
      const current = byTeam.get(key) || { team: member.team_name || 'بدون فريق', total: 0, chefs: 0, equipiers: 0 }
      current.total += 1
      if (member.is_equipier) current.equipiers += 1
      else current.chefs += 1
      byTeam.set(key, current)
    })
    const rows = Array.from(byTeam.values()).sort((a, b) => b.total - a.total || a.team.localeCompare(b.team, 'ar'))
    return {
      status: members.length ? 'answered' : 'empty',
      title: `عدد الأعضاء في ${scope.label}`,
      message: members.length ? 'العدد مبني على الأعضاء النشطين داخل السنة الحالية ونطاق صلاحياتك.' : 'لا توجد أسماء مطابقة داخل النطاق المطلوب.',
      source: `v_members_current — ${scope.label}`,
      interpretation: `تم فهم السؤال كسؤال عدد/إحصاء أعضاء (${kind === 'chefs' ? 'شيفات' : kind === 'equipiers' ? 'Equipiers' : 'الكل'}).`,
      confidence: requestedTeam ? 'high' : 'medium',
      references: [
        { label: 'أعضاء مطابقين', value: members.length },
        { label: 'النطاق', value: scope.label },
        { label: 'النوع', value: kind === 'chefs' ? 'شيفات فقط' : kind === 'equipiers' ? 'Equipiers فقط' : 'كل الأعضاء' },
      ],
      items: rows.map((row) => ({
        label: row.team,
        value: row.total,
        badge: `${row.chefs} شيف / ${row.equipiers} عضو`,
        note: 'من v_members_current للأعضاء النشطين فقط.',
      })),
    }
  }

  return {
    status: members.length ? 'answered' : 'empty',
    title: `أعضاء ${scope.label}`,
    message: members.length ? 'دي قائمة مختصرة من الأعضاء داخل النطاق المطلوب.' : 'لا توجد أسماء مطابقة داخل النطاق المطلوب.',
    source: `v_members_current — ${scope.label}`,
    interpretation: `تم فهم السؤال كطلب قائمة أعضاء (${kind === 'chefs' ? 'شيفات' : kind === 'equipiers' ? 'Equipiers' : 'الكل'}).`,
    confidence: requestedTeam ? 'high' : 'medium',
    references: [
      { label: 'أعضاء مطابقين', value: members.length },
      { label: 'النطاق', value: scope.label },
      { label: 'النوع', value: kind === 'chefs' ? 'شيفات فقط' : kind === 'equipiers' ? 'Equipiers فقط' : 'كل الأعضاء' },
    ],
    items: members.slice(0, 50).map((member) => ({
      label: member.full_name,
      value: member.rank_label || '—',
      badge: member.is_equipier ? 'Equipier' : 'Chef',
      note: member.team_name || 'بدون فريق',
    })),
  }
}

function resolveTermFromQuestion(question: string, terms: TermRow[]) {
  const normalized = normalizeArabic(question)

  for (const term of terms) {
    const name = normalizeArabic(term.name)
    if (name && normalized.includes(name)) return term
  }

  const aliases: Array<{ terms: string[]; match: (term: TermRow) => boolean }> = [
    {
      terms: ['ترم اول', 'الترم الاول', 'ترم 1', 'term 1', 'term one', 'first term'],
      match: (term) => hasAny(normalizeArabic(term.name), ['term 1', 'ترم 1', 'اول', 'الاول', 'first']),
    },
    {
      terms: ['ترم تاني', 'ترم ثاني', 'الترم الثاني', 'الترم التاني', 'ترم 2', 'term 2', 'second term'],
      match: (term) => hasAny(normalizeArabic(term.name), ['term 2', 'ترم 2', 'تاني', 'ثاني', 'second']),
    },
    {
      terms: ['ترم تالت', 'ترم ثالث', 'الترم الثالث', 'ترم 3', 'term 3', 'third term'],
      match: (term) => hasAny(normalizeArabic(term.name), ['term 3', 'ترم 3', 'تالت', 'ثالث', 'third']),
    },
    {
      terms: ['summer', 'صيف', 'الصيف', 'ترم الصيف'],
      match: (term) => hasAny(normalizeArabic(term.name), ['summer', 'صيف']),
    },
  ]

  for (const alias of aliases) {
    if (alias.terms.some((term) => normalized.includes(normalizeArabic(term)))) {
      return terms.find(alias.match) || null
    }
  }

  return null
}

function filterTermsByQuestionYear(question: string, terms: TermRow[], currentScoutYearId: string | null) {
  // Never fall back to unscoped/old-year terms for a normal current-year question.
  if (!currentScoutYearId) return []
  const inSelectedYear = terms.filter((term) => term.scout_year_id === currentScoutYearId)
  const requestedYear = targetQuestionYear(question)
  return requestedYear
    ? inSelectedYear.filter((term) => term.year === requestedYear || dateYear(term.start_date) === requestedYear || dateYear(term.end_date) === requestedYear)
    : inSelectedYear
}

function resolveFinanceEvent(question: string, events: FinanceEventRow[]) {
  const stripped = stripGenericFinanceWords(question)
  const ranked = events
    .map((event) => ({ event, score: scoreNameAgainstQuestion(event.name, question, stripped) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || String(b.event.event_date || '').localeCompare(String(a.event.event_date || '')))
  return ranked[0]?.event || null
}

function shouldAskFinanceEvent(question: string) {
  const normalized = normalizeArabic(question)
  return hasAny(normalized, financeEventTerms) || hasAny(normalized, ['حفلة', 'حفله', 'حفل', 'نشاط', 'رحلة', 'رحله', 'خدمة', 'خدمه'])
}

async function answerFinanceEvent(params: KnowledgeQuestionContext): Promise<KnowledgeAnswer> {
  if (!hasGlobalFinanceAccess(params.roles)) {
    return {
      status: 'blocked',
      title: 'السؤال خاص بميزانية المجموعة',
      message: 'تكلفة الـEvents العامة متاحة فقط للإدارة أو مسؤول مالية عام / Division حسب الصلاحيات، وليست ضمن نطاق مسؤول مالية فريق واحد.',
      guardrail: 'global-finance-required',
      confidence: 'high',
      references: [{ label: 'النطاق المطلوب', value: 'ميزانية Events عامة' }],
    }
  }

  const eventYear = params.scoutYearId ? await fetchScoutYearById(params.scoutYearId) : null
  const eventBounds = getScoutYearBounds(eventYear)
  if (!eventBounds) return { status: 'empty', title: 'لا توجد سنة كشفية محددة', message: 'حدّد السنة الكشفية أولاً لعرض Events مالية.', confidence: 'high' }

  let eventData: FinanceEventRow[] = []
  try {
    const { data, error } = await supabase
      .from('finance_events')
      .select('id,name,event_date,notes')
      .is('soft_deleted_at', null)
      .order('event_date', { ascending: false }) as any
    if (error) throw error
    eventData = (data || []) as FinanceEventRow[]
  } catch (error: any) {
    return {
      status: 'unsupported',
      title: 'بيانات Events المالية غير متاحة',
      message: 'لم أقدر أقرأ جدول finance_events. راجع هل جداول ميزانية المجموعة موجودة ومفعّلة في قاعدة البيانات.',
      source: 'finance_events',
      interpretation: 'تم فهم السؤال كسؤال عن تكلفة Event عام.',
      confidence: 'low',
      references: [{ label: 'خطأ القراءة', value: error?.message || 'finance_events unavailable' }],
    }
  }

  const targetYear = targetQuestionYear(params.question)
  const filteredEvents = eventData.filter((event) => inDateBounds(event.event_date, eventBounds) && (!targetYear || dateYear(event.event_date) === targetYear))
  const event = resolveFinanceEvent(params.question, filteredEvents)
  const asksBreakdown = hasAny(normalizeArabic(params.question), financeBreakdownTerms)

  if (!event && !hasAny(normalizeArabic(params.question), ['كل الايفنتات', 'كل الأحداث', 'كل ال events', 'قائمة الايفنتات', 'قائمه الايفنتات'])) {
    return {
      status: 'empty',
      title: 'لم أجد الـEvent المالي المطلوب',
      message: 'اكتب اسم الـEvent كما هو مسجل في ميزانية المجموعة، أو جرّب سؤال مثل: حفلة الوعد اتكلفت كام؟',
      source: 'finance_events',
      interpretation: `تم فهم السؤال كسؤال تكلفة Event${targetYear ? ` لسنة ${targetYear}` : ''}.`,
      confidence: 'low',
      references: [
        { label: 'Events مالية مقروءة', value: filteredEvents.length },
        { label: 'فلتر السنة', value: targetYear || 'بدون فلتر سنة' },
        { label: 'أقرب أمثلة', value: filteredEvents.slice(0, 5).map((row) => row.name).join('، ') || 'لا يوجد' },
      ],
    }
  }

  const selectedEvents = event ? [event] : filteredEvents.slice(0, 30)
  const eventIds = selectedEvents.map((row) => row.id)
  if (!eventIds.length) {
    return {
      status: 'empty',
      title: 'لا توجد Events مالية',
      message: 'لا توجد Events مالية مطابقة للسؤال داخل البيانات الحالية.',
      source: 'finance_events',
      interpretation: `تم فهم السؤال كسؤال مالي عن Events${targetYear ? ` لسنة ${targetYear}` : ''}.`,
      confidence: 'medium',
      references: [{ label: 'Events مالية مقروءة', value: filteredEvents.length }],
    }
  }

  const [{ data: budgetData, error: budgetError }, { data: expenseData, error: expenseError }] = await Promise.all([
    supabase.from('finance_event_budgets').select('event_id,item_name,qty,unit_price,line_total').in('event_id', eventIds).is('soft_deleted_at', null) as any,
    supabase.from('finance_event_expenses').select('event_id,expense_date,item_name,qty,unit_price,total').in('event_id', eventIds).gte('expense_date', eventBounds.start).lte('expense_date', eventBounds.end).is('soft_deleted_at', null) as any,
  ])
  if (budgetError) throw budgetError
  if (expenseError) throw expenseError

  const budgetRows = (budgetData || []) as FinanceEventBudgetRow[]
  const expenseRows = (expenseData || []) as FinanceEventExpenseRow[]
  const byEvent = new Map<string, { event: FinanceEventRow; budget: number; spent: number; expenseCount: number; budgetCount: number }>()
  selectedEvents.forEach((row) => byEvent.set(row.id, { event: row, budget: 0, spent: 0, expenseCount: 0, budgetCount: 0 }))

  budgetRows.forEach((row) => {
    const current = byEvent.get(row.event_id)
    if (!current) return
    current.budget += numeric(row.line_total) || (numeric(row.qty) * numeric(row.unit_price))
    current.budgetCount += 1
  })
  expenseRows.forEach((row) => {
    const current = byEvent.get(row.event_id)
    if (!current) return
    current.spent += numeric(row.total) || (numeric(row.qty) * numeric(row.unit_price))
    current.expenseCount += 1
  })

  if (asksBreakdown && event) {
    const eventExpenses = expenseRows
      .filter((row) => row.event_id === event.id)
      .sort((a, b) => numeric(b.total) - numeric(a.total) || String(a.item_name || '').localeCompare(String(b.item_name || ''), 'ar'))
    const eventBudgets = budgetRows
      .filter((row) => row.event_id === event.id)
      .sort((a, b) => numeric(b.line_total) - numeric(a.line_total) || String(a.item_name || '').localeCompare(String(b.item_name || ''), 'ar'))

    const rows = eventExpenses.length
      ? eventExpenses.map((row) => ({
          label: row.item_name || 'بند مصروف غير محدد',
          value: money(numeric(row.total) || (numeric(row.qty) * numeric(row.unit_price))),
          badge: row.expense_date || 'مصروف فعلي',
          note: `الكمية: ${numeric(row.qty)} — سعر الوحدة: ${money(numeric(row.unit_price))}`,
        }))
      : eventBudgets.map((row) => ({
          label: row.item_name || 'بند ميزانية غير محدد',
          value: money(numeric(row.line_total) || (numeric(row.qty) * numeric(row.unit_price))),
          badge: 'ميزانية مخططة',
          note: `الكمية: ${numeric(row.qty)} — سعر الوحدة: ${money(numeric(row.unit_price))}`,
        }))

    const summary = byEvent.get(event.id)
    return {
      status: rows.length ? 'answered' : 'empty',
      title: `تقسيم فلوس ${event.name}`,
      message: rows.length ? 'التقسيم يعرض المصروفات الفعلية لو موجودة، ولو مفيش مصروفات يعرض بنود الميزانية المخططة.' : 'لا توجد بنود ميزانية أو مصروفات مسجلة لهذا الـEvent.',
      source: `finance_events + finance_event_budgets + finance_event_expenses — ${event.name}`,
      interpretation: `تم فهم السؤال كتفصيل مالي لـEvent: ${event.name}`,
      confidence: 'high',
      references: [
        { label: 'الـEvent', value: event.name, detail: event.event_date || 'بدون تاريخ' },
        { label: 'إجمالي الميزانية المخططة', value: money(summary?.budget || 0) },
        { label: 'إجمالي المصروف الفعلي', value: money(summary?.spent || 0) },
        { label: 'بنود الميزانية', value: eventBudgets.length },
        { label: 'بنود المصروف', value: eventExpenses.length },
      ],
      items: rows.slice(0, 30),
    }
  }

  const rows = Array.from(byEvent.values())
    .sort((a, b) => String(b.event.event_date || '').localeCompare(String(a.event.event_date || '')) || b.spent - a.spent)

  return {
    status: rows.length ? 'answered' : 'empty',
    title: event ? `تكلفة ${event.name}` : 'ملخص تكلفة الـEvents المالية',
    message: rows.length ? 'الأرقام من ميزانية المجموعة: الميزانية المخططة، المصروف الفعلي، والفرق بينهم.' : 'لا توجد Events مالية مطابقة للسؤال.',
    source: 'finance_events + finance_event_budgets + finance_event_expenses',
    interpretation: event ? `تم فهم السؤال كسؤال تكلفة Event: ${event.name}` : `تم فهم السؤال كملخص Events مالية${targetYear ? ` لسنة ${targetYear}` : ''}.`,
    confidence: event ? 'high' : 'medium',
    references: [
      { label: 'Events مالية مقروءة', value: filteredEvents.length },
      { label: 'Events داخل النتيجة', value: rows.length },
      { label: 'فلتر السنة', value: targetYear || 'بدون فلتر سنة' },
      { label: 'بنود ميزانية مقروءة', value: budgetRows.length },
      { label: 'بنود مصروفات مقروءة', value: expenseRows.length },
    ],
    items: rows.slice(0, parseTopN(params.question) || 20).map((row) => ({
      label: row.event.name,
      value: `مصروف فعلي: ${money(row.spent)}`,
      badge: `ميزانية: ${money(row.budget)}`,
      note: `${row.event.event_date || 'بدون تاريخ'} — فرق/متبقي: ${money(row.budget - row.spent)} — بنود مصروف: ${row.expenseCount}`,
    })),
  }
}

async function answerTeamFinance(params: KnowledgeQuestionContext): Promise<KnowledgeAnswer> {
  const teams = await fetchTeams()
  const requestedTeam = await resolveTeamFromQuestion(params.question, teams)
  const scope = buildFinanceScope(params, requestedTeam)
  if (!scope.allowed) {
    return {
      status: 'blocked',
      title: 'السؤال خاص بالميزانية',
      message: `السؤال يطلب بيانات مالية خارج نطاقك الحالي: ${scope.label}.`,
      guardrail: 'finance-scope-required',
      confidence: 'high',
      references: [{ label: 'النطاق المالي', value: scope.label }],
    }
  }

  const { data: allTermData, error: termError } = await scoutYearFrom('v_terms_with_scout_year', 'v_terms_context')
    .select('id,name,year,start_date,end_date,scout_year_id,is_current') as any
  if (termError) throw termError

  const scopedTerms = filterTermsByQuestionYear(params.question, (allTermData || []) as TermRow[], params.scoutYearId)
  const requestedTerm = resolveTermFromQuestion(params.question, scopedTerms)
  const terms = requestedTerm ? [requestedTerm] : scopedTerms
  const year = params.scoutYearId ? await fetchScoutYearById(params.scoutYearId) : null
  const yearBounds = getScoutYearBounds(year)
  const scopedFinanceTerms = yearBounds ? terms.filter(term => getTermYearBounds(year, term)) : []
  const termIds = scopedFinanceTerms.map((term) => term.id)
  if (!termIds.length) {
    return { status: 'empty', title: 'لا توجد ترمات مالية', message: 'لا توجد ترمات مطابقة للسؤال.', source: 'v_terms_with_scout_year', confidence: 'high' }
  }

  let budgetQuery = supabase.from('v_team_budgets_effective').select('team_id,term_id,amount_total').in('term_id', termIds).is('soft_deleted_at', null) as any
  let expenseQuery = supabase.from('expenses').select('team_id,term_id,total,item_name,expense_date').in('term_id', termIds).gte('expense_date', yearBounds!.start).lte('expense_date', yearBounds!.end).is('soft_deleted_at', null) as any
  if (scope.teamIds.length) {
    budgetQuery = budgetQuery.in('team_id', scope.teamIds)
    expenseQuery = expenseQuery.in('team_id', scope.teamIds)
  }

  const [{ data: budgetData, error: budgetError }, { data: expenseData, error: expenseError }] = await Promise.all([budgetQuery, expenseQuery])
  if (budgetError) throw budgetError
  if (expenseError) throw expenseError

  const budgets = (budgetData || []) as BudgetRow[]
  const expenses = ((expenseData || []) as ExpenseRow[]).filter(expense => inDateBounds(expense.expense_date, getTermYearBounds(year, scopedFinanceTerms.find(t => t.id === expense.term_id))))
  const teamMap = new Map(teams.map((team) => [team.id, team]))
  const termMap = new Map(terms.map((term) => [term.id, term]))
  const asksBreakdown = hasAny(normalizeArabic(params.question), financeBreakdownTerms)

  if (asksBreakdown) {
    const byItem = new Map<string, { label: string; total: number; count: number; teams: Set<string>; terms: Set<string> }>()
    expenses.forEach((row) => {
      const team = teamMap.get(row.team_id)?.name || 'فريق غير محدد'
      const term = termMap.get(row.term_id)?.name || 'ترم غير محدد'
      const key = `${row.item_name || 'بند غير محدد'}__${scope.teamIds.length || requestedTeam ? team : 'all'}__${requestedTerm ? term : 'all'}`
      const current = byItem.get(key) || { label: row.item_name || 'بند غير محدد', total: 0, count: 0, teams: new Set<string>(), terms: new Set<string>() }
      current.total += numeric(row.total)
      current.count += 1
      current.teams.add(team)
      current.terms.add(term)
      byItem.set(key, current)
    })

    const rows = Array.from(byItem.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'ar')).slice(0, parseTopN(params.question) || 30)
    const totalSpent = rows.reduce((sum, row) => sum + row.total, 0)
    const totalBudget = budgets.reduce((sum, row) => sum + numeric(row.amount_total), 0)

    return {
      status: rows.length ? 'answered' : 'empty',
      title: requestedTerm || requestedTeam ? 'تقسيم مصروفات الميزانية المطلوبة' : 'أكبر بنود المصروفات داخل نطاقك',
      message: rows.length ? 'التقسيم مبني على بنود المصروفات المسجلة فقط، وليس على تخمين أو نص حر.' : 'لا توجد بنود مصروفات مسجلة لهذا النطاق/الترم.',
      source: `expenses + team_budgets — ${scope.label}`,
      interpretation: `تم فهم السؤال كتقسيم ميزانية${requestedTeam ? ` لفريق ${requestedTeam.name}` : ''}${requestedTerm ? ` — ${requestedTerm.name}` : ''}.`,
      confidence: requestedTeam || requestedTerm ? 'high' : 'medium',
      references: [
        { label: 'النطاق المالي', value: scope.label },
        { label: 'الترمات داخل السؤال', value: requestedTerm?.name || terms.length },
        { label: 'سجلات الميزانية', value: budgets.length, detail: `الإجمالي: ${money(totalBudget)}` },
        { label: 'سجلات المصروفات', value: expenses.length, detail: `المعروض: ${money(totalSpent)}` },
      ],
      items: rows.map((row) => ({
        label: row.label,
        value: money(row.total),
        badge: `${row.count} بند`,
        note: `فرق: ${Array.from(row.teams).slice(0, 3).join('، ')} — ترم: ${Array.from(row.terms).slice(0, 3).join('، ')}`,
      })),
    }
  }

  const byTeamTerm = new Map<string, { teamId: string; termId: string; budget: number; spent: number; items: number }>()
  budgets.forEach((row) => {
    const key = `${row.team_id}__${row.term_id}`
    const current = byTeamTerm.get(key) || { teamId: row.team_id, termId: row.term_id, budget: 0, spent: 0, items: 0 }
    current.budget += numeric(row.amount_total)
    byTeamTerm.set(key, current)
  })
  expenses.forEach((row) => {
    const key = `${row.team_id}__${row.term_id}`
    const current = byTeamTerm.get(key) || { teamId: row.team_id, termId: row.term_id, budget: 0, spent: 0, items: 0 }
    current.spent += numeric(row.total)
    current.items += 1
    byTeamTerm.set(key, current)
  })

  const rows = Array.from(byTeamTerm.values())
    .map((data) => ({ team: teamMap.get(data.teamId), term: termMap.get(data.termId), ...data, remaining: data.budget - data.spent }))
    .sort((a, b) => String(a.term?.name || '').localeCompare(String(b.term?.name || ''), 'ar') || String(a.team?.name || '').localeCompare(String(b.team?.name || ''), 'ar'))

  return {
    status: rows.length ? 'answered' : 'empty',
    title: requestedTeam || requestedTerm ? 'ميزانية النطاق المطلوب' : 'ملخص الميزانية داخل نطاق صلاحيتك',
    message: rows.length ? 'دي أرقام إجمالية من الميزانية والمصروفات داخل نطاقك المالي فقط.' : 'لا توجد ميزانيات أو مصروفات مسجلة داخل نطاقك المالي.',
    source: `team_budgets + expenses — ${params.scoutYearName || 'السنة الحالية'} — ${scope.label}`,
    interpretation: `تم فهم السؤال كسؤال مالي${requestedTeam ? ` لفريق ${requestedTeam.name}` : ''}${requestedTerm ? ` — ${requestedTerm.name}` : ''}.`,
    confidence: requestedTeam || requestedTerm ? 'high' : 'medium',
    references: [
      { label: 'النطاق المالي', value: scope.label },
      { label: 'الترمات المقروءة', value: terms.length, detail: requestedTerm?.name || 'حسب السؤال/السنة الحالية' },
      { label: 'سجلات الميزانية', value: budgets.length },
      { label: 'سجلات المصروفات', value: expenses.length },
    ],
    items: rows.slice(0, parseTopN(params.question) || 20).map((row) => ({
      label: `${row.team?.name || 'فريق غير محدد'} — ${row.term?.name || 'ترم غير محدد'}`,
      value: `ميزانية: ${money(row.budget)}`,
      badge: `مصروف: ${money(row.spent)}`,
      note: `متبقي/فرق: ${money(row.remaining)} — عدد بنود المصروف: ${row.items}`,
    })),
  }
}

async function answerHelp(params: KnowledgeQuestionContext): Promise<KnowledgeAnswer> {
  const financeAllowed = isFinanceAllowed(params.roles)
  return {
    status: 'answered',
    title: 'بنك المعرفة يقدر يجاوب عن إيه؟',
    message: 'بنك المعرفة بيشتغل كـ Safe Data Assistant: يفهم السؤال، يطابقه على نوع سؤال مسجل، يقرأ من الجداول المسموحة، ويرجع الإجابة مع المراجع. لو السؤال حساس أو مش مدعوم، بيرفض بدل التخمين.',
    source: 'Question Registry + Permission Guard + Supabase data',
    interpretation: 'تم فهم السؤال كطلب مساعدة/أمثلة للأسئلة المدعومة.',
    confidence: 'high',
    references: [
      { label: 'السنة الحالية', value: params.scoutYearName || 'غير محددة' },
      { label: 'ميزانيات', value: financeAllowed ? 'مسموحة حسب نطاقك' : 'مقفولة لصلاحيتك' },
      { label: 'حماية التقييم', value: 'حالة فقط', detail: 'لا درجات ولا نقاط ولا Voice Notes' },
      { label: 'الوعد/الميار/المميز', value: 'مرفوضة بالكامل من بنك المعرفة' },
    ],
    items: [
      { label: 'الحضور والغياب', value: 'Top / آخر اجتماع / نسب', badge: 'آمن', note: 'مثال: مين أكتر 5 غياب؟ أو مين غاب آخر اجتماع في أشبال؟' },
      { label: 'الأعضاء والشيفات', value: 'قوائم وأعداد', badge: 'حسب الفريق', note: 'مثال: كام شيف في فريق أشبال؟' },
      { label: 'الأدوات والعهدة', value: 'مكان / كمية / استخدام', badge: 'Inventory', note: 'مثال: مكان الشوم فين؟ أو إيه أكتر أدوات مستخدمة؟' },
      { label: 'مسؤوليات السنة', value: 'Events وتكليفات', badge: 'Events', note: 'مثال: مين ما نزلش أي event؟ أو فلان نزل كام event؟' },
      { label: 'الميزانيات', value: financeAllowed ? 'متاحة لك' : 'تحتاج صلاحية', badge: 'Finance Guard', note: 'مثال: ميزانية الترم الأول لفريق أشبال كانت كام؟' },
      { label: 'حالة التقييم فقط', value: 'تم / لم يتم', badge: 'مقيد', note: 'لا يعرض تفاصيل تقييم شخصية.' },
    ],
  }
}

async function answerFinance(params: KnowledgeQuestionContext): Promise<KnowledgeAnswer> {
  if (shouldAskFinanceEvent(params.question)) return answerFinanceEvent(params)
  return answerTeamFinance(params)
}

export async function answerKnowledgeQuestion(params: KnowledgeQuestionContext): Promise<KnowledgeAnswer> {
  const question = params.question.trim()
  if (!question) {
    return { status: 'unsupported', title: 'اكتب سؤال الأول', message: 'اكتب سؤال عن الحضور، الأدوات، مسؤوليات السنة، حالة التقييم، ميزانية الفرق، أو تكلفة Events المجموعة حسب صلاحيتك.' }
  }

  const blocked = guardQuestion({ ...params, question })
  if (blocked) return blocked

  const intent = classifyQuestion(question)
  const ctx = { ...params, question }
  if (intent === 'help') return enrichAnswer(await answerHelp(ctx), ctx, intent)
  if (intent === 'attendance') return enrichAnswer(await answerAttendance(ctx), ctx, intent)
  if (intent === 'material_location') return enrichAnswer(await answerMaterialLocation(ctx), ctx, intent)
  if (intent === 'responsibilities') return enrichAnswer(await answerResponsibilities(ctx), ctx, intent)
  if (intent === 'evaluation_status') return enrichAnswer(await answerEvaluationStatus(ctx), ctx, intent)
  if (intent === 'members') return enrichAnswer(await answerMembers(ctx), ctx, intent)
  if (intent === 'finance') return enrichAnswer(await answerFinance(ctx), ctx, intent)

  return enrichAnswer({
    status: 'unsupported',
    title: 'السؤال غير مدعوم حاليًا',
    message: 'بنك المعرفة يرد فقط على أنواع أسئلة مسجلة وآمنة. جرّب سؤال عن الحضور، مكان أداة، استخدام الأدوات، مسؤوليات السنة، حالة التقييم، ميزانية الفرق، أو تكلفة Events المجموعة حسب صلاحيتك.',
    guardrail: 'registered-questions-only',
    confidence: 'high',
    references: [
      { label: 'محرك الأسئلة', value: 'لا يوجد Intent مطابق', detail: 'لا يتم التخمين أو توليد إجابة من غير مصدر' },
      { label: 'اقتراح', value: 'اسأل: أقدر أسأل بنك المعرفة عن إيه؟' },
    ],
  }, ctx, intent)
}
