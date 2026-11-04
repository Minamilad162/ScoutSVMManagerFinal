import { Spinner } from './Spinner'

export function PageLoader({ visible = false, text = 'جاري التحميل…' }: { visible?: boolean, text?: string }) {
  if (!visible) return null
  return (
    <div className="page-loader fixed inset-0 z-[1100] flex items-center justify-center bg-white/45 backdrop-blur-lg">
      <div className="page-loader-card relative overflow-hidden rounded-[30px] border border-white/70 bg-white/82 px-6 py-5 text-center shadow-2xl backdrop-blur-2xl">
        <div className="page-loader-orb" aria-hidden="true" />
        <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/70 bg-white/76 shadow-lg">
          <Spinner className="h-7 w-7" />
        </div>
        <div className="relative text-sm font-black text-slate-800">{text}</div>
        <div className="relative mt-1 text-xs font-semibold text-slate-500">Scout SVM</div>
      </div>
    </div>
  )
}
