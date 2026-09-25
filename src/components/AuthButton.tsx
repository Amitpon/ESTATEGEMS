/**
 * AuthButton - כפתור/תפריט התחברות בפינת ה-header.
 *
 * שלושה מצבים:
 *  1. isAppwriteConfigured() === false → null (הכלי עובד בלי Appwrite בסביבת dev)
 *  2. לא מחובר → כפתור "התחבר" + modal עם Google / אימייל+סיסמה
 *  3. מחובר → שם קצר + כפתור "התנתק"
 *
 * הפניה ל-OAuth (loginWithGoogle) היא redirect - אין promise ממושך.
 * שפה עיצובית: כמו ShimshonChat - כל צבע דרך var(--color-*), logical properties.
 */

import { useEffect, useRef, useState } from 'react'
import {
  getCurrentUser,
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  logout,
  isAppwriteConfigured,
  type AppwriteUser,
} from '@/services/appwrite'

type Tab = 'login' | 'register'

export function AuthButton() {
  // אם Appwrite לא מוגדר - לא מרנדרים כלום
  if (!isAppwriteConfigured()) return null

  return <AuthButtonInner />
}

/** הקומפוננטה הפנימית - רצה רק כש-Appwrite מוגדר */
function AuthButtonInner() {
  const [user, setUser] = useState<AppwriteUser | null | 'loading'>('loading')
  const [modalOpen, setModalOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // טוען את המשתמש הנוכחי בטעינה ראשונה
  useEffect(() => {
    getCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
  }, [])

  // פותח/סוגר את ה-dialog הנייטיבי
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (modalOpen) {
      el.showModal()
    } else {
      el.close()
    }
  }, [modalOpen])

  function openModal() {
    setFormError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEmail('')
    setPassword('')
    setName('')
    setFormError(null)
  }

  async function handleGoogleLogin() {
    // loginWithGoogle מבצע redirect - אין צורך בטיפול בתוצאה
    try {
      await loginWithGoogle()
    } catch {
      setFormError('לא הצליח לפתוח את חלון Google. נסה שוב.')
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const u =
        tab === 'login'
          ? await loginWithEmail(email, password)
          : await registerWithEmail(email, password, name)
      setUser(u)
      closeModal()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'שגיאה בהתחברות. בדוק את הפרטים ונסה שוב.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogout() {
    await logout().catch(() => null)
    setUser(null)
  }

  if (user === 'loading') {
    // שלד זעיר עד שהסטטוס נטען
    return (
      <div
        className="h-8 w-20 animate-pulse rounded-full bg-[var(--color-muted)]"
        aria-hidden
      />
    )
  }

  if (user !== null) {
    // מצב מחובר - שם קצר + התנתק
    const displayName = user.name || user.email.split('@')[0] || 'משתמש'
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-sm text-[var(--color-muted-foreground)] sm:block">
          {displayName}
        </span>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="min-h-[44px] rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-foreground)] transition hover:bg-[var(--color-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          התנתק
        </button>
      </div>
    )
  }

  // מצב לא מחובר
  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="min-h-[44px] rounded-full bg-[var(--color-cta)] px-4 py-2 text-sm font-semibold text-[var(--color-cta-foreground)] transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        התחבר
      </button>

      {/* dialog נייטיבי - נגיש, חוסם רקע, נסגר ב-Escape */}
      {/* backdrop מוגדר ב-CSS הגלובלי כי Tailwind לא מייצר ::backdrop */}
      <dialog
        ref={dialogRef}
        onClose={closeModal}
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-0 shadow-2xl backdrop:bg-black/50 open:flex open:flex-col"
        dir="rtl"
        aria-labelledby="auth-modal-title"
      >
        {/* כותרת */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <h2
            id="auth-modal-title"
            className="text-base font-semibold text-[var(--color-foreground)]"
          >
            כניסה לחשבון
          </h2>
          <button
            type="button"
            onClick={closeModal}
            aria-label="סגור"
            className="rounded-lg p-2 text-[var(--color-muted-foreground)] transition hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Google */}
          <button
            type="button"
            onClick={() => void handleGoogleLogin()}
            className="flex min-h-[44px] w-full items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] transition hover:bg-[var(--color-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            {/* Google "G" ב-SVG - אין תלות חיצונית */}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              />
            </svg>
            המשך עם Google
          </button>

          {/* מפריד */}
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-muted-foreground)]">או עם אימייל</span>
            <hr className="flex-1 border-[var(--color-border)]" />
          </div>

          {/* טאבים: כניסה / הרשמה */}
          <div className="flex rounded-xl border border-[var(--color-border)] p-1">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setFormError(null) }}
                className={[
                  'min-h-[36px] flex-1 rounded-lg text-sm font-medium transition',
                  tab === t
                    ? 'bg-[var(--color-brand-accent)] text-white'
                    : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
                ].join(' ')}
              >
                {t === 'login' ? 'כניסה' : 'הרשמה'}
              </button>
            ))}
          </div>

          {/* טופס */}
          <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3">
            {tab === 'register' && (
              <div className="space-y-1">
                <label
                  htmlFor="auth-name"
                  className="block text-sm font-medium text-[var(--color-foreground)]"
                >
                  שם מלא
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={tab === 'register'}
                  autoComplete="name"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]"
                />
              </div>
            )}

            <div className="space-y-1">
              <label
                htmlFor="auth-email"
                className="block text-sm font-medium text-[var(--color-foreground)]"
              >
                אימייל
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete={tab === 'login' ? 'email' : 'email'}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="auth-password"
                className="block text-sm font-medium text-[var(--color-foreground)]"
              >
                סיסמה
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]"
              />
            </div>

            {formError && (
              <p
                role="alert"
                className="rounded-xl bg-[var(--color-destructive-bg)] px-3 py-2 text-sm text-[var(--color-destructive)]"
              >
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] w-full rounded-xl bg-[var(--color-cta)] px-4 py-2 text-sm font-semibold text-[var(--color-cta-foreground)] transition hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
            >
              {submitting ? 'מתחבר...' : tab === 'login' ? 'כניסה' : 'יצירת חשבון'}
            </button>
          </form>
        </div>
      </dialog>
    </>
  )
}
