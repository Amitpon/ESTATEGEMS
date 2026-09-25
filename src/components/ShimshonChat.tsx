/**
 * ממשק השיחה של שמשון.
 *
 * עיקרון 4 מחייב גילוי נאות **נראה**, לא מוסתר בהגדרות - הוא מוצג בראש
 * הפאנל בפתיחה ונשאר נגיש בכל רגע.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  askShimshon,
  ShimshonError,
  SHIMSHON_DAILY_LIMIT,
  SHIMSHON_DISCLAIMER,
  type ShimshonTurn,
} from '@/services/shimshon'

/** שאלות פתיחה. מנוסחות כהסבר ולא כבקשת המלצה - עיקרון 4. */
const STARTERS = [
  'למה התזרים שלי שלילי?',
  'מה זה מס רכישה ואיך הוא חושב כאן?',
  'מה הכי חשוף לסיכון בעסקה הזו?',
  'מה שכחתי להזין?',
] as const

interface Props {
  /** ההקשר מהמנוע. null כשהחישוב נכשל - אז שמשון מושבת. */
  readonly context: string | null
}

export function ShimshonChat({ context }: Props) {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<ShimshonTurn[]>([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [turns, streaming])

  const send = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || streaming || !context) return

      setDraft('')
      setError(null)
      setStreaming(true)
      // התור של המשתמש נכנס מיד, ואחריו תא ריק שיתמלא תוך כדי הזרמה.
      const history = turns
      setTurns((t) => [...t, { role: 'user', content: q }, { role: 'assistant', content: '' }])

      try {
        const left = await askShimshon({
          question: q,
          context,
          history,
          onChunk: (text) =>
            setTurns((t) => {
              const next = [...t]
              const last = next[next.length - 1]
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { role: 'assistant', content: last.content + text }
              }
              return next
            }),
        })
        if (left !== null) setRemaining(left)
      } catch (e) {
        // התא הריק מוסר כדי שלא תישאר בועה ריקה על המסך.
        setTurns((t) => t.slice(0, -1))
        setError(e instanceof ShimshonError ? e.message : 'שמשון לא זמין כרגע. נסה שוב.')
      } finally {
        setStreaming(false)
      }
    },
    [context, streaming, turns],
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 end-5 z-50 flex items-center gap-2 rounded-full bg-[var(--color-cta)] px-5 py-3 text-sm font-semibold text-[var(--color-cta-foreground)] shadow-lg transition hover:opacity-90 focus:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-ring)]"
        style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
        data-no-print
      >
        <span aria-hidden>💬</span>
        שאל את שמשון
      </button>
    )
  }

  return (
    <div data-no-print className="fixed inset-x-0 bottom-0 z-50 sm:inset-x-auto sm:end-5 sm:bottom-5 sm:w-[420px]">
      <div className="flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl sm:max-h-[70dvh] sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-foreground)]">שמשון</h2>
            {remaining !== null && (
              <p className="text-xs text-[var(--color-muted-foreground)] tabular-nums">
                נותרו {remaining} מתוך {SHIMSHON_DAILY_LIMIT} שאלות היום
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="סגור את שמשון"
            className="rounded-lg p-2 text-[var(--color-muted-foreground)] transition hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            ✕
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <p className="rounded-xl bg-[var(--color-warning-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--color-warning)]">
            {SHIMSHON_DISCLAIMER}
          </p>

          {turns.length === 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-medium text-[var(--color-muted-foreground)]">אפשר להתחיל מאחת מאלה:</p>
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  disabled={!context}
                  className="block w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-start text-sm text-[var(--color-foreground)] transition hover:border-[var(--color-ring)] hover:bg-[var(--color-accent)] disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {turns.map((t, i) => (
            <div
              key={i}
              className={
                t.role === 'user'
                  ? 'ms-auto max-w-[85%] rounded-2xl bg-[var(--color-primary)] px-3 py-2 text-sm text-white'
                  : 'me-auto max-w-[90%] rounded-2xl bg-[var(--color-muted)] px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-foreground)]'
              }
            >
              {t.content || (streaming && i === turns.length - 1 ? 'חושב...' : '')}
            </div>
          ))}

          {error && (
            <p className="rounded-xl bg-[var(--color-destructive-bg)] px-3 py-2 text-sm text-[var(--color-destructive)]">{error}</p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send(draft)
          }}
          className="flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-card)] px-3 py-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={context ? 'שאל על הנתונים שלך' : 'תקן את שגיאת החישוב קודם'}
            disabled={streaming || !context}
            maxLength={1000}
            className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:bg-[var(--color-muted)]"
          />
          <button
            type="submit"
            disabled={streaming || !draft.trim() || !context}
            className="rounded-xl bg-[var(--color-cta)] px-4 py-2 text-sm font-semibold text-[var(--color-cta-foreground)] transition hover:opacity-90 disabled:opacity-40"
          >
            {streaming ? '...' : 'שלח'}
          </button>
        </form>
      </div>
    </div>
  )
}
