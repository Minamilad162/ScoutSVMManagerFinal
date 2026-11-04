import type { ReactNode } from 'react'

export function MetricCard({
  label,
  value,
  hint,
  accent = 'indigo',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  accent?: 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet' | 'navy' | 'orange' | 'gold'
}) {
  const tone =
    accent === 'navy'
      ? 'from-[#0b2a4a]/12 to-[#eef4fa]/82 text-[#0b2a4a] border-[#0b2a4a]/20'
      : accent === 'orange'
      ? 'from-[#f47721]/16 to-[#fff2e7]/86 text-[#b84d0b] border-[#f47721]/28'
      : accent === 'gold'
      ? 'from-[#f3cf63]/22 to-[#fff8dc]/88 text-[#8a6509] border-[#e9be3f]/34'
      : accent === 'emerald'
      ? 'from-emerald-500/12 to-emerald-50/70 text-emerald-700 border-emerald-200/70'
      : accent === 'amber'
      ? 'from-amber-500/14 to-amber-50/72 text-amber-700 border-amber-200/70'
      : accent === 'sky'
      ? 'from-sky-500/14 to-sky-50/72 text-sky-700 border-sky-200/70'
      : accent === 'rose'
      ? 'from-rose-500/12 to-rose-50/72 text-rose-700 border-rose-200/70'
      : accent === 'violet'
      ? 'from-violet-500/12 to-violet-50/72 text-violet-700 border-violet-200/70'
      : 'from-indigo-500/12 to-indigo-50/72 text-indigo-700 border-indigo-200/70'

  return (
    <div className={`metric-card relative overflow-hidden rounded-[28px] border bg-gradient-to-br ${tone} p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-lg`}>
      <div className="metric-card-orb" aria-hidden="true" />
      <div className="metric-card-topline relative text-sm font-bold opacity-90">{label}</div>
      <div className="metric-card-value relative mt-3 text-3xl font-black tracking-tight">{value}</div>
      {hint ? <div className="metric-card-hint relative mt-2 text-xs font-semibold opacity-80">{hint}</div> : null}
    </div>
  )
}
