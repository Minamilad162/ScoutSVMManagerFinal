import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty-state-card relative overflow-hidden rounded-[30px] border border-dashed border-white/75 bg-white/60 p-8 text-center shadow-sm backdrop-blur-2xl">
      <div className="empty-state-glow" aria-hidden="true" />
      <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/75 bg-white/86 text-2xl shadow-sm">✨</div>
      <div className="relative text-base font-black text-slate-900">{title}</div>
      {description ? <div className="relative mx-auto mt-2 max-w-xl text-sm font-medium leading-7 text-slate-500">{description}</div> : null}
      {action ? <div className="relative mt-5">{action}</div> : null}
    </div>
  )
}
