import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { scoutYearFrom, supabase } from '../lib/supabase'
import { useAuth } from '../components/AuthProvider'
import { fetchCurrentScoutYearId } from '../features/reference/api'

type RoleRow = {
  role_slug: string
  team_id?: string | null
}

type CampStatus = 'draft' | 'open' | 'closed' | 'cancelled'

type TeamRow = {
  id: string
  name: string
}

type MemberRow = {
  id: string
  team_id: string | null
  is_equipier: boolean | null
  full_name: string
}

type CampRow = {
  id: string
  title: string
  description: string | null
  base_amount: number
  equipier_price?: number | null
  chef_price?: number | null
  start_date: string | null
  due_date: string | null
  status: CampStatus
}

type CampTeamRow = {
  id?: string
  camp_id?: string
  team_id: string
  collector_member_id: string | null
  notes: string | null
}

const STATUS_OPTIONS: { value: CampStatus; label: string }[] = [
  { value: 'draft', label: 'مسودة' },
  { value: 'open', label: 'مفتوح' },
  { value: 'closed', label: 'مغلق' },
  { value: 'cancelled', label: 'ملغي' },
]

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function teamLabel(team?: TeamRow | null) {
  if (!team) return '-'
  return team.name || 'فريق بدون اسم'
}

function memberLabel(member?: MemberRow | null) {
  if (!member) return '-'
  return member.full_name || 'عضو بدون اسم'
}

function statusTone(status: CampStatus): 'slate' | 'green' | 'yellow' | 'red' | 'blue' {
  if (status === 'open') return 'green'
  if (status === 'draft') return 'yellow'
  if (status === 'closed') return 'blue'
  if (status === 'cancelled') return 'red'
  return 'slate'
}

function statusLabel(status: CampStatus) {
  if (status === 'draft') return 'مسودة'
  if (status === 'open') return 'مفتوح'
  if (status === 'closed') return 'مغلق'
  if (status === 'cancelled') return 'ملغي'
  return status
}

export default function CampInstallmentForm() {
  const navigate = useNavigate()
  const { id } = useParams()

  const { roles, user } = useAuth() as {
    roles: RoleRow[]
    user: { id?: string; name?: string; email?: string } | null
  }

  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [teams, setTeams] = useState<TeamRow[]>([])
  const [chefsByTeam, setChefsByTeam] = useState<Record<string, MemberRow[]>>({})

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [baseAmount, setBaseAmount] = useState<string>('0')
  const [equipierPrice, setEquipierPrice] = useState<string>('0')
  const [chefPrice, setChefPrice] = useState<string>('0')
  const [startDate, setStartDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState(todayISO())
  const [status, setStatus] = useState<CampStatus>('draft')

  const [campTeams, setCampTeams] = useState<CampTeamRow[]>([])
  const [originalCampTeams, setOriginalCampTeams] = useState<CampTeamRow[]>([])

  const hasRole = useCallback(
    (slug: string) => (roles || []).some((r) => r.role_slug === slug),
    [roles]
  )

  const isAdmin = useMemo(() => hasRole('admin'), [hasRole])
  const canAccess = isAdmin
  const isEdit = !!id

  const loadTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) throw error
    setTeams((data || []) as TeamRow[])
  }, [])

  const loadChefsForTeams = useCallback(async (teamIds: string[]) => {
    if (!teamIds.length) return

    const uniqueIds = Array.from(new Set(teamIds.filter(Boolean)))
    if (!uniqueIds.length) return

    const { data, error } = await scoutYearFrom('v_members_current', 'v_members_context')
      .select('id, team_id, is_equipier, full_name')
      .in('team_id', uniqueIds)
      .eq('is_equipier', false)
      .eq('is_active', true)

    if (error) throw error

    const grouped: Record<string, MemberRow[]> = {}
    for (const teamId of uniqueIds) grouped[teamId] = []

    for (const row of (data || []) as MemberRow[]) {
      const key = row.team_id || ''
      if (!key) continue
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(row)
    }

    Object.keys(grouped).forEach((k) => {
      grouped[k].sort((a, b) => memberLabel(a).localeCompare(memberLabel(b), 'ar'))
    })

    setChefsByTeam((prev) => ({ ...prev, ...grouped }))
  }, [])

  const loadCamp = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: campData, error: campError } = await supabase
        .from('camp_installments')
        .select('*')
        .eq('id', id)
        .single()

      if (campError) throw campError

      const { data: campTeamsData, error: campTeamsError } = await supabase
        .from('camp_installment_teams')
        .select('id, camp_id, team_id, collector_member_id, notes')
        .eq('camp_id', id)
        .order('created_at', { ascending: true })

      if (campTeamsError) throw campTeamsError

      const camp = campData as CampRow
      const ct = (campTeamsData || []) as CampTeamRow[]

      const resolvedEquipierPrice = Number(camp.equipier_price ?? camp.base_amount ?? 0)
      const resolvedChefPrice = Number(camp.chef_price ?? camp.base_amount ?? 0)

      setTitle(camp.title || '')
      setDescription(camp.description || '')
      setBaseAmount(String(camp.base_amount ?? resolvedEquipierPrice ?? 0))
      setEquipierPrice(String(resolvedEquipierPrice))
      setChefPrice(String(resolvedChefPrice))
      setStartDate(camp.start_date || todayISO())
      setDueDate(camp.due_date || todayISO())
      setStatus(camp.status || 'draft')
      setCampTeams(ct)
      setOriginalCampTeams(ct)

      const teamIds = ct.map((x) => x.team_id).filter(Boolean)
      await loadChefsForTeams(teamIds)
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء تحميل بيانات المعسكر')
    } finally {
      setLoading(false)
    }
  }, [id, loadChefsForTeams])

  useEffect(() => {
    if (!canAccess) return
    loadTeams().catch((e: any) => setError(e?.message || 'تعذر تحميل الفرق'))
  }, [canAccess, loadTeams])

  useEffect(() => {
    if (!canAccess) return
    loadCamp()
  }, [canAccess, loadCamp])

  const selectedTeamIds = useMemo(
    () => campTeams.map((x) => x.team_id).filter(Boolean),
    [campTeams]
  )

  useEffect(() => {
    if (!selectedTeamIds.length) return
    loadChefsForTeams(selectedTeamIds).catch((e: any) =>
      setError(e?.message || 'تعذر تحميل شفات الفرق')
    )
  }, [selectedTeamIds, loadChefsForTeams])

  const availableTeams = useMemo(() => {
    const selected = new Set(campTeams.map((x) => x.team_id))
    return teams.filter((t) => !selected.has(t.id))
  }, [teams, campTeams])

  const addTeamRow = () => {
    if (!availableTeams.length) return
    const firstTeam = availableTeams[0]

    setCampTeams((prev) => [
      ...prev,
      {
        team_id: firstTeam.id,
        collector_member_id: null,
        notes: null,
      },
    ])
  }

  const updateCampTeam = <K extends keyof CampTeamRow>(
    index: number,
    key: K,
    value: CampTeamRow[K]
  ) => {
    setCampTeams((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row

        if (key === 'team_id') {
          return {
            ...row,
            team_id: String(value),
            collector_member_id: null,
          }
        }

        return {
          ...row,
          [key]: value,
        }
      })
    )
  }

  const removeCampTeam = (index: number) => {
    setCampTeams((prev) => prev.filter((_, i) => i !== index))
  }

  const validate = () => {
    if (!title.trim()) return 'اسم المعسكر مطلوب'

    const equipierAmount = Number(equipierPrice)
    if (!Number.isFinite(equipierAmount) || equipierAmount < 0) return 'سعر الـ Equipier غير صحيح'

    const chefAmount = Number(chefPrice)
    if (!Number.isFinite(chefAmount) || chefAmount < 0) return 'سعر الـ Chef غير صحيح'

    const teamIds = campTeams.map((x) => x.team_id).filter(Boolean)
    const uniqueTeamIds = new Set(teamIds)
    if (teamIds.length !== uniqueTeamIds.size) return 'لا يمكن تكرار نفس الفريق أكثر من مرة'

    for (let i = 0; i < campTeams.length; i++) {
      const row = campTeams[i]
      if (!row.team_id) return `الفريق في الصف رقم ${i + 1} مطلوب`
      if (!row.collector_member_id) return `مسؤول التحصيل للفريق رقم ${i + 1} مطلوب`
    }

    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const normalizedEquipierPrice = Number(equipierPrice || 0)
      const normalizedChefPrice = Number(chefPrice || 0)

      const currentScoutYearId = await fetchCurrentScoutYearId()

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        base_amount: normalizedEquipierPrice,
        equipier_price: normalizedEquipierPrice,
        chef_price: normalizedChefPrice,
        start_date: startDate || null,
        due_date: dueDate || null,
        status,
        scout_year_id: currentScoutYearId,
      }

      let campId = id

      if (campId) {
        const { error } = await supabase
          .from('camp_installments')
          .update(payload)
          .eq('id', campId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('camp_installments')
          .insert(payload)
          .select('id')
          .single()

        if (error) throw error
        campId = data.id as string
      }

      if (!campId) throw new Error('تعذر تحديد رقم المعسكر')

      const currentIds = new Set(
        campTeams.filter((x) => x.id).map((x) => x.id as string)
      )

      const deletedIds = originalCampTeams
        .filter((x) => x.id && !currentIds.has(x.id))
        .map((x) => x.id as string)

      if (deletedIds.length > 0) {
        const { error } = await supabase
          .from('camp_installment_teams')
          .delete()
          .in('id', deletedIds)

        if (error) throw error
      }

      const existingRows = campTeams.filter((x) => x.id)
      for (const row of existingRows) {
        const { error } = await supabase
          .from('camp_installment_teams')
          .update({
            collector_member_id: row.collector_member_id,
            notes: row.notes || null,
          })
          .eq('id', row.id as string)

        if (error) throw error
      }

      const newRows = campTeams.filter((x) => !x.id)
      const insertedTeamIds: string[] = []

      for (const row of newRows) {
        const { error } = await supabase
          .from('camp_installment_teams')
          .insert({
            camp_id: campId,
            team_id: row.team_id,
            collector_member_id: row.collector_member_id,
            notes: row.notes || null,
          })

        if (error) throw error
        insertedTeamIds.push(row.team_id)
      }

      for (const teamId of insertedTeamIds) {
        const { error } = await supabase.rpc('seed_camp_members_for_team', {
          p_camp_id: campId,
          p_team_id: teamId,
        })

        if (error) throw error
      }

      navigate(`/app/camp-installments/${campId}`)
    } catch (e: any) {
      setError(e?.message || 'حدث خطأ أثناء حفظ المعسكر')
    } finally {
      setSaving(false)
    }
  }

  if (!canAccess) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
          <div className="mb-2 text-lg font-bold">غير مسموح</div>
          <p className="text-sm">هذه الصفحة متاحة فقط للأدمن.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          جاري تحميل بيانات المعسكر...
        </div>
      </div>
    )
  }

  return (
    <div className="camp100-page camp100-installment-form space-y-5 p-4 md:p-6">
      <div className="camp100-form-heading flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isEdit ? 'تعديل المعسكر' : 'إضافة معسكر جديد'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            أنشئ المعسكر وحدد الفرق ومسؤول التحصيل. أعضاء الفرق سيظهرون تلقائيًا لكنهم يبدأون
            بحالة غير مشارك حتى يتم تفعيلهم.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/camp-installments"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            رجوع
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ المعسكر'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="عدد الفرق المختارة" value={campTeams.length} />
        <StatCard label="سعر Equipier" value={equipierPrice || '0'} />
        <StatCard label="سعر Chef" value={chefPrice || '0'} />
        <StatCard label="الحالة" value={statusLabel(status)} />
        <StatusCard label="حالة المعسكر" status={status} />
      </div>

      <SectionCard title="بيانات المعسكر">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              اسم المعسكر <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: معسكر الصيف 2026"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">الوصف</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="وصف مختصر للمعسكر أو ملاحظات عامة..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              سعر Equipier <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={equipierPrice}
              onChange={(e) => {
                setEquipierPrice(e.target.value)
                setBaseAmount(e.target.value)
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              هذا السعر هو السعر الافتراضي للـ Equipier ويتم حفظه أيضًا في base_amount للحفاظ على التوافق مع المنطق الحالي.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              سعر Chef <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={chefPrice}
              onChange={(e) => setChefPrice(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الحالة</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CampStatus)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">تاريخ البداية</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">آخر موعد للسداد</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="الفرق ومسؤولو التحصيل"
        extra={
          <button
            type="button"
            onClick={addTeamRow}
            disabled={!availableTeams.length}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            + إضافة فريق
          </button>
        }
      >
        {campTeams.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            لم يتم إضافة أي فرق بعد
          </div>
        ) : (
          <div className="space-y-4">
            {campTeams.map((row, idx) => {
              const currentTeam = teams.find((t) => t.id === row.team_id) || null
              const teamChefs = chefsByTeam[row.team_id] || []

              const teamOptions = [
                ...availableTeams,
                ...(currentTeam ? [currentTeam] : []),
              ].filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index)

              return (
                <div key={row.id || `team-row-${idx}`} className="rounded-2xl border border-slate-200 p-4">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="font-semibold text-slate-800">فريق #{idx + 1}</div>

                    <button
                      type="button"
                      onClick={() => removeCampTeam(idx)}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      حذف الفريق
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        الفريق <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={row.team_id}
                        onChange={(e) => updateCampTeam(idx, 'team_id', e.target.value)}
                        disabled={!!row.id}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        {teamOptions.map((team) => (
                          <option key={team.id} value={team.id}>
                            {teamLabel(team)}
                          </option>
                        ))}
                      </select>
                      {!!row.id && (
                        <p className="mt-1 text-xs text-slate-500">
                          لتغيير الفريق احذف الصف وأضف فريقًا جديدًا
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        مسؤول التحصيل <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={row.collector_member_id || ''}
                        onChange={(e) =>
                          updateCampTeam(idx, 'collector_member_id', e.target.value || null)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                      >
                        <option value="">اختر شيف الفريق</option>
                        {teamChefs.map((chef) => (
                          <option key={chef.id} value={chef.id}>
                            {memberLabel(chef)}
                          </option>
                        ))}
                      </select>

                      {!teamChefs.length && (
                        <p className="mt-1 text-xs text-amber-600">
                          لا يوجد شفات متاحون لهذا الفريق أو لم يتم تحميلهم بعد
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">ملاحظات</label>
                      <input
                        type="text"
                        value={row.notes || ''}
                        onChange={(e) => updateCampTeam(idx, 'notes', e.target.value)}
                        placeholder="ملاحظات على الفريق"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    الفريق المختار: <span className="font-semibold">{teamLabel(currentTeam)}</span>
                    {' • '} عدد الشفات المتاحين: <span className="font-semibold">{teamChefs.length}</span>
                    {' • '} بعد الحفظ، أعضاء الفريق سيُضافون تلقائيًا لكن بحالة غير مشارك
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div>المستخدم الحالي: {user?.name || user?.email || '-'}</div>
        {isEdit && <div>رقم المعسكر: {id}</div>}
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
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="camp100-local-section rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {extra}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="camp100-local-stat rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-800">{value}</div>
    </div>
  )
}

function StatusCard({
  label,
  status,
}: {
  label: string
  status: CampStatus
}) {
  return (
    <div className="camp100-local-stat camp100-status-stat rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2">
        <StatusPill label={statusLabel(status)} tone={statusTone(status)} />
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

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>
}