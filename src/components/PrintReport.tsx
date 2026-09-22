/**
 * הדוח המודפס.
 *
 * ## למה רכיב נפרד ולא הדפסה של המסך
 *
 * המסך בנוי לחקירה: סליידרים, מתגים, טבלאות ארוכות, סקשנים מתקפלים.
 * דוח בנוי לקריאה. בעל המוצר ביקש "רק דברים חשובים כמו מספרי מפתח
 * והשוואות סנריו", ולכן זה תוכן **אחר** ולא עיצוב אחר של אותו תוכן.
 *
 * הרכיב מוסתר על המסך (`hidden`) ומופיע רק ב-`@media print`. שאר המסך
 * מוסתר בהדפסה. כך אין כפילות ואין צורך לפתוח `<details>` מקופלים.
 *
 * ## מה נכנס ומה לא
 *
 * נכנס: מספרי מפתח, פירוט ההון ביום 1, השוואת שלושת התרחישים, ארבע
 * נקודות מכירה, ההנחות שמאחורי הכל, והתובנות.
 *
 * לא נכנס: לוח סילוקין מלא (300 שורות), ציר תשלומים מפורט, כל שורות
 * טבלת המכירה. מי שצריך אותם פותח אותם במסך.
 */

import type { AnalysisResult, SaleAtYear } from '@/lib/calc'
import { findKeyExitPoint } from '@/lib/calc'
import { formatILS, formatCompactILS, formatPercentDirect } from '@/lib/format'
import { buildInsights } from '@/components/ReportInsights'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('he-IL', { month: '2-digit', year: 'numeric' }).format(d)
}

function Num({ children }: { children: React.ReactNode }) {
  return (
    <span dir="ltr" className="tabular-nums">
      {children}
    </span>
  )
}

function KeyNumber({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border border-slate-300 p-2">
      <div className="text-[9pt] text-slate-600">{label}</div>
      <div dir="ltr" className="text-start text-[14pt] font-bold tabular-nums">
        {value}
      </div>
      {note && <div className="text-[8pt] text-slate-500">{note}</div>}
    </div>
  )
}

/**
 * ארבע נקודות מכירה מייצגות במקום כל השורות.
 * תמיד נכללת נקודת השיא, כי היא המספר שבראש הדוח.
 */
function pickRows(rows: readonly SaleAtYear[], peak: SaleAtYear | null): SaleAtYear[] {
  const usable = rows.filter((r) => !r.beforeMortgageStart)
  if (usable.length <= 4) return [...usable]

  const picked = new Map<string, SaleAtYear>()
  const add = (r: SaleAtYear | undefined) => {
    if (r) picked.set(r.saleDate, r)
  }

  add(usable[0])
  if (peak) add(peak)
  add(usable[Math.floor(usable.length / 2)])
  add(usable[usable.length - 1])

  return [...picked.values()].sort((a, b) => a.saleDate.localeCompare(b.saleDate))
}

export function PrintReport({ analysis }: { analysis: AnalysisResult }) {
  const a = analysis
  const exit = findKeyExitPoint(a.saleSchedule)
  const rows = pickRows(a.saleSchedule, exit?.row ?? null)
  const insights = buildInsights(a)
  const totalInterest = a.mortgage.combinedRows.reduce((s, r) => s + r.interest, 0)

  // התוויות מגיעות מהמנוע, כדי שלא יסטו ממה שמוצג במסך.
  const scenarios = [a.scenarios.low, a.scenarios.central, a.scenarios.high]

  return (
    // מוסתר על המסך, מופיע רק בהדפסה.
    <div hidden data-print-report className="text-[10pt] text-black">
      <h1 className="text-[16pt] font-bold">ניתוח כדאיות דירה להשקעה</h1>
      <p className="mt-0.5 text-[9pt] text-slate-600">
        הופק ב-<Num>{new Intl.DateTimeFormat('he-IL').format(new Date())}</Num>. הכלי
        אינו מהווה ייעוץ מס, משכנתאות או השקעות.
      </p>

      <h2 className="mt-4 border-b border-slate-400 pb-1 text-[12pt] font-bold">
        מספרי מפתח
      </h2>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <KeyNumber
          label="תזרים חודשי נטו"
          value={formatILS(a.metrics.netMonthlyCashflow.value)}
          note="אחרי משכנתא, הוצאות ומס"
        />
        <KeyNumber
          label="דרוש ביום 1"
          value={formatCompactILS(a.equity.total)}
          note="הון עצמי ועלויות נלוות"
        />
        {exit && (
          <>
            <KeyNumber
              label={`רווח מצטבר ב-${fmtDate(exit.row.saleDate)}`}
              value={formatPercentDirect(exit.row.totalReturnPct)}
              note={`${formatCompactILS(exit.row.totalProfit)} על ${formatCompactILS(exit.row.totalInvestedSoFar)}`}
            />
            <KeyNumber
              label="ממוצע לשנה בנקודה זו"
              value={
                exit.row.averageAnnualReturnPct === null
                  ? 'לא רלוונטי'
                  : formatPercentDirect(exit.row.averageAnnualReturnPct)
              }
              note={
                exit.reason === 'peak-exempt' ? 'פטור ממס שבח' : 'חייב במס שבח'
              }
            />
          </>
        )}
      </div>

      <h2 className="mt-4 border-b border-slate-400 pb-1 text-[12pt] font-bold">
        ההון ביום 1
      </h2>
      <table className="mt-2 w-full text-[9pt]">
        <tbody>
          {a.equity.lines.map((l) => (
            <tr key={l.key} className="border-b border-slate-200">
              <td className="py-1">{l.label}</td>
              <td dir="ltr" className="py-1 text-start tabular-nums">
                {formatILS(l.amount)}
              </td>
            </tr>
          ))}
          <tr className="border-b-2 border-slate-400 font-bold">
            <td className="py-1">סך הכל</td>
            <td dir="ltr" className="py-1 text-start tabular-nums">
              {formatILS(a.equity.total)}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 className="mt-4 border-b border-slate-400 pb-1 text-[12pt] font-bold">
        השוואת תרחישים
      </h2>
      <p className="mt-1 text-[9pt] text-slate-600">
        שלושתם מריצים את אותה עסקה תחת הנחות עליית ערך שונות. כולם תלויים
        בהנחות שהזנת ואינם תחזית.
      </p>
      <table className="mt-2 w-full text-[9pt]">
        <thead className="border-b border-slate-400">
          <tr>
            <th className="py-1 text-start">תרחיש</th>
            <th className="py-1 text-start">עליית ערך</th>
            <th className="py-1 text-start">שווי בסוף</th>
            <th className="py-1 text-start">יתרת משכנתא</th>
            <th className="py-1 text-start">תזרים מצטבר</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => {
            const last = s.years[s.years.length - 1]
            return (
              <tr key={s.key} className="border-b border-slate-200">
                <td className="py-1 font-medium">{s.label}</td>
                <td dir="ltr" className="py-1 text-start tabular-nums">
                  {formatPercentDirect(s.assumedGrowthPct)}
                </td>
                <td dir="ltr" className="py-1 text-start tabular-nums">
                  {last ? formatCompactILS(last.propertyValue) : '-'}
                </td>
                <td dir="ltr" className="py-1 text-start tabular-nums">
                  {last ? formatCompactILS(last.mortgageBalance) : '-'}
                </td>
                <td dir="ltr" className="py-1 text-start tabular-nums">
                  {last ? formatCompactILS(last.cumulativeNetCashflow) : '-'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2 className="mt-4 border-b border-slate-400 pb-1 text-[12pt] font-bold">
        נקודות מכירה נבחרות
      </h2>
      <table className="mt-2 w-full text-[9pt]">
        <thead className="border-b border-slate-400">
          <tr>
            <th className="py-1 text-start">תאריך</th>
            <th className="py-1 text-start">שווי</th>
            <th className="py-1 text-start">כמה הכנסת</th>
            <th className="py-1 text-start">מס שבח</th>
            <th className="py-1 text-start">רווח</th>
            <th className="py-1 text-start">ממוצע לשנה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.saleDate}
              className={[
                'border-b border-slate-200',
                exit && r.saleDate === exit.row.saleDate ? 'font-bold' : '',
              ].join(' ')}
            >
              <td dir="ltr" className="py-1 text-start tabular-nums">
                {fmtDate(r.saleDate)}
              </td>
              <td dir="ltr" className="py-1 text-start tabular-nums">
                {formatCompactILS(r.propertyValue)}
              </td>
              <td dir="ltr" className="py-1 text-start tabular-nums">
                {formatCompactILS(r.totalInvestedSoFar)}
              </td>
              <td dir="ltr" className="py-1 text-start tabular-nums">
                {r.capitalGains.exemptionApplied
                  ? 'פטור'
                  : formatCompactILS(r.capitalGains.taxAmount)}
              </td>
              <td dir="ltr" className="py-1 text-start tabular-nums">
                {formatCompactILS(r.totalProfit)}
              </td>
              <td dir="ltr" className="py-1 text-start tabular-nums">
                {r.averageAnnualReturnPct === null
                  ? '-'
                  : formatPercentDirect(r.averageAnnualReturnPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[8pt] text-slate-500">
        השורה המודגשת היא נקודת התשואה הגבוהה ביותר. סך הריבית על המשכנתא
        לאורך כל התקופה: <Num>{formatILS(totalInterest)}</Num>.
      </p>

      <h2 className="mt-4 border-b border-slate-400 pb-1 text-[12pt] font-bold">
        מה ראוי לשים לב אליו
      </h2>
      <ul className="mt-2 space-y-1.5 text-[9pt]">
        {insights.map((it) => (
          <li key={it.title}>
            <span className="font-semibold">{it.title}.</span> {it.body}
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-slate-400 pt-2 text-[8pt] leading-relaxed text-slate-600">
        כל מספר עתידי בדוח נגזר מההנחות שהוזנו ואינו תחזית. נתוני מס השבח
        בכלי לא אומתו מול רשות המסים. לפני החלטה בדוק מול יועץ מס.
      </p>
    </div>
  )
}
