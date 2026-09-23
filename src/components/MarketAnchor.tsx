import type { useMarketAnchor } from '@/hooks/useMarketAnchor'
import { formatILS } from '@/lib/format'

/**
 * העוגן השכונתי - מוצג ליד שדה הכתובת, לא ממלא שום דבר בשביל המשתמש.
 *
 * עיקרון 2 (product-principles): "תפקיד הדאטה לשפר את הקלט, לא להחליף
 * אותו". לכן אין כאן שום כפתור "מלא אוטומטית" - רק תצוגה עם מקור ותאריך.
 */
export function MarketAnchor({
  anchor,
}: {
  anchor: ReturnType<typeof useMarketAnchor>
}) {
  const { status, selected, clear } = anchor

  if (status.kind === 'idle') return null

  return (
    <div className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 text-xs font-medium text-[var(--color-foreground)]">
          {selected?.text ?? 'השכונה שנבחרה'}
        </div>
        <button
          type="button"
          onClick={clear}
          className="shrink-0 text-xs text-[var(--color-muted-foreground)] underline"
        >
          נקה
        </button>
      </div>

      {status.kind === 'loading' && (
        <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
          בודק עסקאות בשכונה...
        </p>
      )}

      {status.kind === 'error' && (
        <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">{status.message}</p>
      )}

      {status.kind === 'insufficient' && (
        <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
          נמצאו רק {status.dealCount} עסקאות באזור - פחות מהמינימום
          ({status.minimum}) להצגת נתון אמין. נסה כתובת אחרת או רחוב סמוך.
        </p>
      )}

      {status.kind === 'ready' && (
        <div className="mt-1.5 space-y-1 text-xs text-[var(--color-muted-foreground)]">
          <p>
            בשכונה הזו: חציון{' '}
            <span dir="ltr" className="font-semibold tabular-nums text-[var(--color-foreground)]">
              {formatILS(status.insights.medianPricePerSqm.value)}
            </span>{' '}
            למ"ר, מבוסס על{' '}
            <span dir="ltr" className="tabular-nums">
              {status.insights.dealCount}
            </span>{' '}
            עסקאות ({status.insights.dateRange.from} עד {status.insights.dateRange.to})
          </p>

          {status.position && (
            <p
              className={
                Math.abs(status.position.deviationPct) <= 5
                  ? 'font-medium text-[var(--color-foreground)]'
                  : status.position.deviationPct > 0
                    ? 'font-medium text-[var(--color-warning)]'
                    : 'font-medium text-[var(--color-positive)]'
              }
            >
              הנכס שהזנת: {status.position.label}
            </p>
          )}

          {status.insights.trend && (
            <p>{status.insights.trend.label}</p>
          )}

          <p className="text-[var(--color-muted-foreground)]/80">
            מקור: נתוני עסקאות רשות המסים דרך govmap.gov.il. זהו תיאור של
            עסקאות שנסגרו, לא תחזית.
          </p>
        </div>
      )}
    </div>
  )
}
