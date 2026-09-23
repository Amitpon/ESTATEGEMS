/**
 * @vitest-environment jsdom
 *
 * טסט מבני למסך התוצאות אחרי הריבוד מחדש לגריד שלושת המדדים ול-Disclosure.
 * לא בודק את מנוע החישוב (יש לו כיסוי משלו ב-src/lib/calc/__tests__) -
 * בודק שה-UI מציג את מה שהמנוע מחזיר, ובפרט את הענף התלוי-משכנתא
 * שהכי קל לסוכן עיצוב לשבור בטעות.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsPage } from '@/pages/ResultsPage'
import {
  analyze,
  defaultAcquisitionCosts,
  defaultAssumptions,
  defaultOperatingExpenses,
} from '@/lib/calc'
import type { PropertyInput } from '@/types/property'
import type { PropertyAnalysis } from '@/hooks/usePropertyAnalysis'
import type { AssumptionsPanelValues } from '@/components/AssumptionsPanel'

/** קלט בסיסי - אותה תבנית כמו ב-calc/__tests__/calc.test.ts, עם משכנתא. */
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
    tax: { isSingleApartment: true, rentalTaxTrack: 'exempt', marginalTaxRatePct: 31 },
    ...over,
  }
}

const basePanel: AssumptionsPanelValues = {
  appreciationPct: 3,
  rentGrowthPct: 2,
  expenseGrowthPct: 2,
  indexChangePct: 3.5,
  sellingCostPct: 2,
  horizonYears: 10,
  spreadPoints: 2,
  vacancyPct: 100 / 12,
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
  stages: [],
  stageDates: {},
}

/**
 * ResultsPage משתמש רק ב-`analysis.result` מתוך כל האובייקט שמחזיר
 * usePropertyAnalysis. בונים כאן רק את מה שנצרך בפועל, ומטילים את הטיפוס -
 * זה טסט קומפוננטה, לא טסט של ה-hook.
 */
function makeAnalysis(input: PropertyInput): PropertyAnalysis {
  const assumptions = defaultAssumptions()
  const data = analyze(input, assumptions)
  return {
    result: { ok: true as const, data, input, assumptions },
  } as unknown as PropertyAnalysis
}

describe('ResultsPage', () => {
  it('מציג את המסך בלי שגיאות כשיש תוצאת ניתוח תקינה', () => {
    const analysis = makeAnalysis(baseInput())
    expect(() => render(<ResultsPage analysis={analysis} panel={basePanel} />)).not.toThrow()
  })

  describe('גריד המדדים', () => {
    it('מציג שלושה מדדים - כולל כיסוי ההחזר - כשיש משכנתא', () => {
      const analysis = makeAnalysis(baseInput())
      render(<ResultsPage analysis={analysis} panel={basePanel} />)

      // "כיסוי ההחזר" מופיע גם ככותרת עמודה בטבלת רגישות הריבית (Disclosure
      // נפרד באותו מסך) - מסננים רק ל-<div> של גריד המדדים כדי לא להתנגש.
      expect(screen.getAllByText('כיסוי ההחזר', { selector: 'div' }).length).toBeGreaterThan(0)
      expect(screen.getByText('תשואה ברוטו')).toBeTruthy()
      expect(screen.getByText('תשואה על ההון')).toBeTruthy()
    })

    it('מסתיר את עמודת כיסוי ההחזר כשאין משכנתא (tracks ריק)', () => {
      const noLoanInput = baseInput({
        financing: { downPayment: 2_000_000, tracks: [], earlyRepaymentFeePct: 0 },
      })
      const analysis = makeAnalysis(noLoanInput)
      render(<ResultsPage analysis={analysis} panel={basePanel} />)

      // בלי משכנתא, RateSensitivityTable מחזיר [] ולא מרנדר בכלל - אז "div"
      // הוא מספיק, אין th מתחרה מהטבלה.
      expect(screen.queryByText('כיסוי ההחזר', { selector: 'div' })).toBeNull()
      // שני המדדים האחרים עדיין חייבים להופיע - זה לא "המסך נעלם", זה ענף ספציפי שהוסתר
      expect(screen.getByText('תשואה ברוטו')).toBeTruthy()
      expect(screen.getByText('תשואה על ההון')).toBeTruthy()
    })
  })

  describe('הסקשנים המתקפלים', () => {
    it('פירוק ההון וההשקעה סגורים כברירת מחדל', () => {
      const analysis = makeAnalysis(baseInput())
      render(<ResultsPage analysis={analysis} panel={basePanel} />)

      const equityDetails = screen.getByText('כמה כסף צריך ביום 1').closest('details')
      const cashflowDetails = screen.getByText('פירוק התזרים החודשי').closest('details')

      expect(equityDetails).not.toBeNull()
      expect(cashflowDetails).not.toBeNull()
      expect(equityDetails?.open).toBe(false)
      expect(cashflowDetails?.open).toBe(false)
    })

    it('סקשן "רווח בכל נקודת מכירה" פתוח כברירת מחדל, לפי defaultOpen', () => {
      const analysis = makeAnalysis(baseInput())
      render(<ResultsPage analysis={analysis} panel={basePanel} />)

      const saleDetails = screen.getByText('רווח בכל נקודת מכירה').closest('details')
      expect(saleDetails).not.toBeNull()
      expect(saleDetails?.open).toBe(true)
    })
  })
})
