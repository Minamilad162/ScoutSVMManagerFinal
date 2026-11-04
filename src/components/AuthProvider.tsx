import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCurrentUserContext, fetchCurrentUserRoles } from '../features/reference/api'
import { getErrorMessage, logError } from '../lib/errors'

type RoleView = { role_slug: string; team_id: string | null }
type Ctx = {
  user: any | null
  roles: RoleView[]
  myTeamId: string | null
  loading: boolean
  authError: string | null
  signInWithPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}
const AuthCtx = createContext<Ctx>({
  user: null,
  roles: [],
  myTeamId: null,
  loading: true,
  authError: null,
  signInWithPassword: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: any }) {
  const [user, setUser] = useState<any | null>(null)
  const [roles, setRoles] = useState<RoleView[]>([])
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const activeUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    const applyUser = (nextUser: any | null) => {
      if (!mounted) return
      activeUserIdRef.current = nextUser?.id ?? null
      setUser(nextUser)
    }

    const init = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()
        if (error) throw error
        applyUser(session?.user ?? null)
      } catch (error) {
        logError('AuthProvider.getSession', error as any)
        if (mounted) setAuthError(getErrorMessage(error as any, 'تعذر التحقق من جلسة المستخدم'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void init()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null
      const nextUserId = nextUser?.id ?? null
      const currentUserId = activeUserIdRef.current

      // Supabase can emit SIGNED_IN/TOKEN_REFRESHED again when a background tab
      // becomes active. Treating that as a new login used to remount the whole app
      // and wipe local page/form/scroll state. Same-user refresh events are session
      // maintenance only and must not reinitialize the application.
      if (
        nextUserId &&
        nextUserId === currentUserId &&
        (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')
      ) {
        if (mounted) setAuthError(null)
        return
      }

      if (event === 'USER_UPDATED' && nextUserId && nextUserId === currentUserId) {
        if (mounted) {
          setUser(nextUser)
          setAuthError(null)
        }
        return
      }

      applyUser(nextUser)
      if (mounted) setAuthError(null)
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
        setLoading(true)
        setAuthError(null)

        const [rolesData, me] = await Promise.all([
          fetchCurrentUserRoles(userId),
          fetchCurrentUserContext(userId),
        ])

        setRoles(
          (rolesData as any[])?.map((role) => ({ role_slug: role.role_slug, team_id: role.team_id })) ?? []
        )
        setMyTeamId(me?.team_id ?? null)
      } catch (error) {
        logError('AuthProvider.loadProfile', error as any, { userId })
        setAuthError(getErrorMessage(error as any, 'تعذر تحميل بيانات الحساب'))
        setRoles([])
        setMyTeamId(null)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [user?.id])

  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }
  async function signOut() {
    await supabase.auth.signOut()
  }

  const value = useMemo(
    () => ({ user, roles, myTeamId, loading, authError, signInWithPassword, signOut }),
    [user, roles, myTeamId, loading, authError]
  )
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
export function useAuth() {
  return useContext(AuthCtx)
}
