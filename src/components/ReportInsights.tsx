/**
 * תובנות אוטומטיות לדוח.
 *
 * ## למה זה לא שמשון
 *
 * שמשון הוא מודל, והוא עולה כסף, דורש רשת, ועלול לטעות. הדוח המודפס
 * חייב להיות דטרמיניסטי - אותם נתונים תמיד מייצרים אותו דוח.
 *
 * לכן התובנות כאן נגזרות **מהמנוע בלבד**, בקוד. הן עוברות את אותו מבחן
 * שעובר שמשון: לא מנבאות, לא ממליצות על החלטה, וכל מספר מגיע מהחישוב.
 * הן מצביעות על מה שראוי לשים לב אליו, ומשאירות את המסקנה למשתמש.
 */

import type { AnalysisResult } from '@/lib/calc'
import { findKeyExitPoint } from '@/lib/calc'
import { formatILS, formatCompactILS, formatPercentDirect } from '@/lib/format'

type Tone = 'neutral' | 'watch'

interface Insight {
  readonly tone: Tone
  readonly title: string
  readonly body: string
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('he-IL', { month: '2-digit', year: 'numeric' }).format(d)
}

/** כל התובנות נגזרות מהמנוע. בלי תחזיות ובלי המלצות. */
export function buildInsights(a: AnalysisResult): Insight[] {
  const out: Insight[] = []
  const cf = a.metrics.netMonthlyCashflow.value
  const rent = a.cashflow.effectiveRent.monthly
  const payment = a.cashflow.mortgagePayment.monthly

  // 1. התזרים - השאלה הראשונה של כל משקיע.
  if (cf < 0) {
    const annual = Math.abs(cf) * 12
    out.push({
      tone: 'watch',
      title: 'התזרים שלילי',
      body: `כל חודש יוצאים מהכיס ${formatILS(Math.abs(cf))}, כלומר ${formatILS(annual)} בשנה. זה כסף שנוסף להון שהשקעת, והוא נכנס למכנה של התשואה. ודא שיש לך תזרים פנוי לכסות אותו לאורך כל התקופה.`,
    })
  } else {
    out.push({
      tone: 'neutral',
      title: 'התזרים חיובי',
      body: `נכנסים ${formatILS(cf)} בחודש אחרי משכנתא, הוצאות ומס, לפי הנתונים שהזנת.`,
    })
  }

  // 2. כיסוי ההחזר מהשכירות.
  if (payment > 0) {
    const coverage = (rent / payment) * 100
    out.push({
      tone: coverage < 100 ? 'watch' : 'neutral',
      title: `השכירות מכסה ${coverage.toFixed(0)}% מההחזר`,
      body:
        coverage < 100
          ? `ההפרש ${formatILS(payment - rent)} בחודש מגיע מהכיס, וזה לפני הוצאות תפעול ומס.`
          : `השכירות מכסה את ההחזר במלואו, לפני הוצאות תפעול ומס.`,
    })
  }

  // 3. עלות הריבית לאורך חיי ההלוואה.
  const totalInterest = a.mortgage.totalInterest
  if (totalInterest > 0) {
    const totalPaid = a.mortgage.totalPaid
    const share = totalPaid > 0 ? (totalInterest / totalPaid) * 100 : 0
    out.push({
      tone: 'neutral',
      title: `הריבית לאורך כל התקופה: ${formatCompactILS(totalInterest)}`,
      body: `זה ${share.toFixed(0)}% מסך ההחזרים (${formatCompactILS(totalPaid)}). בשנים הראשונות רוב ההחזר הוא ריבית, ולכן יתרת המשכנתא יורדת לאט ומכירה מוקדמת משאירה פחות ביד.`,
    })
  }

  // 4. נקודת היציאה - מה שהמנוע בחר כנקודה המשמעותית.
  const exit = findKeyExitPoint(a.saleSchedule)
  if (exit) {
    const isExempt = exit.reason === 'peak-exempt'
    out.push({
      tone: 'neutral',
      title: `התשואה הגבוהה ביותר ב-${fmtDate(exit.row.saleDate)}`,
      body: isExempt
        ? `באותה נקודה הרווח המצטבר ${formatPercentDirect(exit.row.totalReturnPct)} על ${formatCompactILS(exit.row.totalInvestedSoFar)} שהושקעו, והמכירה פטורה ממס שבח. מכירה מוקדמת יותר חייבת במס ולכן התשואה שם נמוכה.`
        : `באותה נקודה הרווח המצטבר ${formatPercentDirect(exit.row.totalReturnPct)} על ${formatCompactILS(exit.row.totalInvestedSoFar)} שהושקעו. המכירה שם חייבת במס שבח.`,
    })
  }

  // 5. הנחות שמניעות את התוצאה - העיקרון שהכלי לא מנבא.
  out.push({
    tone: 'watch',
    title: 'המספרים תלויים בהנחות שלך',
    body: 'כל מספר עתידי בדוח נגזר מההנחות שהזנת, בעיקר עליית הערך השנתית. הכלי אינו מנבא ואינו ממליץ. שנה את ההנחה ותראה כיצד התמונה משתנה.',
  })

  return out
}

export function ReportInsights({ analysis }: { analysis: AnalysisResult }) {
  const insights = buildInsights(analysis)

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">מה ראוי לשים לב אליו</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          נגזר מהחישוב, לא מהערכה. אלה נקודות לבדיקה ולא המלצות.
        </p>
      </div>

      <ul className="space-y-3">
        {insights.map((it) => (
          <li
            key={it.title}
            className={[
              /*
               * כרטיסי תובנות - עיצוב:
               * neutral: כרטיס בסיסי, גבול רגיל.
               * watch: border-s-2 עם צבע warning בצד ה-start (ימין ב-RTL).
               * גישה זו קלה יותר מרקע צבעוני מלא, ומאפשרת היררכיה ברורה.
               */
              'rounded-[var(--radius)] border bg-[var(--color-card)] p-4',
              it.tone === 'watch'
                ? 'border-[var(--color-border)] border-s-2 border-s-[var(--color-warning)]'
                : 'border-[var(--color-border)]',
            ].join(' ')}
          >
            <div className="text-sm font-semibold">{it.title}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              {it.body}
            </p>
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        הכלי אינו מהווה ייעוץ מס, ייעוץ משכנתאות או ייעוץ השקעות. נתוני מס
        השבח בכלי לא אומתו מול רשות המסים.
      </p>
    </section>
  )
}
