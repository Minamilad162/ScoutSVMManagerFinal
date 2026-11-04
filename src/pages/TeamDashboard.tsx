import { useMemo } from 'react'
import { useAuth } from '../components/AuthProvider'
import { MetricCard } from '../components/ui/MetricCard'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'

export default function TeamDashboard() {
  const { roles, myTeamId, user } = useAuth()

  const globalRoles = useMemo(() => roles.filter((r) => !r.team_id), [roles])
  const teamRoles = useMemo(() => roles.filter((r) => r.team_id), [roles])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHero
        eyebrow="لوحة الفريق"
        title="نظرة سريعة على صلاحياتك الحالية"
        description="تعرض هذه الصفحة حسابك الحالي، الفريق المرتبط بك، والأدوار الفعالة عليك في النظام بشكل مبسط وواضح."
        badge={<span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">Team view</span>}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="الحساب الحالي" value={user?.email || '—'} accent="indigo" />
        <MetricCard label="الفريق المرتبط" value={myTeamId || '—'} accent="sky" />
        <MetricCard label="عدد الأدوار" value={roles.length} hint="الأدوار العامة + أدوار الفرق" accent="emerald" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="الأدوار العامة"
          description="هذه الأدوار غير مرتبطة بفريق محدد وتؤثر على صلاحياتك على مستوى النظام كله."
          tone="subtle"
        >
          {globalRoles.length ? (
            <div className="flex flex-wrap gap-2">
              {globalRoles.map((role) => (
                <span key={`${role.role_slug}-${role.team_id ?? 'global'}`} className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                  {role.role_slug}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">لا توجد أدوار عامة مرتبطة بحسابك حاليًا.</div>
          )}
        </SectionCard>

        <SectionCard
          title="أدوار الفرق"
          description="الأدوار الآتية مرتبطة بفرق محددة، وقد تختلف من سنة كشفية إلى أخرى."
          tone="subtle"
        >
          {teamRoles.length ? (
            <div className="space-y-2">
              {teamRoles.map((role) => (
                <div key={`${role.role_slug}-${role.team_id}`} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{role.role_slug}</div>
                                      </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    Team: {role.team_id}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">لا توجد أدوار مرتبطة بفريق محدد على هذا الحساب.</div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
