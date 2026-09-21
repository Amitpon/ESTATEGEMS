/**
 * בדיקות שפיות למנוע החישוב.
 * כל בדיקה מאמתת ערך, לא רק שהפונקציה לא זרקה.
 */
import { describe, expect, it } from 'vitest'
import { analyze } from '../index'
import { calcPurchaseTax } from '../purchase-tax'
import { spitzerMonthlyPayment, buildMortgage } from '../mortgage'
import { defaultAcquisitionCosts, defaultAssumptions, defaultOperatingExpenses } from '../defaults'
import type { PropertyInput } from '@/types/property'

describe('מס רכישה', () => {
  it('דירה נוספת ב-2 מיליון: 8 אחוז = 160,000 ש"ח', () => {
    const r = calcPurchaseTax(2_000_000, false)
    expect(r.total).toBe(160_000)
  })

  it('המדרגה השנייה נכנסת רק מעל 6,055,070 ש"ח', () => {
    const below = calcPurchaseTax(6_055_070, false)
    expect(below.total).toBeCloseTo(6_055_070 * 0.08, 2)

    const above = calcPurchaseTax(7_000_000, false)
    // 8% על המדרגה הראשונה ועוד 10% על העודף
    const expected = 6_055_070 * 0.08 + (7_000_000 - 6_055_070) * 0.1
    expect(above.total).toBeCloseTo(expected, 2)
  })

  it('דירה יחידה זולה יותר מדירה נוספת באותו מחיר', () => {
    expect(calcPurchaseTax(2_000_000, true).total).toBeLessThan(
      calcPurchaseTax(2_000_000, false).total,
    )
  })

  it('דריסה ידנית גוברת על החישוב המדורג', () => {
    expect(calcPurchaseTax(2_000_000, false, 0).total).toBe(0)
  })

  it('מחיר 0 מחזיר מס 0', () => {
    expect(calcPurchaseTax(0, false).total).toBe(0)
  })
})

describe('משכנתא', () => {
  it('שפיצר: מיליון ש"ח, 4.5 אחוז, 30 שנה -> כ-5,067 ש"ח לחודש', () => {
    const payment = spitzerMonthlyPayment(1_000_000, 4.5, 360)
    expect(payment).toBeGreaterThan(5_050)
    expect(payment).toBeLessThan(5_080)
  })

  it('ריבית אפס: ההחזר הוא הקרן חלקי מספר החודשים', () => {
    expect(spitzerMonthlyPayment(360_000, 0, 360)).toBeCloseTo(1_000, 6)
  })

  it('לוח הסילוקין אינו נקטע ב-120 חודשים - 360 שורות מלאות', () => {
    const m = buildMortgage(
      [
        {
          id: 't1',
          label: 'קבועה',
          principal: 1_000_000,
          annualRatePct: 4.5,
          termMonths: 360,
          amortization: 'spitzer',
          linkage: 'fixedUnlinked',
        },
      ],
      1_000_000,
    )
    expect(m.combinedRows).toHaveLength(360)
    // בסוף התקופה היתרה מתאפסת
    expect(m.combinedRows[359]!.balance).toBeCloseTo(0, 2)
  })

  it('סך התשלומים גדול מהקרן בדיוק בגובה הריבית', () => {
    const m = buildMortgage(
      [
        {
          id: 't1',
          label: 'קבועה',
          principal: 500_000,
          annualRatePct: 5,
          termMonths: 240,
          amortization: 'spitzer',
          linkage: 'fixedUnlinked',
        },
      ],
      500_000,
    )
    expect(m.totalPaid - m.totalInterest).toBeCloseTo(500_000, 0)
  })

  it('סכום קרנות שאינו תואם לסכום ההלוואה זורק שגיאה', () => {
    expect(() =>
      buildMortgage(
        [
          {
            id: 't1',
            label: 'קבועה',
            principal: 400_000,
            annualRatePct: 5,
            termMonths: 240,
            amortization: 'spitzer',
            linkage: 'fixedUnlinked',
          },
        ],
        500_000,
      ),
    ).toThrow()
  })

  it('הלוואה 0 מחזירה לוח ריק', () => {
    const m = buildMortgage([], 0)
    expect(m.loanAmount).toBe(0)
    expect(m.firstMonthlyPayment).toBe(0)
  })
})

/** קלט בסיסי לבדיקות הניתוח המלא. */
function baseInput(over: Partial<PropertyInput> = {}): PropertyInput {
  const price = 2_000_000
  return {
    analysisDate: '2026-09-20',
    property: { price, sizeSqm: 80, city: 'חיפה', kind: 'apartment', rooms: 3 },
    financing: {
      downPayment: 1_000_000,
      tracks: [
        {
          id: 'main',
          label: 'קבועה לא צמודה',
          principal: 1_000_000,
          annualRatePct: 4.9,
          termMonths: 360,
          amortization: 'spitzer',
          linkage: 'fixedUnlinked',
        },
      ],
      earlyRepaymentFeePct: 0,
    },
    income: { monthlyRent: 5_500, vacancyPct: 100 / 12 },
    expenses: defaultOperatingExpenses(),
    acquisitionCosts: defaultAcquisitionCosts(price),
    tax: { isSingleApartment: false, rentalTaxTrack: 'exempt', marginalTaxRatePct: 31 },
    ...over,
  }
}

describe('ניתוח מלא', () => {
  it('מחזיר LTV נכון ומס רכישה נכון', () => {
    const r = analyze(baseInput(), defaultAssumptions())
    expect(r.ltvPct).toBeCloseTo(50, 6)
    expect(r.loanAmount).toBe(1_000_000)
    expect(r.purchaseTax.total).toBe(160_000)
  })

  it('ההון הנדרש ביום 1 כולל את מס הרכישה ולכן גדול מההון העצמי', () => {
    const r = analyze(baseInput(), defaultAssumptions())
    expect(r.equity.total).toBeGreaterThan(1_000_000 + 160_000)
  })

  it('התזרים הנקי קטן משכר הדירה הברוטו', () => {
    const r = analyze(baseInput(), defaultAssumptions())
    expect(r.cashflow.netCashflow.monthly).toBeLessThan(5_500)
  })

  it('ללא משכנתא התזרים גבוה יותר מאשר עם משכנתא', () => {
    const withLoan = analyze(baseInput(), defaultAssumptions())
    const noLoan = analyze(
      baseInput({ financing: { downPayment: 2_000_000, tracks: [], earlyRepaymentFeePct: 0 } }),
      defaultAssumptions(),
    )
    expect(noLoan.cashflow.netCashflow.monthly).toBeGreaterThan(
      withLoan.cashflow.netCashflow.monthly,
    )
    expect(noLoan.ltvPct).toBe(0)
  })

  it('שכר דירה 0 מייצר תזרים שלילי', () => {
    const r = analyze(baseInput({ income: { monthlyRent: 0, vacancyPct: 0 } }), defaultAssumptions())
    expect(r.cashflow.netCashflow.monthly).toBeLessThan(0)
  })

  it('הגדרת downPayment וגם ltvPct יחד זורקת שגיאה', () => {
    expect(() =>
      analyze(
        baseInput({
          financing: {
            downPayment: 1_000_000,
            ltvPct: 50,
            tracks: [],
            earlyRepaymentFeePct: 0,
          },
        }),
        defaultAssumptions(),
      ),
    ).toThrow()
  })

  it('ההרצה קדימה מחזירה תמיד את ההנחות ששימשו אותה', () => {
    const assumptions = { ...defaultAssumptions(), assumedAppreciationPct: 3 }
    const r = analyze(baseInput(), assumptions)
    expect(r.scenarios.assumptions.assumedAppreciationPct).toBe(3)
    expect(r.scenarios.central.assumedGrowthPct).toBe(3)
    // התרחיש הנמוך והגבוה נפרשים סביב ההנחה
    expect(r.scenarios.low.assumedGrowthPct).toBeLessThan(3)
    expect(r.scenarios.high.assumedGrowthPct).toBeGreaterThan(3)
  })

  it('הרצה קדימה: שווי גבוה יותר בהנחת עליית ערך גבוהה יותר', () => {
    const r = analyze(baseInput(), defaultAssumptions())
    expect(r.scenarios.high.endPropertyValue).toBeGreaterThan(r.scenarios.low.endPropertyValue)
  })

  it('שלושת מסלולי מס השכירות מחושבים וממוינים מהזול ליקר', () => {
    const r = analyze(baseInput(), defaultAssumptions())
    expect(r.rentalTax.tracks).toHaveLength(3)
    const taxes = r.rentalTax.tracks.map((t) => t.annualTax)
    expect([...taxes].sort((a, b) => a - b)).toEqual(taxes)
  })

  it('נקודת האיזון היא שכר הדירה שבו התזרים מתאפס', () => {
    const r = analyze(baseInput(), defaultAssumptions())
    const breakEven = r.metrics.breakEvenRent.value
    expect(Number.isFinite(breakEven)).toBe(true)

    const atBreakEven = analyze(
      baseInput({ income: { monthlyRent: breakEven, vacancyPct: 100 / 12 } }),
      defaultAssumptions(),
    )
    expect(Math.abs(atBreakEven.cashflow.netCashflow.monthly)).toBeLessThan(5)
  })
})
