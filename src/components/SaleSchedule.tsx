/**
 * "כמה נרוויח אם נמכור בכל שנה".
 *
 * שלושה כללים שנגזרים מעיקרון 1 ומהבאגים שנמצאו במוצר הקודם:
 * 1. אין ניסוח של ודאות. אלה הרצות של ההנחות, וזה כתוב בראש.
 * 2. אין סימון של שנה מועדפת ואין המלצה מתי למכור.
 * 3. תשואה שנתית ממוצעת לא מוצגת מתחת ל-12 חודשי החזקה - המנוע מחזיר null,
 *    והממשק מציג מקף. במוצר הקודם הוצג שם מינוס 70 אחוז אחרי 5 חודשים.
 */

import { useState } from 'react'
import type { AnalysisResult } from '@/lib/calc'
import { formatCompactILS, formatILS, formatPercentDirect } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { ProfitChart } from '@/components/ProfitChart'

/** תאריך קצר לתצוגה. */
function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('he-IL', { month: '2-digit', year: 'numeric' }).format(d)
}

/** מספר עם צבע לפי סימן. מספרים תמיד LTR בתוך טקסט RTL. */
function Signed({ value, compact = false }: { value: number; compact?: boolean }) {
  // design tokens: positive/destructive/muted-foreground
  const tone =
    value > 0
      ? 'text-[var(--color-positive)]'
      : value < 0
        ? 'text-[var(--color-destructive)]'
        : 'text-[var(--color-muted-foreground)]'
  return (
    <span dir="ltr" className={`tabular-nums ${tone}`}>
      {compact ? formatCompactILS(value) : formatILS(value)}
    </span>
  )
}

function Pct({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span
        className="text-[var(--color-muted-foreground)]"
        title="תקופת החזקה קצרה מ-12 חודשים. נרמול שנתי לא משמעותי כאן."
      >
        -
      </span>
    )
  }
  const tone =
    value > 0
      ? 'text-[var(--color-positive)]'
      : value < 0
        ? 'text-[var(--color-destructive)]'
        : 'text-[var(--color-muted-foreground)]'
  return (
    <span dir="ltr" className={`tabular-nums ${tone}`}>
      {formatPercentDirect(value)}
    </span>
  )
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: string
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{sub}</p>}
    </Card>
  )
}

export function SaleSchedule({ analysis }: { analysis: AnalysisResult }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  // שורות לפני תחילת המשכנתא אינן מכירת נכס אלא המחאת זכויות. המספרים
  // בהן אינם משמעותיים, ולכן הן מוסתרות כברירת מחדל.
  const [showEarly, setShowEarly] = useState(false)
  const all = analysis.saleSchedule
  const hiddenCount = all.filter((r) => r.beforeMortgageStart).length
  const rows = showEarly ? all : all.filter((r) => !r.beforeMortgageStart)
  if (rows.length === 0) return null

  const last = rows[rows.length - 1]
  const assumptions = analysis.scenarios.assumptions
  // אף נתון מס לא אומת. מוצג במפורש, לא מוסתר.
  const anyUnverified = rows.some((r) => !r.capitalGains.allRegulatoryVerified)

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">כמה נרוויח אם נמכור בכל שנה</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          לפי ההנחות שהזנת: עליית ערך{' '}
          <span dir="ltr" className="tabular-nums">
            {formatPercentDirect(assumptions.assumedAppreciationPct)}
          </span>{' '}
          בשנה, עלויות מכירה{' '}
          <span dir="ltr" className="tabular-nums">
            {formatPercentDirect(assumptions.assumedSellingCostPct)}
          </span>
          . אלה הרצות של ההנחות שלך, לא תחזית.
        </p>
      </div>

      {anyUnverified && (
        <p className="rounded-[var(--radius)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs leading-relaxed text-[var(--color-warning)]">
          מספרי מס השבח בטבלה נשענים על נתונים שטרם אומתו מול רשות המסים. תקרת
          הפטור שבשימוש היא של 2024 והיא מתעדכנת מדי שנה. אל תסתמך על המספרים
          האלה לצורך דיווח מס או החלטה - בדוק אותם מול רשות המסים או יועץ מס.
        </p>
      )}

      {last && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            label="תשואה שנתית ממוצעת"
            value={<Pct value={last.averageAnnualReturnPct} />}
            sub={`על פני ${last.year} שנים`}
          />
          <SummaryCard
            label="תשואה כוללת בסוף התקופה"
            value={<Pct value={last.totalReturnPct} />}
            sub={`רווח כולל ${formatCompactILS(last.totalProfit)}`}
          />
          <SummaryCard
            label="הון שהושקע עד סוף התקופה"
            value={
              <span dir="ltr" className="tabular-nums">
                {formatCompactILS(last.totalInvestedSoFar)}
              </span>
            }
            sub="תשלומי הון ועוד השלמות מהכיס"
          />
        </div>
      )}

      {hiddenCount > 0 && (
        <p className="rounded-[var(--radius)] bg-[var(--color-muted)] px-3 py-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          {hiddenCount} שורות לפני מועד לקיחת המשכנתא הוסתרו. בדירה על הנייר,
          מכירה בשלב הזה היא <strong>המחאת זכויות</strong> ולא מכירת נכס, והמספרים
          אינם משקפים אותה.{' '}
          <button
            type="button"
            onClick={() => setShowEarly(!showEarly)}
            className="text-[var(--color-primary)] underline"
          >
            {showEarly ? 'הסתר' : 'הצג בכל זאת'}
          </button>
        </p>
      )}

      <ProfitChart rows={rows} appreciationPct={assumptions.assumedAppreciationPct} />

      {/* מובייל - כרטיסייה לשנה. דסקטופ - טבלה. */}
      <div className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <Card key={r.year} className="p-3">
            <div className="flex items-baseline justify-between">
              <span dir="ltr" className="font-semibold tabular-nums">
                {fmtDate(r.saleDate)}
              </span>
              <Pct value={r.averageAnnualReturnPct} />
            </div>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted-foreground)]">שווי הנכס</dt>
                <dd dir="ltr" className="tabular-nums">
                  {formatCompactILS(r.propertyValue)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-muted-foreground)]">רווח כולל</dt>
                <dd>
                  <Signed value={r.totalProfit} compact />
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setExpanded(expanded === r.year ? null : r.year)}
              className="mt-2 text-sm text-[var(--color-primary)] underline"
            >
              {expanded === r.year ? 'פחות' : 'פרטים'}
            </button>
            {expanded === r.year && (
              <dl className="mt-2 space-y-1 border-t border-[var(--color-border)] pt-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted-foreground)]">יתרת משכנתא</dt>
                  <dd dir="ltr" className="tabular-nums">
                    {formatCompactILS(r.mortgageBalance)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted-foreground)]">כמה הכנסת</dt>
                  <dd dir="ltr" className="tabular-nums">
                    {formatCompactILS(r.totalInvestedSoFar)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted-foreground)]">מזה השלמות מהכיס</dt>
                  <dd dir="ltr" className="tabular-nums">
                    {formatCompactILS(r.cashContributions)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted-foreground)]">תזרים מצטבר</dt>
                  <dd>
                    <Signed value={r.cumulativeNetCashflow} compact />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted-foreground)]">מס שבח</dt>
                  <dd dir="ltr" className="tabular-nums">
                    {formatCompactILS(r.capitalGains.taxAmount)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-muted-foreground)]">תשואה כוללת</dt>
                  <dd>
                    <Pct value={r.totalReturnPct} />
                  </dd>
                </div>
              </dl>
            )}
          </Card>
        ))}
      </div>

      {/* דסקטופ - טבלה. overflow-x-auto לתאימות מובייל כשמוצגת בעורך. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border)] text-start text-xs text-[var(--color-muted-foreground)]">
            <tr>
              <th className="p-2 text-start font-medium">תאריך מכירה</th>
              <th className="p-2 text-start font-medium">שווי הנכס</th>
              <th className="p-2 text-start font-medium">יתרת משכנתא</th>
              <th
                className="p-2 text-start font-medium"
                title="כמה כסף הכנסת בסך הכל עד אותו תאריך: תשלומי ההון ועוד ההשלמות החודשיות מהכיס"
              >
                כמה הכנסת
              </th>
              <th
                className="p-2 text-start font-medium"
                title="כמה כסף תקבל ביד אחרי סילוק המשכנתא, מס שבח ועלויות מכירה"
              >
                כמה תקבל ביד
              </th>
              <th className="p-2 text-start font-medium">מס שבח</th>
              <th className="p-2 text-start font-medium">רווח כולל</th>
              <th className="p-2 text-start font-medium">תשואה שנתית ממוצעת</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year} className="border-b border-[var(--color-border)]">
                <td className="p-2 font-medium">
                  <span dir="ltr" className="tabular-nums">
                    {fmtDate(r.saleDate)}
                  </span>
                  {r.beforeMortgageStart && (
                    <span className="block text-xs font-normal text-[var(--color-warning)]">
                      לפני המשכנתא
                    </span>
                  )}
                </td>
                <td dir="ltr" className="p-2 text-start tabular-nums">
                  {formatCompactILS(r.propertyValue)}
                </td>
                <td dir="ltr" className="p-2 text-start tabular-nums">
                  {formatCompactILS(r.mortgageBalance)}
                </td>
                <td
                  dir="ltr"
                  className="p-2 text-start tabular-nums"
                  title={`תשלומי הון ${formatILS(r.equityInvestedSoFar)} ועוד השלמות מהכיס ${formatILS(r.cashContributions)}`}
                >
                  {formatCompactILS(r.totalInvestedSoFar)}
                </td>
                <td dir="ltr" className="p-2 text-start tabular-nums">
                  {formatCompactILS(
                    r.propertyValue -
                      r.mortgageBalance -
                      r.capitalGains.taxAmount -
                      r.capitalGains.totalSellingCosts,
                  )}
                </td>
                <td dir="ltr" className="p-2 text-start tabular-nums">
                  {r.capitalGains.exemptionApplied ? (
                    <span
                      className="text-[var(--color-positive)]"
                      title="פטור דירה יחידה הוחל"
                    >
                      פטור
                    </span>
                  ) : (
                    formatCompactILS(r.capitalGains.taxAmount)
                  )}
                </td>
                <td className="p-2">
                  <Signed value={r.totalProfit} compact />
                </td>
                <td className="p-2">
                  <Pct value={r.averageAnnualReturnPct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        ההון המושקע בכל שורה הוא תשלומי ההון שבוצעו <strong>עד אותו תאריך</strong>,
        ועוד כל ההשלמות מהכיס - החודשים שבהם המשכנתא הייתה גדולה מהשכירות. לכן מכירה לפני תשלום גדול נמדדת מול פחות הון, והתשואה
        באחוזים גבוהה יותר - שם המינוף בשיא. מקף פירושו שתקופת ההחזקה קצרה מ-12 חודשים ונרמול שנתי
        אינו משמעותי.
      </p>
    </section>
  )
}
