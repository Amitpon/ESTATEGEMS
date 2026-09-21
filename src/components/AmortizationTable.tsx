/**
 * לוח הסילוקין.
 *
 * הנתונים כבר קיימים ב-`mortgage.combinedRows` - כאן רק מוצגים.
 *
 * ## שתי הכרעות תצוגה
 *
 * 1. **ברירת המחדל היא שנים, לא חודשים.** 300 שורות חודשיות הן רעש.
 *    התובנה שמשקיע מחפש - "כמה מההחזר הולך לריבית" - נקראת טוב יותר
 *    ברזולוציה שנתית. מי שרוצה חודש בודד מחליף מצב.
 * 2. **רק 12 שורות בכל פעם.** רינדור של 300 שורות DOM מאט את המסך,
 *    ואף אחד לא קורא אותן ברצף.
 */

import { useMemo, useState } from 'react'
import type { AnalysisResult } from '@/lib/calc'
import { formatILS, formatCompactILS } from '@/lib/format'
import { Card } from '@/components/ui/Card'

interface Row {
  label: string
  payment: number
  principal: number
  interest: number
  balance: number
}

const PAGE = 12

export function AmortizationTable({ analysis }: { analysis: AnalysisResult }) {
  const [unit, setUnit] = useState<'year' | 'month'>('year')
  const [page, setPage] = useState(0)

  const monthly = analysis.mortgage.combinedRows

  const rows: Row[] = useMemo(() => {
    if (monthly.length === 0) return []

    if (unit === 'month') {
      return monthly.map((r) => ({
        label: `חודש ${r.month}`,
        payment: r.payment,
        principal: r.principal,
        interest: r.interest,
        balance: r.balance,
      }))
    }

    // צבירה לשנים. היתרה נלקחת מהחודש האחרון בשנה, לא מסכום.
    const out: Row[] = []
    for (let i = 0; i < monthly.length; i += 12) {
      const chunk = monthly.slice(i, i + 12)
      const last = chunk[chunk.length - 1]
      if (!last) continue
      out.push({
        label: `שנה ${Math.floor(i / 12) + 1}`,
        payment: chunk.reduce((a, r) => a + r.payment, 0),
        principal: chunk.reduce((a, r) => a + r.principal, 0),
        interest: chunk.reduce((a, r) => a + r.interest, 0),
        balance: last.balance,
      })
    }
    return out
  }, [monthly, unit])

  if (rows.length === 0) return null

  const pages = Math.ceil(rows.length / PAGE)
  const safePage = Math.min(page, pages - 1)
  const visible = rows.slice(safePage * PAGE, safePage * PAGE + PAGE)

  const totalInterest = monthly.reduce((a, r) => a + r.interest, 0)
  const totalPaid = monthly.reduce((a, r) => a + r.payment, 0)

  const switchUnit = (u: 'year' | 'month') => {
    setUnit(u)
    setPage(0)
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">לוח הסילוקין</h2>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            כמה מכל החזר הולך לקרן וכמה לריבית, לפי הנתונים שהזנת.
          </p>
        </div>

        {/*
         * Toggle שנים/חודשים.
         * min-h-[44px] - אזור מגע מינימלי לפי Apple HIG / WCAG 2.5.5.
         * כפתורים פעילים: primary token, לא indigo hardcoded.
         */}
        <div
          data-no-print
          role="group"
          aria-label="רזולוציית הלוח"
          className="flex overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] text-sm"
        >
          {(
            [
              ['year', 'שנים'],
              ['month', 'חודשים'],
            ] as const
          ).map(([u, label]) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => switchUnit(u)}
              className={[
                'min-h-[44px] px-4 py-2 transition-colors',
                unit === u
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* כרטיסי סיכום ריבית */}
      <div className="grid gap-2 sm:grid-cols-2">
        <Card className="p-3">
          <div className="text-xs text-[var(--color-muted-foreground)]">סך הריבית לאורך כל התקופה</div>
          <div dir="ltr" className="mt-1 text-start text-xl font-semibold tabular-nums text-[var(--color-destructive)]">
            {formatILS(totalInterest)}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-[var(--color-muted-foreground)]">סך ההחזרים</div>
          <div dir="ltr" className="mt-1 text-start text-xl font-semibold tabular-nums">
            {formatILS(totalPaid)}
          </div>
        </Card>
      </div>

      {/* טבלה - overflow-x-auto לתאימות מובייל */}
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)]">
            <tr>
              <th className="p-2 text-start font-medium">תקופה</th>
              <th className="p-2 text-start font-medium">החזר</th>
              <th className="p-2 text-start font-medium">מזה קרן</th>
              <th className="p-2 text-start font-medium">מזה ריבית</th>
              <th className="p-2 text-start font-medium">יתרה</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {visible.map((r) => {
              // חלק הריבית מההחזר. זו התובנה שהטבלה קיימת בשבילה.
              const interestShare = r.payment > 0 ? (r.interest / r.payment) * 100 : 0
              return (
                <tr key={r.label}>
                  <td className="p-2 font-medium">{r.label}</td>
                  <td dir="ltr" className="p-2 text-start tabular-nums">
                    {formatCompactILS(r.payment)}
                  </td>
                  <td dir="ltr" className="p-2 text-start tabular-nums text-[var(--color-positive)]">
                    {formatCompactILS(r.principal)}
                  </td>
                  <td dir="ltr" className="p-2 text-start tabular-nums text-[var(--color-destructive)]">
                    {formatCompactILS(r.interest)}
                    <span className="ms-1 text-xs text-[var(--color-muted-foreground)]">
                      {interestShare.toFixed(0)}%
                    </span>
                  </td>
                  <td dir="ltr" className="p-2 text-start tabular-nums">
                    {formatCompactILS(r.balance)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {/* pagination - כפתורים מינימום 44px */}
      {pages > 1 && (
        <div data-no-print className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage(safePage - 1)}
            disabled={safePage === 0}
            className="min-h-[44px] rounded-[var(--radius)] border border-[var(--color-border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
          >
            הקודם
          </button>
          <span dir="ltr" className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
            {safePage + 1} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage(safePage + 1)}
            disabled={safePage >= pages - 1}
            className="min-h-[44px] rounded-[var(--radius)] border border-[var(--color-border)] px-4 py-2 text-sm transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
          >
            הבא
          </button>
        </div>
      )}

      <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        בשנים הראשונות רוב ההחזר הוא ריבית, ולכן היתרה יורדת לאט. זה משפיע
        ישירות על הרווח במכירה מוקדמת.
      </p>
    </section>
  )
}
