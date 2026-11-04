import { useCallback, useEffect, useState } from 'react'
import {
  fetchPhysicalCurrentScoutYear,
  fetchCurrentUserContext,
  fetchTeamById,
  fetchTeams,
  fetchTerms,
  type CurrentScoutYear,
  type CurrentUserContext,
  type TeamOption,
  type TermOption,
} from '../features/reference/api'
import { getErrorMessage, logError } from '../lib/errors'

type AsyncState<T> = {
  data: T
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export function useTeamsData(enabled = true): AsyncState<TeamOption[]> {
  const [data, setData] = useState<TeamOption[]>([])
  const [loading, setLoading] = useState(Boolean(enabled))
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setData([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await fetchTeams())
    } catch (error) {
      logError('useTeamsData', error as any)
      setError(getErrorMessage(error as any, 'تعذر تحميل الفرق'))
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}

export function useTermsData(enabled = true): AsyncState<TermOption[]> {
  const [data, setData] = useState<TermOption[]>([])
  const [loading, setLoading] = useState(Boolean(enabled))
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setData([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await fetchTerms())
    } catch (error) {
      logError('useTermsData', error as any)
      setError(getErrorMessage(error as any, 'تعذر تحميل الترمات'))
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}



export function useCurrentScoutYearData(enabled = true): AsyncState<CurrentScoutYear | null> {
  const [data, setData] = useState<CurrentScoutYear | null>(null)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await fetchPhysicalCurrentScoutYear())
    } catch (error) {
      logError('useCurrentScoutYearData', error as any)
      setError(getErrorMessage(error as any, 'تعذر تحميل السنة الكشفية الحالية'))
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
export function useCurrentUserContext(enabled = true): AsyncState<CurrentUserContext | null> {
  const [data, setData] = useState<CurrentUserContext | null>(null)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!enabled) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setData(await fetchCurrentUserContext())
    } catch (error) {
      logError('useCurrentUserContext', error as any)
      setError(getErrorMessage(error as any, 'تعذر تحميل بيانات المستخدم'))
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}

export function useTeamName(teamId?: string | null): AsyncState<string> {
  const [data, setData] = useState('')
  const [loading, setLoading] = useState(Boolean(teamId))
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!teamId) {
      setData('')
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const team = await fetchTeamById(teamId)
      setData(team?.name || '')
    } catch (error) {
      logError('useTeamName', error as any, { teamId })
      setError(getErrorMessage(error as any, 'تعذر تحميل اسم الفريق'))
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, error, reload }
}
