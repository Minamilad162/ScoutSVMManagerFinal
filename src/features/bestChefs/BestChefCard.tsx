import { supabase } from '../../lib/supabase'

export type BestChefCardItem = {
  full_name: string
  team_name?: string | null
  avatar_url?: string | null
  note?: string | null
}

function resolveAvatarUrl(raw?: string | null) {
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  const { data } = supabase.storage.from('avatars').getPublicUrl(raw)
  return data?.publicUrl ?? raw
}

function initials(name?: string | null) {
  const clean = (name || '').trim()
  if (!clean) return '👤'
  const parts = clean.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
}

export function BestChefCard({ item, rank }: { item: BestChefCardItem; rank?: number }) {
  const avatarUrl = resolveAvatarUrl(item.avatar_url)

  return (
    <div className="best-chef-card group relative overflow-hidden rounded-3xl border border-amber-100 bg-gradient-to-br from-white via-amber-50/60 to-orange-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
        ⭐ الأفضل
        {typeof rank === 'number' ? <span className="ms-1 rounded-full bg-white/20 px-1.5 py-0.5">#{rank + 1}</span> : null}
      </div>
      <div className="mt-8 flex flex-col items-center text-center">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={item.full_name}
            className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-md ring-2 ring-amber-100"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-amber-200 via-orange-200 to-rose-200 text-xl font-bold text-slate-700 shadow-md ring-2 ring-amber-100">
            {initials(item.full_name)}
          </div>
        )}
        <div className="mt-4 text-lg font-bold text-slate-900">{item.full_name}</div>
        <div className="mt-1 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
          {item.team_name || 'بدون فريق'}
        </div>
        {item.note ? <div className="mt-3 text-xs leading-6 text-slate-500">{item.note}</div> : null}
      </div>
    </div>
  )
}
