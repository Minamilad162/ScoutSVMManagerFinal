// src/pages/Login.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toaster'
import { InlineAlert } from '../components/ui/InlineAlert'
import { LoadingButton } from '../components/ui/LoadingButton'

export default function Login() {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState('')

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const search = window.location.search

    const hp = new URLSearchParams(hash)
    const qp = new URLSearchParams(search)

    const hasRecoveryInHash = hp.get('type') === 'recovery'
    const hasRecoveryInQuery =
      qp.get('type') === 'recovery' || qp.get('token_hash') || qp.get('code')

    if (hasRecoveryInHash || hasRecoveryInQuery) {
      setHint('جارٍ تحويلك إلى صفحة إعادة تعيين كلمة المرور…')
      const target =
        '/reset-password' +
        (search || '') +
        (hash ? `#${hash}` : '')
      window.location.replace(target)
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('اكتب البريد وكلمة السر')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      window.location.replace('/app')
    } catch (err: any) {
      toast.error(err?.message || 'تعذر تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page-shell relative min-h-screen overflow-hidden px-4 py-8 md:px-6 md:py-10">
      <div className="login-page-ambient login-page-ambient-one" aria-hidden="true" />
      <div className="login-page-ambient login-page-ambient-two" aria-hidden="true" />
      <div className="login-page-ambient login-page-ambient-three" aria-hidden="true" />

      <div className="login-page-grid relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="login-premium-card relative w-full max-w-md overflow-hidden rounded-[34px] border border-white/35 px-6 py-7 shadow-2xl backdrop-blur-2xl md:px-8 md:py-8">
          <div className="login-premium-shine" aria-hidden="true" />
          <div className="relative text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/50 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(74,222,128,0.18)]" aria-hidden="true" />
              Scout SVM Manager
            </div>

            <img
              src="/icons/icon-512.png"
              alt="Scout SVM Logo"
              className="mx-auto mt-5 h-auto w-24 select-none md:w-28"
              draggable={false}
            />

            <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 md:text-[2rem]">
              تسجيل الدخول
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-600 md:text-[15px]">
              ادخل على حسابك للوصول للوحة التشغيل والمتابعة اليومية بشكل أوضح وأهدأ وبواجهة أكثر ترتيبًا.
            </p>
          </div>

          {hint ? (
            <div className="relative mt-5">
              <InlineAlert tone="info">{hint}</InlineAlert>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="relative mt-6 space-y-4">
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-slate-700">البريد الإلكتروني</label>
              <input
                type="email"
                className="login-premium-input w-full rounded-[20px] border px-4 py-3.5"
                placeholder="example@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-slate-700">كلمة السر</label>
              <input
                type="password"
                className="login-premium-input w-full rounded-[20px] border px-4 py-3.5"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div className="pt-1">
              <LoadingButton loading={loading} type="submit" className="login-premium-submit w-full rounded-[20px] px-4 py-3.5 text-sm font-black">
                دخول
              </LoadingButton>
            </div>
          </form>

          <div className="relative mt-5 flex items-center justify-center gap-2 text-center text-xs text-slate-500 md:text-sm">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
            واجهة محسّنة بتجربة أكثر هدوءًا ووضوحًا.
          </div>
        </div>
      </div>
    </div>
  )
}
