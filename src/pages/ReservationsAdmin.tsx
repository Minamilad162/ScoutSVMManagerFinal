import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toaster'
import { PageLoader } from '../components/ui/PageLoader'
import { EmptyState } from '../components/ui/EmptyState'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'

type Team = { id: string; name: string }
type Material = { id: string; name: string; storage: string | null }
type Reservation = {
  id: string
  team_id: string
  material_id: string
  qty: number
  starts_at: string
  ends_at: string
}
type Zone = { id: string; team_id: string; zone_name: string; starts_at: string; ends_at: string }

function fmtTimeRange(a: string, b: string) {
  const from = new Date(a).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  const to = new Date(b).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  return `${from} — ${to}`
}

export default function ReservationsAdmin() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [materialsMap, setMaterialsMap] = useState<Record<string, Material>>({})
  const [rows, setRows] = useState<Reservation[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [teamId, setTeamId] = useState('')
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => { void refresh() }, [teamId, dateStr])

  async function refresh() {
    setLoading(true)
    try {
      const dayStart = `${dateStr}T00:00:00`
      const dayEnd = `${dateStr}T23:59:59`
      const [{ data: teamsData, error: teamsErr }, { data: materialsData, error: materialsErr }, { data: reservationsData, error: reservationsErr }, { data: zonesData, error: zonesErr }] = await Promise.all([
        supabase.from('teams').select('id,name').order('name'),
        supabase.from('materials').select('id,name,storage').order('name'),
        supabase.from('material_reservations').select('id,team_id,material_id,qty,starts_at,ends_at').lte('starts_at', dayEnd).gte('ends_at', dayStart).order('starts_at'),
        supabase.from('field_reservations').select('id,team_id,zone_name,starts_at,ends_at').lte('starts_at', dayEnd).gte('ends_at', dayStart),
      ])
      if (teamsErr) throw teamsErr
      if (materialsErr) throw materialsErr
      if (reservationsErr) throw reservationsErr
      if (zonesErr) throw zonesErr

      const teamRows = (teamsData as Team[]) ?? []
      setTeams(teamRows)
      if (!teamId && teamRows.length) setTeamId(teamRows[0].id)
      setRows(((reservationsData as Reservation[]) ?? []).filter((row) => !teamId || row.team_id === teamId))
      setZones((zonesData as Zone[]) ?? [])
      setMaterialsMap(Object.fromEntries(((materialsData as Material[]) ?? []).map((item) => [item.id, item])))
    } catch (e: any) {
      toast.error(e.message || 'تعذر تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const byTeamThenTime = useMemo(() => [...rows].sort((a, b) => a.team_id.localeCompare(b.team_id) || a.starts_at.localeCompare(b.starts_at)), [rows])

  function zonesFor(team: string, startsAt: string, endsAt: string) {
    return zones
      .filter((z) => z.team_id === team && z.starts_at <= endsAt && z.ends_at >= startsAt)
      .map((z) => z.zone_name)
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري تحميل البيانات..." />

      <PageHero
        eyebrow="حجوزات الأدوات"
        title="رؤية إدارية أوضح للحجوزات اليومية"
        description="استعرض حجوزات الأدوات التي تتقاطع مع اليوم المختار، مع إظهار الفريق، الأداة، العدد، والأرض المحجوزة في نفس الصف."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="الحجوزات الظاهرة" value={byTeamThenTime.length} accent="indigo" />
        <MetricCard label="عدد الفرق" value={teams.length} accent="sky" />
        <MetricCard label="عدد الأراضي المتقاطعة" value={zones.length} accent="emerald" />
      </div>

      <SectionCard title="الفلاتر" description="اختر الفريق والتاريخ لعرض الحجوزات المتقاطعة مع هذا اليوم فقط.">
        <div className="grid gap-3 md:grid-cols-3 md:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الفريق</label>
            <select className="w-full rounded-2xl border border-slate-300 px-3 py-2 cursor-pointer" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">كل الفرق</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">التاريخ</label>
            <input type="date" className="w-full rounded-2xl border border-slate-300 px-3 py-2 cursor-pointer" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </div>
          <div className="text-sm leading-6 text-slate-500">
            يعرض الحجوزات التي تتقاطع مع اليوم المختار. كل صف يوضح اسم الأداة، الفريق، العدد، والأرض المحجوزة.
          </div>
        </div>
      </SectionCard>

      <SectionCard title="النتائج">
        {byTeamThenTime.length === 0 ? (
          <EmptyState title="لا توجد حجوزات في هذا اليوم" description="اختر تاريخًا آخر أو وسّع الفلترة إلى كل الفرق لمراجعة الحجوزات الحالية." />
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/80 text-slate-700">
                <tr>
                  <th className="p-3">الوقت</th>
                  <th className="p-3 text-start">اسم الأداة</th>
                  <th className="p-3 text-start">الفريق</th>
                  <th className="p-3 text-center">العدد</th>
                  <th className="p-3 text-start">الأرض المحجوزة</th>
                  <th className="p-3 text-start">مكان التخزين</th>
                </tr>
              </thead>
              <tbody>
                {byTeamThenTime.map((r) => {
                  const mat = materialsMap[r.material_id]
                  const teamName = teams.find((t) => t.id === r.team_id)?.name || '—'
                  const z = zonesFor(r.team_id, r.starts_at, r.ends_at)
                  return (
                    <tr key={r.id} className="border-t border-slate-200 align-top bg-white">
                      <td className="p-3 whitespace-nowrap">{fmtTimeRange(r.starts_at, r.ends_at)}</td>
                      <td className="p-3 font-semibold text-slate-800">{mat?.name || '—'}</td>
                      <td className="p-3 text-slate-600">{teamName}</td>
                      <td className="p-3 text-center font-semibold text-slate-800">{r.qty}</td>
                      <td className="p-3 text-slate-600">{z.length ? z.join(', ') : '—'}</td>
                      <td className="p-3 text-slate-600">{mat?.storage || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
