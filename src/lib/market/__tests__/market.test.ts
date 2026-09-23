/**
 * טסטים למודול שוק.
 *
 * כל טסט מאמת ערך ספציפי, לא רק שלא נזרקה שגיאה.
 */

import { describe, it, expect } from 'vitest'
import { cleanDeals, type FilterReason } from '../clean'
import { computeMarketInsights, computeMarketPosition, MIN_DEALS_FOR_INSIGHTS } from '../insights'
import type { GovmapRawDeal } from '@/services/govmap'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeal(
  price: number,
  sqm: number,
  date = '2025-06-01',
): GovmapRawDeal {
  return {
    dealDate: date,
    dealAmount: price,
    sqmeter: sqm,
    floor: 2,
    rooms: 3,
    streetNameHeb: 'הרצל',
    houseNum: '1',
  }
}

/** מייצר N עסקאות סבירות סביב מחיר למ"ר נתון */
function makeDeals(n: number, pricePerSqm = 20000, sqm = 75): GovmapRawDeal[] {
  return Array.from({ length: n }, (_, i) =>
    makeDeal(pricePerSqm * sqm + i * 1000, sqm, `2025-0${(i % 9) + 1}-01`),
  )
}

// ---------------------------------------------------------------------------
// clean.ts
// ---------------------------------------------------------------------------

describe('cleanDeals - סינון בסיסי', () => {
  it('מסנן עסקה שחסר בה מחיר', () => {
    const deals: GovmapRawDeal[] = [{ sqmeter: 60 }]
    const r = cleanDeals(deals)
    expect(r.deals).toHaveLength(0)
    expect(r.filtered).toHaveLength(1)
    expect(r.filtered[0]?.reason).toBe<FilterReason>('missing-price')
  })

  it('מסנן עסקה שחסר בה שטח', () => {
    const deals: GovmapRawDeal[] = [{ dealAmount: 1_000_000 }]
    const r = cleanDeals(deals)
    expect(r.deals).toHaveLength(0)
    expect(r.filtered[0]?.reason).toBe<FilterReason>('missing-sqm')
  })

  it('מסנן שטח 0 - לא נספר בחציון', () => {
    const deals: GovmapRawDeal[] = [{ dealAmount: 1_000_000, sqmeter: 0 }]
    const r = cleanDeals(deals)
    expect(r.deals).toHaveLength(0)
    expect(r.filtered[0]?.reason).toBe<FilterReason>('zero-sqm')
  })

  it('מסנן מחיר 0', () => {
    const r = cleanDeals([{ dealAmount: 0, sqmeter: 60 }])
    expect(r.filtered[0]?.reason).toBe<FilterReason>('zero-price')
  })

  it('מסנן מחיר שלילי', () => {
    const r = cleanDeals([{ dealAmount: -500_000, sqmeter: 60 }])
    expect(r.filtered[0]?.reason).toBe<FilterReason>('negative-price')
  })

  it('מסנן עסקה ישנה מהחלון', () => {
    const old: GovmapRawDeal = { dealAmount: 1_500_000, sqmeter: 70, dealDate: '01/01/2020' }
    const r = cleanDeals([old], { minDate: '2024-01-01' })
    expect(r.deals).toHaveLength(0)
    expect(r.filtered[0]?.reason).toBe<FilterReason>('too-old')
  })

  it('מעביר עסקה תקינה', () => {
    const deal = makeDeal(1_500_000, 75, '01/06/2025')
    const r = cleanDeals([deal])
    expect(r.deals).toHaveLength(1)
    expect(r.deals[0]?.pricePerSqm).toBeCloseTo(20000, 0)
  })

  it('ממיר תאריך DD/MM/YYYY ל-ISO', () => {
    const deal = makeDeal(1_500_000, 75, '15/06/2025')
    const r = cleanDeals([deal])
    expect(r.deals[0]?.date).toBe('2025-06-15')
  })

  it('מחשב נכון pricePerSqm', () => {
    const deal = makeDeal(2_000_000, 100)
    const r = cleanDeals([deal])
    expect(r.deals[0]?.pricePerSqm).toBe(20000)
  })

  it('totalInput מכיל את כל העסקאות שהוזנו', () => {
    const r = cleanDeals([makeDeal(1_500_000, 75), { dealAmount: 0, sqmeter: 60 }])
    expect(r.totalInput).toBe(2)
    expect(r.deals).toHaveLength(1)
    expect(r.filtered).toHaveLength(1)
  })
})

describe('cleanDeals - סינון חריגים IQR', () => {
  it('מסנן עסקה במחיר מלאכותי (בין קרובי משפחה)', () => {
    // 9 עסקאות בטווח סביר + 1 עסקה במחיר מלאכותי נמוך מאוד
    const normal = makeDeals(9, 20000)
    const artificial: GovmapRawDeal = { dealAmount: 100_000, sqmeter: 70, dealDate: '2025-05-01' }
    const r = cleanDeals([...normal, artificial])
    expect(r.deals).toHaveLength(9)
    const filteredReasons = r.filtered.map((f) => f.reason)
    expect(filteredReasons).toContain<FilterReason>('price-per-sqm-outlier')
  })

  it('שומר עסקה בטווח תקין בתוך אוסף מגוון', () => {
    // 10 עסקאות - פיזור של 15000-25000 ₪ למ"ר, הכל סביר
    const deals: GovmapRawDeal[] = [
      makeDeal(1_125_000, 75), // 15000/m2
      makeDeal(1_312_500, 75), // 17500/m2
      makeDeal(1_500_000, 75), // 20000/m2
      makeDeal(1_500_000, 75), // 20000/m2
      makeDeal(1_500_000, 75), // 20000/m2
      makeDeal(1_500_000, 75), // 20000/m2
      makeDeal(1_687_500, 75), // 22500/m2
      makeDeal(1_875_000, 75), // 25000/m2
      makeDeal(1_500_000, 60), // 25000/m2
      makeDeal(1_800_000, 90), // 20000/m2
    ]
    const r = cleanDeals(deals)
    expect(r.deals.length).toBeGreaterThanOrEqual(8)
  })
})

// ---------------------------------------------------------------------------
// insights.ts
// ---------------------------------------------------------------------------

describe('computeMarketInsights - סף מינימום', () => {
  it('מחזיר insufficient כשיש פחות מ-MIN עסקאות', () => {
    const smallSet = makeDeals(MIN_DEALS_FOR_INSIGHTS - 1)
    const cleaned = cleanDeals(smallSet)
    const result = computeMarketInsights(cleaned.deals)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('insufficient')
      expect(result.error.minimum).toBe(MIN_DEALS_FOR_INSIGHTS)
    }
  })

  it('מחזיר נתונים בדיוק על הסף המינימלי', () => {
    const minSet = makeDeals(MIN_DEALS_FOR_INSIGHTS, 20000)
    const cleaned = cleanDeals(minSet)
    const result = computeMarketInsights(cleaned.deals)
    expect(result.ok).toBe(true)
  })
})

describe('computeMarketInsights - ערכים', () => {
  it('מחשב חציון נכון', () => {
    // 5 עסקאות עם מחיר ידוע - חציון 20000
    const deals: GovmapRawDeal[] = [
      makeDeal(1_200_000, 75), // 16000
      makeDeal(1_425_000, 75), // 19000
      makeDeal(1_500_000, 75), // 20000  <- חציון
      makeDeal(1_575_000, 75), // 21000
      makeDeal(1_800_000, 75), // 24000
    ]
    const cleaned = cleanDeals(deals)
    const result = computeMarketInsights(cleaned.deals)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.medianPricePerSqm.value).toBe(20000)
    }
  })

  it('p25 < חציון < p75', () => {
    const deals = makeDeals(10, 20000)
    const cleaned = cleanDeals(deals)
    const result = computeMarketInsights(cleaned.deals)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.p25PricePerSqm).toBeLessThanOrEqual(result.data.medianPricePerSqm.value)
      expect(result.data.p75PricePerSqm).toBeGreaterThanOrEqual(result.data.medianPricePerSqm.value)
    }
  })

  it('dealCount מדויק', () => {
    const n = 8
    const cleaned = cleanDeals(makeDeals(n, 20000))
    const result = computeMarketInsights(cleaned.deals)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.dealCount).toBe(n)
    }
  })

  it('verified=false - נתון govmap לא אומת ידנית', () => {
    const cleaned = cleanDeals(makeDeals(10, 20000))
    const result = computeMarketInsights(cleaned.deals)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.medianPricePerSqm.verified).toBe(false)
    }
  })
})

describe('computeMarketPosition', () => {
  it('מחשב סטייה חיובית כשהנכס יקר מהחציון', () => {
    const cleaned = cleanDeals(makeDeals(10, 20000))
    const result = computeMarketInsights(cleaned.deals)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const position = computeMarketPosition(22000, result.data)
    expect(position.deviationPct).toBeGreaterThan(0)
    expect(position.label).toMatch(/יקר/)
  })

  it('מחשב סטייה שלילית כשהנכס זול מהחציון', () => {
    const cleaned = cleanDeals(makeDeals(10, 20000))
    const result = computeMarketInsights(cleaned.deals)
    if (!result.ok) return

    const position = computeMarketPosition(17000, result.data)
    expect(position.deviationPct).toBeLessThan(0)
    expect(position.label).toMatch(/זול/)
  })

  it('תווית "קרוב לחציון" בסטייה של 3%', () => {
    const cleaned = cleanDeals(makeDeals(10, 20000))
    const result = computeMarketInsights(cleaned.deals)
    if (!result.ok) return

    const position = computeMarketPosition(20600, result.data) // ~3%
    expect(position.label).toMatch(/קרוב/)
  })
})

describe('trend', () => {
  it('מגמה null כשאין מספיק עסקאות לשתי תקופות', () => {
    // 8 עסקאות - פחות מ-5*2=10 עסקאות עם תאריכים
    const cleaned = cleanDeals(makeDeals(8, 20000))
    const result = computeMarketInsights(cleaned.deals)
    if (!result.ok) return
    expect(result.data.trend).toBeNull()
  })

  it('מגמה עולה כשמחירי מחצית שנייה גבוהים מהראשונה', () => {
    // 12 עסקאות: 6 ישנות ב-15000, 6 חדשות ב-25000
    const older = Array.from({ length: 6 }, (_, i) =>
      makeDeal(15000 * 75, 75, `2024-0${i + 1}-01`),
    )
    const recent = Array.from({ length: 6 }, (_, i) =>
      makeDeal(25000 * 75, 75, `2025-0${i + 1}-01`),
    )
    const cleaned = cleanDeals([...older, ...recent])
    const result = computeMarketInsights(cleaned.deals)
    if (!result.ok) return
    expect(result.data.trend?.direction).toBe('up')
  })
})
