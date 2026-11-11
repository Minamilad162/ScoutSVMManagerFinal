import { useEffect, useState } from 'react'
import scoutSvmOfficialLogo from '../assets/brand/scout-svm-official-logo.webp'
import scoutLantern from '../assets/auth/scout-lantern.png'
import scoutCompassScarf from '../assets/auth/scout-compass-scarf.png'
import scoutTent from '../assets/auth/scout-tent.png'
import { useToast } from '../components/ui/Toaster'
import { InlineAlert } from '../components/ui/InlineAlert'
import { LoadingButton } from '../components/ui/LoadingButton'
import { useAuth } from '../components/AuthProvider'

function AuthBackdrop() {
  return (
    <>
      <div className="auth128-sky" aria-hidden="true" />
      <div className="auth128-sun" aria-hidden="true" />
      <div className="auth128-mountain auth128-mountain-back" aria-hidden="true" />
      <div className="auth128-mountain auth128-mountain-front" aria-hidden="true" />
      <div className="auth128-pines auth128-pines-left" aria-hidden="true" />
      <div className="auth128-pines auth128-pines-right" aria-hidden="true" />
      <img src={scoutTent} alt="" className="auth128-tent" aria-hidden="true" draggable={false} />
      <img src={scoutLantern} alt="" className="auth128-lantern" aria-hidden="true" draggable={false} />
      <img src={scoutCompassScarf} alt="" className="auth128-compass" aria-hidden="true" draggable={false} />
    </>
  )
}

function BrandHeader() {
  return (
    <div className="auth128-brand relative text-center">
      <img
        src={scoutSvmOfficialLogo}
        alt="شعار مجموعة ScoutSVM"
        className="auth128-logo mx-auto h-auto select-none"
        draggable={false}
      />
      <div className="auth128-brand-name">ScoutSVM</div>
      <div className="auth128-brand-ar">إدارة المجموعة الكشفية</div>
      <div className="auth128-brand-en">Scout Group Management System</div>
      <div className="auth128-landscape-mark" aria-hidden="true">
        <span className="auth128-mini-pines">▲ ▲</span>
        <span className="auth128-mini-tent">⌂</span>
        <span className="auth128-mini-pines">▲ ▲</span>
      </div>
    </div>
  )
}

function CardWave() {
  return (
    <div className="auth128-card-wave" aria-hidden="true">
      <span className="auth128-wave-gold" />
      <span className="auth128-wave-blue" />
      <span className="auth128-wave-navy" />
    </div>
  )
}

export default function Login() {
  const toast = useToast()
  const {
    signInWithPassword,
    accountInactive,
    accountInactiveReason,
    clearInactiveAccount,
  } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [hint, setHint] = useState('')
  const [inlineError, setInlineError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
      const target = '/reset-password' + (search || '') + (hash ? `#${hash}` : '')
      window.location.replace(target)
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setInlineError('اكتب البريد الإلكتروني وكلمة المرور')
      return
    }

    setInlineError('')
    setLoading(true)
    try {
      const result = await signInWithPassword(email.trim(), password)
      if (!result.active) return
      window.location.replace('/app')
    } catch (err: any) {
      const message = err?.message || 'تعذر تسجيل الدخول'
      setInlineError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  function backToLogin() {
    clearInactiveAccount()
    setPassword('')
    setInlineError('')
  }

  return (
    <main className="auth128-shell min-h-screen" dir="rtl">
      <AuthBackdrop />

      <section className="auth128-stage relative mx-auto flex min-h-screen w-full items-center justify-center px-4 py-5 sm:px-6 lg:px-10">
        <div className={`auth128-card ${accountInactive ? 'auth128-card-inactive' : ''}`}>
          <BrandHeader />

          {accountInactive ? (
            <div className="auth128-inactive-content relative">
              <div className="auth128-warning" aria-hidden="true">
                <span className="auth128-warning-rays" />
                <span>!</span>
              </div>

              <div className="auth128-inactive-message">
                <h1>هذا الحساب غير نشط للسنة الحالية.</h1>
                <p>This account is not active for the current year.</p>
              </div>

              <p className="auth128-inactive-reason">
                {accountInactiveReason || 'تواصل مع مسؤول النظام لإضافتك إلى السنة الكشفية الحالية.'}
              </p>

              <button type="button" className="auth128-primary auth128-return" onClick={backToLogin}>
                <span className="auth128-button-icon" aria-hidden="true">↩</span>
                <span>
                  <strong>العودة إلى تسجيل الدخول</strong>
                  <small>Return to Login</small>
                </span>
              </button>
            </div>
          ) : (
            <>
              <div className="auth128-copy relative text-center">
                <h1>تسجيل الدخول</h1>
                <p className="auth128-copy-ar">ادخل بيانات حسابك للوصول إلى النظام</p>
                <p className="auth128-copy-en">Sign in to your account</p>
              </div>

              {hint ? (
                <div className="relative mt-4">
                  <InlineAlert tone="info">{hint}</InlineAlert>
                </div>
              ) : null}

              {inlineError ? (
                <div className="auth128-error" role="alert">
                  <span aria-hidden="true">!</span>
                  <p>{inlineError}</p>
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="auth128-form relative" noValidate>
                <label className="auth128-field">
                  <span className="auth128-field-icon" aria-hidden="true">♙</span>
                  <span className="auth128-field-copy">
                    <strong>البريد الإلكتروني</strong>
                    <small>Email</small>
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    dir="ltr"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>

                <label className="auth128-field">
                  <span className="auth128-field-icon" aria-hidden="true">▣</span>
                  <span className="auth128-field-copy">
                    <strong>كلمة المرور</strong>
                    <small>Password</small>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    dir="ltr"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    className="auth128-eye"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? '◉' : '◎'}
                  </button>
                </label>

                <LoadingButton loading={loading} type="submit" className="auth128-primary auth128-submit">
                  <span className="auth128-button-icon" aria-hidden="true">↪</span>
                  <span>
                    <strong>تسجيل الدخول</strong>
                    <small>Sign In</small>
                  </span>
                </LoadingButton>
              </form>
            </>
          )}

          <CardWave />
        </div>
      </section>
    </main>
  )
}
