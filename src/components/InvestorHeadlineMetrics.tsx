/**
 * 6 מדדי המשקיע המרכזיים - שכבה 1 של מסך התוצאות, מעל ExitPointHero.
 *
 * בעל המוצר ביקש שאלה יהיו הדברים הראשונים שמשקיע רואה (2026-09-25):
 * הון עצמי -> משכורת נדרשת -> גודל משכנתא -> תזרים חודשי -> שתי התשואות
 * מול S&P 500. הסדר קבוע - ראה investorMetrics.ts.
 *
 * הנתונים כבר מחושבים ומסודרים ב-result.data.investorMetrics.ordered -
 * הרכיב הזה רק מציג אותם, לא מחשב כלום.
 */
import { KpiCard } from '@/components/ui/Card'
import { formatILS, formatPercentDirect } from '@/lib/format'
import type { AnalysisResult, Sp500Comparison } from '@/lib/calc'

function formatMetricValue(unit: 'ils' | 'pct', value: number): string {
  return unit === 'ils' ? formatILS(value) : formatPercentDirect(value)
}

/**
 * שורת ההשוואה מציגה את **הנתון עצמו** של S&P 500 באותה תקופה - לא רק הפרש
 * בנקודות אחוז. "יקר ב-2 נ״א" לא אומר כלום בלי לדעת מול מה; "S&P 500: 14.8%"
 * נותן למשתמש נקודת ייחוס מיידית שהוא יכול לשפוט בעצמו.
 */
function Sp500ReferenceLine({ sp500Pct }: { sp500Pct: number }) {
  return (
    <div className="mt-1.5 text-[11px] text-[var(--color-muted-foreground)]">
      S&amp;P 500 באותה תקופה:{' '}
      <span dir="ltr" className="font-semibold tabular-nums text-[var(--color-foreground)]">
        {formatPercentDirect(sp500Pct)}
      </span>
    </div>
  )
}

export function InvestorHeadlineMetrics({ analysis }: { analysis: AnalysisResult }) {
  const m = analysis.investorMetrics
  const comparison: Sp500Comparison | null = m.sp500Comparison

  return (
    <section aria-label="6 מדדי המשקיע המרכזיים">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {m.ordered.map((metric) => {
          const sp500Pct =
            metric.key === 'headline:averageAnnualReturnVsSp500'
              ? comparison?.sp500AverageAnnualReturnPct
              : metric.key === 'headline:totalReturnVsSp500'
                ? comparison?.sp500TotalReturnPct
                : undefined

          return (
            <KpiCard key={metric.key} className="p-3">
              <div className="text-[11px] leading-snug text-[var(--color-muted-foreground)]">
                {metric.label}
              </div>
              <div dir="ltr" className="mt-1 text-xl font-bold tabular-nums text-[var(--color-foreground)]">
                {formatMetricValue(metric.unit, metric.value)}
              </div>
              {typeof sp500Pct === 'number' && <Sp500ReferenceLine sp500Pct={sp500Pct} />}
            </KpiCard>
          )
        })}
      </div>

      {comparison && (
        <p className="mt-2 px-1 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
          {comparison.note}
        </p>
      )}
    </section>
  )
}
