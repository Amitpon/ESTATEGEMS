import { calcRateSensitivity } from '@/lib/calc'
import type { Assumptions, PropertyInput } from '@/types/property'
import { formatILS, formatPercentDirect } from '@/lib/format'

/**
 * "מה קורה אם הריבית עולה" - טבלת רגישות לריבית.
 *
 * זו לא הנחה עתידית (עיקרון 1 אוסר על תחזית) - זו שאלת "מה אם" על
 * הנתונים שכבר הוזנו. כל שורה מריצה מחדש את המנוע בריבית אחרת ומראה
 * מה קורה לתזרים ולכיסוי. השורה עם הריבית שהוזנה בפועל מודגשת.
 */
export function RateSensitivityTable({
  input,
  assumptions,
}: {
  input: PropertyInput
  assumptions: Assumptions
}) {
  const rows = calcRateSensitivity(input, assumptions)
  if (rows.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">רגישות לשינוי בריבית</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          מה קורה לתזרים ולכיסוי ההחזר אם ריבית המשכנתא משתנה, בלי לשנות
          שום דבר אחר בעסקה.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full min-w-[26rem] text-sm">
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)]">
            <tr>
              <th className="p-2 text-start font-medium">ריבית</th>
              <th className="p-2 text-start font-medium">תזרים חודשי</th>
              <th className="p-2 text-start font-medium">כיסוי ההחזר</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((r) => {
              const isBase = r.deltaPct === 0
              return (
                <tr
                  key={r.deltaPct}
                  className={isBase ? 'bg-[var(--color-accent)]' : undefined}
                >
                  <td className="p-2 font-medium">
                    <span dir="ltr" className="tabular-nums">
                      {r.ratePct}%
                    </span>
                    {isBase && (
                      <span className="ms-2 rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] text-white">
                        הריבית שהזנת
                      </span>
                    )}
                  </td>
                  <td
                    dir="ltr"
                    className={`p-2 tabular-nums ${
                      r.monthlyCashflow >= 0
                        ? 'text-[var(--color-positive)]'
                        : 'text-[var(--color-destructive)]'
                    }`}
                  >
                    {r.monthlyCashflow >= 0 ? '+' : ''}
                    {formatILS(r.monthlyCashflow)}
                  </td>
                  <td
                    dir="ltr"
                    className={`p-2 tabular-nums ${
                      r.coveragePct >= 100
                        ? 'text-[var(--color-positive)]'
                        : 'text-[var(--color-warning)]'
                    }`}
                  >
                    {formatPercentDirect(r.coveragePct)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        זו בדיקת רגישות, לא תחזית. הריבית בפועל עלולה לעלות, לרדת, או
        להישאר כפי שהיא - הטבלה רק מראה את ההשפעה אם היא תזוז.
      </p>
    </section>
  )
}
