import { Spinner } from './Spinner'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  variant?: 'brand' | 'outline' | 'soft'
}

export function LoadingButton({ loading, children, className = '', variant = 'brand', ...rest }: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition shadow-sm disabled:cursor-not-allowed disabled:opacity-60'
  const style =
    variant === 'brand'
      ? 'border border-amber-300/30 bg-slate-950 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/15'
      : variant === 'soft'
      ? 'border border-amber-200/70 bg-amber-50/80 text-slate-800 hover:bg-amber-100/80 backdrop-blur'
      : 'border border-white/70 bg-white/76 text-slate-700 hover:bg-white/95 backdrop-blur'

  return (
    <button className={`${base} ${style} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading && <Spinner />}
      <span>{children}</span>
    </button>
  )
}
