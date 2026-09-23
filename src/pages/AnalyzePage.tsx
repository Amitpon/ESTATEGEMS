import { useState } from 'react'
import { Link } from 'wouter'
import type { PropertyAnalysis } from '@/hooks/usePropertyAnalysis'
import { InputPage } from '@/pages/InputPage'
import { ResultsPage } from '@/pages/ResultsPage'
import { ShimshonChat } from '@/components/ShimshonChat'
import { PrintReport } from '@/components/PrintReport'
import { AuthButton } from '@/components/AuthButton'
import { isAppwriteConfigured } from '@/services/appwrite'

/**
 * מסך הניתוח הראשי - header, ניווט בין שני השלבים, וטעינת שני ה-pages.
 * `analysis` מגיע מ-`App.tsx` (לא נוצר כאן) כדי ש-/properties יוכל
 * לטעון נכס שמור לתוך אותו state ולחזור לכאן.
 */
export function AnalyzePage({ analysis }: { analysis: PropertyAnalysis }) {
  // במובייל מוצג שלב אחד בכל רגע - הכרעת בעל המוצר, כדי שלא צריך לגלול
  // מאות פיקסלים כדי לראות תוצאה. מ-sm ומעלה שני הטורים גלויים יחד
  // וה-state הזה חסר משמעות (ראה `sm:block` למטה).
  const [step, setStep] = useState<'input' | 'results'>('input')

  return (
    <div className="min-h-dvh bg-[var(--color-muted)] pb-16 text-[var(--color-foreground)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-lg object-cover" />
            <div>
              <h1 className="text-lg font-bold">Estate Gems</h1>
              <p className="text-xs text-[var(--color-muted-foreground)]">ניתוח דירה להשקעה בישראל</p>
            </div>
          </div>
          <div data-no-print className="flex items-center gap-3">
            <span className="hidden rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] sm:inline">
              הנתונים נשמרים במכשיר שלך בלבד
            </span>
            {isAppwriteConfigured() && (
              <Link
                href="/properties"
                className="min-h-[44px] flex items-center rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-foreground)] transition hover:bg-[var(--color-muted)]"
              >
                הנכסים שלי
              </Link>
            )}
            <AuthButton />
          </div>
        </div>
      </header>

      <div data-no-print className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-card)]/95 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-3xl gap-1 px-4 py-2">
          {(
            [
              ['input', 'הנתונים שלי'],
              ['results', 'התוצאות'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-current={step === v ? 'step' : undefined}
              onClick={() => setStep(v)}
              className={
                step === v
                  ? 'flex-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white'
                  : 'flex-1 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted-foreground)]'
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl gap-6 px-4 py-4 sm:grid sm:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] sm:items-start">
        <div data-print-section className={`space-y-4 ${step === 'input' ? '' : 'hidden'} sm:block`}>
          <InputPage analysis={analysis} onShowResults={() => setStep('results')} />
        </div>

        <div data-print-section className={`space-y-4 ${step === 'results' ? '' : 'hidden'} sm:block`}>
          <ResultsPage analysis={analysis} panel={analysis.panel} />
        </div>
      </main>

      {analysis.result.ok && <PrintReport analysis={analysis.result.data} />}

      <ShimshonChat context={analysis.shimshonContext} />
    </div>
  )
}
