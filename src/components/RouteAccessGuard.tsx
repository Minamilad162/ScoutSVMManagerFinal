import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { PageLoader } from './ui/PageLoader'

type Props = {
  children: ReactNode
  adminOnly?: boolean
  anyRoles?: string[]
  globalRoles?: string[]
  allRoles?: string[]
  sameTeamRoles?: string[]
  allowAdmin?: boolean
}

export function RouteAccessGuard({
  children,
  adminOnly = false,
  anyRoles = [],
  globalRoles = [],
  allRoles = [],
  sameTeamRoles = [],
  allowAdmin = true,
}: Props) {
  const { roles, loading } = useAuth()

  if (loading) return <PageLoader visible text="جاري التحقق من الصلاحيات..." />

  const isAdmin = roles.some((role) => role.role_slug === 'admin')
  const hasAnyRole = anyRoles.some((slug) => roles.some((role) => role.role_slug === slug))
  const hasGlobalRole = globalRoles.some((slug) =>
    roles.some(
      (role) =>
        role.role_slug === slug &&
        (role.team_id === null || role.team_id === undefined)
    )
  )
  const hasAllRoles =
    allRoles.length > 0 &&
    allRoles.every((slug) => roles.some((role) => role.role_slug === slug))
  const hasSameTeamRoles =
    sameTeamRoles.length > 0 &&
    roles.some((candidate) => {
      if (!candidate.team_id || candidate.role_slug !== sameTeamRoles[0]) return false
      return sameTeamRoles.every((slug) =>
        roles.some((role) => role.role_slug === slug && role.team_id === candidate.team_id)
      )
    })

  const allowed = adminOnly
    ? isAdmin
    : (allowAdmin && isAdmin) || hasAnyRole || hasGlobalRole || hasAllRoles || hasSameTeamRoles

  if (!allowed) {
    return (
      <div className="p-4 md:p-6" dir="rtl">
        <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-black text-amber-700">صلاحية غير كافية</div>
          <h1 className="mt-2 text-2xl font-black text-slate-950">لا يمكنك فتح هذه الصفحة بهذا الحساب</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            تم منع الوصول على مستوى الـRoute كطبقة حماية إضافية. لو تعتقد أن الحساب يجب أن يمتلك الصلاحية، راجع الأدوار المعيّنة له.
          </p>
          <Link
            to="/app"
            className="mt-5 inline-flex rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800"
          >
            الرجوع للرئيسية
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
