import { Card } from '@/components/ui/Card'
import { NumberField } from '@/components/NumberField'
import { RateSparkline } from '@/components/RateSparkline'
import { AssumptionsPanel } from '@/components/AssumptionsPanel'
import { AddressField } from '@/components/AddressField'
import { MarketAnchor } from '@/components/MarketAnchor'
import { getBoiRateTrend, getCurrentBoiRate, INVESTMENT_LTV_CAP_PCT } from '@/services/rates'
import type { PropertyAnalysis } from '@/hooks/usePropertyAnalysis'

/**
 * שלב הקלט: פרטי העסקה, ריבית בנק ישראל, ופאנל ההנחות.
 * כל ה-state מגיע מ-`usePropertyAnalysis` דרך `analysis` - הדף עצמו
 * לא מחזיק state, רק מציג ומאציל שינויים חזרה.
 */
export function InputPage({
  analysis,
  onShowResults,
}: {
  analysis: PropertyAnalysis
  onShowResults: () => void
}) {
  const {
    price, setPrice,
    monthlyRent, setMonthlyRent,
    equityPct, setEquityPct,
    annualRatePct, setAnnualRatePct,
    termYears, setTermYears,
    sizeSqm, setSizeSqm,
    isSingleApartment, setIsSingleApartment,
    amortization, setAmortization,
    panel, setPanelField,
    suggestion,
    result,
    marketAnchor,
  } = analysis

  const boiRate = getCurrentBoiRate()
  const trend = getBoiRateTrend(12)

  return (
    <>
      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">פרטי העסקה</h2>

        {/* כתובת ועוגן השוק - מעל שאר השדות, כי היא נותנת הקשר לפני
            שממלאים מחיר. אופציונלי לגמרי ולא משפיע על שום חישוב. */}
        <div className="mb-3">
          <AddressField anchor={marketAnchor} />
          <MarketAnchor anchor={marketAnchor} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="מחיר הנכס" value={price} onChange={setPrice} suffix="₪" step={10_000} />
          <NumberField label="שכר דירה חודשי צפוי" value={monthlyRent} onChange={setMonthlyRent} suffix="₪" step={100} />
          <NumberField
            label="הון עצמי"
            value={equityPct}
            onChange={setEquityPct}
            suffix="%"
            hint={
              suggestion?.exceedsInvestmentLtvCap
                ? `שיעור המימון יוצא ${suggestion.ltvPct.toFixed(0)} אחוז. בנק ישראל מגביל דירה שאינה יחידה ל-${INVESTMENT_LTV_CAP_PCT} אחוז מימון`
                : 'בנק ישראל מגביל דירה שאינה יחידה למימון של עד 50 אחוז'
            }
          />
          <NumberField label="שטח" value={sizeSqm} onChange={setSizeSqm} suffix={'מ"ר'} />
          <div>
            <NumberField
              label="ריבית משכנתא שנתית"
              value={annualRatePct}
              onChange={setAnnualRatePct}
              suffix="%"
              step={0.1}
            />
            {suggestion ? (
              <div className="mt-1.5 rounded-lg bg-[var(--color-muted)] p-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                <div>{suggestion.note}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAnnualRatePct(suggestion.suggestedRatePct)}
                    className="rounded-md bg-[var(--color-card)] px-2 py-1 font-medium text-[var(--color-primary)] ring-1 ring-[var(--color-brand-accent)]"
                  >
                    השתמש ב-{suggestion.suggestedRatePct}%
                  </button>
                  <a
                    href={suggestion.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-primary)] underline"
                  >
                    {suggestion.sourceName}
                  </a>
                </div>
              </div>
            ) : null}
          </div>
          <NumberField label="תקופת משכנתא" value={termYears} onChange={setTermYears} suffix="שנים" />
        </div>

        <div className="mt-4">
          <span className="text-sm font-medium text-[var(--color-foreground)]">שיטת הסילוקין</span>
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {(
              [
                ['spitzer', 'שפיצר', 'ההחזר החודשי קבוע. בהתחלה רובו ריבית.'],
                ['equalPrincipal', 'קרן שווה', 'ההחזר מתחיל גבוה ויורד. סך הריבית נמוך יותר.'],
              ] as const
            ).map(([kind, title, note]) => (
              <button
                key={kind}
                type="button"
                aria-pressed={amortization === kind}
                onClick={() => setAmortization(kind)}
                className={
                  amortization === kind
                    ? 'rounded-[var(--radius)] border-2 border-[var(--color-brand-accent)] bg-[var(--color-accent)] p-2.5 text-start'
                    : 'rounded-[var(--radius)] border border-[var(--color-border)] p-2.5 text-start hover:border-[var(--color-ring)] transition-colors'
                }
              >
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                  {note}
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={isSingleApartment}
            onChange={(e) => setIsSingleApartment(e.target.checked)}
            className="size-5 rounded border-[var(--color-border)]"
          />
          <span className="text-sm">זו דירתי היחידה</span>
        </label>
      </Card>

      <Card className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">ריבית בנק ישראל</h2>
          <span dir="ltr" className="text-xl font-bold tabular-nums text-[var(--color-primary)]">
            {boiRate.rate}%
          </span>
        </div>
        {trend ? (
          <>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">{trend.summary}</p>
            <RateSparkline points={trend.points.map((p) => p.rate)} />
          </>
        ) : null}
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
          נכון ל-{boiRate.asOf}. מקור:{' '}
          <a href={boiRate.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--color-primary)] underline">
            {boiRate.sourceName}
          </a>
        </p>
      </Card>

      <div className="mt-8">
        <AssumptionsPanel
          values={panel}
          onChange={setPanelField}
          price={price}
          monthlyRent={monthlyRent}
          costAmounts={
            result.ok
              ? Object.fromEntries(result.data.equity.lines.map((l) => [l.key, l.amount]))
              : {}
          }
        />
      </div>

      {/* CTA כהה מאוד (--color-cta = hsl(160 18% 12%)) - לא sage ירוק.
          ירוק שמור לחיובי (positive). CTA כהה מונע בלבול. */}
      <button
        type="button"
        onClick={onShowResults}
        className="w-full rounded-[var(--radius)] bg-[var(--color-cta)] px-4 py-3 text-sm font-semibold text-[var(--color-cta-foreground)] transition-opacity hover:opacity-90 sm:hidden"
      >
        הצג את התוצאות
      </button>
    </>
  )
}
