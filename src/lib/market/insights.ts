/**
 * src/lib/market/insights.ts
 *
 * סטטיסטיקות שוק ממעסקאות מנוקות.
 *
 * פונקציות טהורות - אין fetch, אין React, אין Date.now().
 *
 * עיקרון 1 (product-principles): הכלי לא מנבא. כל מספר כאן הוא תיאור של
 * עסקאות שנסגרו - לא תחזית לעתיד.
 *
 * עיקרון 2: כל ערך חוזר עם מקור ותאריך (SourcedValue<T> מ-types/property.ts).
 */

import type { CleanDeal } from './clean'
import type { SourcedValue } from '@/types/property'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * מינימום עסקאות לחישוב תקף.
 *
 * 5 הוא הסף שנבחר: עם פחות עסקאות החציון יכול להיות מעוות על ידי עסקה בודדת חריגה,
 * ולא ניתן לחשב אחוזון 25-75  משמעותי. 3 עסקאות אינן שכונה.
 */
export const MIN_DEALS_FOR_INSIGHTS = 5

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** מיקום הנכס ביחס לשוק */
export interface MarketPosition {
  /** מחיר למ"ר של הנכס הנבדק */
  readonly subjectPricePerSqm: number
  /** החציון של השוק */
  readonly medianPricePerSqm: number
  /**
   * סטייה מהחציון באחוזים. חיובי = יקר מהחציון, שלילי = זול ממנו.
   * למשל 12 = "יקר ב-12% מחציון השכונה".
   */
  readonly deviationPct: number
  readonly label: string
}

/** מגמה בין שתי תקופות */
export interface PriceTrend {
  /** עלייה/ירידה באחוזים בין תקופה ראשונה לשנייה */
  readonly changePct: number
  readonly direction: 'up' | 'down' | 'flat'
  readonly olderMedian: number
  readonly recentMedian: number
  readonly olderCount: number
  readonly recentCount: number
  readonly label: string
}

/** תוצאת ניתוח שוק מלא */
export interface MarketInsights {
  /** חציון מחיר למ"ר, עם מקור ותאריך */
  readonly medianPricePerSqm: SourcedValue<number>
  /** אחוזון 25 */
  readonly p25PricePerSqm: number
  /** אחוזון 75 */
  readonly p75PricePerSqm: number
  /** מספר עסקאות שנכנסו לחישוב */
  readonly dealCount: number
  /** טווח תאריכי העסקאות */
  readonly dateRange: { readonly from: string; readonly to: string }
  /** מגמה בין חצי השנה הישנה לחצי השנה החדשה (null אם אין מספיק נתונים) */
  readonly trend: PriceTrend | null
}

/** תוצאה כשאין מספיק נתונים */
export interface InsufficientData {
  readonly kind: 'insufficient'
  readonly dealCount: number
  readonly minimum: number
}

export type InsightsResult = { ok: true; data: MarketInsights } | { ok: false; error: InsufficientData }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortedValues(deals: readonly CleanDeal[]): number[] {
  return deals.map((d) => d.pricePerSqm).sort((a, b) => a - b)
}

/**
 * חציון - פרצנטיל 50.
 * עבור מערך זוגי מחזיר ממוצע שני הערכים האמצעיים.
 */
function median(sorted: readonly number[]): number {
  const n = sorted.length
  if (n === 0) return 0
  const mid = Math.floor(n / 2)
  if (n % 2 === 1) return sorted[mid] ?? 0
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo] ?? 0
  const loVal = sorted[lo] ?? 0
  const hiVal = sorted[hi] ?? 0
  return loVal + (hiVal - loVal) * (idx - lo)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * מחשב סטטיסטיקות שוק מרשימת עסקאות מנוקות.
 *
 * @param deals     עסקאות לאחר cleanDeals
 * @param sourceUrl המקור שיצורף לכל SourcedValue (govmap URL)
 */
export function computeMarketInsights(
  deals: readonly CleanDeal[],
  sourceUrl = 'https://www.govmap.gov.il/',
): InsightsResult {
  if (deals.length < MIN_DEALS_FOR_INSIGHTS) {
    return {
      ok: false,
      error: { kind: 'insufficient', dealCount: deals.length, minimum: MIN_DEALS_FOR_INSIGHTS },
    }
  }

  const sorted = sortedValues(deals)
  const med = median(sorted)
  const p25 = percentile(sorted, 25)
  const p75 = percentile(sorted, 75)

  // טווח תאריכים
  const dates = deals.map((d) => d.date).filter(Boolean).sort()
  const from = dates[0] ?? ''
  const to = dates[dates.length - 1] ?? ''

  // מגמה: מחלקים את העסקאות לשתי חצאים לפי תאריך
  const trend = computeTrend(deals)

  const asOf = to || new Date().toISOString().slice(0, 10)

  return {
    ok: true,
    data: {
      medianPricePerSqm: {
        value: Math.round(med),
        asOf,
        source: sourceUrl,
        verified: false, // נתון שנשלף מ-API ממשלתי - לא עבר ביקורת ידנית
        note: 'נתוני עסקאות רשות המסים דרך govmap.gov.il',
      },
      p25PricePerSqm: Math.round(p25),
      p75PricePerSqm: Math.round(p75),
      dealCount: deals.length,
      dateRange: { from, to },
      trend,
    },
  }
}

/**
 * מחשב מיקום נכס ספציפי ביחס לשוק.
 *
 * @param subjectPricePerSqm  מחיר למ"ר של הנכס הנבדק
 * @param insights            תוצאת computeMarketInsights
 */
export function computeMarketPosition(
  subjectPricePerSqm: number,
  insights: MarketInsights,
): MarketPosition {
  const med = insights.medianPricePerSqm.value
  const deviationPct = med > 0 ? Math.round(((subjectPricePerSqm - med) / med) * 100) : 0

  let label: string
  if (Math.abs(deviationPct) <= 5) {
    label = 'קרוב לחציון השוק'
  } else if (deviationPct > 0) {
    label = `יקר ב-${deviationPct}% מחציון השכונה`
  } else {
    label = `זול ב-${Math.abs(deviationPct)}% מחציון השכונה`
  }

  return { subjectPricePerSqm, medianPricePerSqm: med, deviationPct, label }
}

/**
 * מגמת מחירים: מחלק עסקאות לשתי תקופות (חצי ישן + חצי חדש לפי תאריך)
 * ומשווה את החציונים.
 *
 * מחזיר null אם אין מספיק עסקאות בכל אחת מהתקופות (מינימום MIN_DEALS_FOR_INSIGHTS).
 */
function computeTrend(deals: readonly CleanDeal[]): PriceTrend | null {
  // מיון לפי תאריך - עסקאות בלי תאריך מושמטות
  const dated = deals.filter((d) => d.date).sort((a, b) => a.date.localeCompare(b.date))
  if (dated.length < MIN_DEALS_FOR_INSIGHTS * 2) return null

  const mid = Math.floor(dated.length / 2)
  const older = dated.slice(0, mid)
  const recent = dated.slice(mid)

  if (older.length < MIN_DEALS_FOR_INSIGHTS || recent.length < MIN_DEALS_FOR_INSIGHTS) return null

  const olderMedian = Math.round(median(sortedValues(older)))
  const recentMedian = Math.round(median(sortedValues(recent)))

  const changePct =
    olderMedian > 0 ? Math.round(((recentMedian - olderMedian) / olderMedian) * 100) : 0

  const direction = changePct > 2 ? 'up' : changePct < -2 ? 'down' : 'flat'

  const label =
    direction === 'flat'
      ? 'המחירים יציבים בתקופה הנסקרת'
      : direction === 'up'
        ? `המחירים עלו ב-${changePct}% בתקופה הנסקרת`
        : `המחירים ירדו ב-${Math.abs(changePct)}% בתקופה הנסקרת`

  return {
    changePct,
    direction,
    olderMedian,
    recentMedian,
    olderCount: older.length,
    recentCount: recent.length,
    label,
  }
}
