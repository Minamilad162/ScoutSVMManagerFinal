import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCurrentUserContext, fetchCurrentUserRoles } from '../features/reference/api'
import { getErrorMessage, logError } from '../lib/errors'

type RoleView = { role_slug: string; team_id: string | null }
type SignInResult =
  | { active: true }
  | { active: false; reason: string }

type AccessSnapshot = {
  roles: RoleView[]
  myTeamId: string | null
  allowed: boolean
  reason: string | null
}

type Ctx = {
  user: any | null
  roles: RoleView[]
  myTeamId: string | null
  loading: boolean
  authError: string | null
  accountInactive: boolean
  accountInactiveReason: string | null
  signInWithPassword: (email: string, password: string) => Promise<SignInResult>
  clearInactiveAccount: () => void
  signOut: () => Promise<void>
}

const INACTIVE_REASON = 'هذا الحساب غير نشط في السنة الكشفية الحالية. تواصل مع مسؤول النظام لإضافتك إلى السنة الحالية.'

const AuthCtx = createContext<Ctx>({
  user: null,
  roles: [],
  myTeamId: null,
  loading: true,
  authError: null,
  accountInactive: false,
  accountInactiveReason: null,
  signInWithPassword: async () => ({ active: false, reason: INACTIVE_REASON }),
  clearInactiveAccount: () => {},
  signOut: async () => {},
})

async function fetchAccessSnapshot(userId: string): Promise<AccessSnapshot> {
  const [rolesData, me] = await Promise.all([
    fetchCurrentUserRoles(userId),
    fetchCurrentUserContext(userId),
  ])

  const normalizedRoles =
    (rolesData as any[])?.map((role) => ({ role_slug: role.role_slug, team_id: role.team_id })) ?? []
  const isPermanentAdmin = normalizedRoles.some((role) => role.role_slug === 'admin')
  const hasActiveCurrentYearMembership = Boolean(me?.member_id)
  const allowed = isPermanentAdmin || hasActiveCurrentYearMembership

  return {
    roles: normalizedRoles,
    myTeamId: me?.team_id ?? null,
    allowed,
    reason: allowed ? null : INACTIVE_REASON,
  }
}

export function AuthProvider({ children }: { children: any }) {
  const [user, setUser] = useState<any | null>(null)
  const [roles, setRoles] = useState<RoleView[]>([])
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [accountInactive, setAccountInactive] = useState(false)
  const [accountInactiveReason, setAccountInactiveReason] = useState<string | null>(null)
  const activeUserIdRef = useRef<string | null>(null)
  const credentialSignInRef = useRef(false)

  const applyUser = (nextUser: any | null) => {
    activeUserIdRef.current = nextUser?.id ?? null
    setUser(nextUser)
  }

  const applyAllowedSnapshot = (nextUser: any, snapshot: AccessSnapshot) => {
    setRoles(snapshot.roles)
    setMyTeamId(snapshot.myTeamId)
    setAccountInactive(false)
    setAccountInactiveReason(null)
    setAuthError(null)
    applyUser(nextUser)
  }

  const blockInactiveAccount = async (reason = INACTIVE_REASON) => {
    setRoles([])
    setMyTeamId(null)
    applyUser(null)

    // Remove the authenticated session before exposing any application route.
    // The inactive state is set after signOut because SIGNED_OUT listeners clear user state.
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (error) {
      logError('AuthProvider.blockInactiveAccount.signOut', error as any)
    }

    setAccountInactive(true)
    setAccountInactiveReason(reason)
    setAuthError(null)
  }

  const admitUser = async (nextUser: any) => {
    const snapshot = await fetchAccessSnapshot(nextUser.id)
    if (!snapshot.allowed) {
      await blockInactiveAccount(snapshot.reason || INACTIVE_REASON)
      return false
    }
    applyAllowedSnapshot(nextUser, snapshot)
    return true
  }

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        if (error) throw error

        if (!mounted) return
        const sessionUser = session?.user ?? null
        if (!sessionUser) {
          applyUser(null)
          return
        }

        // Validate current-year access before the app ever receives a user object.
        await admitUser(sessionUser)
      } catch (error) {
        logError('AuthProvider.getSession', error as any)
        if (mounted) {
          applyUser(null)
          setAuthError(getErrorMessage(error as any, 'تعذر التحقق من جلسة المستخدم'))
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void init()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      // INITIAL_SESSION is handled by init() so admission can finish before routing.
      if (event === 'INITIAL_SESSION') return

      const nextUser = session?.user ?? null
      const nextUserId = nextUser?.id ?? null
      const currentUserId = activeUserIdRef.current

      if (event === 'SIGNED_OUT' || !nextUser) {
        applyUser(null)
        setRoles([])
        setMyTeamId(null)
        setAuthError(null)
        return
      }

      // Credential login performs its own admission check before exposing the user.
      if (event === 'SIGNED_IN' && credentialSignInRef.current) return

      // Supabase can emit SIGNED_IN/TOKEN_REFRESHED again when a background tab
      // becomes active. Same-user refresh events are session maintenance only.
      if (
        nextUserId &&
        nextUserId === currentUserId &&
        (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')
      ) {
        setAuthError(null)
        return
      }

      if (event === 'USER_UPDATED' && nextUserId && nextUserId === currentUserId) {
        setUser(nextUser)
        setAuthError(null)
        return
      }

      // Any external/magic-link style sign-in still passes through the same gate.
      void admitUser(nextUser).catch((error) => {
        logError('AuthProvider.onAuthStateChange.admitUser', error as any)
        applyUser(null)
        setRoles([])
        setMyTeamId(null)
        setAuthError(getErrorMessage(error as any, 'تعذر التحقق من صلاحية الحساب للسنة الحالية'))
      })
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = user?.id ?? null

    const load = async () => {
      if (!userId) {
        setRoles([])
        setMyTeamId(null)
        setAuthError(null)
        setLoading(false)
        return
      }

      try {
        setAuthError(null)
        const snapshot = await fetchAccessSnapshot(userId)

        if (!snapshot.allowed) {
          await blockInactiveAccount(snapshot.reason || INACTIVE_REASON)
          return
        }

        setRoles(snapshot.roles)
        setMyTeamId(snapshot.myTeamId)
        setAccountInactive(false)
        setAccountInactiveReason(null)
      } catch (error) {
        logError('AuthProvider.loadProfile', error as any, { userId })
        setAuthError(getErrorMessage(error as any, 'تعذر تحميل بيانات الحساب'))
        setRoles([])
        setMyTeamId(null)
      }
    }

    void load()
  }, [user?.id])

  async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
    credentialSignInRef.current = true
    setAccountInactive(false)
    setAccountInactiveReason(null)
    setAuthError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const nextUser = data.user
      if (!nextUser) throw new Error('تعذر قراءة بيانات الحساب بعد تسجيل الدخول')

      const snapshot = await fetchAccessSnapshot(nextUser.id)
      if (!snapshot.allowed) {
        await blockInactiveAccount(snapshot.reason || INACTIVE_REASON)
        return { active: false, reason: snapshot.reason || INACTIVE_REASON }
      }

      applyAllowedSnapshot(nextUser, snapshot)
      return { active: true }
    } catch (error) {
      // Never keep a partially admitted authenticated session after a failed gate check.
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {}
      applyUser(null)
      setRoles([])
      setMyTeamId(null)
      throw error
    } finally {
      credentialSignInRef.current = false
    }
  }

  function clearInactiveAccount() {
    setAccountInactive(false)
    setAccountInactiveReason(null)
    setAuthError(null)
  }

  async function signOut() {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      applyUser(null)
      setRoles([])
      setMyTeamId(null)
      setAccountInactive(false)
      setAccountInactiveReason(null)
      setAuthError(null)
    }
  }

  const value = useMemo(
    () => ({
      user,
      roles,
      myTeamId,
      loading,
      authError,
      accountInactive,
      accountInactiveReason,
      signInWithPassword,
      clearInactiveAccount,
      signOut,
    }),
    [user, roles, myTeamId, loading, authError, accountInactive, accountInactiveReason]
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}
