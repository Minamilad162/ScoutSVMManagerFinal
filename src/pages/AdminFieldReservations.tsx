// src/pages/AdminFieldReservations.tsx
import { useEffect, useState, useMemo } from 'react'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { PageLoader } from '../components/ui/PageLoader'
import { useToast } from '../components/ui/Toaster'
import { fetchTerms } from '../features/reference/api'
import { useScoutYear } from '../components/ScoutYearProvider'
import { clampDateToBounds, getTermYearBounds, getScoutYearBounds, inDateBounds } from '../lib/scoutYearScope'
import { safeWriteAuditLog } from '../features/audit/api'
import { buildFieldReservationSummary } from '../features/audit/humanize'
import { LoadingButton } from '../components/ui/LoadingButton'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import FieldMaps from '../components/FieldMaps'
import { useAuth } from '../components/AuthProvider'

type Team = { id: string; name: string }
type Zone = { id: string; name: string }
type Row = {
  id: string
  team_id: string
  team_name: string | null
  field_zone_id: string
  field_zone_name: string | null
  starts_at: string
  ends_at: string
  meeting_id: string | null
  meeting_date: string | null
  mtype: 'preparation'|'meeting' | null
}
type SummaryRow = { team_id: string; team_name: string; reservations: number; distinct_zones: number }

type QtyCol = 'quantity' | 'qty' | 'count' | null
type SoftDeleteCol = 'soft_deleted_at' | 'deleted_at' | 'is_deleted' | null

// ⬅️ الترم + تواريخه
type Term = { id: string; name: string; year: number; start_date: string | null; end_date: string | null }
type TermDateRow = { id: string; meeting_date: string } // YYYY-MM-DD

export default function AdminFieldReservations() {
  const toast = useToast()
  const { user } = useAuth()
  const { currentScoutYear } = useScoutYear()
  const yearBounds = getScoutYearBounds(currentScoutYear)

  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [teams, setTeams] = useState<Team[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [teamId, setTeamId] = useState<string>('all')

  // فلتر “يوم واحد”
  const [dayDate, setDayDate] = useState<string>('')

  // ✅ الترم + تواريخه
  const [terms, setTerms] = useState<Term[]>([])
  const [termId, setTermId] = useState<string>('')
  const termMeta = useMemo(() => terms.find(t => t.id === termId) || null, [terms, termId])

  const [termDates, setTermDates] = useState<TermDateRow[]>([])
  const hasTermDates = termDates.length > 0
  const [useCustomDay, setUseCustomDay] = useState<boolean>(false)
  const [selectedDay, setSelectedDay] = useState<string>('') // YYYY-MM-DD
  const selectedTermBounds = termMeta ? getTermYearBounds(currentScoutYear, termMeta) : null
  const minDate = selectedTermBounds?.start
  const maxDate = selectedTermBounds?.end

  // بيانات حجوزات الأرض
  const [rows, setRows] = useState<Row[]>([])

  // ملخص اليوم
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)

  // حجوزات الأدوات لليوم
  const [materialsLoading, setMaterialsLoading] = useState(false)
  const [materialsRows, setMaterialsRows] = useState<any[]>([])
  const [materialsSource, setMaterialsSource] = useState<string | null>(null)
  const [materialsDict, setMaterialsDict] = useState<Record<string, string>>({})

  // تحرير/إلغاء حجوزات الأدوات
  const [editingMatId, setEditingMatId] = useState<string | null>(null)
  const [editingMatOriginal, setEditingMatOriginal] = useState<any|null>(null) // ← للأصل قبل التعديل (للتنبيه)
  const [editingMatDraft, setEditingMatDraft] = useState<{ quantity: number | string; starts_at: string; ends_at: string } | null>(null)
  const [editingQtyCol, setEditingQtyCol] = useState<QtyCol>(null)
  const [editingSoftCol, setEditingSoftCol] = useState<SoftDeleteCol>(null)
  const [savingMatId, setSavingMatId] = useState<string | null>(null)
  const [cancellingMatId, setCancellingMatId] = useState<string | null>(null)

  // ==== Helpers إضافية للتنبيهات ====
  const teamNameById = (id?: string|null) => {
    if (!id) return '—'
    return teams.find(t => t.id === id)?.name || '—'
  }
  const zoneNameById = (id?: string|null) => {
    if (!id) return '—'
    return zones.find(z => z.id === id)?.name || '—'
  }

 async function notifyTeamRoles(team_id: string, ntype: string, payload: any) {
  try {
    const { data, error } = await supabase.rpc('notify_team_roles', {
      _team_id: team_id,                                     // استخدم براميتر الدالة الفعلي (فريق الحجز)
      _role_slugs: ['chef_de_legion', 'responsable_materials'],
      _ntype: ntype,                                         // استخدم النوع الممرَّر
      _payload: payload,
      _actor_user_id: user?.id || null,                      // المرسل (مهم لعمود notifications.user_id)
    })
    if (error) throw error
    // اختياري: تشوف كام مستلم اتبعت له
    // toast.success(`تم إرسال الإشعار إلى ${data ?? 0} مستلِم`)
  } catch (e:any) {
    console.warn('notify_team_roles failed:', e?.message || e)
    // اختياري: toast.error(e?.message || 'فشل إرسال الإشعار')
  }
}


  useEffect(() => { setRows([]); setSummaryRows([]); setMaterialsRows([]); setTermId(''); setTerms([]); if (currentScoutYear?.id) void init() }, [currentScoutYear?.id])
  async function init() {
    setLoading(true)
    try {
      const [{ data: ts, error: te }, { data: zs, error: ze }] = await Promise.all([
        supabase.from('teams').select('id,name').order('name'),
        supabase.from('field_zones').select('id,name').eq('active', true).order('name')
      ])
      if (te) throw te; if (ze) throw ze
      setTeams((ts as any) ?? []); setZones((zs as any) ?? [])

      // تاريخ افتراضي = اليوم
      const today = new Date()
      const pad=(n:number)=>String(n).padStart(2,'0')
      const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`
      setDayDate(clampDateToBounds(todayStr, yearBounds))

      // حمّل مسميات الأدوات
      await loadMaterialNames()

      // حمّل الترمات
      await loadTerms()
    } catch (e:any) {
      toast.error(e.message || 'تعذر التحميل')
    } finally { setLoading(false) }
  }

  async function loadTerms() {
    const arr = (await fetchTerms()) as Term[]
    setTerms(arr)
    setTermId(arr[0]?.id || '')
  }

  // لما الترم يتغير، حمّل تواريخه واضبط اختيار اليوم
  useEffect(() => {
    if (!termId) return
    ;(async () => {
      const { data, error } = await supabase
        .from('term_meeting_dates')
        .select('id,meeting_date')
        .eq('term_id', termId)
        .gte('meeting_date', minDate || '9999-01-01')
        .lte('meeting_date', maxDate || '9999-01-01')
        .order('meeting_date', { ascending: true })
      if (error) { toast.error(error.message || 'تعذر تحميل تواريخ الترم'); return }
      const list = (data ?? []) as TermDateRow[]
      setTermDates(list)

      if (list.length > 0) {
        const d = list[0].meeting_date
        setSelectedDay(d)
        setUseCustomDay(false)
        setDayDate(d) // ← يحدّث الجداول
      } else {
        setUseCustomDay(true) // لا يوجد جدول — اسمح بتاريخ داخل السنة فقط
        setDayDate(clampDateToBounds(dayDate, selectedTermBounds))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId, currentScoutYear?.id, minDate, maxDate])

  async function loadMaterialNames() {
    const candidates = [
      { table: 'materials', id: 'id', name: 'name' },
      { table: 'material_items', id: 'id', name: 'name' },
      { table: 'tools', id: 'id', name: 'name' },
      { table: 'tools_items', id: 'id', name: 'name' },
    ]
    for (const c of candidates) {
      try {
        const { data, error } = await supabase.from(c.table).select(`${c.id}, ${c.name}`).limit(1000)
        if (!error && Array.isArray(data) && data.length) {
          const map: Record<string,string> = {}
          ;(data as any[]).forEach((r:any) => { map[r[c.id]] = r[c.name] ?? '' })
          setMaterialsDict(map)
          break
        }
      } catch { /* جرّب اللي بعده */ }
    }
  }

  useEffect(() => { if (dayDate && inDateBounds(dayDate, selectedTermBounds)) refreshAll(); else { setRows([]); setSummaryRows([]); setMaterialsRows([]) } }, [dayDate, teamId, currentScoutYear?.id, minDate, maxDate])

  function getDayBounds(d: string) {
    const start = new Date(d + 'T00:00:00')
    const end   = new Date(d + 'T23:59:59')
    return { startISO: start.toISOString(), endISO: end.toISOString() }
  }

  async function refreshAll() {
    await Promise.all([refreshReservations(), refreshSummary(), refreshMaterialsForDay()])
  }

  // حجوزات الأرض
  async function refreshReservations() {
    if (!inDateBounds(dayDate, selectedTermBounds)) return
    const { startISO, endISO } = getDayBounds(dayDate)
    setLoading(true)
    try {
      let q = supabase.from('v_field_reservations_detailed').select('*').is('soft_deleted_at', null) as any
      q = q.lt('starts_at', endISO).gt('ends_at', startISO)
      if (teamId !== 'all') q = q.eq('team_id', teamId)
      const { data, error } = await q.order('starts_at', { ascending: true })
      if (error) throw error
      setRows((data as any) ?? [])
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل حجوزات الأرض لليوم')
    } finally { setLoading(false) }
  }

  // ملخص اليوم
  async function refreshSummary() {
    if (!inDateBounds(dayDate, selectedTermBounds)) return
    setSummaryLoading(true)
    try {
      const { startISO, endISO } = getDayBounds(dayDate)
      let q = supabase
        .from('field_reservations')
        .select('team_id, teams:team_id(name), field_zone_id, starts_at, ends_at')
        .is('soft_deleted_at', null)
        .lt('starts_at', endISO)
        .gt('ends_at', startISO) as any
      if (teamId !== 'all') q = q.eq('team_id', teamId)

      const { data, error } = await q
      if (error) throw error

      const map: Record<string, { name: string, reservations: number, zones: Set<string> }> = {}
      ;(data as any[] ?? []).forEach(r => {
        const tid = r.team_id as string
        const tname = r?.teams?.name || teams.find(t => t.id === tid)?.name || '—'
        if (!map[tid]) map[tid] = { name: tname, reservations: 0, zones: new Set<string>() }
        map[tid].reservations += 1
        if (r.field_zone_id) map[tid].zones.add(r.field_zone_id as string)
      })
      const rows: SummaryRow[] = Object.entries(map).map(([tid, v]) => ({
        team_id: tid, team_name: v.name, reservations: v.reservations, distinct_zones: v.zones.size
      })).sort((a,b) => a.team_name.localeCompare(b.team_name))
      setSummaryRows(rows)
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل ملخص اليوم')
    } finally { setSummaryLoading(false) }
  }

  // حجوزات الأدوات
  async function refreshMaterialsForDay() {
    if (!inDateBounds(dayDate, selectedTermBounds)) return
    setMaterialsLoading(true)
    setMaterialsRows([])
    setMaterialsSource(null)
    try {
      const { startISO, endISO } = getDayBounds(dayDate)

      const trySources: Array<() => Promise<{ ok: boolean, source: string, rows: any[] }>> = [
        async () => {
          try {
            let q = supabase.from('v_materials_reservations_detailed').select('*') as any
            if (teamId !== 'all') q = q.eq('team_id', teamId)
            const { data, error } = await q
              .lt('starts_at', endISO)
              .gt('ends_at', startISO)
              .order('starts_at', { ascending: true })
            if (error) throw error
            return { ok: true, source: 'v_materials_reservations_detailed', rows: (data as any[]) ?? [] }
          } catch { return { ok: false, source: 'v_materials_reservations_detailed', rows: [] } }
        },
        async () => {
          try {
            let q = supabase.from('materials_reservations').select(`
              id, team_id, starts_at, ends_at, notes, quantity, qty, count,
              teams:team_id(name),
              material_id,
              materials:material_id(name)
            `) as any
            if (teamId !== 'all') q = q.eq('team_id', teamId)
            const { data, error } = await q
              .lt('starts_at', endISO)
              .gt('ends_at', startISO)
              .order('starts_at', { ascending: true })
            if (error) throw error
            return { ok: true, source: 'materials_reservations', rows: (data as any[]) ?? [] }
          } catch { return { ok: false, source: 'materials_reservations', rows: [] } }
        },
        async () => {
          try {
            let q = supabase.from('material_reservations').select('*') as any
            if (teamId !== 'all') q = q.eq('team_id', teamId)
            const { data, error } = await q
              .lt('starts_at', endISO)
              .gt('ends_at', startISO)
              .order('starts_at', { ascending: true })
            if (error) throw error
            return { ok: true, source: 'material_reservations', rows: (data as any[]) ?? [] }
          } catch { return { ok: false, source: 'material_reservations', rows: [] } }
        },
        async () => {
          try {
            let q = supabase.from('tools_reservations').select('*') as any
            if (teamId !== 'all') q = q.eq('team_id', teamId)
            const { data, error } = await q
              .lt('starts_at', endISO)
              .gt('ends_at', startISO)
              .order('starts_at', { ascending: true })
            if (error) throw error
            return { ok: true, source: 'tools_reservations', rows: (data as any[]) ?? [] }
          } catch { return { ok: false, source: 'tools_reservations', rows: [] } }
        },
      ]

      for (const fn of trySources) {
        const { ok, source, rows } = await fn()
        if (ok) {
          setMaterialsSource(source)
          setMaterialsRows(rows)
          break
        }
      }
    } catch (e:any) {
      toast.error(e.message || 'تعذر تحميل حجوزات الأدوات')
    } finally { setMaterialsLoading(false) }
  }

  async function saveRow(r: Row) {
    setSavingId(r.id)
    try {
      // النسخة القديمة قبل التحديث (لعرض الفروقات في التنبيه)
      const { data: prev, error: pe } = await supabase
        .from('field_reservations')
        .select('team_id, field_zone_id, starts_at, ends_at')
        .eq('id', r.id)
        .maybeSingle()
      if (pe) throw pe

      let meeting_id = r.meeting_id
      if (r.meeting_date && r.mtype) {
        const { data: mrow, error: me } = await supabase
          .from('meetings')
          .upsert({ team_id: r.team_id, meeting_date: r.meeting_date, mtype: r.mtype }, { onConflict: 'team_id,meeting_date,mtype' })
          .select('id').maybeSingle()
        if (me) throw me
        meeting_id = mrow?.id || null
      }

      const { error } = await supabase.from('field_reservations').update({
        team_id: r.team_id, field_zone_id: r.field_zone_id, starts_at: r.starts_at, ends_at: r.ends_at, meeting_id
      }).eq('id', r.id)
      if (error) {
        const msg = String(error.message || '')
        if (msg.includes('field_reservations_no_overlap') || msg.includes('overlap')) throw new Error('تعذر الحفظ: تعارض مع حجز آخر')
        throw error
      }
      void safeWriteAuditLog({
        action: 'update',
        module: 'field_reservations',
        entityType: 'field_reservation',
        entityId: r.id,
        entityDisplay: `${zoneNameById(r.field_zone_id)} — ${r.meeting_date || dayDate || ''}`.trim(),
        summary: buildFieldReservationSummary({
          action: 'update',
          zoneName: zoneNameById(r.field_zone_id),
          teamName: teamNameById(r.team_id),
          startsAt: r.starts_at,
          endsAt: r.ends_at,
        }),
        severity: 'warning',
        source: 'AdminFieldReservations',
        teamId: r.team_id,
        before: {
          team_id: prev?.team_id ?? null,
          zone_name: zoneNameById(prev?.field_zone_id ?? null),
          starts_at: prev?.starts_at ?? null,
          ends_at: prev?.ends_at ?? null,
        },
        after: {
          team_id: r.team_id,
          zone_name: zoneNameById(r.field_zone_id),
          starts_at: r.starts_at,
          ends_at: r.ends_at,
        },
        context: {
          meeting_date: r.meeting_date || dayDate || null,
          meeting_type: r.mtype || null,
          team_name: teamNameById(r.team_id),
        },
      })

      toast.success('تم الحفظ')
      await refreshAll()

      // أرسل تنبيه لو في اختلاف
      const changedZone = (prev?.field_zone_id ?? null) !== (r.field_zone_id ?? null)
      const changedTime = (prev?.starts_at !== r.starts_at) || (prev?.ends_at !== r.ends_at)
      if (changedZone || changedTime) {
        await notifyTeamRoles(r.team_id, 'field_reservation_updated', {
          team_id: r.team_id,
          teamName: teamNameById(r.team_id),
          extra: {
            actor_name: user?.name || user?.email || 'مسؤول',
            zone_old_id: prev?.field_zone_id ?? null,
            zone_old_name: zoneNameById(prev?.field_zone_id ?? null),
            zone_new_id: r.field_zone_id,
            zone_new_name: zoneNameById(r.field_zone_id),
            start_old: prev?.starts_at,
            end_old:   prev?.ends_at,
            start_new: r.starts_at,
            end_new:   r.ends_at,
          }
        })
      }
    } catch (e:any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally { setSavingId(null) }
  }

  async function softDelete(id: string) {
    setDeletingId(id)
    try {
      const { data: prev, error: pe } = await supabase
        .from('v_field_reservations_detailed')
        .select('id, team_id, field_zone_id, starts_at, ends_at, team_name, field_zone_name')
        .eq('id', id)
        .maybeSingle()
      if (pe) throw pe

      const cancelledAt = new Date().toISOString()
      const { error } = await supabase.from('field_reservations').update({ soft_deleted_at: cancelledAt }).eq('id', id)
      if (error) throw error

      void safeWriteAuditLog({
        action: 'cancel',
        module: 'field_reservations',
        entityType: 'field_reservation',
        entityId: id,
        entityDisplay: `${prev?.field_zone_name || zoneNameById(prev?.field_zone_id || null)} — ${prev?.starts_at ? prev.starts_at.slice(0, 10) : ''}`.trim(),
        summary: buildFieldReservationSummary({
          action: 'cancel',
          zoneName: prev?.field_zone_name || zoneNameById(prev?.field_zone_id || null),
          teamName: prev?.team_name || teamNameById(prev?.team_id || null),
          startsAt: prev?.starts_at || null,
          endsAt: prev?.ends_at || null,
        }),
        severity: 'warning',
        source: 'AdminFieldReservations',
        teamId: prev?.team_id || null,
        before: {
          zone_name: prev?.field_zone_name || zoneNameById(prev?.field_zone_id || null),
          starts_at: prev?.starts_at || null,
          ends_at: prev?.ends_at || null,
        },
        after: { soft_deleted_at: cancelledAt },
        changedFields: ['soft_deleted_at'],
        context: {
          team_name: prev?.team_name || teamNameById(prev?.team_id || null),
          zone_name: prev?.field_zone_name || zoneNameById(prev?.field_zone_id || null),
        },
      })

      toast.success('تم إلغاء الحجز')
      await refreshAll()

      if (prev?.team_id) {
        await notifyTeamRoles(prev.team_id, 'field_reservation_cancelled', {
          team_id: prev.team_id,
          teamName: prev.team_name || teamNameById(prev.team_id),
          extra: {
            actor_name: user?.name || user?.email || 'مسؤول',
            zone_old_id: prev.field_zone_id,
            zone_old_name: prev.field_zone_name || zoneNameById(prev.field_zone_id),
            start_old: prev.starts_at,
            end_old:   prev.ends_at
          }
        })
      }
    } catch (e:any) {
      toast.error(e.message || 'تعذر الإلغاء')
    } finally { setDeletingId(null) }
  }

  // Helpers
  function getTeamNameFromRow(r: any): string {
    return (
      r.team_name ||
      r?.teams?.name ||
      r?.team?.name ||
      teams.find(t => t.id === r.team_id)?.name ||
      '—'
    )
  }
  function getMaterialNameFromRow(r: any): string {
    return (
      r.material_name ||
      r?.materials?.name ||
      r?.item_name ||
      r?.item?.name ||
      r?.tool_name ||
      r?.tools?.name ||
      (r.material_id ? materialsDict[r.material_id] : '') ||
      '—'
    )
  }
  const normalizeDTLocal = (v?: string|null) => v ? v.slice(0,16) : ''

  // أي مصادر قابلة للتعديل؟
  const editableMaterialsBaseTable = () => {
    if (materialsSource === 'materials_reservations') return 'materials_reservations'
    if (materialsSource === 'material_reservations') return 'material_reservations'
    if (materialsSource === 'tools_reservations') return 'tools_reservations'
    return null // View
  }

  function detectQtyCol(r:any): QtyCol {
    if ('quantity' in r) return 'quantity'
    if ('qty' in r) return 'qty'
    if ('count' in r) return 'count'
    return null
  }

  function detectSoftDeleteCol(r:any): SoftDeleteCol {
    if ('soft_deleted_at' in r) return 'soft_deleted_at'
    if ('deleted_at' in r) return 'deleted_at'
    if ('is_deleted' in r) return 'is_deleted'
    return null
  }

  function startEditMat(r: any) {
    if (!r?.id) return
    setEditingMatId(r.id)
    setEditingMatOriginal(r) // ← مهم: هنستخدمه لبناء التنبيه بعد الحفظ
    setEditingQtyCol(detectQtyCol(r))
    setEditingSoftCol(detectSoftDeleteCol(r))
    setEditingMatDraft({
      quantity: (r.quantity ?? r.qty ?? r.count ?? 1) as number,
      starts_at: normalizeDTLocal(r.starts_at),
      ends_at: normalizeDTLocal(r.ends_at),
    })
  }
  function cancelEditMat() {
    setEditingMatId(null)
    setEditingMatDraft(null)
    setEditingMatOriginal(null)
    setEditingQtyCol(null)
    setEditingSoftCol(null)
  }

  // ✅ UPDATE بدون .select — نعتمد على عدم وجود error
  async function saveEditMat() {
    if (!editingMatId || !editingMatDraft) return
    const base = editableMaterialsBaseTable()
    if (!base) {
      toast.error('مصدر البيانات الحالي غير قابل للتعديل.')
      return
    }
    const qtyCol: QtyCol = editingQtyCol || 'qty' // fallback شائع
    try {
      setSavingMatId(editingMatId)

      const isoStart = editingMatDraft.starts_at ? new Date(editingMatDraft.starts_at).toISOString() : null
      const isoEnd   = editingMatDraft.ends_at   ? new Date(editingMatDraft.ends_at).toISOString()   : null
      const qtyNum = Number(editingMatDraft.quantity || 0) || 1

      const payload: any = {}
      if (isoStart) payload.starts_at = isoStart
      if (isoEnd) payload.ends_at = isoEnd
      if (qtyCol) payload[qtyCol] = qtyNum

      const { error } = await supabase
        .from(base)
        .update(payload)
        .eq('id', editingMatId)

      if (error) throw error

      toast.success('تم حفظ التعديل')

      // إرسال تنبيه تعديل الأدوات
      const orig = editingMatOriginal || {}
      const team_id = (orig.team_id ?? null) as string|null
      if (team_id) {
        const qtyOld = (orig.quantity ?? orig.qty ?? orig.count ?? 1) as number
        const itemName = getMaterialNameFromRow(orig)
        await notifyTeamRoles(team_id, 'materials_reservation_updated', {
          team_id,
          teamName: getTeamNameFromRow(orig),
          materialName: itemName,
          qty: qtyNum, // الحالي
          extra: {
            actor_name: user?.name || user?.email || 'مسؤول',
            qty_old: qtyOld,
            qty_new: qtyNum,
            start_old: orig.starts_at || null,
            end_old:   orig.ends_at || null,
            start_new: isoStart,
            end_new:   isoEnd
          }
        })
      }

      cancelEditMat()
      await refreshMaterialsForDay()
    } catch (e:any) {
      toast.error(e?.message || 'تعذر حفظ التعديل')
    } finally {
      setSavingMatId(null)
    }
  }

  // ✅ إلغاء الحجز: Soft-delete إن وُجد عمود، وإلا Delete — بدون .select
  async function cancelMaterialReservation(row: any) {
    if (!row?.id) return
    const base = editableMaterialsBaseTable()
    if (!base) {
      toast.error('مصدر البيانات الحالي غير قابل للإلغاء.')
      return
    }
    if (!confirm('هل أنت متأكد من إلغاء هذا الحجز؟')) return
    try {
      setCancellingMatId(row.id)

      const softCol: SoftDeleteCol = detectSoftDeleteCol(row)

      if (softCol) {
        const payload: any = {}
        payload[softCol] = softCol === 'is_deleted' ? true : new Date().toISOString()

        const { error } = await supabase
          .from(base)
          .update(payload)
          .eq('id', row.id)

        if (error) throw error
      } else {
        const { error: e2 } = await supabase
          .from(base)
          .delete()
          .eq('id', row.id)

        if (e2) throw e2
      }

      toast.success('تم إلغاء الحجز')
      await refreshMaterialsForDay()

      // إرسال تنبيه إلغاء الأدوات
      const team_id = (row.team_id ?? null) as string|null
      if (team_id) {
        const itemName = getMaterialNameFromRow(row)
        const qty      = (row.quantity ?? row.qty ?? row.count ?? 1) as number
        await notifyTeamRoles(team_id, 'materials_reservation_cancelled', {
          team_id,
          teamName: getTeamNameFromRow(row),
          materialName: itemName,
          qty,
          extra: {
            actor_name: user?.name || user?.email || 'مسؤول',
            start_old: row.starts_at || null,
            end_old:   row.ends_at   || null
          }
        })
      }
    } catch (e:any) {
      toast.error(e?.message || 'تعذر إلغاء الحجز')
    } finally {
      setCancellingMatId(null)
    }
  }

  // ⬅️ تغيير اليوم المختار من جدول الترم
  function onTermDayChange(v: string) {
    if (v === '__custom__') {
      setUseCustomDay(true)
      return
    }
    setUseCustomDay(false)
    setSelectedDay(v)
    setDayDate(v) // ← هذا هو الفلتر المعتمد
  }

  const reservedZoneCount = useMemo(() => new Set(rows.map((row) => row.field_zone_id).filter(Boolean)).size, [rows])
  const visibleTeamCount = useMemo(() => new Set(summaryRows.map((row) => row.team_id).filter(Boolean)).size, [summaryRows])

  return (
    <div className="field123-page space-y-5 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري التحميل..." />

      <PageHero
        className="field123-hero"
        eyebrow="الأرض والحجوزات"
        title="إدارة الأرض"
        description="راجع خريطة الأرض، اختر الترم واليوم والفريق، ثم تابع حجوزات الأرض والأدوات وعدّلها أو ألغها بنفس الوظائف الحالية."
        badge={<span className="field123-hero-badge">Field Admin</span>}
      />

      <div className="field123-kpis grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="إجمالي القطاعات" value={zones.length} hint="القطاعات النشطة المتاحة للحجز" accent="navy" />
        <MetricCard label="حجوزات الأرض في اليوم" value={rows.length} hint={dayDate || 'اختر اليوم'} accent="amber" />
        <MetricCard label="قطاعات مستخدمة" value={reservedZoneCount} hint={rows.length ? 'ضمن نتائج اليوم الحالية' : 'لا توجد حجوزات'} accent="emerald" />
        <MetricCard label="حجوزات الأدوات في اليوم" value={materialsRows.length} hint={visibleTeamCount ? `${visibleTeamCount} فريق في الملخص` : 'حسب الفلتر الحالي'} accent="sky" />
      </div>

      <SectionCard className="field123-filter-card" title="اختيار نطاق العمل" description="نفس فلاتر الترم والتاريخ والفريق المستخدمة حاليًا، لكن في شريط واحد أوضح.">
        <div className="field123-filterbar">
          <label className="field123-field">
            <span>الترم</span>
            <select value={termId} onChange={e=>setTermId(e.target.value)}>{terms.map(t => <option key={t.id} value={t.id}>{t.year} — {t.name}</option>)}</select>
            {termMeta?.start_date && termMeta?.end_date && <small>{termMeta.start_date} → {termMeta.end_date}</small>}
          </label>

          <label className="field123-field">
            <span>التاريخ</span>
            {hasTermDates && !useCustomDay ? (
              <select value={selectedDay} onChange={e=>onTermDayChange(e.target.value)}>{termDates.map(d => <option key={d.id} value={d.meeting_date}>{d.meeting_date}</option>)}<option value="__custom__">— تاريخ آخر —</option></select>
            ) : (
              <input type="date" value={dayDate} onChange={e=>setDayDate(clampDateToBounds(e.target.value, selectedTermBounds))} min={minDate} max={maxDate} />
            )}
            {hasTermDates && useCustomDay && <button type="button" className="field123-inline-link" onClick={()=>{ if (termDates.length) { setUseCustomDay(false); const d=termDates[0].meeting_date; setSelectedDay(d); setDayDate(d) } }}>الرجوع لجدول الترم</button>}
          </label>

          <label className="field123-field"><span>الفريق</span><select value={teamId} onChange={e=>setTeamId(e.target.value)}><option value="all">كل الفرق</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <button type="button" className="field123-refresh" onClick={refreshAll}>تحديث البيانات</button>
        </div>
      </SectionCard>

      <SectionCard className="field123-map-card" title="خريطة الأرض" description="الخريطة الحالية تظل كما هي وتستخدم نفس البيانات، مع إبرازها كجزء أساسي من مساحة الإدارة.">
        <FieldMaps className="field123-map" sticky height="h-72 md:h-[28rem]" />
      </SectionCard>

      <SectionCard className="field123-summary-card" title={`ملخص اليوم — ${dayDate || 'بدون تاريخ'}`} description="عدد حجوزات الأرض لكل فريق في اليوم والفلتر المختارين." actions={<span className="field123-chip">{summaryRows.length} فريق</span>}>
        <PageLoader visible={summaryLoading} text="جاري حساب الملخص..." />
        <div className="field123-summary-grid">
          {summaryRows.map(row => (
            <article key={row.team_id}><span>⚜</span><div><strong>{row.team_name}</strong><small>{row.distinct_zones} قطاع مختلف</small></div><b>{row.reservations}</b></article>
          ))}
          {summaryRows.length === 0 && !summaryLoading && <div className="field123-empty-card">لا توجد حجوزات أرض في هذا اليوم{teamId !== 'all' ? ' لهذا الفريق' : ''}.</div>}
        </div>
      </SectionCard>

      <SectionCard className="field123-materials-card" title="حجوزات الأدوات في اليوم" description="نفس حجوزات الأدوات الحالية مع التعديل والإلغاء والكمية ومن/إلى بالدقيقة." actions={<span className="field123-chip is-blue">{materialsRows.length} حجز</span>}>
        <PageLoader visible={materialsLoading} text="جاري تحميل حجوزات الأدوات..." />
        <div className="field123-table-wrap" dir="ltr" style={{ WebkitOverflowScrolling: 'touch' as any }}>
          <table className="field123-table min-w-[980px]">
            <thead><tr><th>إلغاء الحجز</th><th>تحرير</th><th>إلى</th><th>من</th><th>الكمية</th><th>الأداة</th><th>الفريق</th></tr></thead>
            <tbody>
              {materialsRows.map((r:any) => {
                const teamName = getTeamNameFromRow(r)
                const itemName = getMaterialNameFromRow(r)
                const qty = (r.quantity ?? r.qty ?? r.count ?? r.amount ?? 1) as number
                const start = (r.starts_at || '')
                const end = (r.ends_at || '')
                const startDisp = start ? start.slice(0,16).replace('T',' ') : '—'
                const endDisp = end ? end.slice(0,16).replace('T',' ') : '—'
                const key = r.id || `${teamName}-${itemName}-${start}`
                const canEdit = !!r.id && !!editableMaterialsBaseTable()
                const isEditing = editingMatId === r.id
                return (
                  <tr key={key}>
                    <td className="text-center"><button className="field123-danger-btn" disabled={!canEdit || cancellingMatId===r.id} onClick={()=>cancelMaterialReservation(r)} title={canEdit ? '' : 'غير قابل للإلغاء (مصدر البيانات View)'}>{cancellingMatId===r.id ? '...' : 'إلغاء'}</button></td>
                    <td className="text-center">{isEditing ? <div className="field123-actions"><LoadingButton loading={savingMatId===r.id} onClick={saveEditMat}>حفظ</LoadingButton><button className="field123-secondary-btn" onClick={cancelEditMat}>إلغاء التعديل</button></div> : <button className="field123-edit-btn" disabled={!canEdit} onClick={()=>startEditMat(r)} title={canEdit ? '' : 'غير قابل للتعديل (مصدر البيانات View)'}>تعديل</button>}</td>
                    <td>{isEditing ? <input type="datetime-local" className="field123-inline-input" value={editingMatDraft?.ends_at ?? normalizeDTLocal(end)} onChange={e=>setEditingMatDraft(d => d ? { ...d, ends_at:e.target.value } : d)} /> : endDisp}</td>
                    <td>{isEditing ? <input type="datetime-local" className="field123-inline-input" value={editingMatDraft?.starts_at ?? normalizeDTLocal(start)} onChange={e=>setEditingMatDraft(d => d ? { ...d, starts_at:e.target.value } : d)} /> : startDisp}</td>
                    <td className="text-center">{isEditing ? <input type="number" min={1} className="field123-inline-input is-qty" value={editingMatDraft?.quantity ?? 1} onChange={e=>setEditingMatDraft(d => d ? { ...d, quantity:e.target.value } : d)} /> : <span className="field123-qty">{qty}</span>}</td>
                    <td><strong>{itemName}</strong></td><td><span className="field123-team">{teamName}</span></td>
                  </tr>
                )
              })}
              {materialsRows.length===0 && !materialsLoading && <tr><td className="field123-empty" colSpan={7}>لا توجد حجوزات أدوات في هذا اليوم{teamId!=='all' ? ' لهذا الفريق' : ''}.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard className="field123-reservations-card" title="حجوزات الأرض" description="كل الحقول الحالية ما زالت قابلة للتعديل والحفظ والإلغاء كما كانت." actions={<span className="field123-chip is-gold">{rows.length} حجز</span>}>
        <div className="field123-table-wrap" dir="ltr" style={{ WebkitOverflowScrolling: 'touch' as any }}>
          <table className="field123-table min-w-[920px]">
            <thead><tr><th>إلغاء</th><th>حفظ</th><th>النوع</th><th>تاريخ الاجتماع</th><th>إلى</th><th>من</th><th>القطاع</th><th>الفريق</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="text-center"><button className="field123-danger-btn" disabled={deletingId===r.id} onClick={()=>softDelete(r.id)}>{deletingId===r.id ? '...' : 'إلغاء'}</button></td>
                  <td className="text-center"><LoadingButton loading={savingId===r.id} onClick={()=>saveRow(r)}>حفظ</LoadingButton></td>
                  <td><select className="field123-inline-input" value={r.mtype ?? 'meeting'} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,mtype:e.target.value as any}:x))}><option value="preparation">تحضير</option><option value="meeting">اجتماع</option></select></td>
                  <td><input type="date" className="field123-inline-input" value={r.meeting_date ?? ''} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,meeting_date:e.target.value}:x))} min={minDate} max={maxDate} /></td>
                  <td><input type="datetime-local" className="field123-inline-input" value={r.ends_at?.slice(0,16)} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,ends_at:e.target.value}:x))} /></td>
                  <td><input type="datetime-local" className="field123-inline-input" value={r.meeting_date ?? ''} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,meeting_date:e.target.value}:x))} min={minDate} max={maxDate} /></td>
                  <td><select className="field123-inline-input" value={r.field_zone_id} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,field_zone_id:e.target.value}:x))}>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></td>
                  <td><select className="field123-inline-input" value={r.team_id} onChange={e=>setRows(prev=>prev.map(x=>x.id===r.id?{...x,team_id:e.target.value}:x))}>{teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select></td>
                </tr>
              ))}
              {rows.length===0 && <tr><td className="field123-empty" colSpan={8}>لا توجد سجلات لهذا اليوم.</td></tr>}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
