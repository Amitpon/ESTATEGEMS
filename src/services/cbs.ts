/**
 * src/services/cbs.ts
 *
 * קריאה ל-snapshot נתוני הלמ"ס שנמשך בזמן הבילד (`scripts/fetch-cbs.mjs`).
 * פונקציות טהורות - הנתונים כבר בקובץ, אין fetch כאן.
 */

import cbsIndices from '@/data/cbs-indices.json'
import type { SourcedValue } from '@/types/property'

interface IndexPoint {
  readonly period: string
  readonly value: number
}

interface IndexSnapshot {
  readonly id: number
  readonly label: string
  readonly latestPeriod: string
  readonly latestValue: number
  readonly points: readonly IndexPoint[]
  readonly source: string
}

/**
 * שיעור עליית מחירי הדירות השנתי הממוצע (CAGR), לפי מדד הלמ"ס.
 *
 * **זהו תיאור עבר, לא תחזית** (עיקרון 1) - לכן `note` בתוצאה מזכיר זאת
 * במפורש, כדי שהממשק לעולם לא יציג את זה כהבטחה לעתיד.
 *
 * @param lookbackYears כמה שנים אחורה למדוד. ברירת מחדל 5 - מספיק ארוך
 *   כדי למצע מחזורי שוק, קצר מספיק להיות רלוונטי.
 */
export function getHousingPriceGrowth(lookbackYears = 5): SourcedValue<number> | null {
  if (!cbsIndices.fetchedAt) return null
  const idx = cbsIndices.housingPrices as IndexSnapshot | undefined
  if (!idx || idx.points.length === 0) return null

  const points = idx.points
  const latest = points[points.length - 1]
  if (!latest) return null

  const targetPeriod = shiftPeriod(latest.period, -lookbackYears)
  // מחפשים את הנקודה המוקדמת ביותר שעדיין בתוך החלון - לא בהכרח מדויקת
  // לחודש, כי המדד לא תמיד מתחיל באותו חודש בכל שנה.
  const startPoint = points.find((p) => p.period >= targetPeriod)
  if (!startPoint || startPoint.value <= 0) return null

  const yearsElapsed = periodDiffYears(startPoint.period, latest.period)
  if (yearsElapsed < 1) return null

  const cagr = (Math.pow(latest.value / startPoint.value, 1 / yearsElapsed) - 1) * 100

  return {
    value: Math.round(cagr * 10) / 10,
    asOf: latest.period,
    source: idx.source,
    verified: false,
    note: `שיעור עלייה שנתי ממוצע ב-${Math.round(yearsElapsed)} השנים האחרונות, לפי מדד מחירי הדירות של הלמ"ס. זהו נתון היסטורי ולא תחזית.`,
  }
}

/** "YYYY-MM" פחות n שנים. */
function shiftPeriod(period: string, deltaYears: number): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  return `${y + deltaYears}-${String(m).padStart(2, '0')}`
}

/** הפרש בשנים בין שני "YYYY-MM", כשבר עשרוני. */
function periodDiffYears(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  if (!fy || !fm || !ty || !tm) return 0
  return (ty - fy) + (tm - fm) / 12
}
