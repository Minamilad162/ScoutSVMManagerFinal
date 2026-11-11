export type StructuredErrorLike = {
  message?: string
  details?: string
  hint?: string
  error_description?: string
  code?: string
}

export type ErrorLike = Error | StructuredErrorLike | string | null | undefined

function isStructuredErrorLike(error: unknown): error is StructuredErrorLike {
  return typeof error === 'object' && error !== null && !(error instanceof Error)
}

export function getErrorMessage(error: unknown, fallback = 'حدث خطأ غير متوقع') {
  if (!error) return fallback
  if (typeof error === 'string') return error

  if (error instanceof Error) {
    const direct = String(error.message || '').trim()
    return direct || fallback
  }

  if (isStructuredErrorLike(error)) {
    const direct = [error.message, error.details, error.hint, error.error_description]
      .map((value) => String(value || '').trim())
      .find(Boolean)

    return direct || fallback
  }

  return fallback
}

export function logError(scope: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(`[${scope}]`, error, extra || {})
}
