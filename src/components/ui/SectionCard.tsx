import type { ReactNode } from 'react'

export function SectionCard({
  title,
  description,
  actions,
  children,
  tone = 'default',
  className = '',
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  tone?: 'default' | 'subtle'
  className?: string
}) {
  return (
    <section className={`section-card rounded-[28px] border p-4 shadow-sm backdrop-blur-2xl md:p-5 ${tone === 'subtle' ? 'border-white/55 bg-white/45' : 'border-white/65 bg-white/74'} ${className}`}>
      <div className="section-card-header mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="section-card-heading">
          <h2 className="section-card-title text-lg font-black tracking-tight text-slate-900">{title}</h2>
          {description ? <div className="section-card-description mt-1 text-sm leading-6 text-slate-500">{description}</div> : null}
        </div>
        {actions ? <div className="section-card-actions flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="section-card-content space-y-4">{children}</div>
    </section>
  )
}
