import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { safeWriteAuditLog } from '../features/audit/api'
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
import { useSeasonAdminData } from '../hooks/useSeasonAdminData'
import { listScoutYears, type ScoutYearRow } from '../features/scoutYears/api'
import {
  addCurrentSeasonRole,
  removeCurrentSeasonRole,
  upsertCurrentSeasonMemberAssignment,
  type CurrentSeasonMember,
  type CurrentSeasonRole,
} from '../features/scoutYears/adminRosterApi'

type AuthUser = { id: string; email: string; created_at?: string | null }

type RoleScopeChoice = {
  slug: string
  label: string
  allowGlobal: boolean
  allowTeam: boolean
}

const ROLE_CHOICES: RoleScopeChoice[] = [
  { slug: 'admin', label: 'Admin (Chef de mouvement)', allowGlobal: true, allowTeam: false },
  { slug: 'chef_de_legion', label: 'Chef de legion', allowGlobal: true, allowTeam: true },
  { slug: 'responsable_finance', label: 'Responsable Finance', allowGlobal: true, allowTeam: true },
  { slug: 'responsable_materials', label: 'Responsable Materials', allowGlobal: true, allowTeam: true },
  { slug: 'responsable_secretary', label: 'Responsable Secretary', allowGlobal: true, allowTeam: true },
  { slug: 'responsable_media', label: 'Responsable Media', allowGlobal: true, allowTeam: true },
  { slug: 'normal_chef', label: 'Normal Chef', allowGlobal: true, allowTeam: true },
  { slug: 'equipier', label: 'Equipier', allowGlobal: false, allowTeam: false },
]

function roleScopeText(role: CurrentSeasonRole) {
  return role.team_name ? `على ${role.team_name}` : 'عام'
}

export default function AdminMembers() {
  const { roles, user } = useAuth()
  const { currentScoutYear, actualCurrentScoutYear, availableYears: globalYears, setViewedScoutYearId } = useScoutYear()
  const isAdmin = roles.some((r) => r.role_slug === 'admin')
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [availableYears, setAvailableYears] = useState<ScoutYearRow[]>([])
  // The header Scout Year selector is authoritative across all pages.
  // Preserve old ?year=<id> deep links (e.g. rollover setup) by applying the
  // requested year globally and then removing the stale per-page override.
  useEffect(() => {
    const requested = searchParams.get('year')
    if (!requested || !globalYears.some((year) => year.id === requested)) return
    if (requested !== currentScoutYear?.id) setViewedScoutYearId(requested)
    const next = new URLSearchParams(searchParams)
    next.delete('year')
    setSearchParams(next, { replace: true })
  }, [searchParams, globalYears, currentScoutYear?.id, setViewedScoutYearId, setSearchParams])
  const selectedYearId = currentScoutYear?.id || '' 
  const selectedYear = useMemo(
    () => availableYears.find((year) => year.id === selectedYearId) || (currentScoutYear?.id === selectedYearId ? currentScoutYear : null),
    [availableYears, currentScoutYear, selectedYearId]
  )
  const isSelectedCurrentYear = Boolean(selectedYearId && actualCurrentScoutYear?.id === selectedYearId)
  const canEditSelectedYear = Boolean(isSelectedCurrentYear || selectedYear?.status === 'draft')

  const { loading, error, teams, ranks, roles: roleCatalog, members, seasonRoles, reload } = useSeasonAdminData(isAdmin && Boolean(selectedYearId), selectedYearId)

  const [tab, setTab] = useState<'chef' | 'equipier'>('chef')

  const [chefFullName, setChefFullName] = useState('')
  const [chefPhone, setChefPhone] = useState('')
  const [chefTeamId, setChefTeamId] = useState('')
  const [chefRankId, setChefRankId] = useState<number | ''>('')
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<AuthUser[]>([])
  const [unlinkedAuthUsers, setUnlinkedAuthUsers] = useState<AuthUser[]>([])
  const [unlinkedSearch, setUnlinkedSearch] = useState('')
  const [loadingUnlinked, setLoadingUnlinked] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null)
  const [chefAvatar, setChefAvatar] = useState<File | null>(null)
  const [selectedGlobal, setSelectedGlobal] = useState<string[]>([])
  const [selectedTeamRoles, setSelectedTeamRoles] = useState<string[]>([])
  const [savingChef, setSavingChef] = useState(false)
  const [searching, setSearching] = useState(false)

  const [eqFullName, setEqFullName] = useState('')
  const [eqTeamId, setEqTeamId] = useState('')
  const [eqGuardianName, setEqGuardianName] = useState('')
  const [eqGuardianPhone, setEqGuardianPhone] = useState('')
  const [eqBirthDate, setEqBirthDate] = useState('')
  const [savingEq, setSavingEq] = useState(false)

  const [manageSearch, setManageSearch] = useState('')
  const [manageTeamFilter, setManageTeamFilter] = useState('')
  const [manageStatusFilter, setManageStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [manageTypeFilter, setManageTypeFilter] = useState<'all' | 'chef' | 'equipier'>('all')
  const [manageSetupFilter, setManageSetupFilter] = useState<'all' | 'configured' | 'needs_setup'>('all')
  const [selectedManagedMemberId, setSelectedManagedMemberId] = useState('')
  const [seasonTeamId, setSeasonTeamId] = useState('')
  const [seasonRankId, setSeasonRankId] = useState<number | ''>('')
  const [seasonIsEquipier, setSeasonIsEquipier] = useState(false)
  const [seasonIsActive, setSeasonIsActive] = useState(true)
  const [savingSeasonMember, setSavingSeasonMember] = useState(false)
  const [roleActionBusy, setRoleActionBusy] = useState(false)
  const [newRoleId, setNewRoleId] = useState<number | ''>('')
  const [newRoleScope, setNewRoleScope] = useState<'global' | 'team'>('global')
  const [newRoleTeamId, setNewRoleTeamId] = useState('')

  const AVATARS_BUCKET = 'avatars'

  useEffect(() => {
    if (!isAdmin) return
    void listScoutYears()
      .then(setAvailableYears)
      .catch(() => setAvailableYears([]))
  }, [isAdmin])

  useEffect(() => {
    setSelectedManagedMemberId('')
    setManageSearch('')
    setManageTeamFilter('')
    setManageStatusFilter('all')
    setManageTypeFilter('all')
    setManageSetupFilter('all')
  }, [selectedYearId])

  useEffect(() => {
    if (!eqTeamId && teams.length) setEqTeamId(teams[0].id)
    if (!newRoleTeamId && teams.length) setNewRoleTeamId(teams[0].id)
  }, [teams, eqTeamId, newRoleTeamId])

  async function uploadAvatarOrWarn(file: File, teamId: string | null | undefined, memberId: string, toastApi?: any) {
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${teamId || 'unassigned'}/${memberId}-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      })

      if (upErr) {
        if (/bucket not found/i.test(upErr.message)) {
          toastApi?.error?.('Bucket باسم "avatars" غير موجود في Storage — أنشئه ثم أعد المحاولة.')
          return null
        }
        throw upErr
      }
      const { data: pub } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
      return pub?.publicUrl as string
    } catch (e: any) {
      toastApi?.error?.(e.message || 'تعذر رفع الصورة')
      return null
    }
  }

  async function loadUnlinkedAuthUsers(query = unlinkedSearch) {
    if (!isAdmin) return
    setLoadingUnlinked(true)
    try {
      const normalizedQuery = query.trim()
      let data: any = null
      let error: any = null

      const searchResult = await supabase.rpc('admin_search_unlinked_auth_accounts', {
        p_query: normalizedQuery,
        p_limit: 50,
      }) as any

      if (searchResult.error) {
        const message = String(searchResult.error.message || '')
        const canFallback = searchResult.error.code === 'PGRST202' || message.includes('admin_search_unlinked_auth_accounts') || message.includes('schema cache')
        if (!canFallback) throw searchResult.error

        const fallback = await supabase.rpc('admin_list_unlinked_auth_accounts', { p_limit: 100 }) as any
        data = fallback.data
        error = fallback.error
      } else {
        data = searchResult.data
      }

      if (error) {
        const message = String(error.message || '')
        if (error.code === 'PGRST202' || message.includes('admin_list_unlinked_auth_accounts') || message.includes('schema cache')) {
          setUnlinkedAuthUsers([])
          return
        }
        throw error
      }

      const rows = ((data || []) as any[]).map((row) => ({
        id: String(row.user_id),
        email: String(row.email || ''),
        created_at: row.created_at || null,
      }))

      const filtered = normalizedQuery
        ? rows.filter((row) => row.email.toLowerCase().includes(normalizedQuery.toLowerCase()))
        : rows
      setUnlinkedAuthUsers(filtered.slice(0, 50))
    } catch {
      setUnlinkedAuthUsers([])
    } finally {
      setLoadingUnlinked(false)
    }
  }


  useEffect(() => {
    void loadUnlinkedAuthUsers('')
  }, [isAdmin])

  useEffect(() => {
    const h = window.setTimeout(() => {
      void loadUnlinkedAuthUsers(unlinkedSearch)
    }, 280)
    return () => window.clearTimeout(h)
  }, [unlinkedSearch, isAdmin])

  useEffect(() => {
    const h = setTimeout(async () => {
      setSelectedUser(null)
      if (!userSearch || userSearch.length < 2) {
        setUserResults([])
        return
      }
      setSearching(true)
      try {
        const { data, error } = await supabase.rpc('search_auth_users', { q: userSearch })
        if (error) throw error
        const rows = (data as any[] | null) ?? []
        setUserResults(rows as AuthUser[])
        if (rows.length === 1) setSelectedUser(rows[0] as AuthUser)
      } catch (e: any) {
        toast.error(e.message || 'تعذر البحث')
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(h)
  }, [userSearch, toast])

  const activeRoleCountByUser = useMemo(() => {
    const map = new Map<string, number>()
    seasonRoles.forEach((role) => {
      map.set(role.user_id, (map.get(role.user_id) || 0) + 1)
    })
    return map
  }, [seasonRoles])

  const setupByMemberId = useMemo(() => {
    const map = new Map<string, { configured: boolean; needsSetup: boolean; activeRolesCount: number; missing: string[] }>()
    members.forEach((member) => {
      const activeRolesCount = member.auth_user_id ? (activeRoleCountByUser.get(member.auth_user_id) || 0) : 0
      const missing: string[] = []
      if (!member.is_equipier && !member.auth_user_id) missing.push('account')
      const configured = Boolean(member.is_active && missing.length === 0)
      const needsSetup = Boolean(member.is_active && missing.length > 0)
      map.set(member.id, { configured, needsSetup, activeRolesCount, missing })
    })
    return map
  }, [members, activeRoleCountByUser])

  const setupSummary = useMemo(() => {
    let configured = 0
    let needsSetup = 0
    let inactive = 0
    members.forEach((member) => {
      const setup = setupByMemberId.get(member.id)
      if (!member.is_active) inactive += 1
      else if (setup?.configured) configured += 1
      else if (setup?.needsSetup) needsSetup += 1
    })
    return { configured, needsSetup, inactive }
  }, [members, setupByMemberId])

  const seasonAccountMembers = useMemo(
    () => members.filter((member) => Boolean(member.auth_user_id) && !member.is_equipier),
    [members]
  )

  const seasonAccountSetupSummary = useMemo(() => {
    let configured = 0
    let needsSetup = 0
    seasonAccountMembers.forEach((member) => {
      const setup = setupByMemberId.get(member.id)
      if (setup?.configured) configured += 1
      else if (setup?.needsSetup) needsSetup += 1
    })
    return { configured, needsSetup }
  }, [seasonAccountMembers, setupByMemberId])

  function openMemberReview(memberId?: string) {
    setManageSearch('')
    setManageTeamFilter('')
    setManageStatusFilter('all')
    setManageTypeFilter('all')
    setManageSetupFilter('all')
    if (memberId) setSelectedManagedMemberId(memberId)
    window.setTimeout(() => {
      document.querySelector('.members98-manage-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }

  const managedMembers = useMemo(() => {
    return members.filter((member) => {
      if (manageTeamFilter && member.team_id !== manageTeamFilter) return false
      if (manageStatusFilter === 'active' && !member.is_active) return false
      if (manageStatusFilter === 'inactive' && member.is_active) return false
      if (manageTypeFilter === 'chef' && member.is_equipier) return false
      if (manageTypeFilter === 'equipier' && !member.is_equipier) return false
      const setup = setupByMemberId.get(member.id)
      if (manageSetupFilter === 'configured' && !setup?.configured) return false
      if (manageSetupFilter === 'needs_setup' && !setup?.needsSetup) return false
      const q = manageSearch.trim().toLowerCase()
      if (q) {
        const hay = `${member.full_name} ${member.team_name ?? ''} ${member.rank_label ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [members, manageSearch, manageStatusFilter, manageTeamFilter, manageTypeFilter, manageSetupFilter, setupByMemberId])


  const roleMetaBySlug = useMemo(
    () => new Map(ROLE_CHOICES.map((choice) => [choice.slug, choice])),
    []
  )

  const roleCatalogOptions = useMemo(
    () => roleCatalog.filter((role) => role.role_slug !== 'equipier'),
    [roleCatalog]
  )

  const roleCatalogById = useMemo(() => new Map(roleCatalog.map((role) => [role.id, role])), [roleCatalog])
  const roleCatalogBySlug = useMemo(() => new Map(roleCatalog.map((role) => [role.role_slug, role])), [roleCatalog])

  const selectedManagedMember = useMemo(
    () => managedMembers.find((member) => member.id === selectedManagedMemberId) || members.find((member) => member.id === selectedManagedMemberId) || null,
    [managedMembers, members, selectedManagedMemberId]
  )

  const selectedManagedRoles = useMemo(() => {
    if (!selectedManagedMember?.auth_user_id) return [] as CurrentSeasonRole[]
    return seasonRoles.filter((role) => role.user_id === selectedManagedMember.auth_user_id)
  }, [seasonRoles, selectedManagedMember])

  useEffect(() => {
    if (!selectedManagedMember) {
      setSeasonTeamId('')
      setSeasonRankId('')
      setSeasonIsEquipier(false)
      setSeasonIsActive(true)
      return
    }
    setSeasonTeamId(selectedManagedMember.team_id || '')
    setSeasonRankId(selectedManagedMember.rank_id ?? '')
    setSeasonIsEquipier(Boolean(selectedManagedMember.is_equipier))
    setSeasonIsActive(Boolean(selectedManagedMember.is_active))
    setNewRoleScope('global')
    setNewRoleId('')
    setNewRoleTeamId(selectedManagedMember.team_id || teams[0]?.id || '')
  }, [selectedManagedMember, teams])

  function toggleGlobal(slug: string) {
    setSelectedGlobal((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }
  function toggleTeam(slug: string) {
    setSelectedTeamRoles((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  function ensureSelectedYearEditable() {
    if (canEditSelectedYear) return true
    toast.error('هذه السنة للقراءة فقط. التعديل مسموح فقط على السنة الحالية أو سنة Draft قيد التجهيز.')
    return false
  }

  async function saveChef() {
    if (!isAdmin) return toast.error('أذونات غير كافية')
    if (!selectedYearId) return toast.error('اختر السنة الكشفية أولًا')
    if (!ensureSelectedYearEditable()) return
    if (!chefFullName.trim()) return toast.error('أدخل الاسم')
    if (!selectedUser) return toast.error('اختر مستخدم (Auth user)')
    if (selectedTeamRoles.length && !chefTeamId) return toast.error('اختر فريقًا فقط للأدوار المرتبطة بفريق، أو ألغِ اختيار Team Role')

    setSavingChef(true)
    try {
      const { data: existing, error: exErr } = await supabase
        .from('members')
        .select('id, full_name, team_id, rank_id, is_equipier')
        .eq('auth_user_id', selectedUser.id)
        .maybeSingle()
      if (exErr) throw exErr

      let memberId: string | null = null
      if (existing?.id) {
        const masterPatch: Record<string, unknown> = {
          full_name: chefFullName.trim(),
          personal_phone: chefPhone || null,
        }
        if (isSelectedCurrentYear) {
          masterPatch.team_id = chefTeamId || null
          masterPatch.rank_id = chefRankId === '' ? null : chefRankId
          masterPatch.is_equipier = false
        }
        const { error: upErr } = await supabase.from('members').update(masterPatch).eq('id', existing.id)
        if (upErr) throw upErr
        memberId = existing.id
      } else {
        const { data: ins, error: em } = await supabase
          .from('members')
          .insert({
            full_name: chefFullName.trim(),
            team_id: chefTeamId || null,
            rank_id: chefRankId === '' ? null : chefRankId,
            personal_phone: chefPhone || null,
            auth_user_id: selectedUser.id,
            is_equipier: false,
          })
          .select('id')
          .single()
        if (em) throw em
        memberId = ins?.id ?? null
      }

      if (!memberId) throw new Error('تعذر تحديد ملف العضو المرتبط بالأكونت')

      await upsertCurrentSeasonMemberAssignment({
        scoutYearId: selectedYearId,
        memberId,
        teamId: chefTeamId || null,
        rankId: chefRankId === '' ? null : Number(chefRankId),
        isEquipier: false,
        isActive: true,
        syncLegacy: isSelectedCurrentYear,
      })

      if (chefAvatar) await uploadAvatarOrWarn(chefAvatar, chefTeamId || null, memberId, toast)

      const requestedRoles: Array<{ roleId: number; teamId: string | null }> = []
      ROLE_CHOICES.forEach((choice) => {
        if (choice.slug === 'equipier') return
        const role = roleCatalogBySlug.get(choice.slug)
        if (!role) return
        if (selectedGlobal.includes(choice.slug)) requestedRoles.push({ roleId: role.id, teamId: null })
        if (selectedTeamRoles.includes(choice.slug) && chefTeamId) requestedRoles.push({ roleId: role.id, teamId: chefTeamId })
      })

      for (const role of requestedRoles) {
        await addCurrentSeasonRole({
          scoutYearId: selectedYearId,
          userId: selectedUser.id,
          roleId: role.roleId,
          teamId: role.teamId,
          createdBy: user?.id ?? null,
          syncLegacy: isSelectedCurrentYear,
        })
      }

      void safeWriteAuditLog({
        action: existing ? 'update_member' : 'create_member',
        module: 'members',
        entityType: 'member',
        entityId: memberId,
        entityDisplay: chefFullName.trim(),
        summary: `${existing ? 'حدّث' : 'أنشأ'} ملف قائد داخل ${selectedYear?.name || 'السنة المختارة'}: ${chefFullName.trim()}`,
        severity: 'warning',
        source: 'AdminMembers',
        scoutYearId: selectedYearId,
        teamId: chefTeamId || null,
        targetMemberId: memberId,
        delta: { after: { full_name: chefFullName.trim(), team_id: chefTeamId || null, rank_id: chefRankId === '' ? null : chefRankId, is_equipier: false, auth_user_id: selectedUser.id } },
      })

      toast.success(existing ? 'تم ربط الأكونت بالسنة المختارة وتحديث بياناته' : 'تم إضافة الأكونت للسنة المختارة')
      setChefFullName(''); setChefPhone(''); setUserSearch(''); setUserResults([]); setSelectedUser(null)
      setSelectedGlobal([]); setSelectedTeamRoles([]); setChefAvatar(null)
      await Promise.all([reload(), loadUnlinkedAuthUsers(unlinkedSearch)])
    } catch (e: any) {
      toast.error(e.message || 'تعذر الحفظ')
    } finally {
      setSavingChef(false)
    }
  }

  async function saveEquipier() {
    if (!isAdmin) return toast.error('أذونات غير كافية')
    if (!selectedYearId) return toast.error('اختر السنة الكشفية أولًا')
    if (!ensureSelectedYearEditable()) return
    if (!eqFullName.trim()) return toast.error('أدخل الاسم')
    if (!eqTeamId) return toast.error('اختر الفريق')

    setSavingEq(true)
    try {
      const payload = {
        full_name: eqFullName.trim(),
        team_id: eqTeamId,
        is_equipier: true,
        guardian_name: eqGuardianName || null,
        guardian_phone: eqGuardianPhone || null,
        birth_date: eqBirthDate || null,
      }
      const { data: inserted, error } = await supabase.from('members').insert(payload).select('id').single()
      if (error) throw error
      if (!inserted?.id) throw new Error('تعذر إنشاء ملف الـEquipier')

      await upsertCurrentSeasonMemberAssignment({
        scoutYearId: selectedYearId,
        memberId: inserted.id,
        teamId: eqTeamId,
        rankId: null,
        isEquipier: true,
        isActive: true,
        syncLegacy: isSelectedCurrentYear,
      })

      void safeWriteAuditLog({
        action: 'create_member',
        module: 'members',
        entityType: 'member',
        entityId: inserted?.id ?? null,
        entityDisplay: eqFullName.trim(),
        summary: `أنشأ Equipier جديد: ${eqFullName.trim()}` ,
        severity: 'info',
        source: 'AdminMembers',
        scoutYearId: selectedYearId || null,
        teamId: eqTeamId,
        targetMemberId: inserted?.id ?? null,
        delta: { after: payload },
      })

      toast.success('تم إضافة الـ Equipier')
      setEqFullName('')
      setEqGuardianName('')
      setEqGuardianPhone('')
      setEqBirthDate('')
      await reload()
    } catch (e: any) {
      toast.error(e.message || 'تعذر الإضافة')
    } finally {
      setSavingEq(false)
    }
  }

  async function saveSeasonMemberState() {
    if (!selectedManagedMember) return toast.error('اختر عضوًا أولًا')
    if (!selectedYearId) return toast.error('اختر السنة الكشفية أولًا')
    if (!ensureSelectedYearEditable()) return

    setSavingSeasonMember(true)
    try {
      await upsertCurrentSeasonMemberAssignment({
        scoutYearId: selectedYearId,
        memberId: selectedManagedMember.id,
        teamId: seasonTeamId || null,
        rankId: seasonRankId === '' ? null : Number(seasonRankId),
        isEquipier: seasonIsEquipier,
        isActive: seasonIsActive,
        seasonNotes: selectedManagedMember.season_notes,
        syncLegacy: isSelectedCurrentYear,
      })
      toast.success('تم حفظ بيانات العضو داخل السنة المختارة')
      await reload()
    } catch (e: any) {
      toast.error(e.message || 'تعذر حفظ بيانات السنة المختارة')
    } finally {
      setSavingSeasonMember(false)
    }
  }

  async function handleAddRole() {
    if (!selectedManagedMember?.auth_user_id) return toast.error('هذا العضو غير مرتبط بحساب مستخدم')
    if (!selectedYearId) return toast.error('اختر السنة الكشفية أولًا')
    if (!ensureSelectedYearEditable()) return
    if (newRoleId === '') return toast.error('اختر الدور')

    const role = roleCatalogById.get(Number(newRoleId))
    const meta = role ? roleMetaBySlug.get(role.role_slug) : undefined
    const effectiveScope: 'global' | 'team' = meta?.allowTeam ? newRoleScope : 'global'
    const targetTeamId = effectiveScope === 'team' ? (newRoleTeamId || selectedManagedMember.team_id || null) : null

    if (effectiveScope === 'team' && !targetTeamId) return toast.error('اختر الفريق الذي سيتم ربط الدور به')

    setRoleActionBusy(true)
    try {
      await addCurrentSeasonRole({
        scoutYearId: selectedYearId,
        userId: selectedManagedMember.auth_user_id,
        roleId: Number(newRoleId),
        teamId: targetTeamId,
        createdBy: user?.id ?? null,
        syncLegacy: isSelectedCurrentYear,
      })
      toast.success('تمت إضافة الدور داخل السنة المختارة')
      setNewRoleId('')
      setNewRoleScope('global')
      await reload()
    } catch (e: any) {
      toast.error(e.message || 'تعذر إضافة الدور')
    } finally {
      setRoleActionBusy(false)
    }
  }

  async function handleRemoveRole(role: CurrentSeasonRole) {
    if (!selectedYearId) return toast.error('اختر السنة الكشفية أولًا')
    if (!ensureSelectedYearEditable()) return
    if (!selectedManagedMember?.auth_user_id) return toast.error('هذا العضو غير مرتبط بحساب مستخدم')
    if (!window.confirm(`حذف الدور ${role.role_label || role.role_slug} من ${selectedManagedMember.full_name}؟`)) return

    setRoleActionBusy(true)
    try {
      await removeCurrentSeasonRole({
        scoutYearId: selectedYearId,
        userId: selectedManagedMember.auth_user_id,
        roleId: role.role_id,
        teamId: role.team_id,
        syncLegacy: isSelectedCurrentYear,
      })
      toast.success('تم حذف الدور من السنة المختارة')
      await reload()
    } catch (e: any) {
      toast.error(e.message || 'تعذر حذف الدور')
    } finally {
      setRoleActionBusy(false)
    }
  }

  if (!isAdmin) return <div className="p-6">هذه الصفحة مخصصة للأدمن فقط.</div>

  const selectedRoleMeta = newRoleId === '' ? null : roleMetaBySlug.get(roleCatalogById.get(Number(newRoleId))?.role_slug || '')
  const canUseTeamScope = Boolean(selectedRoleMeta?.allowTeam)

  return (
    <div className="members98-page space-y-6 p-4 md:p-6">
      <PageLoader visible={loading} text="جاري تحميل بيانات الأعضاء والأدوار..." />

      <PageHero
        className="members98-hero"
        eyebrow="🧭 إدارة الأكونتات حسب السنة"
        title="الأعضاء والأدوار بشكل أوضح وأسهل"
        badge={
          <span className="members98-year-badge inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold shadow-sm">
            {selectedYear?.name || currentScoutYear?.name || 'لا توجد سنة مختارة'}
          </span>
        }
        description="اختار السنة الكشفية ثم أدِر الأشخاص المرتبطين بها. نفس Auth account يقدر يستمر من سنة لسنة، بينما Team / Rank / Roles تتحدد بشكل مستقل لكل سنة."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/app/admin-scout-years" className="members98-hero-link rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-sm">
              إدارة السنة الكشفية
            </Link>
            <Link to="/app/admin" className="members98-hero-link rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-sm">
              العودة للإدارة
            </Link>
          </div>
        }
      />

      {error && <InlineAlert tone="error" title="تعذر تحميل بعض البيانات">{error}</InlineAlert>}

      <SectionCard title="السنة التي تديرها الآن" description="تقدر تجهز السنة الجديدة وهي Draft قبل ما تجعلها السنة المختارة. تعديل سنة غير حالية لا يغير Team/Rank/Roles الخاصة بالسنة المختارة.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,320px)_1fr] md:items-center">
          <select
            value={selectedYearId}
            onChange={(e) => setViewedScoutYearId(e.target.value || null)}
            className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-800 outline-none"
          >
            {availableYears.map((year) => (
              <option key={year.id} value={year.id}>{year.name}{year.is_current ? ' — الحالية' : ''}</option>
            ))}
          </select>
          <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
            isSelectedCurrentYear
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : selectedYear?.status === 'draft'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}>
            {isSelectedCurrentYear
              ? 'أنت تدير السنة الحالية. أي تعديل موسمي سيتزامن مع الجداول القديمة عند الحاجة.'
              : selectedYear?.status === 'draft'
                ? `وضع تجهيز ${selectedYear?.name || 'السنة الجديدة'}: يمكنك تعديل Team / Rank / Roles لهذه السنة قبل تفعيلها.`
                : `عرض ${selectedYear?.name || 'سنة سابقة'} للقراءة فقط. لا يمكن تعديل Team / Rank / Roles فيها.`}
          </div>
        </div>
      </SectionCard>

      <div className="members98-metrics grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="أعضاء السنة المختارة" value={members.length} hint="إجمالي الأعضاء المرتبطين بالسنة المختارة" accent="navy" />
        <MetricCard label="النشطون" value={members.filter((m) => m.is_active).length} hint="ظاهرون في التشغيل اليومي" accent="gold" />
        <MetricCard label="Chefs" value={members.filter((m) => !m.is_equipier).length} hint="القادة داخل السنة المختارة" accent="orange" />
        <MetricCard label="Equipiers" value={members.filter((m) => m.is_equipier).length} hint="الأعضاء المسجلون كـ Equipier" accent="sky" />
      </div>

      <SectionCard
        className="members111-transferred-accounts"
        title={`أكونتات ${selectedYear?.name || 'السنة المختارة'}`}
        description="هنا تظهر الأكونتات المرتبطة بأعضاء وتم نقلها أو إضافتها لهذه السنة. اختَر أي شخص لمراجعة Team / Rank / Roles الخاصة به."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <label className="mb-1 block text-sm font-bold text-slate-700">اختيار شخص من أكونتات السنة</label>
            <select
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 font-semibold text-slate-800 outline-none"
              value={selectedManagedMemberId}
              onChange={(e) => {
                const memberId = e.target.value
                setSelectedManagedMemberId(memberId)
                if (memberId) openMemberReview(memberId)
              }}
            >
              <option value="">— اختر شخصًا لمراجعة بيانات السنة —</option>
              {seasonAccountMembers.map((member) => {
                const setup = setupByMemberId.get(member.id)
                return (
                  <option key={member.id} value={member.id}>
                    {member.full_name} — {setup?.configured ? 'تم الإعداد' : setup?.needsSetup ? 'يحتاج إعداد' : 'غير نشط'}
                  </option>
                )
              })}
            </select>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => { setManageSetupFilter('needs_setup'); setManageStatusFilter('active'); window.setTimeout(() => document.querySelector('.members98-manage-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }}
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800"
            >
              يحتاج إعداد: {seasonAccountSetupSummary.needsSetup}
            </button>
            <button
              type="button"
              onClick={() => { setManageSetupFilter('configured'); setManageStatusFilter('active'); window.setTimeout(() => document.querySelector('.members98-manage-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0) }}
              className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800"
            >
              تم الإعداد: {seasonAccountSetupSummary.configured}
            </button>
          </div>
        </div>

        {seasonAccountMembers.length === 0 ? (
          <InlineAlert tone="warning" title="لا توجد أكونتات مرتبطة بهذه السنة حتى الآن">
            لو كنت اخترت أشخاصًا في شاشة نقل السنة، ارجع إلى إدارة السنة وتأكد أنك ضغطت «اعتماد نهائي» بعد المراجعة. الأكونتات الجديدة فقط تظهر في قسم Unassigned بالأسفل.
          </InlineAlert>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-700">إجمالي الأكونتات: {seasonAccountMembers.length}</span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-bold text-amber-800">يحتاج إعداد: {seasonAccountSetupSummary.needsSetup}</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-bold text-emerald-800">تم الإعداد: {seasonAccountSetupSummary.configured}</span>
          </div>
        )}
      </SectionCard>

      <div className="members98-add-tabs" role="tablist" aria-label="نوع العضو الجديد">
        <button
          className={`members98-tab ${tab === 'chef' ? 'is-active' : ''}`}
          onClick={() => setTab('chef')}
          role="tab"
          aria-selected={tab === 'chef'}
        >
          <span className="members98-tab-icon" aria-hidden="true">⚜️</span>
          <span><strong>إضافة قائد</strong><small>Chef</small></span>
        </button>
        <button
          className={`members98-tab ${tab === 'equipier' ? 'is-active' : ''}`}
          onClick={() => setTab('equipier')}
          role="tab"
          aria-selected={tab === 'equipier'}
        >
          <span className="members98-tab-icon" aria-hidden="true">👥</span>
          <span><strong>إضافة Equipier</strong><small>عضو جديد</small></span>
        </button>
      </div>

      {tab === 'chef' && (
        <SectionCard
          className="members98-section members98-add-card"
          title="إضافة قائد جديد"
          description="أنشئ القائد وحدد بياناته وربطه بالحساب والأدوار المناسبة من نفس المكان."
        >

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div className="min-w-0">
              <label className="text-sm">الاسم الكامل</label>
              <input className="border rounded-xl p-2 w-full" value={chefFullName} onChange={(e) => setChefFullName(e.target.value)} placeholder="مثلاً: أحمد علي" />
            </div>
            <div className="min-w-0">
              <label className="text-sm">الهاتف</label>
              <input className="border rounded-xl p-2 w-full" value={chefPhone} onChange={(e) => setChefPhone(e.target.value)} placeholder="010..." />
            </div>
            <div className="min-w-0">
              <label className="text-sm">الفريق <span className="text-slate-400">(اختياري)</span></label>
              <select className="border rounded-xl p-2 w-full cursor-pointer" value={chefTeamId} onChange={(e) => setChefTeamId(e.target.value)}>
                <option value="">— بدون فريق —</option>
                {teams.length === 0 && <option value="" disabled>لا توجد فرق مفعلة</option>}
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="text-sm">الرتبة <span className="text-slate-400">(اختياري)</span></label>
              <select className="border rounded-xl p-2 w-full cursor-pointer" value={chefRankId as any} onChange={(e) => setChefRankId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">— بدون رتبة —</option>
                {ranks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.rank_label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 min-w-0">
              <label className="text-sm">صورة شخصية (اختياري)</label>
              <input type="file" accept="image/*" onChange={(e) => setChefAvatar(e.target.files?.[0] ?? null)} />
              {chefAvatar && <div className="text-xs text-gray-500 mt-1">الحجم: {(chefAvatar.size / 1024 / 1024).toFixed(2)} MB</div>}
            </div>

            <div className="md:col-span-2 min-w-0">
              <label className="text-sm">المستخدم (Auth user) — ابحث بالبريد</label>
              <input className="border rounded-xl p-2 w-full" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="user@example.com" />
              {searching && <div className="text-xs text-gray-500 mt-1">جاري البحث…</div>}
              {userResults.length > 0 && (
                <div className="mt-2 border rounded-2xl max-h-48 overflow-auto bg-white">
                  {userResults.map((u) => (
                    <div key={u.id} className={`p-2 cursor-pointer hover:bg-gray-50 ${selectedUser?.id === u.id ? 'bg-gray-100' : ''}`} onClick={() => setSelectedUser(u)}>
                      {u.email} <span className="text-xs text-gray-500">({u.id.slice(0, 8)})</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedUser && <div className="text-xs text-emerald-700 mt-1">تم اختيار: {selectedUser.email}</div>}
            </div>

            <div className="md:col-span-3 min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-black text-slate-900">أكونتات جديدة غير مربوطة بعضو</div>
                  <div className="mt-1 text-xs text-slate-500">هذا القسم للأكونتات الجديدة في Supabase Authentication فقط. الأشخاص الذين نقلتهم من السنة السابقة موجودون في «أكونتات السنة المختارة» بالأعلى. البحث محدود لأفضل 50 نتيجة لتحسين الأداء.</div>
                </div>
                <button type="button" onClick={() => void loadUnlinkedAuthUsers(unlinkedSearch)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700" disabled={loadingUnlinked}>
                  {loadingUnlinked ? 'جاري التحديث...' : 'تحديث'}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)]">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600">بحث في الأكونتات الجديدة غير المربوطة</label>
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                    value={unlinkedSearch}
                    onChange={(e) => setUnlinkedSearch(e.target.value)}
                    placeholder="اكتب جزء من البريد الإلكتروني..."
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600">اختيار الأكونت</label>
                  <select
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none"
                    value={selectedUser?.id || ''}
                    onChange={(e) => {
                      const authUser = unlinkedAuthUsers.find((item) => item.id === e.target.value) || null
                      setSelectedUser(authUser)
                      if (authUser?.email) setUserSearch(authUser.email)
                    }}
                    dir="ltr"
                  >
                    <option value="">{loadingUnlinked ? 'جاري التحميل...' : '— اختر أكونت جديد غير مربوط —'}</option>
                    {unlinkedAuthUsers.map((authUser) => (
                      <option key={authUser.id} value={authUser.id}>
                        {authUser.email || authUser.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!loadingUnlinked && unlinkedAuthUsers.length === 0 && (
                <div className="mt-2 text-xs text-slate-500">لا توجد نتائج مطابقة، أو لا توجد Auth accounts جديدة غير مربوطة.</div>
              )}
              {selectedUser && (
                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800" dir="ltr">
                  Selected: {selectedUser.email || selectedUser.id}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold mb-1">الأدوار ونطاقها</div>
            <div className="border rounded-2xl overflow-x-auto">
              <table className="w-full text-sm min-w-[560px] md:min-w-0">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-start whitespace-nowrap">الدور</th>
                    <th className="p-2 text-center whitespace-nowrap">عام (Global)</th>
                    <th className="p-2 text-center whitespace-nowrap">على الفريق المختار</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLE_CHOICES.map((rc) => (
                    <tr key={rc.slug} className="border-t">
                      <td className="p-2 break-words">{rc.label}</td>
                      <td className="p-2 text-center">
                        <input type="checkbox" disabled={!rc.allowGlobal} checked={selectedGlobal.includes(rc.slug)} onChange={() => toggleGlobal(rc.slug)} />
                      </td>
                      <td className="p-2 text-center">
                        <input type="checkbox" disabled={!rc.allowTeam} checked={selectedTeamRoles.includes(rc.slug)} onChange={() => toggleTeam(rc.slug)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <LoadingButton loading={savingChef} onClick={saveChef}>
              حفظ القائد والأدوار
            </LoadingButton>
          </div>
        </SectionCard>
      )}

      {tab === 'equipier' && (
        <SectionCard
          className="members98-section members98-add-card"
          title="إضافة Equipier جديد"
          description="أضف بيانات العضو الأساسية وحدد فريقه لتسجيله مباشرة في السنة المختارة."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div className="min-w-0">
              <label className="text-sm">الاسم الكامل</label>
              <input className="border rounded-xl p-2 w-full" value={eqFullName} onChange={(e) => setEqFullName(e.target.value)} placeholder="مثلاً: كريم محمد" />
            </div>
            <div className="min-w-0">
              <label className="text-sm">الفريق</label>
              <select className="border rounded-xl p-2 w-full cursor-pointer" value={eqTeamId} onChange={(e) => setEqTeamId(e.target.value)}>
                {teams.length === 0 && <option value="">لا توجد فرق</option>}
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="text-sm">اسم ولي الأمر</label>
              <input className="border rounded-xl p-2 w-full" value={eqGuardianName} onChange={(e) => setEqGuardianName(e.target.value)} />
            </div>
            <div className="min-w-0">
              <label className="text-sm">هاتف ولي الأمر</label>
              <input className="border rounded-xl p-2 w-full" value={eqGuardianPhone} onChange={(e) => setEqGuardianPhone(e.target.value)} placeholder="010..." />
            </div>
            <div className="min-w-0">
              <label className="text-sm">تاريخ الميلاد</label>
              <input type="date" className="border rounded-xl p-2 w-full" value={eqBirthDate} onChange={(e) => setEqBirthDate(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
            <LoadingButton loading={savingEq} onClick={saveEquipier}>
              حفظ الـ Equipier
            </LoadingButton>
          </div>
        </SectionCard>
      )}

      <SectionCard
        className="members98-section members98-manage-section"
        title="إدارة أعضاء وأدوار السنة المختارة"
        description={`راجع الأشخاص الموجودين فعليًا في ${selectedYear?.name || 'السنة المختارة'} ثم حدّث Team / Rank / Roles. الأكونتات المنقولة من السنة السابقة تظهر هنا، وليس في قائمة الأكونتات الجديدة غير المربوطة.`}
      >

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button type="button" onClick={() => setManageSetupFilter('all')} className={`rounded-2xl border p-3 text-right transition ${manageSetupFilter === 'all' ? 'border-slate-400 bg-slate-100 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <div className="text-xs font-bold text-slate-500">كل الأسماء</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{members.length}</div>
          </button>
          <button type="button" onClick={() => { setManageSetupFilter('configured'); setManageStatusFilter('active') }} className={`rounded-2xl border p-3 text-right transition ${manageSetupFilter === 'configured' ? 'border-emerald-300 bg-emerald-50 shadow-sm' : 'border-emerald-100 bg-white hover:border-emerald-200'}`}>
            <div className="text-xs font-bold text-emerald-700">تم الإعداد</div>
            <div className="mt-1 text-2xl font-black text-emerald-800">{setupSummary.configured}</div>
          </button>
          <button type="button" onClick={() => { setManageSetupFilter('needs_setup'); setManageStatusFilter('active') }} className={`rounded-2xl border p-3 text-right transition ${manageSetupFilter === 'needs_setup' ? 'border-amber-300 bg-amber-50 shadow-sm' : 'border-amber-100 bg-white hover:border-amber-200'}`}>
            <div className="text-xs font-bold text-amber-700">يحتاج إعداد</div>
            <div className="mt-1 text-2xl font-black text-amber-800">{setupSummary.needsSetup}</div>
          </button>
          <button type="button" onClick={() => { setManageSetupFilter('all'); setManageStatusFilter('inactive') }} className="rounded-2xl border border-slate-200 bg-white p-3 text-right transition hover:border-slate-300">
            <div className="text-xs font-bold text-slate-500">غير نشط</div>
            <div className="mt-1 text-2xl font-black text-slate-700">{setupSummary.inactive}</div>
          </button>
        </div>

        <div className="members98-filters grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">بحث</label>
            <input className="w-full rounded-xl border border-slate-300 px-3 py-2" value={manageSearch} onChange={(e) => setManageSearch(e.target.value)} placeholder="ابحث بالاسم أو الفريق أو الرتبة" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">حالة الإعداد</label>
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={manageSetupFilter} onChange={(e) => setManageSetupFilter(e.target.value as any)}>
              <option value="all">الكل</option>
              <option value="configured">تم الإعداد</option>
              <option value="needs_setup">يحتاج إعداد</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الفريق</label>
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={manageTeamFilter} onChange={(e) => setManageTeamFilter(e.target.value)}>
              <option value="">كل الفرق</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">الحالة</label>
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={manageStatusFilter} onChange={(e) => setManageStatusFilter(e.target.value as any)}>
              <option value="all">الكل</option>
              <option value="active">نشط</option>
              <option value="inactive">غير نشط</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">النوع</label>
            <select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={manageTypeFilter} onChange={(e) => setManageTypeFilter(e.target.value as any)}>
              <option value="all">الكل</option>
              <option value="chef">Chefs</option>
              <option value="equipier">Equipiers</option>
            </select>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <label className="mb-1 block text-sm font-bold text-slate-700">مراجعة شخص محدد</label>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-semibold text-slate-800"
                value={selectedManagedMemberId}
                onChange={(e) => setSelectedManagedMemberId(e.target.value)}
              >
                <option value="">— اختر اسمًا لمراجعة Team / Rank / Roles —</option>
                {managedMembers.map((member) => {
                  const setup = setupByMemberId.get(member.id)
                  return (
                    <option key={member.id} value={member.id}>
                      {member.full_name} — {setup?.configured ? 'تم الإعداد' : setup?.needsSetup ? 'يحتاج إعداد' : 'غير نشط'}
                    </option>
                  )
                })}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => { setManageSearch(''); setManageTeamFilter(''); setManageStatusFilter('all'); setManageTypeFilter('all'); setManageSetupFilter('all') }}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 md:w-auto"
              >
                مسح الفلاتر
              </button>
            </div>
          </div>
        </div>

        <div className="members98-manage-grid grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="members98-roster overflow-hidden rounded-[24px] border bg-white shadow-sm">
            <div className="members98-roster-head border-b px-4 py-3 text-sm font-bold">
              أعضاء السنة المختارة ({managedMembers.length})
            </div>
            <div className="members98-roster-list max-h-[600px] overflow-auto divide-y">
              {managedMembers.length === 0 ? (
                <div className="p-4"><EmptyState title="لا توجد نتائج مطابقة" description="جرّب تغيير الفلاتر أو البحث باسم مختلف." /></div>
              ) : (
                managedMembers.map((member) => {
                  const setup = setupByMemberId.get(member.id)
                  const activeRolesCount = setup?.activeRolesCount || 0
                  const needsSetup = Boolean(setup?.needsSetup)
                  const selected = selectedManagedMemberId === member.id
                  return (
                    <button
                      type="button"
                      key={member.id}
                      onClick={() => setSelectedManagedMemberId(member.id)}
                      className={`members98-member-row w-full px-4 py-3 text-right transition ${selected ? 'is-selected' : ''}`}
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="members98-member-main">
                          <span className="members98-member-avatar" aria-hidden="true">{member.full_name?.trim()?.[0] || '•'}</span>
                          <div className="min-w-0">
                            <div className="members98-member-name font-semibold">{member.full_name}</div>
                            <div className="members98-member-meta mt-1 text-xs">
                              {member.team_name || 'بدون فريق'} • {member.rank_label || 'بدون رتبة'} • {member.is_equipier ? 'Equipier' : 'Chef'}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {needsSetup ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-bold text-amber-800">
                              يحتاج إعداد
                            </span>
                          ) : setup?.configured ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">
                              تم الإعداد
                            </span>
                          ) : (
                            <span className="members98-status-pill is-inactive rounded-full border px-2.5 py-1">غير نشط</span>
                          )}
                          <span className="members98-role-count rounded-full border px-2.5 py-1">
                            {activeRolesCount} دور
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="members98-detail-panel rounded-[24px] border p-4 shadow-sm">
            {!selectedManagedMember ? (
              <EmptyState title="لم يتم اختيار عضو بعد" description="اختر عضوًا من القائمة المجاورة حتى تظهر لك أدوات التعديل الخاصة به." />
            ) : (
              <div className="space-y-4">
                <div className="members98-selected-summary rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="members98-selected-name text-lg font-black">{selectedManagedMember.full_name}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {selectedManagedMember.auth_user_id ? 'مرتبط بحساب مستخدم ويمكن إدارة أدواره' : 'بدون حساب مستخدم — لا يمكن إدارة الأدوار من هنا'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={`rounded-full border px-2.5 py-1 ${selectedManagedMember.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{selectedManagedMember.is_active ? 'نشط' : 'غير نشط'}</span>
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">{selectedManagedMember.team_name || 'بدون فريق'}</span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">{selectedManagedMember.is_equipier ? 'Equipier' : 'Chef'}</span>
                      <Link to={`/app/member-profile/${selectedManagedMember.id}`} className="members98-profile-link rounded-full border px-2.5 py-1 transition">
                        فتح Member 360
                      </Link>
                    </div>
                  </div>
                </div>

                {setupByMemberId.get(selectedManagedMember.id)?.needsSetup ? (
                  <InlineAlert tone="warning" title="يحتاج إعداد">
                    ناقص: {setupByMemberId.get(selectedManagedMember.id)?.missing.map((item) => ({ account: 'Auth Account' }[item] || item)).join(' + ')}. الفريق والرتبة والـRole اختيارية ويمكن تركها فارغة.
                  </InlineAlert>
                ) : setupByMemberId.get(selectedManagedMember.id)?.configured ? (
                  <InlineAlert tone="success" title="تم الإعداد">
                    البيانات الأساسية مكتملة. الفريق والـRole اختياريان ويمكن إضافتهما فقط عند الحاجة.
                  </InlineAlert>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">الفريق في السنة المختارة <span className="text-slate-400">(اختياري)</span></label>
                    <select className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500" value={seasonTeamId} onChange={(e) => setSeasonTeamId(e.target.value)} disabled={!canEditSelectedYear}>
                      <option value="">بدون فريق</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">الرتبة في السنة المختارة <span className="text-slate-400">(اختياري)</span></label>
                    <select className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500" value={seasonRankId as any} onChange={(e) => setSeasonRankId(e.target.value ? Number(e.target.value) : '')} disabled={!canEditSelectedYear}>
                      <option value="">— بدون رتبة —</option>
                      {ranks.map((rank) => (
                        <option key={rank.id} value={rank.id}>
                          {rank.rank_label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                    <input type="checkbox" checked={seasonIsEquipier} onChange={(e) => setSeasonIsEquipier(e.target.checked)} disabled={!canEditSelectedYear} />
                    Equipier في السنة المختارة
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                    <input type="checkbox" checked={seasonIsActive} onChange={(e) => setSeasonIsActive(e.target.checked)} disabled={!canEditSelectedYear} />
                    نشط في السنة المختارة
                  </label>
                </div>

                <div className="flex justify-end">
                  <LoadingButton loading={savingSeasonMember} onClick={saveSeasonMemberState} disabled={!canEditSelectedYear}>
                    حفظ بيانات السنة المختارة
                  </LoadingButton>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <div className="mb-1 text-sm font-semibold text-slate-700">أدوار السنة المختارة <span className="font-normal text-slate-400">(اختياري)</span></div>
                  <div className="mb-3 text-xs leading-5 text-slate-500">أضف Role فقط لو الشخص يحتاج صلاحية فعلية داخل السيستم. لا يلزم إضافة Normal Chef لمجرد إكمال الإعداد.</div>
                  {selectedManagedMember.auth_user_id ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {selectedManagedRoles.length === 0 ? (
                          <div className="text-sm text-slate-500">لا توجد أدوار حالية لهذا العضو.</div>
                        ) : (
                          selectedManagedRoles.map((role) => (
                            <span key={role.id} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700">
                              <span>{role.role_label || role.role_slug}</span>
                              <span className="text-slate-400">•</span>
                              <span>{roleScopeText(role)}</span>
                              <button type="button" onClick={() => handleRemoveRole(role)} className="text-red-600 hover:text-red-700 disabled:text-slate-300" disabled={roleActionBusy || !canEditSelectedYear}>
                                حذف
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      <div className="members98-role-editor mt-4 space-y-3 rounded-2xl border bg-white p-3">
                        <div className="text-sm font-semibold text-slate-700">إضافة دور جديد</div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">الدور</label>
                            <select className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500" value={newRoleId as any} onChange={(e) => setNewRoleId(e.target.value ? Number(e.target.value) : '')} disabled={!canEditSelectedYear}>
                              <option value="">— اختر —</option>
                              {roleCatalogOptions.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.role_label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">النطاق</label>
                            <select className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500" value={newRoleScope} onChange={(e) => setNewRoleScope(e.target.value as 'global' | 'team')} disabled={!canUseTeamScope || !canEditSelectedYear}>
                              <option value="global">عام</option>
                              <option value="team">على فريق</option>
                            </select>
                          </div>
                        </div>
                        {canUseTeamScope && newRoleScope === 'team' && (
                          <div>
                            <label className="mb-1 block text-sm font-medium text-slate-700">الفريق</label>
                            <select className="w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500" value={newRoleTeamId} onChange={(e) => setNewRoleTeamId(e.target.value)} disabled={!canEditSelectedYear}>
                              <option value="">— اختر —</option>
                              {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="flex justify-end">
                          <LoadingButton loading={roleActionBusy} onClick={handleAddRole} disabled={!canEditSelectedYear}>
                            إضافة الدور
                          </LoadingButton>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500">لا يمكن إدارة الأدوار لأن العضو غير مرتبط بحساب مستخدم.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
