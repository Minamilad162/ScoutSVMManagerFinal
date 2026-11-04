import type { ReactNode } from 'react'

type Tone = 'error' | 'success' | 'info' | 'warning'

const toneMap: Record<Tone, { wrapper: string; icon: string }> = {
  error: {
    wrapper: 'border-red-200/80 bg-red-50/82 text-red-800',
    icon: '⛔',
  },
  success: {
    wrapper: 'border-emerald-200/80 bg-emerald-50/82 text-emerald-800',
    icon: '✅',
  },
  info: {
    wrapper: 'border-sky-200/80 bg-sky-50/82 text-sky-800',
    icon: 'ℹ️',
  },
  warning: {
    wrapper: 'border-amber-200/80 bg-amber-50/85 text-amber-900',
    icon: '⚠️',
  },
}

export function InlineAlert({
  tone = 'info',
  title,
  children,
}: {
  tone?: Tone
  title?: ReactNode
  children: ReactNode
}) {
  const config = toneMap[tone] ?? toneMap.info

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm backdrop-blur-xl ${config.wrapper}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-sm shadow-sm">
          {config.icon}
        </div>
        <div className="min-w-0 text-sm leading-6">
          {title ? <div className="mb-1 font-black">{title}</div> : null}
          <div>{children}</div>
        </div>
      </div>
    </div>
  )
}
