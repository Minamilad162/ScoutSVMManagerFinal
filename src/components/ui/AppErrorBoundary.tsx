import React from 'react'
import { getErrorMessage, logError } from '../../lib/errors'

type State = { hasError: boolean; message: string | null }

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, message: null }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: getErrorMessage(error as any, 'حصل خطأ غير متوقع في الصفحة.'),
    }
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    logError('AppErrorBoundary', error as any, { componentStack: errorInfo.componentStack })
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="mx-auto max-w-2xl rounded-[30px] border border-rose-200/70 bg-white/78 p-6 shadow-2xl backdrop-blur-2xl">
          <div className="text-xl font-black text-slate-800">حدث خطأ غير متوقع</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{this.state.message || 'يرجى إعادة تحميل الصفحة والمحاولة مرة أخرى.'}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-2xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-900/10 hover:bg-indigo-700"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      </div>
    )
  }
}
