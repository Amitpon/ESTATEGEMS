/**
 * "מתי משלמים ומה" - לוח התשלומים בפועל.
 *
 * זה הרכיב שעונה על השאלה הראשונה של כל רוכש: **בתאריך הזה, כמה כסף
 * אני צריך להוציא?** בלעדיו כל שאר המספרים מרחפים באוויר.
 *
 * תשלומים באותו תאריך מקובצים, כי מה שמעניין הוא הסכום שיוצא באותו יום.
 */

import type { CapitalTimeline, CapitalOutflow } from '@/lib/calc'
import { formatILS } from '@/lib/format'
import { Card } from '@/components/ui/Card'

/** תאריך לתצוגה בעברית. */
function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

interface DateGroup {
  date: string
  equity: number
  mortgage: number
  items: CapitalOutflow[]
}

function groupByDate(outflows: readonly CapitalOutflow[]): DateGroup[] {
  const map = new Map<string, DateGroup>()
  for (const o of outflows) {
    let g = map.get(o.date)
    if (!g) {
      g = { date: o.date, equity: 0, mortgage: 0, items: [] }
      map.set(o.date, g)
    }
    if (o.source === 'equity') g.equity += o.amount
    else g.mortgage += o.amount
    g.items.push(o)
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function CashflowTimeline({
  timeline,
  occupancyDate,
}: {
  timeline: CapitalTimeline
  occupancyDate?: string
}) {
  const groups = groupByDate(timeline.outflows)
  if (groups.length === 0) return null

  let runningEquity = 0

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">מתי משלמים ומה</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          כל תאריך והסכום שיוצא בו. "מהכיס" הוא הון עצמי, "משכנתא" ממומן בהלוואה.
        </p>
      </div>

      {/* space-y-3 = 12px בין כרטיסים, יותר נשימה מ-space-y-2 */}
      <div className="space-y-3">
        {groups.map((g) => {
          runningEquity += g.equity
          const isOccupancy = occupancyDate === g.date
          return (
            <Card key={g.date} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span dir="ltr" className="font-semibold tabular-nums">
                    {fmtDate(g.date)}
                  </span>
                  {isOccupancy && (
                    // badge - design token צבעים
                    <span className="rounded-full bg-[var(--color-positive-bg)] px-2 py-0.5 text-xs text-[var(--color-positive)]">
                      אכלוס
                    </span>
                  )}
                </div>
                {/* סכום כולל באותו תאריך - מספר בולט */}
                <span dir="ltr" className="text-lg font-bold tabular-nums">
                  {formatILS(g.equity + g.mortgage)}
                </span>
              </div>

              <ul className="mt-3 space-y-1.5 text-sm">
                {g.items.map((it, i) => (
                  <li key={`${it.key}-${i}`} className="flex justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-[var(--color-muted-foreground)]">
                      {it.label}
                      {/* מקור המימון - קוד צבע לפי משמעות */}
                      <span
                        className={
                          it.source === 'equity'
                            ? 'ms-2 text-xs text-[var(--color-primary)]'
                            : 'ms-2 text-xs text-[var(--color-muted-foreground)]'
                        }
                      >
                        {it.source === 'equity' ? 'מהכיס' : 'משכנתא'}
                      </span>
                    </span>
                    <span dir="ltr" className="shrink-0 tabular-nums">
                      {formatILS(it.amount)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* סיכום הכיס - מופרד בקו דק */}
              <div className="mt-3 space-y-1 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-muted-foreground)]">
                <div className="flex justify-between">
                  <span>מהכיס בתאריך זה</span>
                  <span dir="ltr" className="tabular-nums">
                    {formatILS(g.equity)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>סך מהכיס עד כאן</span>
                  <span dir="ltr" className="font-semibold tabular-nums">
                    {formatILS(runningEquity)}
                  </span>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* סיכום כולל */}
      <Card className="p-4">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">סך הכל מהכיס</span>
            <span dir="ltr" className="font-semibold tabular-nums">
              {formatILS(timeline.totalEquity)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">סך הכל מהמשכנתא</span>
            <span dir="ltr" className="font-semibold tabular-nums">
              {formatILS(timeline.totalMortgage)}
            </span>
          </div>
        </div>
      </Card>

      <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        הסכומים כאן אינם כוללים את ההשלמות החודשיות מהכיס אחרי האכלוס - אלה
        מופיעות בטבלת הרווח ממכירה, בעמודת ההון המושקע.
      </p>
    </section>
  )
}
