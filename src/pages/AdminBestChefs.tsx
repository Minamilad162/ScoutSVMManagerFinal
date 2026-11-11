import { useEffect, useMemo, useRef, useState } from 'react'
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
import { supabase } from '../lib/supabase'
import {
  listBestChefCandidatesForCurrentYear,
  listBestChefTermsForCurrentYear,
  getBestChefsHomeTermId,
  listBestChefsForTerm,
  saveBestChefsForTerm,
  setBestChefsHomeTerm,
  type BestChefCandidate,
  type BestChefSelection,
} from '../features/bestChefs/api'
import type { TermOption } from '../features/reference/api'
import { filterTermsForScoutYear } from '../features/bestChefs/yearScope'

function resolveAvatarUrl(raw?: string | null) {
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  const { data } = supabase.storage.from('avatars').getPublicUrl(raw)
  return data?.publicUrl ?? raw
}

function initials(name?: string | null) {
  const clean = (name || '').trim()
  if (!clean) return '👤'
  const parts = clean.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
}

export default function AdminBestChefs() {
  const { roles, user } = useAuth()
  const { currentScoutYear, isReadOnlyView } = useScoutYear()
  const toast = useToast()
  const isAdmin = roles.some((role) => role.role_slug === 'admin')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [terms, setTerms] = useState<TermOption[]>([])
  const [selectedTermId, setSelectedTermId] = useState('')
  const [candidates, setCandidates] = useState<BestChefCandidate[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [savedItems, setSavedItems] = useState<BestChefSelection[]>([])
  const [search, setSearch] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [homeTermId, setHomeTermId] = useState<string | null>(null)
  const [settingHome, setSettingHome] = useState(false)
  const loadVersion = useRef(0)
  const selectionVersion = useRef(0)

  const selectedTerm = useMemo(() => terms.find((term) => term.id === selectedTermId) || null, [terms, selectedTermId])

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false)
      return
    }
    void load()
    return () => { loadVersion.current += 1; selectionVersion.current += 1 }
  }, [isAdmin, currentScoutYear?.id])

  useEffect(() => {
    if (!selectedTermId || !currentScoutYear?.id) {
      selectionVersion.current += 1
      setSavedItems([])
      setSelectedIds([])
      return
    }
    void loadSelections(selectedTermId, currentScoutYear.id)
    return () => { selectionVersion.current += 1 }
  }, [selectedTermId, currentScoutYear?.id])

  async function load() {
    const requestVersion = ++loadVersion.current
    setLoading(true)
    setTerms([])
    setCandidates([])
    setHomeTermId(null)
    setSavedItems([])
    setSelectedIds([])
    setError(null)
    if (!currentScoutYear?.id) {
      setSelectedTermId('')
      setLoading(false)
      return
    }
    try {
      const [termRows, candidateRows, currentHomeTermId] = await Promise.all([
        listBestChefTermsForCurrentYear(),
        listBestChefCandidatesForCurrentYear(),
        currentScoutYear?.id ? getBestChefsHomeTermId(currentScoutYear.id) : Promise.resolve(null),
      ])
      if (requestVersion !== loadVersion.current) return
      const yearTerms = filterTermsForScoutYear(termRows, currentScoutYear?.id ?? '')
      setTerms(yearTerms)
      setCandidates(candidateRows)
      setHomeTermId(currentHomeTermId)
      const nextTermId = selectedTermId && yearTerms.some((term) => term.id === selectedTermId)
        ? selectedTermId : yearTerms[0]?.id ?? ''
      setSelectedTermId(nextTermId)
      if (nextTermId) void loadSelections(nextTermId, currentScoutYear.id)
      else { setSavedItems([]); setSelectedIds([]) }
    } catch (err) {
      if (requestVersion !== loadVersion.current) return
      logError('AdminBestChefs.load', err as any)
      setError(getErrorMessage(err, 'تعذر تحميل بيانات أفضل الـ chefs'))
    } finally {
      if (requestVersion === loadVersion.current) setLoading(false)
    }
  }

  async function loadSelections(termId: string, yearId: string) {
    const requestVersion = ++selectionVersion.current
    try {
      const rows = await listBestChefsForTerm(termId, yearId)
      if (requestVersion !== selectionVersion.current) return
      setSavedItems(rows)
      setSelectedIds(rows.map((item) => item.member_id))
    } catch (err) {
      if (requestVersion !== selectionVersion.current) return
      logError('AdminBestChefs.loadSelections', err as any, { termId })
      setError(getErrorMessage(err, 'تعذر تحميل اختيارات الترم'))
    }
  }

  async function handleSave() {
    if (isReadOnlyView) { toast.error('السنة المؤرشفة للعرض فقط'); return }
    if (!selectedTerm) {
      toast.error('اختر الترم أولًا')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = await saveBestChefsForTerm({ term: selectedTerm, memberIds: selectedIds, actorUserId: user?.id ?? null })
      setSavedItems(next)
      toast.success('تم حفظ أفضل الـ chefs لهذا الترم بنجاح')
    } catch (err) {
      logError('AdminBestChefs.handleSave', err as any, { termId: selectedTerm.id })
      setError(getErrorMessage(err, 'تعذر حفظ اختيارات أفضل الـ chefs'))
    } finally {
      setSaving(false)
    }
  }


  async function handleSetHomeTerm() {
    if (isReadOnlyView) { toast.error('السنة المؤرشفة للعرض فقط'); return }
    if (!selectedTerm) {
      toast.error('اختر الترم أولًا')
      return
    }
    setSettingHome(true)
    setError(null)
    try {
      await setBestChefsHomeTerm({ term: selectedTerm, actorUserId: user?.id ?? null })
      setHomeTermId(selectedTerm.id)
      toast.success(`تم تحديد ${selectedTerm.name} ليظهر في الصفحة الرئيسية حاليًا`)
    } catch (err) {
      logError('AdminBestChefs.handleSetHomeTerm', err as any, { termId: selectedTerm.id })
      setError(getErrorMessage(err, 'تعذر تحديد الترم الذي يظهر في الصفحة الرئيسية'))
    } finally {
      setSettingHome(false)
    }
  }

  function toggle(memberId: string) {
    setSelectedIds((prev) => (prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]))
  }

  const teamOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of candidates) {
      if (!item.team_id) continue
      map.set(item.team_id, item.team_name || 'بدون فريق')
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }, [candidates])

  const filteredCandidates = useMemo(() => {
    let rows = candidates
    if (selectedTeamId) rows = rows.filter((item) => item.team_id === selectedTeamId)

    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((item) => `${item.full_name} ${item.team_name || ''}`.toLowerCase().includes(q))
  }, [candidates, search, selectedTeamId])

  const selectedPreview = useMemo(
    () => selectedIds.map((id) => candidates.find((item) => item.member_id === id)).filter(Boolean) as BestChefCandidate[],
    [selectedIds, candidates]
  )

  if (loading) return <PageLoader visible text="جاري تحميل اختيار أفضل الـ chefs..." />

  if (!isAdmin) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <PageHero eyebrow="⭐ أفضل الـ chefs" title="الصفحة غير متاحة" description="هذه الصفحة متاحة للإدارة فقط لاختيار أفضل الـ chefs لكل ترم." />
        <InlineAlert tone="error" title="لا تملك الصلاحية">هذه الصفحة مخصصة للإدارة فقط.</InlineAlert>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHero
        eyebrow="⭐ أفضل الـ chefs"
        title="اختيار أفضل الـ chefs لكل ترم"
        badge={
          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
            {currentScoutYear?.name || 'السنة الحالية'}
          </span>
        }
        description="اختر من كل الـ chefs الحاليين داخل السنة الحالية، ويمكنك التصفية بالفريق لتسهيل اختيار أفضل الـ chefs لكل فريق، ثم حدّد أي ترم منهم هو الذي يظهر حاليًا في الصفحة الرئيسية لكل الحسابات."
        actions={<LoadingButton onClick={() => void load()} loading={loading}>تحديث</LoadingButton>}
      />

      {error ? <InlineAlert tone="error" title="تعذر تحميل أو حفظ البيانات">{error}</InlineAlert> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="الترمات المتاحة" value={terms.length} accent="indigo" />
        <MetricCard label="كل الـ chefs الحاليين" value={candidates.length} accent="sky" />
        <MetricCard label="الاختيارات الحالية" value={selectedIds.length} accent="emerald" />
        <MetricCard label="المحفوظ فعليًا" value={savedItems.length} accent="amber" />
      </div>

      <SectionCard title="اختيار الترم" description="اختر الترم الذي تريد تحديد أفضل الـ chefs له، ويمكنك جعله هو الترم الظاهر حاليًا في الصفحة الرئيسية.">
        {terms.length ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">الترم</label>
                <select
                  value={selectedTermId}
                  onChange={(e) => setSelectedTermId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500"
                >
                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">من</label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">{selectedTerm?.start_date || '—'}</div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">إلى</label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">{selectedTerm?.end_date || '—'}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="text-sm font-semibold text-amber-900">الترم الظاهر حاليًا في الصفحة الرئيسية:</div>
              <div className="rounded-full bg-white px-3 py-1 text-sm font-bold text-amber-700 shadow-sm">
                {terms.find((term) => term.id === homeTermId)?.name || 'لم يتم تحديد ترم للعرض حتى الآن'}
              </div>
              <LoadingButton onClick={handleSetHomeTerm} loading={settingHome} disabled={isReadOnlyView || !selectedTerm || homeTermId === selectedTerm.id}>
                {homeTermId === selectedTerm?.id ? 'هذا الترم ظاهر الآن' : 'اجعل هذا الترم ظاهرًا في الرئيسية'}
              </LoadingButton>
            </div>
          </div>
        ) : (
          <EmptyState title="لا توجد ترمات" description="أضف ترمات داخل السنة الحالية أولًا من صفحة الترمات والاجتماعات." />
        )}
      </SectionCard>

      <SectionCard
        title="اختيار أفضل الـ chefs"
        description="يمكنك تحديد أكثر من chef، وسيظهرون في الصفحة الرئيسية للجميع داخل قسم خاص بالترم الحالي."
        actions={
          <>
            <LoadingButton variant="outline" disabled={isReadOnlyView} onClick={() => setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredCandidates.map((item) => item.member_id)])))}>تحديد المعروض</LoadingButton>
            <LoadingButton variant="outline" disabled={isReadOnlyView} onClick={() => setSelectedIds((prev) => prev.filter((id) => !filteredCandidates.some((item) => item.member_id === id)))}>إلغاء المعروض</LoadingButton>
            <LoadingButton onClick={handleSave} loading={saving} disabled={isReadOnlyView}>حفظ الاختيارات</LoadingButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-1 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">بحث</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الفريق"
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">فلتر الفريق</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-indigo-500"
              >
                <option value="">كل الفرق</option>
                {teamOptions.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-bold text-slate-800">المختارون حاليًا</div>
              <div className="mt-1 text-xs text-slate-500">يمكنك التصفية حسب الفريق ثم اختيار أفضل الـ chefs لكل فريق.</div>
              <div className="mt-3 space-y-2">
                {selectedPreview.length ? selectedPreview.map((item, index) => (
                  <div key={item.member_id} className="rounded-2xl border border-white bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                    <span className="font-semibold">#{index + 1}</span> {item.full_name} — {item.team_name || 'بدون فريق'}
                  </div>
                )) : <div className="text-sm text-slate-500">لم يتم اختيار أي chef بعد.</div>}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            {filteredCandidates.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredCandidates.map((item) => {
                  const selected = selectedIds.includes(item.member_id)
                  const avatarUrl = resolveAvatarUrl(item.avatar_url)
                  return (
                    <button
                      key={item.member_id}
                      type="button"
                      onClick={() => { if (!isReadOnlyView) toggle(item.member_id) }}
                      disabled={isReadOnlyView}
                      className={`rounded-[24px] border p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}
                    >
                      <div className="flex items-start gap-3">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={item.full_name} className="h-14 w-14 rounded-2xl border border-slate-200 object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-sm font-black text-slate-600">
                            {initials(item.full_name)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate text-sm font-bold text-slate-900">{item.full_name}</div>
                            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${selected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              {selected ? 'مختار' : 'اختر'}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{item.team_name || 'بدون فريق'}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <EmptyState title="لا يوجد chefs مطابقون" description="غيّر البحث أو تأكد أن هناك قادة مفعّلين داخل السنة الحالية." />
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
