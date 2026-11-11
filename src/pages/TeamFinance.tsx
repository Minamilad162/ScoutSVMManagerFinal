import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toaster'
import { LoadingButton } from '../components/ui/LoadingButton'
import { PageLoader } from '../components/ui/PageLoader'
import { useRoleGate } from '../hooks/useRoleGate'
import { useAuth } from '../components/AuthProvider'
import { useScoutYear } from '../components/ScoutYearProvider'
import { fetchCurrentUserContext, fetchTeamById, fetchTeams, fetchTerms } from '../features/reference/api'
import { getErrorMessage, logError } from '../lib/errors'
import type { Borders, Fill, Worksheet } from 'exceljs'
import scoutCompassScarf from '../assets/scout-theme/scout-compass-scarf.webp'
import { clampDateToBounds, getScoutYearBounds, getTermYearBounds, inDateBounds } from '../lib/scoutYearScope'

type Team = { id: string; name: string }
type Term = { id: string; name: string; year: number; start_date?: string | null; end_date?: string | null }
type Expense = { id: string; expense_date: string; item_name: string; qty: number; unit_price: number; total: number; is_delivered: boolean }
type TermDateRow = { id: string; meeting_date: string }

export default function TeamFinance() {
  const toast = useToast()
  const gate = useRoleGate()
  const { roles } = useAuth()
  const { currentScoutYear } = useScoutYear()

  const isAdmin = roles.some(r => r.role_slug === 'admin')
  const isGlobalFinance = roles.some(r => r.role_slug === 'responsable_finance' && (r.team_id === null || r.team_id === undefined))

  const [teams, setTeams] = useState<Team[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [teamId, setTeamId] = useState<string>('')
  const [termId, setTermId] = useState<string>('')

  // تواريخ الترم
  const [termDates, setTermDates] = useState<TermDateRow[]>([])
  const hasTermDates = termDates.length > 0

  const [budget, setBudget] = useState<number | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [savingExp, setSavingExp] = useState(false)

  // Expense form
  const [exDate, setExDate] = useState<string>('')                 // التاريخ المحفوظ
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false)
  const [exName, setExName] = useState<string>('')
  const [exQty, setExQty] = useState<number | ''>('')
  const [exUnit, setExUnit] = useState<number | ''>('')
  const [exDelivered, setExDelivered] = useState<boolean>(false)    // ⬅️ جديد: حالة التسليم وقت الإدخال

  // Export state
  const [exporting, setExporting] = useState(false)
  type ExportMode = 'all' | 'term' | 'year'
  const [exportMode, setExportMode] = useState<ExportMode>('term')
  const years = useMemo(() => Array.from(new Set(terms.map(t => t.year))).sort((a,b)=>a-b), [terms])
  const [exportYear, setExportYear] = useState<number | ''>('')
  const [exportTeamScope, setExportTeamScope] = useState<'all'|'one'>('all')
  const [exportTeamId, setExportTeamId] = useState<string>('')

  const egp = (v: number) => new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(v)

  /* ==================== Sanitizers ==================== */
  const stripMarks = (s: any) =>
    (s == null ? '' : String(s))
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
      .replace(/Â|â€‹|â€/g, '')

  const looksMojibake = (s: string) =>
    /[ÃÂÙƒƒœ„’”“–—]/.test(s) || /(?:Ø|Ù){2,}/.test(s)

  const WIN1252_UNI_TO_BYTE: Record<number, number> = {
    0x20AC:0x80, 0x201A:0x82, 0x0192:0x83, 0x201E:0x84, 0x2026:0x85, 0x2020:0x86, 0x2021:0x87,
    0x02C6:0x88, 0x2030:0x89, 0x0160:0x8A, 0x2039:0x8B, 0x0152:0x8C, 0x017D:0x8E, 0x2018:0x91,
    0x2019:0x92, 0x201C:0x93, 0x201D:0x94, 0x2022:0x95, 0x2013:0x96, 0x2014:0x97, 0x02DC:0x98,
    0x2122:0x99, 0x0161:0x9A, 0x203A:0x9B, 0x0153:0x9C, 0x017E:0x9E, 0x0178:0x9F
  }
  const win1252MojibakeToUtf8 = (input: string) => {
    const cleaned = stripMarks(input)
    if (!looksMojibake(cleaned)) return cleaned
    const bytes = new Uint8Array([...cleaned].map(ch => {
      const code = ch.charCodeAt(0)
      if (code <= 0xFF) return code
      return WIN1252_UNI_TO_BYTE[code] ?? 0x3F
    }))
    try { return new TextDecoder('utf-8').decode(bytes) } catch { return cleaned }
  }
  const sanitizeForUI = (v: any) => {
    const s = stripMarks(v)
    return win1252MojibakeToUtf8(s)
  }
  /* ==================================================== */

  // ===== Helpers: term range + dates =====
  const termMeta = useMemo(() => terms.find(t => t.id === termId) || null, [terms, termId])
  const yearBounds = getScoutYearBounds(currentScoutYear)
  const termBounds = termMeta ? getTermYearBounds(currentScoutYear, termMeta) : null
  const termMin = termBounds?.start || ''
  const termMax = termBounds?.end || ''
  const clampToTerm = (d: string) => {
    if (!d) return d
    if (!termMin && !termMax) return d
    const asDate = new Date(d)
    if (termMin && asDate < new Date(termMin)) return termMin
    if (termMax && asDate > new Date(termMax)) return termMax
    return d
  }
  const fmtDate = (dt: Date) => {
    const pad = (n:number)=>String(n).padStart(2,'0')
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`
  }

  useEffect(() => {
    setTermId(''); setTerms([]); setBudget(null); setExpenses([]); setTermDates([])
    if (currentScoutYear?.id) void init()
  }, [currentScoutYear?.id])
  async function init() {
    setLoading(true)
    try {
      const tm = await fetchTerms()
      setTerms(tm)
      setTermId(tm[0]?.id || '')
      setExportYear(tm[0]?.year ?? '')

      let myTeamId: string | null = null
      const meRow = await fetchCurrentUserContext()
      if (meRow?.team_id) myTeamId = meRow.team_id

      if (isAdmin || isGlobalFinance) {
        const ts = await fetchTeams()
        setTeams(ts)
        if (myTeamId && ts.some(t => t.id === myTeamId)) setTeamId(myTeamId)
        else if (ts.length) setTeamId(ts[0].id)
        setExportTeamId(myTeamId || (ts[0]?.id ?? ''))
      } else {
        if (!myTeamId) throw new Error('لا يوجد فريق مرتبط بحسابك')
        setTeamId(myTeamId)
        const team = await fetchTeamById(myTeamId)
        setTeams(team ? [team] : [])
        setExportTeamId(myTeamId)
      }

      const today = new Date()
      setExDate(fmtDate(today))
    } catch (e:any) {
      logError('TeamFinance.init', e)
      toast.error(getErrorMessage(e, 'تعذر تحميل البيانات'))
    } finally {
      setLoading(false)
    }
  }

  // حمّل تواريخ الترم المختار + اضبط exDate
  useEffect(() => { if (termId && termBounds) void loadTermDates(termId); else setTermDates([]) }, [termId, termMin, termMax])
  async function loadTermDates(tid: string) {
    try {
      const { data, error } = await supabase
        .from('term_meeting_dates')
        .select('id, meeting_date')
        .eq('term_id', tid)
        .gte('meeting_date', termMin).lte('meeting_date', termMax)
        .order('meeting_date', { ascending: true })
      if (error) throw error
      const list = (data as any as TermDateRow[]) ?? []
      setTermDates(list)

      if (list.length > 0) {
        setUseCustomDate(false)
        setExDate(list[0].meeting_date)
      } else {
        setUseCustomDate(true)
        setExDate(prev => clampDateToBounds(prev, termBounds))
      }
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل تواريخ الترم')
    }
  }

  useEffect(() => {
    setBudget(null); setExpenses([])
    if (teamId && termId && termBounds) void refreshData()
  }, [teamId, termId, currentScoutYear?.id, termMin, termMax])
  async function refreshData() {
    setLoading(true)
    try {
      if (!termBounds) { setBudget(null); setExpenses([]); return }
      const [{ data: bRow, error: bErr }, { data: expRows, error: eErr }] = await Promise.all([
        supabase.from('v_team_budgets_effective').select('amount_total').eq('team_id', teamId).eq('term_id', termId).is('soft_deleted_at', null).maybeSingle(),
        supabase.from('expenses').select('id, expense_date, item_name, qty, unit_price, total, is_delivered').eq('team_id', teamId).eq('term_id', termId).gte('expense_date', termMin).lte('expense_date', termMax).is('soft_deleted_at', null).order('expense_date', { ascending: false })
      ])
      if (bErr) throw bErr
      if (eErr) throw eErr
      setBudget(bRow?.amount_total ?? null)

      const fixed = (expRows as any[] ?? []).map(row => ({
        ...row,
        expense_date: sanitizeForUI(row.expense_date),
        item_name: sanitizeForUI(row.item_name),
        is_delivered: !!row.is_delivered
      }))
      setExpenses(fixed as Expense[])
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل الميزانية/المصروفات')
    } finally {
      setLoading(false)
    }
  }

  const spent = useMemo(() => expenses.reduce((s, x) => s + (Number(x.total) || 0), 0), [expenses])
  const remaining = useMemo(() => (budget ?? 0) - spent, [budget, spent])
  const status: 'ok' | 'low' | 'depleted' = useMemo(() => {
    if (!budget || budget <= 0) return spent > 0 ? 'depleted' : 'ok'
    if (remaining <= 0) return 'depleted'
    if (remaining <= 0.25 * budget) return 'low'
    return 'ok'
  }, [budget, remaining, spent])

  // تاريخ المصروف: Select من تواريخ الترم أو input داخل نطاق الترم
  function onSelectDateChange(v: string) {
    if (v === '__custom__') {
      setUseCustomDate(true)
      setExDate(prev => clampToTerm(prev) || prev)
    } else {
      setUseCustomDate(false)
      setExDate(v)
    }
  }

  async function addExpense() {
    if (!teamId || !termId || !termBounds) return toast.error('اختر ترمًا داخل السنة الكشفية الحالية')
    if (!gate.canWriteExpense(teamId)) { toast.error('ليست لديك صلاحية إضافة مصروف'); return }
    const q = Number(exQty); const u = Number(exUnit)
    if (!isFinite(q) || q <= 0) return toast.error('العدد غير صالح')
    if (!isFinite(u) || u < 0) return toast.error('سعر القطعة غير صالح')
    if (!exName.trim()) return toast.error('ادخل اسم المنتج')
    if (!inDateBounds(exDate, termBounds)) return toast.error('تاريخ المصروف خارج نطاق السنة الكشفية أو الترم')

    const clamped = clampToTerm(exDate)
    if ((termMin || termMax) && clamped !== exDate) {
      return toast.error('التاريخ خارج نطاق الترم المحدد')
    }

    setSavingExp(true)
    try {
      const cleanName = stripMarks(exName.trim())
      const { error } = await supabase.from('expenses').insert({
        team_id: teamId, term_id: termId,
        expense_date: stripMarks(exDate),
        item_name: cleanName,
        qty: q, unit_price: u,
        is_delivered: !!exDelivered // ⬅️ يسجّل حسب اختيار المستخدم
      })
      if (error) throw error
      toast.success('تم إضافة المصروف')
      setExName(''); setExQty(''); setExUnit(''); setExDelivered(false)
      await refreshData()
    } catch (e:any) {
      toast.error(e.message || 'تعذر إضافة المصروف')
    } finally {
      setSavingExp(false)
    }
  }

  /* =============================== Export (كما هو) =============================== */

  async function fetchFinanceData(filters: {
    termIds?: string[]
    year?: number
    teamIds?: string[]
  }) {
    const [teamsRes, termsArr] = await Promise.all([
      supabase.from('teams').select('id,name'),
      fetchTerms()
    ])
    if (teamsRes.error) throw teamsRes.error
    const teamsMap = new Map<string,string>((teamsRes.data ?? []).map(t => [t.id, t.name]))
    const termsArrTyped = (termsArr ?? []) as Term[]
    const termsMap = new Map<string,{name:string, year:number}>(
      termsArrTyped.map(t => [t.id, { name: t.name, year: t.year }])
    )

    // All modes, including 'all', are restricted to the viewed scout year.
    // An empty list must never turn into an unfiltered production query.
    const selectedTerms = termsArrTyped.filter(t =>
      (!filters.termIds || filters.termIds.includes(t.id)) &&
      (!filters.year || t.year === filters.year) &&
      Boolean(getTermYearBounds(currentScoutYear, t))
    )
    const termFilterIds = selectedTerms.map(t => t.id)
    if (!yearBounds || !termFilterIds.length) return { teamsMap, termsMap, termsArr: selectedTerms, budgets: [], exps: [] }

    let bq = supabase.from('v_team_budgets_effective').select('team_id, term_id, amount_total').is('soft_deleted_at', null)
    bq = bq.in('term_id', termFilterIds)
    if (filters.teamIds?.length) bq = bq.in('team_id', filters.teamIds)
    const { data: budgets, error: bErr } = await bq
    if (bErr) throw bErr

    let eq = supabase.from('expenses')
      .select('team_id, term_id, expense_date, item_name, qty, unit_price, total')
      .is('soft_deleted_at', null)
    eq = eq.in('term_id', termFilterIds).gte('expense_date', yearBounds.start).lte('expense_date', yearBounds.end)
    if (filters.teamIds?.length) eq = eq.in('team_id', filters.teamIds)
    const { data: exps, error: eErr } = await eq
    if (eErr) throw eErr

    const allowedTerms = new Set(termFilterIds)
    const validExpenses = (exps ?? []).filter(e => allowedTerms.has(e.term_id) && inDateBounds(e.expense_date, getTermYearBounds(currentScoutYear, selectedTerms.find(t => t.id === e.term_id))))
    return { teamsMap, termsMap, termsArr: selectedTerms, budgets: budgets ?? [], exps: validExpenses }
  }

  function parseDate(d?: string) {
    if (!d) return ''
    const parts = String(d).slice(0,10).split('-').map(Number)
    if (parts.length === 3 && !parts.some(isNaN)) return new Date(parts[0], parts[1]-1, parts[2])
    return d as any
  }
  function sanitizeSheetName(name: string) {
    const cleaned = name.replace(/[:\\/?*\[\]]/g, ' ').trim()
    return cleaned.length > 31 ? cleaned.slice(0, 29) + '…' : cleaned
  }
  function ensureUniqueName(base: string, used: Set<string>) {
    let name = sanitizeSheetName(base)
    if (!used.has(name)) { used.add(name); return name }
    let i = 2
    while (used.has(`${name} (${i})`)) i++
    const finalName = sanitizeSheetName(`${name} (${i})`)
    used.add(finalName)
    return finalName
  }

  async function handleExport() {
    if (!(isAdmin || isGlobalFinance)) return
    setExporting(true)
    try {
      let filters: { termIds?: string[]; year?: number; teamIds?: string[] } = {}
      let filename = 'finance.xlsx'

      if (exportMode === 'all') {
        filename = `finance_all_terms.xlsx`
      } else if (exportMode === 'term') {
        if (!termId) throw new Error('اختر الترم أولاً')
        filters.termIds = [termId]
        filename = `finance_term_${termId}.xlsx`
      } else if (exportMode === 'year') {
        if (!exportYear) throw new Error('اختر السنة')
        filters.year = Number(exportYear)
        if (exportTeamScope === 'one' && exportTeamId) {
          filters.teamIds = [exportTeamId]
          filename = `finance_year_${exportYear}_team_${exportTeamId}.xlsx`
        } else {
          filename = `finance_year_${exportYear}.xlsx`
        }
      }

      const { teamsMap, termsMap, termsArr, budgets, exps } = await fetchFinanceData(filters)
      type Key = string
      const keyOf = (t:string, r:string) => `${t}|${r}`
      const budgetMap = new Map<Key, number>()
      const expensesMap = new Map<Key, Expense[]>()

      budgets.forEach((b:any) => {
        const k = keyOf(b.team_id, b.term_id)
        budgetMap.set(k, Number(b.amount_total) || 0)
      })
      exps.forEach((e:any) => {
        const k = keyOf(e.team_id, e.term_id)
        const arr = expensesMap.get(k) || []
        arr.push({
          id: '',
          expense_date: sanitizeForUI(e.expense_date),
          item_name: sanitizeForUI(e.item_name),
          qty: Number(e.qty) || 0,
          unit_price: Number(e.unit_price) || 0,
          total: Number(e.total) || (Number(e.qty||0) * Number(e.unit_price||0)),
          is_delivered: true
        })
        expensesMap.set(k, arr)
      })

      let termIdsSet = new Set<string>()
      if (filters.termIds?.length) {
        filters.termIds.forEach(id => termIdsSet.add(id))
      } else if (filters.year) {
        termsArr.filter(t => t.year === filters.year).forEach(t => termIdsSet.add(t.id))
      } else {
        budgets.forEach((b:any)=> termIdsSet.add(b.term_id))
        exps.forEach((e:any)=> termIdsSet.add(e.term_id))
      }
      // No fallback to a different year when the requested selection is empty.

      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const usedNames = new Set<string>()

      const headerFill: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF59D' } }
      const thinBorder: Borders = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        diagonal: {},
      }
      const teamFills = ['FFF8F9FA', 'FFF3F4F6']

      function addHeader(ws: Worksheet) {
        ws.views = [{ state: 'frozen', ySplit: 1 }]
        ws.columns = [
          { key: 'team', width: 24 },
          { key: 'budget', width: 14, style: { numFmt: '#,##0.00' } },
          { key: 'spent', width: 14, style: { numFmt: '#,##0.00' } },
          { key: 'remaining', width: 14, style: { numFmt: '#,##0.00' } },
          { key: 'expdate', width: 14, style: { numFmt: 'yyyy-mm-dd' } },
          { key: 'item', width: 28 },
          { key: 'qty', width: 8, style: { numFmt: '#,##0' } },
          { key: 'unit', width: 12, style: { numFmt: '#,##0.00' } },
          { key: 'line', width: 12, style: { numFmt: '#,##0.00' } },
        ]
        const headers = ['Team','Budget(EGP)','Spent(EGP)','Remaining(EGP)','Expense Date','Item','Qty','Unit Price','Total']
        const hr = ws.addRow(headers)
        hr.font = { bold: true }
        hr.alignment = { vertical: 'middle' }
        hr.height = 22
        hr.eachCell(cell => {
          cell.fill = headerFill
          cell.border = thinBorder
        })
      }
      function addDataRow(ws: Worksheet, values: any[], fillArgb?: string, withBorder = true) {
        const r = ws.addRow(values)
        r.eachCell(cell => {
          if (fillArgb) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } }
          if (withBorder) cell.border = thinBorder
        })
        return r
      }

      const termIds = Array.from(termIdsSet)
      termIds.sort((a,b) => {
        const ta = termsMap.get(a), tb = termsMap.get(b)
        if (!ta || !tb) return 0
        if (ta.year !== tb.year) return ta.year - tb.year
        return (ta.name || '').localeCompare(tb.name || '', 'ar')
      })

      for (const rId of termIds) {
        const tMeta = termsMap.get(rId)
        if (!tMeta) continue
        const baseName = `${tMeta.year} — ${tMeta.name}`
        const sheetName = ensureUniqueName(baseName, usedNames)
        const ws = wb.addWorksheet(sheetName)
        addHeader(ws)

        const teamIdsSet = new Set<string>()
        budgets.filter((b:any)=> b.term_id === rId).forEach(b => teamIdsSet.add(b.team_id))
        exps.filter((e:any)=> e.term_id === rId).forEach(e => teamIdsSet.add(e.team_id))
        const teamIds = Array.from(teamIdsSet).sort((a,b)=>{
          const na = (teamsMap.get(a) || a)
          const nb = (teamsMap.get(b) || b)
          return na.localeCompare(nb, 'ar')
        })

        let teamAlt = 0
        for (const tId of teamIds) {
          const teamName = teamsMap.get(tId) || tId
          const k = `${tId}|${rId}`
          const lines = (expensesMap.get(k) || []).sort((a,b)=> (a.expense_date||'').localeCompare(b.expense_date||''))

          const budgetVal = Number(budgetMap.get(k) || 0)
          const spentVal = lines.reduce((s, x) => s + (Number(x.total)||0), 0)
          const remainingVal = budgetVal - spentVal

          const fill = teamFills[teamAlt % teamFills.length]
          teamAlt++

          addDataRow(ws, [
            teamName,
            budgetVal,
            spentVal,
            remainingVal,
            '', '', '', '', ''
          ], fill)

          for (const l of lines) {
            const d = parseDate(l.expense_date)
            const row = addDataRow(ws, [
              '',
              '', '', '',
              d instanceof Date ? d : (l.expense_date || ''),
              l.item_name || '',
              Number(l.qty||0),
              Number(l.unit_price||0),
              Number(l.total|| (Number(l.qty||0)*Number(l.unit_price||0)))
            ], fill)
            const cExpDate = row.getCell(5)
            if (d instanceof Date) cExpDate.numFmt = 'yyyy-mm-dd'
            row.getCell(7).numFmt = '#,##0'
            row.getCell(8).numFmt = '#,##0.00'
            row.getCell(9).numFmt = '#,##0.00'
          }

          ws.addRow(['','','','','','','','',''])
        }

        if (teamIds.length === 0) {
          addDataRow(ws, ['No data','','','','','','','',''])
        }
      }

      const safe = filename.toLowerCase().endsWith('.xlsx') ? filename : filename.replace(/\.csv$/i,'') + '.xlsx'
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = safe
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('تم إنشاء ملف Excel')
    } catch (e:any) {
      console.error(e)
      toast.error(e.message || 'فشل إنشاء ملف Excel')
    } finally {
      setExporting(false)
    }
  }

  /* ===== تعديل/حذف/تبديل التسليم ===== */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ expense_date: string; item_name: string; qty: number | ''; unit_price: number | '' } | null>(null)
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)
  const [togglingId,   setTogglingId]   = useState<string | null>(null)

  const canModify = (teamId && gate.canWriteExpense(teamId)) || isAdmin || isGlobalFinance
  const selectedTeamName = teams.find(team => team.id === teamId)?.name || 'الفريق'
  const selectedTermLabel = termMeta ? `${termMeta.year} — ${termMeta.name}` : 'الترم غير محدد'
  const spentPercent = budget && budget > 0 ? Math.max(0, Math.min(100, (spent / budget) * 100)) : (spent > 0 ? 100 : 0)
  const deliveredExpensesCount = expenses.filter(expense => expense.is_delivered).length
  const pendingExpensesCount = Math.max(0, expenses.length - deliveredExpensesCount)
  const budgetStateLabel = status === 'depleted' ? 'الميزانية مستنفدة' : status === 'low' ? 'المتبقي أقل من 25%' : 'الوضع المالي مستقر'
  const monthlySpend = useMemo(() => {
    const grouped = new Map<string, number>()
    expenses.forEach(expense => {
      const raw = (expense.expense_date || '').slice(0, 7)
      if (!raw) return
      grouped.set(raw, (grouped.get(raw) || 0) + (Number(expense.total) || 0))
    })
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, value]) => ({
        key,
        label: new Intl.DateTimeFormat('ar-EG', { month: 'short' }).format(new Date(`${key}-01T00:00:00`)),
        value,
      }))
  }, [expenses])
  const maxMonthlySpend = Math.max(1, ...monthlySpend.map(item => item.value))

  function startEditRow(x: Expense) {
    setEditingId(x.id)
    setEditDraft({
      expense_date: (x.expense_date || '').slice(0,10),
      item_name: x.item_name || '',
      qty: Number(x.qty) || 0,
      unit_price: Number(x.unit_price) || 0
    })
  }
  function cancelEditRow() {
    setEditingId(null)
    setEditDraft(null)
  }

  async function saveEditRow(id: string) {
    if (!editDraft) return
    const q = Number(editDraft.qty)
    const u = Number(editDraft.unit_price)
    const d = (editDraft.expense_date || '').trim()
    if (!isFinite(q) || q <= 0) return toast.error('العدد غير صالح')
    if (!isFinite(u) || u < 0) return toast.error('سعر القطعة غير صالح')
    if (!d) return toast.error('اختر التاريخ')
    if (!editDraft.item_name.trim()) return toast.error('ادخل اسم المنتج')

    const clamped = clampToTerm(d)
    if (!inDateBounds(d, termBounds) || clamped !== d) {
      return toast.error('التاريخ خارج نطاق الترم المحدد')
    }

    setSavingEditId(id)
    try {
      const payload = {
        expense_date: stripMarks(d),
        item_name: stripMarks(editDraft.item_name.trim()),
        qty: q,
        unit_price: u,
        total: q * u
      }
      const { error } = await supabase.from('expenses').update(payload).eq('id', id)
      if (error) throw error
      toast.success('تم حفظ التعديل')
      cancelEditRow()
      await refreshData()
    } catch (e:any) {
      toast.error(e.message || 'تعذر حفظ التعديل')
    } finally {
      setSavingEditId(null)
    }
  }

  async function deleteRow(id: string) {
    if (!canModify) return
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return
    setDeletingId(id)
    try {
      const { error } = await supabase.from('expenses')
        .update({ soft_deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      toast.success('تم حذف المصروف')
      await refreshData()
    } catch (e:any) {
      toast.error(e.message || 'تعذر حذف المصروف')
    } finally {
      setDeletingId(null)
    }
  }

  async function toggleDelivered(id: string, to: boolean) {
    if (!canModify) return
    setTogglingId(id)
    try {
      const { error } = await supabase.from('expenses').update({ is_delivered: to }).eq('id', id)
      if (error) throw error
      await refreshData()
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحديث حالة التسليم')
    } finally {
      setTogglingId(null)
    }
  }
  /* ============================================================================ */

  return (
    <div className="teamfinance129-page space-y-5 p-3 sm:p-4 md:p-6" dir="rtl">
      <PageLoader visible={loading} text="جاري تحميل البيانات..." />

      <section
        className="teamfinance129-hero"
        style={{ backgroundImage: `linear-gradient(90deg, rgba(7,35,72,.98) 0%, rgba(9,49,92,.95) 45%, rgba(9,49,92,.42) 72%, rgba(9,49,92,.14) 100%), url(${scoutCompassScarf})` }}
      >
        <div className="teamfinance129-hero-copy">
          <div className="teamfinance129-hero-icon" aria-hidden="true">◉</div>
          <div>
            <div className="teamfinance129-eyebrow">💰 مالية الفريق</div>
            <h1>إدارة مالية الفريق</h1>
            <p>متابعة ميزانية الترم ومصروفات الفريق وحالة التسليم من نفس البيانات الحالية.</p>
          </div>
        </div>
        <div className="teamfinance129-hero-meta">
          <span>{currentScoutYear?.name || 'السنة غير محددة'}</span>
          <strong>{selectedTeamName}</strong>
        </div>
      </section>

      <section className="teamfinance129-kpis" aria-label="ملخص مالي">
        <article className="teamfinance129-kpi teamfinance129-kpi-blue">
          <div className="teamfinance129-kpi-icon">▦</div>
          <div><span>عدد العمليات</span><strong>{expenses.length}</strong><small>{deliveredExpensesCount} مُسلّم · {pendingExpensesCount} غير مُسلّم</small></div>
        </article>
        <article className="teamfinance129-kpi teamfinance129-kpi-green">
          <div className="teamfinance129-kpi-icon">⌁</div>
          <div><span>ميزانية الترم</span><strong>{budget !== null ? egp(budget) : '—'}</strong><small>{selectedTermLabel}</small></div>
        </article>
        <article className="teamfinance129-kpi teamfinance129-kpi-red">
          <div className="teamfinance129-kpi-icon">↗</div>
          <div><span>إجمالي المصروفات</span><strong>{egp(spent)}</strong><small>{Math.round(spentPercent)}% من الميزانية</small></div>
        </article>
        <article className={`teamfinance129-kpi ${status === 'depleted' ? 'teamfinance129-kpi-red' : status === 'low' ? 'teamfinance129-kpi-amber' : 'teamfinance129-kpi-purple'}`}>
          <div className="teamfinance129-kpi-icon">▣</div>
          <div><span>الرصيد المتبقي</span><strong>{egp(remaining)}</strong><small>{budgetStateLabel}</small></div>
        </article>
      </section>

      <section className="teamfinance129-toolbar">
        <div className={`teamfinance129-field ${(isAdmin || isGlobalFinance) ? '' : 'is-disabled'}`}>
          <label>الفريق</label>
          <select value={teamId} onChange={e=>setTeamId(e.target.value)} disabled={!(isAdmin || isGlobalFinance)}>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="teamfinance129-field">
          <label>الترم</label>
          <select value={termId} onChange={e=>setTermId(e.target.value)}>
            {terms.map(t => <option key={t.id} value={t.id}>{t.year} — {t.name}</option>)}
          </select>
        </div>
        <div className="teamfinance129-term-range">
          <span>الفترة الحالية</span>
          <strong>{termMeta?.start_date && termMeta?.end_date ? `${termMeta.start_date} ← ${termMeta.end_date}` : selectedTermLabel}</strong>
        </div>
        {gate.canWriteExpense(teamId) && (
          <button type="button" className="teamfinance129-primary" onClick={()=>document.getElementById('teamfinance-add-expense')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            + إضافة مصروف
          </button>
        )}
      </section>

      <section className="teamfinance129-insights">
        <article className="teamfinance129-card teamfinance129-budget-summary">
          <div className="teamfinance129-card-head"><h2>ملخص الفترة</h2><span>◫</span></div>
          <div className="teamfinance129-summary-row"><span>ميزانية الترم</span><strong>{budget !== null ? egp(budget) : '—'}</strong></div>
          <div className="teamfinance129-summary-row is-red"><span>المصروف</span><strong>{egp(spent)}</strong></div>
          <div className="teamfinance129-summary-row is-green"><span>المتبقي</span><strong>{egp(remaining)}</strong></div>
          <div className="teamfinance129-progress-wrap">
            <div className="teamfinance129-progress-label"><span>نسبة الاستهلاك</span><strong>{Math.round(spentPercent)}%</strong></div>
            <div className="teamfinance129-progress"><i style={{ width: `${spentPercent}%` }} /></div>
            <small className={status === 'depleted' ? 'is-danger' : status === 'low' ? 'is-warning' : ''}>{budgetStateLabel}</small>
          </div>
        </article>

        <article className="teamfinance129-card teamfinance129-monthly">
          <div className="teamfinance129-card-head"><h2>حركة المصروفات</h2><span>▥</span></div>
          {monthlySpend.length ? (
            <div className="teamfinance129-bars" aria-label="المصروفات الشهرية">
              {monthlySpend.map(item => (
                <div className="teamfinance129-bar-item" key={item.key} title={`${item.label}: ${egp(item.value)}`}>
                  <div className="teamfinance129-bar-value">{Math.round(item.value).toLocaleString('en-EG')}</div>
                  <div className="teamfinance129-bar-track"><i style={{ height: `${Math.max(8, (item.value / maxMonthlySpend) * 100)}%` }} /></div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ) : <div className="teamfinance129-empty">لا توجد مصروفات لعرض الحركة المالية.</div>}
        </article>

        <article className="teamfinance129-card teamfinance129-delivery">
          <div className="teamfinance129-card-head"><h2>حالة التسليم</h2><span>✓</span></div>
          <div className="teamfinance129-donut" style={{ background: `conic-gradient(#16a34a 0 ${expenses.length ? (deliveredExpensesCount / expenses.length) * 100 : 0}%, #e5e7eb 0 100%)` }}>
            <div><strong>{expenses.length ? Math.round((deliveredExpensesCount / expenses.length) * 100) : 0}%</strong><span>مُسلّم</span></div>
          </div>
          <div className="teamfinance129-delivery-grid">
            <div><strong>{deliveredExpensesCount}</strong><span>مُسلّم</span></div>
            <div><strong>{pendingExpensesCount}</strong><span>غير مُسلّم</span></div>
          </div>
        </article>
      </section>

      <section className="teamfinance129-card teamfinance129-expenses-card">
        <div className="teamfinance129-list-head">
          <div>
            <span className="teamfinance129-eyebrow-dark">📋 المصروفات المسجلة</span>
            <h2>قائمة العمليات المالية</h2>
            <p>نفس مصروفات الفريق الحالية مع حالة التسليم والإجراءات الموجودة.</p>
          </div>
          {(isAdmin || isGlobalFinance) && (
            <div className="teamfinance129-export-inline">
              <select value={exportMode} onChange={e=>setExportMode(e.target.value as ExportMode)} aria-label="نوع التصدير">
                <option value="term">الترم الحالي</option>
                <option value="year">سنة معيّنة</option>
                <option value="all">كل الترمات</option>
              </select>
              {exportMode === 'year' && (
                <select value={exportYear} onChange={e=>setExportYear(Number(e.target.value))} aria-label="سنة التصدير">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
              {exportMode === 'year' && (
                <select value={exportTeamScope} onChange={e=>setExportTeamScope(e.target.value as any)} aria-label="نطاق الفرق">
                  <option value="all">كل الفرق</option><option value="one">فريق واحد</option>
                </select>
              )}
              {exportMode === 'year' && exportTeamScope === 'one' && (
                <select value={exportTeamId} onChange={e=>setExportTeamId(e.target.value)} aria-label="الفريق للتصدير">
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              <LoadingButton loading={exporting} onClick={handleExport}>{exporting ? 'جارِ التحضير...' : 'تصدير Excel'}</LoadingButton>
            </div>
          )}
        </div>

        <div className="teamfinance129-table-wrap">
          <table className="teamfinance129-table">
            <thead><tr><th>#</th><th>التاريخ</th><th>البيان</th><th>العدد</th><th>سعر القطعة</th><th>الإجمالي</th><th>التسليم</th><th>إجراءات</th></tr></thead>
            <tbody>
              {expenses.map((x, index) => {
                const isEditing = editingId === x.id
                const totalDisp = egp(Number(isEditing ? (Number(editDraft?.qty||0) * Number(editDraft?.unit_price||0)) : x.total))
                return (
                  <tr key={x.id}>
                    <td className="teamfinance129-row-index">{index + 1}</td>
                    <td>{!isEditing ? sanitizeForUI(x.expense_date) : <input type="date" value={editDraft?.expense_date ?? (x.expense_date || '').slice(0,10)} min={termMin || undefined} max={termMax || undefined} onChange={e=>setEditDraft(d=>d?{...d,expense_date:e.target.value}:{expense_date:e.target.value,item_name:x.item_name,qty:x.qty,unit_price:x.unit_price})}/>}</td>
                    <td className="teamfinance129-item-name">{!isEditing ? sanitizeForUI(x.item_name) : <input value={editDraft?.item_name ?? x.item_name} onChange={e=>setEditDraft(d=>d?{...d,item_name:e.target.value}:{expense_date:(x.expense_date||'').slice(0,10),item_name:e.target.value,qty:x.qty,unit_price:x.unit_price})}/>}</td>
                    <td>{!isEditing ? x.qty : <input type="number" min={1} value={editDraft?.qty ?? x.qty} onChange={e=>setEditDraft(d=>d?{...d,qty:e.target.value as any}:{expense_date:(x.expense_date||'').slice(0,10),item_name:x.item_name,qty:e.target.value as any,unit_price:x.unit_price})}/>}</td>
                    <td>{!isEditing ? egp(Number(x.unit_price)) : <input type="number" min={0} step={0.01} value={editDraft?.unit_price ?? x.unit_price} onChange={e=>setEditDraft(d=>d?{...d,unit_price:e.target.value as any}:{expense_date:(x.expense_date||'').slice(0,10),item_name:x.item_name,qty:x.qty,unit_price:e.target.value as any})}/>}</td>
                    <td className="teamfinance129-total">{totalDisp}</td>
                    <td><label className={`teamfinance129-delivery-chip ${x.is_delivered ? 'is-done' : ''}`}><input type="checkbox" checked={!!x.is_delivered} disabled={!canModify || togglingId===x.id} onChange={e=>toggleDelivered(x.id,e.target.checked)}/><span>{x.is_delivered ? 'مُسلّم' : 'غير مُسلّم'}</span></label></td>
                    <td>{!canModify ? <span className="teamfinance129-muted">—</span> : !isEditing ? <button className="teamfinance129-danger-action" disabled={deletingId===x.id} onClick={()=>deleteRow(x.id)}>{deletingId===x.id?'...':'حذف'}</button> : <div className="teamfinance129-edit-actions"><LoadingButton loading={savingEditId===x.id} onClick={()=>saveEditRow(x.id)}>حفظ</LoadingButton><button onClick={cancelEditRow}>إلغاء</button></div>}</td>
                  </tr>
                )
              })}
              {expenses.length === 0 && <tr><td colSpan={8} className="teamfinance129-empty-row">لا توجد مصروفات مسجلة لهذا الفريق في الترم المحدد.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {gate.canWriteExpense(teamId) && (
        <section id="teamfinance-add-expense" className="teamfinance129-card teamfinance129-form-card">
          <div className="teamfinance129-card-head"><div><span className="teamfinance129-eyebrow-dark">＋ عملية جديدة</span><h2>إضافة مصروف</h2></div><span>💳</span></div>
          <div className="teamfinance129-form-grid">
            <div className="teamfinance129-field"><label>التاريخ</label>{hasTermDates && !useCustomDate ? <><select value={exDate} onChange={e=>onSelectDateChange(e.target.value)}>{termDates.map(d=><option key={d.id} value={d.meeting_date}>{d.meeting_date}</option>)}<option value="__custom__">— تاريخ آخر داخل الترم —</option></select><small>اختر تاريخًا من جدول الترم أو تاريخًا آخر.</small></> : <><input type="date" value={exDate} min={termMin||undefined} max={termMax||undefined} onChange={e=>setExDate(e.target.value)}/>{hasTermDates && <button type="button" className="teamfinance129-text-action" onClick={()=>{if(termDates.length){setUseCustomDate(false);setExDate(termDates[0].meeting_date)}}}>الرجوع لجدول الترم</button>}</>}</div>
            <div className="teamfinance129-field teamfinance129-field-wide"><label>اسم المنتج</label><input value={exName} onChange={e=>setExName(e.target.value)} placeholder="مثلاً: أدوات أو خامات..."/></div>
            <div className="teamfinance129-field"><label>العدد</label><input type="number" min={1} value={exQty} onChange={e=>setExQty(e.target.value as any)}/></div>
            <div className="teamfinance129-field"><label>سعر القطعة</label><input type="number" min={0} step={0.01} value={exUnit} onChange={e=>setExUnit(e.target.value as any)}/></div>
            <label className="teamfinance129-delivered-toggle"><input type="checkbox" checked={exDelivered} onChange={e=>setExDelivered(e.target.checked)}/><span><strong>تم التسليم</strong><small>يمكن تعديل الحالة لاحقًا من الجدول.</small></span></label>
            <div className="teamfinance129-form-submit"><LoadingButton loading={savingExp} onClick={addExpense}>حفظ المصروف</LoadingButton></div>
          </div>
        </section>
      )}
    </div>
  )

}
