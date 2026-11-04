import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthProvider'
import { useCurrentScoutYearData } from '../hooks/useReferenceData'
import type { CurrentScoutYear } from '../features/reference/api'
import { listScoutYears, type ScoutYearRow } from '../features/scoutYears/api'
import { setScoutYearViewOverride } from '../lib/supabase'

const STORAGE_KEY = 'scoutsvm:super-admin-year-view'

type ScoutYearContextValue = {
  /** Effective year used by operational pages. For normal users this is always the physical current year. */
  currentScoutYear: CurrentScoutYear | null
  /** The real database year marked is_current=true. */
  actualCurrentScoutYear: CurrentScoutYear | null
  availableYears: ScoutYearRow[]
  viewedScoutYearId: string | null
  isHistoricalView: boolean
  isPlanningView: boolean
  isReadOnlyView: boolean
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  setViewedScoutYearId: (scoutYearId: string | null) => void
  resetViewedScoutYear: () => void
}

const ScoutYearContext = createContext<ScoutYearContextValue>({
  currentScoutYear: null,
  actualCurrentScoutYear: null,
  availableYears: [],
  viewedScoutYearId: null,
  isHistoricalView: false,
  isPlanningView: false,
  isReadOnlyView: false,
  loading: true,
  error: null,
  reload: async () => {},
  setViewedScoutYearId: () => {},
  resetViewedScoutYear: () => {},
})

export function ScoutYearProvider({ children }: { children: React.ReactNode }) {
  const { roles } = useAuth()
  const physical = useCurrentScoutYearData(true)
  const isAdmin = roles.some((role) => role.role_slug === 'admin')
  const [availableYears, setAvailableYears] = useState<ScoutYearRow[]>([])
  const [yearsLoading, setYearsLoading] = useState(false)
  const [yearsError, setYearsError] = useState<string | null>(null)
  const [viewedScoutYearId, setViewedScoutYearIdState] = useState<string | null>(null)

  const loadYears = useCallback(async () => {
    if (!isAdmin) {
      setAvailableYears([])
      setYearsError(null)
      setYearsLoading(false)
      return
    }

    setYearsLoading(true)
    setYearsError(null)
    try {
      setAvailableYears(await listScoutYears())
    } catch (error: any) {
      setAvailableYears([])
      setYearsError(error?.message || 'تعذر تحميل السنوات الكشفية')
    } finally {
      setYearsLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void loadYears()
  }, [loadYears])

  const setViewedScoutYearId = useCallback((scoutYearId: string | null) => {
    if (!isAdmin) return

    const normalized = scoutYearId && scoutYearId !== physical.data?.id ? scoutYearId : null
    const selectedYear = normalized ? availableYears.find((year) => year.id === normalized) ?? null : null
    const readOnly = Boolean(selectedYear && selectedYear.status !== 'draft')

    setScoutYearViewOverride(normalized, { readOnly })
    setViewedScoutYearIdState(normalized)

    try {
      if (normalized) sessionStorage.setItem(STORAGE_KEY, normalized)
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {}
  }, [isAdmin, physical.data?.id, availableYears])

  const resetViewedScoutYear = useCallback(() => {
    setScoutYearViewOverride(null, { readOnly: false })
    setViewedScoutYearIdState(null)
    try { sessionStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      resetViewedScoutYear()
      return
    }
    if (!physical.data?.id || !availableYears.length) return

    let stored = ''
    try { stored = sessionStorage.getItem(STORAGE_KEY) || '' } catch {}
    if (!stored || stored === physical.data.id) {
      resetViewedScoutYear()
      return
    }

    const storedYear = availableYears.find((year) => year.id === stored) ?? null
    if (storedYear) {
      setScoutYearViewOverride(stored, { readOnly: storedYear.status !== 'draft' })
      setViewedScoutYearIdState(stored)
    } else {
      resetViewedScoutYear()
    }
  }, [isAdmin, physical.data?.id, availableYears, resetViewedScoutYear])

  const viewedYear = useMemo(
    () => viewedScoutYearId ? availableYears.find((year) => year.id === viewedScoutYearId) ?? null : null,
    [availableYears, viewedScoutYearId]
  )

  const currentScoutYear = (isAdmin && viewedYear ? viewedYear : physical.data) as CurrentScoutYear | null
  const isPlanningView = Boolean(
    isAdmin && viewedYear && physical.data && viewedYear.id !== physical.data.id && viewedYear.status === 'draft'
  )
  const isReadOnlyView = Boolean(
    isAdmin && viewedYear && physical.data && viewedYear.id !== physical.data.id && viewedYear.status !== 'draft'
  )
  const isHistoricalView = isReadOnlyView

  const reload = useCallback(async () => {
    await Promise.all([physical.reload(), loadYears()])
  }, [physical.reload, loadYears])

  const value = useMemo(
    () => ({
      currentScoutYear,
      actualCurrentScoutYear: physical.data,
      availableYears,
      viewedScoutYearId,
      isHistoricalView,
      isPlanningView,
      isReadOnlyView,
      loading: physical.loading || (isAdmin && yearsLoading),
      error: physical.error || yearsError,
      reload,
      setViewedScoutYearId,
      resetViewedScoutYear,
    }),
    [
      currentScoutYear,
      physical.data,
      availableYears,
      viewedScoutYearId,
      isHistoricalView,
      isPlanningView,
      isReadOnlyView,
      physical.loading,
      isAdmin,
      yearsLoading,
      physical.error,
      yearsError,
      reload,
      setViewedScoutYearId,
      resetViewedScoutYear,
    ]
  )

  return <ScoutYearContext.Provider value={value}>{children}</ScoutYearContext.Provider>
}

export function useScoutYear() {
  return useContext(ScoutYearContext)
}
