import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title?: string
  children?: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="app-modal fixed inset-0 z-[1200]" role="presentation">
      <div
        className="app-modal-backdrop absolute inset-0 bg-slate-950/35 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="app-modal-panel relative w-full max-w-lg animate-[svmFloatIn_.22s_ease_both] overflow-hidden rounded-[30px] border border-white/65 bg-white/82 p-0 shadow-2xl backdrop-blur-2xl"
          role="dialog"
          aria-modal="true"
          aria-label={title || 'نافذة منبثقة'}
          dir="rtl"
        >
          <div className="app-modal-shine" aria-hidden="true" />
          {(title || onClose) && (
            <div className="app-modal-header relative flex items-center justify-between gap-3 border-b border-white/60 px-5 py-4 md:px-6">
              {title ? (
                <div className="app-modal-title text-lg font-black tracking-tight text-slate-900">{title}</div>
              ) : (
                <span />
              )}
              <button type="button" className="app-modal-x" onClick={onClose} aria-label="إغلاق">
                ×
              </button>
            </div>
          )}
          <div className="app-modal-content relative px-5 py-4 text-sm leading-6 text-slate-700 md:px-6">
            {children}
          </div>
          <div className="app-modal-footer relative flex justify-end gap-2 border-t border-white/60 px-5 py-4 md:px-6">
            <button className="btn cursor-pointer px-4 py-2" onClick={onClose}>
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
