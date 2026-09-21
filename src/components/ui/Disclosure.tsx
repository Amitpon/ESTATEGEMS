/**
 * סקשן מתקפל לתוכן כבד.
 *
 * **למה `<details>` ולא state:** הוא נגיש כברירת מחדל, עובד בלי JS,
 * ובעיקר - הדפדפן פותח אותו אוטומטית בהדפסה ובחיפוש בתוך העמוד. סקשן
 * שמבוסס על state היה נעלם מהדוח המודפס.
 *
 * `summary` מציג גם תקציר מימין, כדי שהמשתמש יידע אם שווה לפתוח.
 */

import { cn } from '@/lib/cn'

export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
}: {
  title: string
  /** מספר או משפט קצר שמוצג בשורת הכותרת, בלי לפתוח. */
  summary?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        'group overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)]',
        // בהדפסה תמיד פתוח, כדי שהדוח יכלול את כל הפירוט.
        'print:open',
        className,
      )}
    >
      {/*
       * summary - min-h-[48px] להבטיח אזור מגע מספיק.
       * הצ'יבון ‹ (שמאל): סגור = מצביע שמאלה, פתוח = rotate-90 -> מצביע מטה.
       * ב-RTL שמאל = כיוון "פנימה", מטה = "פתוח". זה הconvention המקובל.
       */}
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-[var(--color-muted)]">
        <span
          aria-hidden
          className="inline-block text-[var(--color-muted-foreground)] transition-transform duration-200 group-open:rotate-90"
        >
          ‹
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold">{title}</span>
        {summary && (
          <span
            dir="ltr"
            className="shrink-0 text-xs tabular-nums text-[var(--color-muted-foreground)] group-open:hidden"
          >
            {summary}
          </span>
        )}
      </summary>
      <div className="border-t border-[var(--color-border)] p-4">{children}</div>
    </details>
  )
}
