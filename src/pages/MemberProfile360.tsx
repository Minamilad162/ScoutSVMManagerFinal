import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../components/AuthProvider'
import { PageLoader } from '../components/ui/PageLoader'
import { PageHero } from '../components/ui/PageHero'
import { SectionCard } from '../components/ui/SectionCard'
import { InlineAlert } from '../components/ui/InlineAlert'
import { EmptyState } from '../components/ui/EmptyState'
import { LoadingButton } from '../components/ui/LoadingButton'
import { useToast } from '../components/ui/Toaster'
import { fetchCurrentUserContext } from '../features/reference/api'
import {
  fetchMemberProfile360,
  uploadMemberAvatar,
  type MemberProfile360,
} from '../features/memberProfile/api'
import { getErrorMessage, logError } from '../lib/errors'

function initialsFromName(name?: string | null) {
  const clean = (name || '').trim()
  if (!clean) return '👤'
  const parts = clean.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '👤'
}

function roleTone(roleSlug: string) {
  if (roleSlug === 'admin') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (roleSlug === 'chef_de_legion') return 'border-indigo-200 bg-indigo-50 text-indigo-700'
  if (roleSlug === 'responsable_secretary') return 'border-sky-200 bg-sky-50 text-sky-700'
  if (roleSlug === 'responsable_finance') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function canAccessTarget(args: {
  profile: MemberProfile360
  currentUserId?: string | null
  currentMemberId?: string | null
  currentTeamId?: string | null
  roles: Array<{ role_slug: string; team_id: string | null }>
}) {
  const { profile, currentUserId, currentMemberId, currentTeamId, roles } = args
  const isSelf = profile.member.auth_user_id === currentUserId || profile.member.id === currentMemberId
  if (isSelf) return true

  const isAdmin = roles.some((role) => role.role_slug === 'admin')
  if (isAdmin) return true

  const isGlobalSecretary = roles.some(
    (role) => role.role_slug === 'responsable_secretary' && (role.team_id === null || role.team_id === undefined)
  )
  if (isGlobalSecretary) return true

  const sameTeam = currentTeamId && profile.member.team_id && currentTeamId === profile.member.team_id
  const canManageTeam = roles.some((role) => ['chef_de_legion', 'responsable_secretary'].includes(role.role_slug))

  return Boolean(sameTeam && canManageTeam)
}

function phoneValue(profile: MemberProfile360) {
  return profile.member.personal_phone || profile.member.guardian_phone || '—'
}

export default function MemberProfile360Page() {
  const { user, roles, myTeamId } = useAuth()
  const { memberId } = useParams()
  const toast = useToast()
  const nav = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<MemberProfile360 | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, user?.id])

  async function load() {
    setLoading(true)
    setError(null)

    try {
      const currentContext = await fetchCurrentUserContext(user?.id)
      const nextProfile = await fetchMemberProfile360(
        memberId ? { memberId } : { authUserId: user?.id ?? null }
      )

      if (!nextProfile) {
        setProfile(null)
        setError('تعذر العثور على ملف العضو داخل السنة الحالية.')
        return
      }

      const allowed = canAccessTarget({
        profile: nextProfile,
        currentUserId: user?.id ?? null,
        currentMemberId: currentContext.member_id,
        currentTeamId: currentContext.team_id ?? myTeamId,
        roles,
      })

      if (!allowed) {
        setProfile(null)
        setError('لا تملك صلاحية عرض هذا الملف الشخصي.')
        return
      }

      setProfile(nextProfile)
    } catch (err) {
      logError('MemberProfile360.load', err as any, { memberId, userId: user?.id })
      setError(getErrorMessage(err, 'تعذر تحميل ملف العضو'))
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const isSelfProfile = useMemo(() => {
    if (!profile) return false
    return profile.member.auth_user_id === user?.id
  }, [profile, user?.id])

  const canEditAvatar = useMemo(() => {
    if (!profile) return false
    const isAdmin = roles.some((role) => role.role_slug === 'admin')
    const isGlobalSecretary = roles.some(
      (role) => role.role_slug === 'responsable_secretary' && (role.team_id === null || role.team_id === undefined)
    )
    return isSelfProfile || isAdmin || isGlobalSecretary
  }, [profile, roles, isSelfProfile])

  async function handleAvatarChange(file: File | null) {
    if (!profile || !file) return
    if (!canEditAvatar) {
      toast.error('لا تملك صلاحية تعديل الصورة الشخصية لهذا الملف')
      return
    }

    if (!file.type.startsWith('image/')) {
      toast.error('الملف المختار يجب أن يكون صورة')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('الحد الأقصى المسموح به للصورة هو 5MB')
      return
    }

    setUploadingAvatar(true)
    try {
      const nextUrl = await uploadMemberAvatar(file, profile.member.id, profile.member.team_id)
      setProfile((prev) => (prev ? { ...prev, member: { ...prev.member, avatar_url: nextUrl } } : prev))
      toast.success('تم تحديث الصورة الشخصية وحفظ الرابط داخل الملف بنجاح')
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'تعذر رفع الصورة الشخصية'))
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading) {
    return <PageLoader visible text="جاري تحميل الملف الشخصي..." />
  }

  if (!profile) {
    return (
      <div className="member98-profile-page space-y-6 p-4 md:p-6">
        <PageHero
          className="member98-profile-hero"
          eyebrow="👤 الملف الشخصي"
          title="الملف الشخصي غير متاح"
          description="إما أن العضو غير موجود داخل السنة الحالية أو أنك لا تملك صلاحية الوصول لهذا الملف."
          actions={
            <button
              type="button"
              onClick={() => nav(-1)}
              className="members98-hero-link rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-sm"
            >
              رجوع
            </button>
          }
        />
        {error ? <InlineAlert tone="error" title="تعذر فتح الملف الشخصي">{error}</InlineAlert> : null}
        <EmptyState title="لا توجد بيانات" description="جرّب الرجوع ثم فتح الملف من جديد من قائمة الأعضاء أو الصفحة الرئيسية." />
      </div>
    )
  }

  return (
    <div className="member98-profile-page space-y-6 p-4 md:p-6">
      <PageHero
        className="member98-profile-hero"
        eyebrow="👤 الملف الشخصي"
        title={profile.member.full_name}
        badge={
          <span className="members98-year-badge inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold shadow-sm">
            {profile.currentScoutYear?.name || 'السنة الحالية'}
          </span>
        }
        description="الصورة الشخصية والبيانات الأساسية والمسؤوليات الحالية داخل السنة الكشفية الحالية."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => nav(-1)}
              className="members98-hero-link rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-sm"
            >
              رجوع
            </button>
            <Link
              to="/app/member-profile"
              className="member98-primary-link rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              ملفي الشخصي
            </Link>
          </div>
        }
      />

      {error ? <InlineAlert tone="error" title="تنبيه">{error}</InlineAlert> : null}

      <SectionCard className="member98-profile-card" title="البيانات الأساسية" description="الصفحة تعرض فقط البيانات المطلوبة داخل السنة الحالية، مع إمكانية تحديث الصورة الشخصية.">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex flex-col items-center gap-3 lg:w-64">
            {profile.member.avatar_url ? (
              <img
                src={profile.member.avatar_url}
                alt={profile.member.full_name}
                className="member98-avatar h-36 w-36 rounded-full border object-cover shadow-sm"
              />
            ) : (
              <div className="member98-avatar member98-avatar-fallback flex h-36 w-36 items-center justify-center rounded-full border text-4xl font-black shadow-sm">
                {initialsFromName(profile.member.full_name)}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleAvatarChange(e.target.files?.[0] ?? null)}
            />

            {canEditAvatar ? (
              <LoadingButton loading={uploadingAvatar} onClick={() => fileInputRef.current?.click()}>
                {profile.member.avatar_url ? 'تحديث الصورة الشخصية' : 'رفع صورة شخصية'}
              </LoadingButton>
            ) : null}
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <InfoField label="الاسم" value={profile.member.full_name} />
            <InfoField label="رقم التليفون" value={phoneValue(profile)} />
            <InfoField label="الفريق" value={profile.member.team_name || 'بدون فريق'} />
            <ResponsibilitiesField roles={profile.roles} />
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="member98-info-field rounded-2xl border bg-white px-4 py-4 shadow-sm">
      <div className="member98-info-label text-xs font-medium">{label}</div>
      <div className="member98-info-value mt-1 text-sm font-semibold">{value}</div>
    </div>
  )
}

function ResponsibilitiesField({ roles }: { roles: MemberProfile360['roles'] }) {
  return (
    <div className="member98-info-field member98-responsibilities rounded-2xl border bg-white px-4 py-4 shadow-sm md:col-span-2">
      <div className="text-xs font-medium text-slate-500">المسؤوليات</div>
      {roles.length === 0 ? (
        <div className="mt-2 text-sm font-semibold text-slate-700">لا توجد مسؤوليات حالية</div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {roles.map((role) => (
            <span
              key={role.id}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${roleTone(role.role_slug)}`}
            >
              <span>{role.role_label || role.role_slug}</span>
              {role.team_name ? <span className="text-slate-300">•</span> : null}
              {role.team_name ? <span>{role.team_name}</span> : null}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
