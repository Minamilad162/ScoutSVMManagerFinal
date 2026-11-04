import type { ReactNode } from 'react'

export function PageHero({
  title,
  description,
  eyebrow,
  actions,
  badge,
  className,
}: {
  title: string
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  badge?: ReactNode
  className?: string
}) {
  return (
    <div className={`page-hero relative overflow-hidden rounded-[30px] border border-white/65 bg-white/72 p-4 shadow-lg backdrop-blur-2xl md:p-5 lg:p-6 ${className ?? ""}`.trim()}>
      <div className="absolute -left-16 top-0 h-40 w-40 rounded-full bg-amber-200/35 blur-3xl" />
      <div className="absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-sky-200/45 blur-3xl" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
      <div className="page-hero-glow" aria-hidden="true" />
      <div className="page-hero-layout relative">
        <div className="page-hero-copy space-y-2.5">
          {eyebrow ? (
            <div className="page-hero-eyebrow inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-white/80 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm backdrop-blur">
              <span className="page-hero-eyebrow-dot" aria-hidden="true" />
              {eyebrow}
            </div>
          ) : null}
          <div className="page-hero-title-row flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-[2rem]">{title}</h1>
            {badge ? badge : null}
          </div>
          {description ? <div className="page-hero-description text-sm leading-7 text-slate-600 md:text-[15px]">{description}</div> : null}
        </div>
        {actions ? <div className="page-hero-actions flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
