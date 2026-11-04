import { scoutYearFrom, supabase } from '../../lib/supabase'
import { fetchCurrentScoutYear, type CurrentScoutYear } from '../reference/api'

const AVATARS_BUCKET = 'avatars'

export type MemberProfileBasic = {
  id: string
  auth_user_id: string | null
  full_name: string
  personal_phone: string | null
  guardian_name: string | null
  guardian_phone: string | null
  birth_date: string | null
  avatar_url: string | null
  whatsapp_opt_in_personal: boolean | null
  whatsapp_opt_in_guardian: boolean | null
  scout_year_id: string
  team_id: string | null
  team_name: string | null
  rank_id: number | null
  rank_label: string | null
  rank_slug: string | null
  is_equipier: boolean
  is_active: boolean
  joined_at: string | null
  left_at: string | null
  season_notes: string | null
  created_at: string | null
}

export type MemberCurrentRole = {
  id: string
  scout_year_id: string
  user_id: string
  role_id: number
  role_slug: string
  role_label: string | null
  team_id: string | null
  team_name: string | null
  is_active: boolean
}

export type MemberProfile360 = {
  currentScoutYear: CurrentScoutYear | null
  member: MemberProfileBasic
  roles: MemberCurrentRole[]
}

function normalizePublicAvatarUrl(raw?: string | null) {
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(raw)
  return data?.publicUrl ?? null
}

export async function fetchMemberProfileBasic(params: { memberId?: string | null; authUserId?: string | null }) {
  let query = scoutYearFrom('v_members_current', 'v_members_context').select('*') as any
  if (params.memberId) query = query.eq('id', params.memberId)
  else if (params.authUserId) query = query.eq('auth_user_id', params.authUserId)
  else throw new Error('يلزم memberId أو authUserId لتحميل ملف العضو')

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return (data || null) as MemberProfileBasic | null
}

export async function fetchMemberCurrentRoles(authUserId: string | null) {
  if (!authUserId) return [] as MemberCurrentRole[]
  const { data, error } = await scoutYearFrom('v_user_roles_current', 'v_user_roles_context')
    .select('id, scout_year_id, user_id, role_id, role_slug, role_label, team_id, team_name, is_active')
    .eq('user_id', authUserId)
    .eq('is_active', true)
    .order('role_label', { ascending: true })
  if (error) throw error
  return (data || []) as MemberCurrentRole[]
}

export async function fetchMemberProfile360(params: { memberId?: string | null; authUserId?: string | null }) {
  const currentScoutYear = await fetchCurrentScoutYear()
  const member = await fetchMemberProfileBasic(params)
  if (!member) return null

  const roles = await fetchMemberCurrentRoles(member.auth_user_id)

  return {
    currentScoutYear,
    member: {
      ...member,
      avatar_url: normalizePublicAvatarUrl(member.avatar_url),
    },
    roles,
  } as MemberProfile360
}

function withCacheBust(url: string) {
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}t=${Date.now()}`
}

export async function uploadMemberAvatar(file: File, memberId: string, teamId?: string | null) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const folder = teamId || 'unassigned'
  const path = `${folder}/${memberId}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase
    .storage.from(AVATARS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) throw uploadError

  const { data: publicData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  const avatarUrl = publicData?.publicUrl ?? path

  const { data: updatedRows, error: rpcError } = await supabase.rpc('set_member_avatar_url', {
    p_member_id: memberId,
    p_avatar_url: avatarUrl,
  })

  if (rpcError) throw rpcError

  const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows
  if (!updated || !updated.avatar_url) {
    throw new Error('تم رفع الصورة لكن تعذر حفظ الرابط داخل ملف العضو')
  }

  return withCacheBust(normalizePublicAvatarUrl(updated.avatar_url) || avatarUrl)
}
