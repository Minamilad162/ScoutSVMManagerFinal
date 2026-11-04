import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

type ToastType = 'success' | 'error' | 'info'
type Toast = { id: string; type: ToastType; title?: string; message: string; duration?: number }

type ToastCtx = {
  show: (t: Omit<Toast, 'id'>) => void
  success: (msg: string, title?: string, duration?: number) => void
  error: (msg: string, title?: string, duration?: number) => void
  info: (msg: string, title?: string, duration?: number) => void
}

const Ctx = createContext<ToastCtx | null>(null)

function uid() {
  return Math.random().toString(36).slice(2)
}

const toastIcon: Record<ToastType, string> = {
  success: '✓',
  error: '!',
  info: 'i',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const show = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = uid()
      const duration = t.duration ?? 3000
      setToasts((prev) => [...prev, { ...t, id, duration }])
      window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss]
  )

  const success = useCallback(
    (message: string, title = 'تم بنجاح', duration = 3000) => show({ type: 'success', message, title, duration }),
    [show]
  )
  const error = useCallback(
    (message: string, title = 'حدث خطأ', duration = 4000) => show({ type: 'error', message, title, duration }),
    [show]
  )
  const info = useCallback(
    (message: string, title = 'تنبيه', duration = 3000) => show({ type: 'info', message, title, duration }),
    [show]
  )

  const value = useMemo(() => ({ show, success, error, info }), [show, success, error, info])

  return (
    <Ctx.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-zone fixed inset-x-0 top-4 z-[1000] flex justify-center pointer-events-none">
          <div className="flex w-full max-w-md flex-col gap-2 px-4">
            {toasts.map((t) => (
              <div
                key={t.id}
                role={t.type === 'error' ? 'alert' : 'status'}
                className={`toast-card pointer-events-auto animate-[svmFloatIn_.2s_ease_both] rounded-[24px] border p-3 shadow-xl backdrop-blur-2xl
                   ${
                     t.type === 'success'
                       ? 'toast-success border-emerald-300/70 bg-emerald-50/88 text-emerald-900'
                       : t.type === 'error'
                       ? 'toast-error border-rose-300/70 bg-rose-50/88 text-rose-900'
                       : 'toast-info border-sky-300/70 bg-sky-50/88 text-sky-900'
                   }`}
              >
                <div className="flex items-start gap-3">
                  <div className="toast-icon" aria-hidden="true">
                    {toastIcon[t.type]}
                  </div>
                  <div className="min-w-0 flex-1">
                    {t.title && <div className="text-sm font-black">{t.title}</div>}
                    <div className="text-sm font-semibold leading-6">{t.message}</div>
                  </div>
                  <button
                    type="button"
                    className="toast-close"
                    aria-label="إخفاء التنبيه"
                    onClick={() => dismiss(t.id)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
