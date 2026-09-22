/**
 * המדד הראשי: התזרים החודשי, ולצידו הרווח בנקודת היציאה המשמעותית.
 *
 * ## למה דווקא הנקודה הזו
 *
 * הכרעת בעל המוצר: בדירה ראשונה יש רגע מוגדר שבו הפטור ממס שבח נכנס -
 * 18 חודשים מהאכלוס. עד אליו המכירה חייבת במס, ואחריו לא. זו נקודת
 * ההשוואה הטבעית, ולכן היא המספר שמוצג.
 *
 * כשזו **אינה** הדירה הראשונה אין פטור, ולכן אין תאריך מפתח. שם מוצגת
 * הנקודה עם התשואה השנתית הגבוהה ביותר, והכותרת אומרת זאת במפורש.
 *
 * המנוע בוחר את השורה (`findKeyExitPoint`). כאן רק מציגים.
 *
 * ## היררכיה ויזואלית
 *
 * תזרים חודשי = מדד #1. הוא תופס רוחב מלא במובייל (col-span-2)
 * ומוצג בגופן גדול יותר. שני המדדים האחרים מוצגים זה לצד זה מתחת.
 * בדסקטופ (sm+) - שלושה עמודות שוות.
 */

import type { KeyExitPoint } from '@/lib/calc'
import { formatILS, formatCompactILS, formatPercentDirect } from '@/lib/format'
import { Card } from '@/components/ui/Card'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('he-IL', { month: '2-digit', year: 'numeric' }).format(d)
}

/** כותרת ההקשר, לפי מה שהמנוע מצא בנקודת השיא. */
const REASON_TEXT: Record<KeyExitPoint['reason'], { title: string; note: string }> = {
  'peak-exempt': {
    title: 'נקודת התשואה הגבוהה ביותר',
    note: 'זו הנקודה שבה התשואה השנתית הגבוהה ביותר לאורך כל הסימולציה, והמכירה בה פטורה ממס שבח. מכירה מוקדמת יותר חייבת במס, ולכן התשואה שם נמוכה.',
  },
  'peak-taxed': {
    title: 'נקודת התשואה הגבוהה ביותר',
    note: 'זו הנקודה שבה התשואה השנתית הגבוהה ביותר לאורך כל הסימולציה. המכירה בה חייבת במס שבח - אין פטור, או שהתנאים לו לא מתקיימים כאן.',
  },
  'end-of-horizon': {
    title: 'סוף תקופת הבדיקה',
    note: 'אין נקודה עם תקופת החזקה של שנה לפחות, ולכן אין תשואה שנתית משמעותית להצגה.',
  },
}

function Big({
  label,
  value,
  tone,
  sub,
  hero = false,
}: {
  label: string
  value: string
  tone?: 'good' | 'bad'
  sub?: string
  hero?: boolean
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
      <div
        dir="ltr"
        className={[
          'mt-1 text-start tabular-nums',
          // hero: text-3xl (mobile) / text-4xl (desktop). משני: text-2xl.
          hero
            ? 'text-3xl font-bold sm:text-4xl'
            : 'text-2xl font-semibold',
          tone === 'good'
            ? 'text-[var(--color-positive)]'
            : tone === 'bad'
              ? 'text-[var(--color-destructive)]'
              : 'text-[var(--color-foreground)]',
        ].join(' ')}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          {sub}
        </div>
      )}
    </div>
  )
}

export function ExitPointHero({
  monthlyCashflow,
  exit,
}: {
  monthlyCashflow: number
  /** null כשאין נקודת יציאה כשירה, למשל לפני שנלקחה משכנתא. */
  exit: KeyExitPoint | null
}) {
  const reason = exit ? REASON_TEXT[exit.reason] : null

  return (
    <Card className="p-4 sm:p-6">
      {/*
       * גריד: 2 עמודות במובייל.
       * התזרים = col-span-2 (מלא) ברוחב, שני המדדים האחרים זה לצד זה מתחתיו.
       * ב-sm+: 3 עמודות שוות.
       * gap-y-4 = 16px בין שורות לנשימה.
       */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
        {/* תזרים חודשי - hero, מלא ברוחב במובייל */}
        <div className="col-span-2 sm:col-span-1">
          <Big
            label="תזרים חודשי נטו"
            value={`${monthlyCashflow >= 0 ? '+' : ''}${formatILS(monthlyCashflow)}`}
            tone={monthlyCashflow >= 0 ? 'good' : 'bad'}
            sub={
              monthlyCashflow >= 0
                ? 'נכנס לכיס כל חודש'
                : 'יוצא מהכיס כל חודש, מעבר להון שהושקע'
            }
            hero
          />
        </div>

        {/* שני המדדים הנוספים - מוצגים רק כשיש נקודת יציאה */}
        {exit && (
          <>
            <Big
              label={`רווח מצטבר במכירה ב-${fmtDate(exit.row.saleDate)}`}
              value={formatPercentDirect(exit.row.totalReturnPct)}
              tone={exit.row.totalReturnPct >= 0 ? 'good' : 'bad'}
              sub={`${formatCompactILS(exit.row.totalProfit)} בשקלים, על ${formatCompactILS(exit.row.totalInvestedSoFar)} שהושקעו`}
            />
            <Big
              label={`ממוצע לשנה עד ${fmtDate(exit.row.saleDate)}`}
              value={
                exit.row.averageAnnualReturnPct === null
                  ? 'לא רלוונטי'
                  : formatPercentDirect(exit.row.averageAnnualReturnPct)
              }
              tone={
                exit.row.averageAnnualReturnPct === null
                  ? undefined
                  : exit.row.averageAnnualReturnPct >= 0
                    ? 'good'
                    : 'bad'
              }
              sub={
                exit.row.averageAnnualReturnPct === null
                  ? 'תקופת החזקה קצרה מ-12 חודשים'
                  : `מחולק ב-${(exit.row.capitalGains.holdingMonths / 12).toFixed(1)} שנים בפועל`
              }
            />
          </>
        )}
      </div>

      {reason && (
        <div className="mt-5 border-t border-[var(--color-border)] pt-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold">{reason.title}</span>
            <span dir="ltr" className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
              {fmtDate(exit!.row.saleDate)}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
            {reason.note}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-warning)]">
            המספרים לפי ההנחות שהזנת, ונתוני מס השבח בכלי לא אומתו מול רשות
            המסים. לפני החלטה בדוק מול יועץ מס.
          </p>
        </div>
      )}

      {!exit && (
        <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          אין עדיין נקודת מכירה משמעותית להצגה. בדירה על הנייר זה קורה כשכל
          נקודות היציאה נופלות לפני שנלקחה המשכנתא.
        </p>
      )}
    </Card>
  )
}
