import { useCallback, useEffect, useState } from 'react'
import {
  fetchAdminSeasonReferenceData,
  fetchSeasonMembers,
  fetchSeasonRoles,
  type CurrentSeasonMember,
  type CurrentSeasonRole,
  type RankOption,
  type RoleOption,
  type TeamOption,
} from '../features/scoutYears/adminRosterApi'
import { getErrorMessage } from '../lib/errors'

export function useSeasonAdminData(enabled: boolean, scoutYearId?: string | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [ranks, setRanks] = useState<RankOption[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [members, setMembers] = useState<CurrentSeasonMember[]>([])
  const [seasonRoles, setSeasonRoles] = useState<CurrentSeasonRole[]>([])

  const reload = useCallback(async () => {
    if (!enabled) {
      setTeams([])
      setRanks([])
      setRoles([])
      setMembers([])
      setSeasonRoles([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [reference, membersRows, rolesRows] = await Promise.all([
        fetchAdminSeasonReferenceData(),
        scoutYearId ? fetchSeasonMembers(scoutYearId) : Promise.resolve([]),
        scoutYearId ? fetchSeasonRoles(scoutYearId) : Promise.resolve([]),
      ])

      setTeams(reference.teams)
      setRanks(reference.ranks)
      setRoles(reference.roles)
      setMembers(membersRows)
      setSeasonRoles(rolesRows)
    } catch (error) {
      setError(getErrorMessage(error, 'تعذر تحميل بيانات السنة الحالية'))
    } finally {
      setLoading(false)
    }
  }, [enabled, scoutYearId])

  useEffect(() => {
    void reload()
  }, [reload])

  return {
    loading,
    error,
    teams,
    ranks,
    roles,
    members,
    seasonRoles,
    reload,
  }
}
