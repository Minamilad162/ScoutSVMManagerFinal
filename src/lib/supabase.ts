import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

let scoutYearViewOverrideId: string | null = null
let scoutYearViewReadOnly = false

const HISTORICAL_READ_RPC_ALLOWLIST = new Set([
  'attendance_stats',
  'material_available_qty',
  'material_reservations_by_day_all',
  'search_auth_users',
  'admin_list_auth_accounts',
  'admin_list_unlinked_auth_accounts',
])

function historicalWriteBlockedResponse() {
  return new Response(
    JSON.stringify({
      code: 'HISTORICAL_READ_ONLY',
      message: 'عرض السنة غير الحالية للقراءة فقط. ارجع للسنة الحالية قبل إضافة أو تعديل أو حذف أي بيانات.',
    }),
    { status: 409, headers: { 'Content-Type': 'application/json' } }
  )
}

export function setScoutYearViewOverride(
  scoutYearId?: string | null,
  options?: { readOnly?: boolean }
) {
  scoutYearViewOverrideId = scoutYearId || null
  scoutYearViewReadOnly = Boolean(scoutYearViewOverrideId && options?.readOnly)
}

export function getScoutYearViewOverride() {
  return scoutYearViewOverrideId
}

export function isHistoricalScoutYearView() {
  return Boolean(scoutYearViewOverrideId)
}

export function isScoutYearViewReadOnly() {
  return Boolean(scoutYearViewOverrideId && scoutYearViewReadOnly)
}

const contextAwareFetch: typeof fetch = async (input, init) => {
  const request = typeof Request !== 'undefined' && input instanceof Request ? input : null
  const url = request?.url || String(input)
  const method = String(init?.method || request?.method || 'GET').toUpperCase()
  const headers = new Headers(init?.headers || request?.headers || undefined)

  // Historical archived/past mode is a viewing context only. Draft planning
  // years remain editable for Super Admin setup workflows.
  // A small allowlist keeps known read-only RPCs usable because PostgREST RPC calls use POST.
  if (scoutYearViewReadOnly && scoutYearViewOverrideId && url.includes('/rest/v1/') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const rpcMatch = url.match(/\/rest\/v1\/rpc\/([^?]+)/)
    const rpcName = rpcMatch ? decodeURIComponent(rpcMatch[1]) : ''
    if (!rpcName || !HISTORICAL_READ_RPC_ALLOWLIST.has(rpcName)) {
      return historicalWriteBlockedResponse()
    }
  }

  return fetch(input, { ...init, headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { fetch: contextAwareFetch },
})

/**
 * Returns the normal current-year view during ordinary operation.
 * In Super Admin historical mode it switches to the admin-only all-year view
 * and transparently injects scout_year_id after .select().
 */
export function scoutYearFrom(currentView: string, historicalView: string): any {
  if (!scoutYearViewOverrideId) return supabase.from(currentView as any)

  const base: any = supabase.from(historicalView as any)
  const yearId = scoutYearViewOverrideId

  return new Proxy(base, {
    get(target, prop, receiver) {
      if (prop === 'select') {
        return (...args: any[]) => target.select(...args).eq('scout_year_id', yearId)
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
