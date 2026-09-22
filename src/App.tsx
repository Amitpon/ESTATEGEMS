import { useMemo, useState } from 'react'
import { analyze, findKeyExitPoint, defaultAcquisitionCosts, defaultAssumptions, defaultOperatingExpenses, DEFAULT_VACANCY_PCT } from '@/lib/calc'
import type { AmortizationKind, PropertyInput } from '@/types/property'
import { formatCompactILS, formatILS, formatPercentDirect } from '@/lib/format'
import { ExitPointHero } from '@/components/ExitPointHero'
import { Card } from '@/components/ui/Card'
import { getBoiRateTrend, getCurrentBoiRate, suggestMortgageRate, INVESTMENT_LTV_CAP_PCT } from '@/services/rates'
import { ShimshonChat } from '@/components/ShimshonChat'
import { SaleSchedule } from '@/components/SaleSchedule'
import { CashflowTimeline } from '@/components/CashflowTimeline'
import { AmortizationTable } from '@/components/AmortizationTable'
import { Disclosure } from '@/components/ui/Disclosure'
import { ReportInsights } from '@/components/ReportInsights'
import { printReport } from '@/lib/print'
import { PrintReport } from '@/components/PrintReport'
import { AssumptionsPanel, type AssumptionsPanelValues } from '@/components/AssumptionsPanel'
import { buildShimshonContext } from '@/services/shimshon'

/** שדה מספרי עם תווית ויחידה. מספרים תמיד LTR גם בתוך ממשק RTL. */
function NumberField({
  label,
  value,
  onChange,
  suffix,
  step = 1,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  suffix?: string
  step?: number
  hint?: string
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-1 flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(Number(e.target.value))}
          dir="ltr"
          className="min-h-11 w-full bg-transparent text-start text-base tabular-nums outline-none"
        />
        {suffix ? <span className="shrink-0 text-sm text-slate-500">{suffix}</span> : null}
      </span>
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  )
}

/**
 * גרף קו קטן למגמת הריבית. SVG ידני - אין ספריית גרפים ב-bundle.
 * ציר הזמן נשאר LTR: מוקדם משמאל, עדכני מימין, כמקובל בגרפים פיננסיים.
 */
function RateSparkline({ points }: { points: readonly number[] }) {
  if (points.length < 2) return null

  const w = 300
  const h = 48
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1

  const d = points
    .map((rate, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((rate - min) / span) * (h - 8) - 4
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 h-12 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`מגמת ריבית בנק ישראל, מ-${points[0]} אחוז ל-${points[points.length - 1]} אחוז`}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600" />
    </svg>
  )
}

/** שורת פירוק - תווית מימין, סכום משמאל. */
function BreakdownRow({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${strong ? 'font-semibold' : ''}`}>
      <span className="text-sm text-slate-600">{label}</span>
      <span dir="ltr" className="text-sm tabular-nums text-slate-900">
        {formatILS(amount)}
      </span>
    </div>
  )
}

export default function App() {
  // שדות הליבה. שלושה שדות מספיקים לתוצאה ראשונה.
  const [price, setPrice] = useState(2_000_000)
  const [monthlyRent, setMonthlyRent] = useState(5_500)
  const [equityPct, setEquityPct] = useState(50)
  const [annualRatePct, setAnnualRatePct] = useState(4.9)
  const [termYears, setTermYears] = useState(30)
  const [sizeSqm, setSizeSqm] = useState(80)
  // ברירת המחדל היא **דירה ראשונה** - הכרעת בעל המוצר, 2026-09-21.
  // המשתמש מסמן אם זו אינה הדירה הראשונה שלו, וזה משנה מדרגות מס רכישה
  // וזכאות לפטור ממס שבח.
  const [isSingleApartment, setIsSingleApartment] = useState(true)
  // כל ההנחות והעלויות במקום אחד. עיקרון 3 - אין קבוע נסתר בקוד.
  // במובייל מוצג שלב אחד בכל רגע. מ-sm ומעלה שני הטורים גלויים יחד
  // וה-state הזה חסר משמעות.
  const [step, setStep] = useState<'input' | 'results'>('input')
  // שיטת הסילוקין. המנוע תמך בשתיהן מההתחלה, פשוט לא היה בורר.
  const [amortization, setAmortization] = useState<AmortizationKind>('spitzer')

  const [panel, setPanel] = useState<AssumptionsPanelValues>({
    appreciationPct: 3,
    rentGrowthPct: 2,
    expenseGrowthPct: 2,
    indexChangePct: 3.5,
    sellingCostPct: 2,
    horizonYears: 10,
    spreadPoints: 2,
    vacancyPct: DEFAULT_VACANCY_PCT,
    brokerFee: 0,
    lawyerFee: 0,
    mortgageAdvisorFee: 0,
    finishingCostPerSqm: 0,
    liquidityReserve: 30_000,
    buildingFee: 250,
    insurance: 100,
    managementPct: 8,
    maintenancePct: 8,
    hasPaymentSchedule: false,
    isContractorPurchase: false,
    occupancyDate: '',
    // לוח ברירת מחדל טיפוסי לעסקת קבלן: מקדמה, שלב ביניים, ויתרה באכלוס.
    // המשתמש משנה הכל - עיקרון 3.
    stages: [
      { id: 's1', label: 'תשלום ראשון (חתימה)', percentOfPrice: 20, dueDate: new Date().toISOString().slice(0, 10), linkedToIndex: false, fundingSource: 'equity' },
      { id: 's2', label: 'תשלום שני', percentOfPrice: 30, dueDate: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10), linkedToIndex: true, fundingSource: 'equity' },
      { id: 's3', label: 'יתרה באכלוס', percentOfPrice: 50, dueDate: new Date(Date.now() + 730 * 864e5).toISOString().slice(0, 10), linkedToIndex: true, fundingSource: 'mortgage' },
    ],
    stageDates: {},
  })
  const setPanelField = <K extends keyof AssumptionsPanelValues>(
    key: K,
    value: AssumptionsPanelValues[K],
  ) => setPanel((p) => ({ ...p, [key]: value }))

  const boiRate = getCurrentBoiRate()
  const trend = getBoiRateTrend(12)

  const suggestion = useMemo(
    () => suggestMortgageRate({ price, downPayment: (price * equityPct) / 100 }),
    [price, equityPct],
  )

  const result = useMemo(() => {
    try {
      const downPayment = (price * equityPct) / 100
      const loanAmount = price - downPayment

      const input: PropertyInput = {
        analysisDate: new Date().toISOString().slice(0, 10),
        property: { price, sizeSqm, city: '', kind: 'apartment', rooms: 3 },
        financing: {
          downPayment,
          tracks:
            loanAmount > 0
              ? [
                  {
                    id: 'main',
                    label: 'מסלול יחיד',
                    principal: loanAmount,
                    annualRatePct,
                    termMonths: termYears * 12,
                    amortization,
                    linkage: 'fixedUnlinked',
                  },
                ]
              : [],
          earlyRepaymentFeePct: 0,
        },
        income: { monthlyRent, vacancyPct: panel.vacancyPct },
        expenses: {
          ...defaultOperatingExpenses(),
          buildingFee: { kind: 'monthlyAmount', amount: panel.buildingFee },
          insurance: { kind: 'monthlyAmount', amount: panel.insurance },
          management: { kind: 'percentOfAnnualRent', percent: panel.managementPct },
          maintenance: { kind: 'percentOfAnnualRent', percent: panel.maintenancePct },
        },
        acquisitionCosts: {
          ...defaultAcquisitionCosts(price),
          brokerFee: panel.brokerFee,
          lawyerFee: panel.lawyerFee,
          mortgageAdvisorFee: panel.mortgageAdvisorFee,
          finishingCostPerSqm: panel.finishingCostPerSqm,
          liquidityReserve: panel.liquidityReserve,
          stageDates: panel.stageDates,
        },
        tax: {
          isSingleApartment,
          rentalTaxTrack: 'exempt',
          marginalTaxRatePct: 31,
        },
        // תאריך האכלוס נדרש למס שבח - 18 החודשים נספרים ממנו בדירה על הנייר.
        // לוח התשלומים מופעל רק כשסכום האחוזים הוא בדיוק 100. אחרת המנוע
        // זורק, והממשק כבר מציג על כך אזהרה בעורך.
        ...(panel.hasPaymentSchedule &&
        Math.abs(panel.stages.reduce((a, st) => a + st.percentOfPrice, 0) - 100) < 0.01
          ? {
              paymentSchedule: {
                // אכלוס והצמדה למדד תשומות הבנייה קיימים רק בדירה על הנייר.
                // ביד שנייה מפוצלת אין טופס 4 ואין הצמדה.
                ...(panel.isContractorPurchase && panel.occupancyDate
                  ? { occupancyDate: panel.occupancyDate }
                  : {}),
                indexationMode: panel.isContractorPurchase
                  ? ('on' as const)
                  : ('off' as const),
                assumedIndexChangePct: panel.isContractorPurchase
                  ? panel.indexChangePct
                  : 0,
                stages: panel.stages,
              },
            }
          : {}),
      }

      const assumptions = {
        ...defaultAssumptions(),
        assumedAppreciationPct: panel.appreciationPct,
        assumedRentGrowthPct: panel.rentGrowthPct,
        assumedExpenseGrowthPct: panel.expenseGrowthPct,
        assumedIndexChangePct: panel.indexChangePct,
        assumedSellingCostPct: panel.sellingCostPct,
        horizonYears: panel.horizonYears,
        scenarioSpreadPoints: panel.spreadPoints,
      }
      return { ok: true as const, data: analyze(input, assumptions), input }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'שגיאה בחישוב' }
    }
  }, [price, monthlyRent, equityPct, annualRatePct, termYears, sizeSqm, isSingleApartment, panel])

  // ההקשר לשמשון נבנה רק ממה שהמנוע חישב. null מנטרל אותו.
  const shimshonContext = useMemo(
    () => (result.ok ? buildShimshonContext(result.input, result.data) : null),
    [result],
  )

  return (
    <div className="min-h-dvh bg-slate-50 pb-16 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold">Estate Gems</h1>
            <p className="text-xs text-slate-500">ניתוח דירה להשקעה בישראל</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            הנתונים נשמרים במכשיר שלך בלבד
          </span>
        </div>
      </header>

      {/* ניווט השלבים. במובייל מוצג שלב אחד בכל רגע - הכרעת בעל המוצר,
          כדי שלא צריך לגלול מאות פיקסלים כדי לראות תוצאה. מ-sm ומעלה
          שני הטורים גלויים יחד והניווט מוסתר. */}
      <div data-no-print className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-3xl gap-1 px-4 py-2">
          {(
            [
              ['input', 'הנתונים שלי'],
              ['results', 'התוצאות'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-current={step === v ? 'step' : undefined}
              onClick={() => setStep(v)}
              className={
                step === v
                  ? 'flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white'
                  : 'flex-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600'
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto max-w-6xl gap-6 px-4 py-4 sm:grid sm:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] sm:items-start">
        <div data-print-section className={`space-y-4 ${step === 'input' ? '' : 'hidden'} sm:block`}>
        <Card className="p-4">
          <h2 className="mb-3 text-base font-semibold">פרטי העסקה</h2>
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
                <div className="mt-1.5 rounded-lg bg-slate-100 p-2 text-xs leading-relaxed text-slate-600">
                  <div>{suggestion.note}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAnnualRatePct(suggestion.suggestedRatePct)}
                      className="rounded-md bg-white px-2 py-1 font-medium text-indigo-700 ring-1 ring-slate-300"
                    >
                      השתמש ב-{suggestion.suggestedRatePct}%
                    </button>
                    <a
                      href={suggestion.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-700 underline"
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
            <span className="text-sm font-medium text-slate-700">שיטת הסילוקין</span>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {(
                [
                  [
                    'spitzer',
                    'שפיצר',
                    'ההחזר החודשי קבוע. בהתחלה רובו ריבית.',
                  ],
                  [
                    'equalPrincipal',
                    'קרן שווה',
                    'ההחזר מתחיל גבוה ויורד. סך הריבית נמוך יותר.',
                  ],
                ] as const
              ).map(([kind, title, note]) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={amortization === kind}
                  onClick={() => setAmortization(kind)}
                  className={
                    amortization === kind
                      ? 'rounded-xl border-2 border-indigo-600 bg-indigo-50 p-2.5 text-start'
                      : 'rounded-xl border border-slate-300 p-2.5 text-start hover:border-indigo-300'
                  }
                >
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
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
              className="size-5 rounded border-slate-300"
            />
            <span className="text-sm">זו דירתי היחידה</span>
          </label>
        </Card>

        <Card className="p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">ריבית בנק ישראל</h2>
            <span dir="ltr" className="text-xl font-bold tabular-nums text-indigo-700">
              {boiRate.rate}%
            </span>
          </div>
          {trend ? (
            <>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{trend.summary}</p>
              <RateSparkline points={trend.points.map((p) => p.rate)} />
            </>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            נכון ל-{boiRate.asOf}. מקור:{' '}
            <a href={boiRate.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-700 underline">
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

          <button
            type="button"
            onClick={() => setStep('results')}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white sm:hidden"
          >
            הצג את התוצאות
          </button>
        </div>

        <div data-print-section className={`space-y-4 ${step === 'results' ? '' : 'hidden'} sm:block`}>
        <div data-no-print className="flex justify-end">
            <button
              type="button"
              onClick={() => printReport()}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-700"
            >
              הדפסה או שמירה כ-PDF
            </button>
          </div>

        {!result.ok ? (
          <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{result.message}</Card>
        ) : (
          <>
            <ExitPointHero
              monthlyCashflow={result.data.metrics.netMonthlyCashflow.value}
              exit={findKeyExitPoint(result.data.saleSchedule)}
            />

            {/* כיסוי ההחזר - הבקשה של בעל המוצר: כמה מההחזר השכירות מחזירה.
                מוצג בשורה נפרדת כי זו השאלה הראשונה שמשקיע שואל. */}
            {result.data.cashflow.mortgagePayment.monthly > 0 && (
              <Card className="p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">כיסוי ההחזר מהשכירות</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      שכר דירה אחרי אי-אכלוס, חלקי ההחזר החודשי
                    </div>
                  </div>
                  <div
                    dir="ltr"
                    className={`text-2xl font-semibold tabular-nums ${
                      result.data.metrics.mortgageCoveragePct.value >= 100
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {formatPercentDirect(result.data.metrics.mortgageCoveragePct.value)}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${
                      result.data.metrics.mortgageCoveragePct.value >= 100
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(0, result.data.metrics.mortgageCoveragePct.value))}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {result.data.metrics.mortgageCoveragePct.value >= 100
                    ? 'השכירות מכסה את ההחזר. העודף לפני הוצאות תפעול ומס.'
                    : `השכירות לא מכסה את ההחזר. ההפרש ${formatILS(result.data.cashflow.mortgagePayment.monthly - result.data.cashflow.effectiveRent.monthly)} בחודש, לפני הוצאות תפעול ומס.`}
                </p>
              </Card>
            )}

            <details className="rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-slate-700">
                מדדי תשואה שנתיים
              </summary>
              <div className="border-t border-slate-100 px-3 pb-3 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-slate-500">תשואה ברוטו</div>
                    <div dir="ltr" className="mt-0.5 text-start text-lg font-semibold tabular-nums">
                      {formatPercentDirect(result.data.metrics.grossYieldPct.value)}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      שכר הדירה השנתי חלקי מחיר הנכס. מתעלם ממשכנתא, מהוצאות
                      וממס - לכן נוח להשוואה בין נכסים, אבל לא אומר כמה נכנס לכיס.
                    </p>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">תשואה על ההון</div>
                    <div dir="ltr" className="mt-0.5 text-start text-lg font-semibold tabular-nums">
                      {formatPercentDirect(result.data.metrics.cashOnCashPct.value)}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      התזרים השנתי חלקי ההון שהושקע. מודד את השכירות בלבד, בלי
                      עליית ערך ובלי מס שבח.
                    </p>
                  </div>
                </div>
                <p className="mt-3 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500">
                  שני אלה מודדים <strong>שנה אחת</strong> ואינם כוללים רווח
                  ממכירה. המספרים בראש המסך הם התמונה המלאה, כולל עליית ערך ומס.
                </p>
              </div>
            </details>
          </>
        )}

        {result.ok ? (
          <>
            <Card className="p-4">
              <h2 className="mb-2 text-base font-semibold">כמה כסף צריך ביום 1</h2>
              <div className="divide-y divide-slate-100">
                {result.data.equity.lines.map((line) => (
                  <BreakdownRow key={line.key} label={line.label} amount={line.amount} />
                ))}
                <BreakdownRow label="סך הכל" amount={result.data.equity.total} strong />
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="mb-2 text-base font-semibold">התזרים החודשי, מרכיב מרכיב</h2>
              <div className="divide-y divide-slate-100">
                <BreakdownRow label="שכר דירה ברוטו" amount={result.data.cashflow.grossRent.monthly} />
                <BreakdownRow label="אי-אכלוס" amount={-result.data.cashflow.vacancyLoss.monthly} />
                {result.data.cashflow.operatingExpenses.lines.map((line) => (
                  <BreakdownRow key={line.key} label={line.label} amount={-line.monthly} />
                ))}
                <BreakdownRow label="החזר משכנתא" amount={-result.data.cashflow.mortgagePayment.monthly} />
                <BreakdownRow label="מס שכר דירה" amount={-result.data.cashflow.rentalTax.monthly} />
                <BreakdownRow label="נשאר בסוף חודש" amount={result.data.cashflow.netCashflow.monthly} strong />
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="text-base font-semibold">הרצה של ההנחות שלך</h2>
              <p className="mt-1 text-xs text-slate-500">
                לשינוי ההנחות ראה "ההנחות שלך" בפאנל שמתחת.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[result.data.scenarios.low, result.data.scenarios.central, result.data.scenarios.high].map((s) => (
                  <div key={s.key} className="rounded-xl bg-slate-100 p-3">
                    <div className="text-xs text-slate-500">{s.label}</div>
                    <div dir="ltr" className="mt-1 text-sm font-semibold tabular-nums">
                      {formatCompactILS(s.endPropertyValue)}
                    </div>
                    <div dir="ltr" className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                      {s.assumedGrowthPct}%
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                {result.data.scenarios.disclaimer}
              </p>
            </Card>
          </>
        ) : null}

        {result.ok && (
          <div className="mt-2">
            <ReportInsights analysis={result.data} />
          </div>
        )}

        {result.ok && (
          <Disclosure
            title="מתי משלמים ומה"
            summary={`${result.data.capitalTimeline.outflows.length} תשלומים`}
          >
            <CashflowTimeline
              timeline={result.data.capitalTimeline}
              {...(panel.hasPaymentSchedule && panel.isContractorPurchase && panel.occupancyDate
                ? { occupancyDate: panel.occupancyDate }
                : {})}
            />
          </Disclosure>
        )}

        {result.ok && (
          <Disclosure
            title="לוח הסילוקין"
            summary={`${formatCompactILS(
              result.data.mortgage.combinedRows.reduce((a, x) => a + x.interest, 0),
            )} ריבית`}
          >
            <AmortizationTable analysis={result.data} />
          </Disclosure>
        )}

        {result.ok && (
          <Disclosure title="רווח בכל נקודת מכירה" defaultOpen>
            <SaleSchedule analysis={result.data} />
          </Disclosure>
        )}

        <p className="px-1 text-xs leading-relaxed text-slate-500">
          הכלי מיועד להמחשה בלבד ואינו מהווה ייעוץ מס, ייעוץ משכנתאות או ייעוץ השקעות. נתוני המיסוי
          נכונים למועד העדכון המצוין לצד כל נתון.
        </p>
        </div>
      </main>

      {result.ok && <PrintReport analysis={result.data} />}

      <ShimshonChat context={shimshonContext} />
    </div>
  )
}
