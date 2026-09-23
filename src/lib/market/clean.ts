/**
 * src/lib/market/clean.ts
 *
 * ניקוי עסקאות גולמיות לפני חישוב סטטיסטיקות שוק.
 *
 * פונקציות טהורות בלבד - אין fetch, אין React, אין Date.now().
 * תאריכים מגיעים כפרמטר.
 *
 * ה-moat של המוצר: נתוני govmap כוללים עסקאות מלוכלכות שמשבשות חציון.
 * כל סינון מתועד ב-FilteredOut כדי שהממשק יוכל להציג "47 עסקאות, 6 סוננו".
 */

import type { GovmapRawDeal } from '@/services/govmap'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** עסקה מנורמלת ומאומתת - כל שדה קיים ותקין. */
export interface CleanDeal {
  /** תאריך העסקה, ISO YYYY-MM-DD */
  readonly date: string
  /** מחיר ב-₪ */
  readonly price: number
  /** שטח במ"ר */
  readonly sqm: number
  /** מחיר למ"ר */
  readonly pricePerSqm: number
  readonly floor: number | null
  readonly rooms: number | null
  readonly streetName: string | null
  readonly houseNum: string | null
}

/** סיבה לסינון */
export type FilterReason =
  | 'missing-price'
  | 'missing-sqm'
  | 'zero-sqm'
  | 'zero-price'
  | 'negative-price'
  | 'too-old'
  | 'price-per-sqm-outlier'
  | 'non-finite-value'

/** עסקה שסוננה - נשמרת לשקיפות בפני המשתמש */
export interface FilteredOut {
  readonly raw: GovmapRawDeal
  readonly reason: FilterReason
  /** הערך החריג שגרם לסינון, כדי שניתן יהיה לדבג */
  readonly offendingValue?: number
}

/** תוצאת ניקוי */
export interface CleanResult {
  readonly deals: readonly CleanDeal[]
  readonly filtered: readonly FilteredOut[]
  /** כמה עסקאות הגיעו מלכתחילה */
  readonly totalInput: number
}

// ---------------------------------------------------------------------------
// Date parsing
// ---------------------------------------------------------------------------

/**
 * ממיר פורמטים שגורים של govmap ל-ISO.
 * govmap מחזיר "DD/MM/YYYY" ולעיתים "YYYY-MM-DD".
 * מחזיר null אם לא ניתן לפרש.
 */
function parseDate(raw: string | undefined): string | null {
  if (!raw) return null

  // DD/MM/YYYY
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw)
  if (dmy && dmy[3] && dmy[2] && dmy[1]) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }

  // YYYY-MM-DD (כבר ISO)
  const iso = /^\d{4}-\d{2}-\d{2}$/.exec(raw)
  if (iso) return raw

  return null
}

// ---------------------------------------------------------------------------
// IQR outlier filter for price-per-sqm
// ---------------------------------------------------------------------------

/**
 * מחשב גבולות IQR לסינון חריגים.
 * מחזיר [lower, upper] של מחיר למ"ר.
 *
 * מכפיל 2.5 (במקום הסטנדרטי 1.5) כי שוק הנדל"ן הישראלי הוא מגוון -
 * דירה פנטהאוז ודירת גן באותה שכונה יכולות להיות חוקיות לגמרי.
 * 1.5 היה מסנן יותר מדי.
 */
function iqrBounds(values: readonly number[]): [number, number] {
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  if (n < 4) return [0, Infinity] // אין מספיק נתונים לסינון IQR

  const q1 = sorted[Math.floor(n * 0.25)] ?? sorted[0] ?? 0
  const q3 = sorted[Math.floor(n * 0.75)] ?? sorted[n - 1] ?? 0
  const iqr = q3 - q1
  const k = 2.5

  return [q1 - k * iqr, q3 + k * iqr]
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface CleanOptions {
  /**
   * תאריך מוקדם ביותר לקבל (ISO). עסקאות ישנות יותר מסוננות.
   * ברירת מחדל: 2 שנים אחורה מ-referenceDate.
   */
  readonly minDate?: string
  /**
   * תאריך הייחוס לחישוב חלון זמן ברירת מחדל.
   * חייב להיות מוגדר אם minDate לא מוגדר.
   */
  readonly referenceDate?: string
}

/**
 * מנקה רשימת עסקאות גולמיות משלב ה-govmap לניתוח שוק.
 *
 * שלבי הסינון:
 * 1. חסרים: מחיר, שטח.
 * 2. ערכים בלתי אפשריים: שטח 0, מחיר 0 או שלילי.
 * 3. עסקאות ישנות מהחלון המוגדר.
 * 4. חריגים במחיר למ"ר (IQR×2.5) - מייצגים בדרך כלל עסקאות בין קרובים או מכירת חלק.
 */
export function cleanDeals(
  raw: readonly GovmapRawDeal[],
  opts: CleanOptions = {},
): CleanResult {
  const filtered: FilteredOut[] = []

  // חלון זמן
  let minDateIso: string | null = null
  if (opts.minDate) {
    minDateIso = opts.minDate
  } else if (opts.referenceDate) {
    // ברירת מחדל: 2 שנים אחורה
    const ref = new Date(opts.referenceDate)
    ref.setFullYear(ref.getFullYear() - 2)
    minDateIso = ref.toISOString().slice(0, 10)
  }

  // שלב 1+2: סינון בסיסי
  const basicPassed: Array<{ raw: GovmapRawDeal; date: string; price: number; sqm: number }> = []

  for (const deal of raw) {
    if (deal.dealAmount === undefined || deal.dealAmount === null) {
      filtered.push({ raw: deal, reason: 'missing-price' })
      continue
    }
    if (deal.sqmeter === undefined || deal.sqmeter === null) {
      filtered.push({ raw: deal, reason: 'missing-sqm' })
      continue
    }
    if (!Number.isFinite(deal.dealAmount) || !Number.isFinite(deal.sqmeter)) {
      // govmap הוא מקור חיצוני לא מאומת - ערך NaN/Infinity לא נעצר על ידי
      // בדיקת <=0 (למשל NaN <= 0 הוא false) ויכול לזהם חציון בשקט.
      const offending = Number.isFinite(deal.dealAmount) ? deal.sqmeter : deal.dealAmount
      filtered.push({ raw: deal, reason: 'non-finite-value', offendingValue: offending })
      continue
    }
    if (deal.dealAmount <= 0) {
      filtered.push({ raw: deal, reason: deal.dealAmount < 0 ? 'negative-price' : 'zero-price', offendingValue: deal.dealAmount })
      continue
    }
    if (deal.sqmeter <= 0) {
      filtered.push({ raw: deal, reason: 'zero-sqm', offendingValue: deal.sqmeter })
      continue
    }

    const date = parseDate(deal.dealDate)
    if (!date) {
      // תאריך חסר לא עוצר את העסקה אם אין חלון זמן, אבל לא נוכל לסנן לפי תאריך
      // אנחנו נסנן רק אם יש minDate
      if (minDateIso) {
        filtered.push({ raw: deal, reason: 'too-old' })
        continue
      }
      basicPassed.push({ raw: deal, date: '', price: deal.dealAmount, sqm: deal.sqmeter })
      continue
    }

    // שלב 3: סינון לפי חלון זמן
    if (minDateIso && date < minDateIso) {
      filtered.push({ raw: deal, reason: 'too-old', offendingValue: undefined })
      continue
    }

    basicPassed.push({ raw: deal, date, price: deal.dealAmount, sqm: deal.sqmeter })
  }

  // שלב 4: סינון IQR על מחיר למ"ר
  const pricesPerSqm = basicPassed.map((d) => d.price / d.sqm)
  const [lowerBound, upperBound] = iqrBounds(pricesPerSqm)

  const deals: CleanDeal[] = []

  for (let i = 0; i < basicPassed.length; i++) {
    const d = basicPassed[i]
    if (!d) continue
    const ppsm = d.price / d.sqm

    if (ppsm < lowerBound || ppsm > upperBound) {
      filtered.push({
        raw: d.raw,
        reason: 'price-per-sqm-outlier',
        offendingValue: Math.round(ppsm),
      })
      continue
    }

    deals.push({
      date: d.date,
      price: d.price,
      sqm: d.sqm,
      pricePerSqm: ppsm,
      floor: d.raw.floor ?? null,
      rooms: d.raw.rooms ?? null,
      streetName: d.raw.streetNameHeb ?? null,
      houseNum: d.raw.houseNum ?? null,
    })
  }

  return { deals, filtered, totalInput: raw.length }
}
