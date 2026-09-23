import { useMemo, useState } from 'react'
import { analyze, defaultAcquisitionCosts, defaultAssumptions, defaultOperatingExpenses, DEFAULT_VACANCY_PCT } from '@/lib/calc'
import type { AmortizationKind, PropertyInput } from '@/types/property'
import { suggestMortgageRate } from '@/services/rates'
import { buildShimshonContext } from '@/services/shimshon'
import { useMarketAnchor } from '@/hooks/useMarketAnchor'
import type { AssumptionsPanelValues } from '@/components/AssumptionsPanel'

/**
 * כל ה-state של מסך הניתוח, במקום אחד.
 *
 * למה hook ולא state ב-App: `App.tsx` הוא ההרכבה (header, ניווט שלבים,
 * page מתאים) ואילו כאן יושבת הלוגיקה - שדות הקלט, בניית קלט המנוע,
 * וההרצה עצמה. פיצול הזה מאפשר ל-InputPage ו-ResultsPage לצרוך את אותו
 * מקור אמת בלי prop-drilling ארוך.
 */
export function usePropertyAnalysis() {
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
  // שיטת הסילוקין. המנוע תמך בשתיהן מההתחלה, פשוט לא היה בורר.
  const [amortization, setAmortization] = useState<AmortizationKind>('spitzer')

  // מזהה השורה בענן אם הנכס הזה נטען מ-/properties או כבר נשמר בסשן הזה.
  // null = "עדיין לא שמור בכלל" - saveProperty ייצור שורה חדשה. אחרת -
  // שמירות חוזרות מעדכנות את אותה שורה במקום ליצור כפילויות.
  const [currentPropertyId, setCurrentPropertyId] = useState<string | null>(null)

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
      return { ok: true as const, data: analyze(input, assumptions), input, assumptions }
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'שגיאה בחישוב' }
    }
  }, [price, monthlyRent, equityPct, annualRatePct, termYears, sizeSqm, isSingleApartment, amortization, panel])

  // עוגן השוק - כתובת אופציונלית מול עסקאות אמת מ-govmap. מחיר למ"ר
  // מתעדכן כאן; אם sizeSqm הוא 0 מתקבל Infinity/NaN, ולכן ה-hook עצמו
  // בודק subjectPricePerSqm > 0 לפני שהוא מציג מיקום.
  const marketAnchor = useMarketAnchor(sizeSqm > 0 ? price / sizeSqm : 0)

  // ההקשר לשמשון נבנה רק ממה שהמנוע חישב, ועכשיו גם מנתוני השוק אם
  // יש כאלה. null מנטרל אותו.
  const shimshonContext = useMemo(() => {
    if (!result.ok) return null
    const market =
      marketAnchor.status.kind === 'ready' && sizeSqm > 0
        ? { insights: marketAnchor.status.insights, subjectPricePerSqm: price / sizeSqm }
        : undefined
    return buildShimshonContext(result.input, result.data, market)
  }, [result, marketAnchor.status, price, sizeSqm])

  /**
   * טוען נכס שמור חזרה לתוך הטופס - נקרא ממסך /properties.
   *
   * לא כל שדות ה-PropertyInput משוחזרים - רק אלה ש-usePropertyAnalysis
   * בעצמו מנהל (השדות הגרעיניים). לוח תשלומים, הוצאות מותאמות ועלויות
   * רכישה מפורטות חוזרים לברירת המחדל. זה מספיק לגרסה ראשונה של "טען
   * וערוך" - לא איבוד מידע קריטי, כי המשתמש רואה מיד את התוצאה ויכול
   * לתקן.
   */
  function loadSavedProperty(input: PropertyInput, id: string) {
    setPrice(input.property.price)
    setSizeSqm(input.property.sizeSqm)
    setMonthlyRent(input.income.monthlyRent)
    const downPayment =
      input.financing.downPayment ??
      input.property.price * (1 - (input.financing.ltvPct ?? 0) / 100)
    setEquityPct(input.property.price > 0 ? (downPayment / input.property.price) * 100 : 0)
    const track = input.financing.tracks[0]
    if (track) {
      setAnnualRatePct(track.annualRatePct)
      setTermYears(Math.round(track.termMonths / 12))
      setAmortization(track.amortization)
    }
    setIsSingleApartment(input.tax.isSingleApartment)
    setCurrentPropertyId(id)
  }

  return {
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
    shimshonContext,
    marketAnchor,
    currentPropertyId, setCurrentPropertyId,
    loadSavedProperty,
  }
}

export type PropertyAnalysis = ReturnType<typeof usePropertyAnalysis>
