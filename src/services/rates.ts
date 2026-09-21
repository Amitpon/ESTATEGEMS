/**
 * שכבת הגישה לנתוני הריבית של בנק ישראל.
 *
 * הנתונים מגיעים מ-snapshot סטטי (src/data/boi-rates.json) שנוצר בזמן build
 * על ידי scripts/fetch-boi.mjs. הסיבה: ה-API של בנק ישראל אינו מחזיר
 * Access-Control-Allow-Origin, ולכן fetch ישיר מהדפדפן נחסם.
 *
 * עיקרון 2 (docs/product-principles.md): כל פונקציה כאן מחזירה עוגן להשוואה
 * יחד עם מקורו ותאריכו. היא לא ממלאת שדות בשביל המשתמש.
 */

import snapshot from '@/data/boi-rates.json'

/** נקודה אחת בסדרת ריבית בנק ישראל. */
export interface BoiRatePoint {
  readonly month: string
  readonly date: string
  readonly rate: number
}

/** כיוון המגמה. */
export type TrendDirection = 'down' | 'up' | 'flat'

/** מגמת ריבית בנק ישראל על פני תקופה. */
export interface BoiRateTrend {
  readonly direction: TrendDirection
  /** השינוי בנקודות אחוז מתחילת התקופה ועד היום. שלילי פירושו ירידה. */
  readonly changePoints: number
  readonly fromRate: number
  readonly toRate: number
  readonly fromMonth: string
  readonly toMonth: string
  readonly points: readonly BoiRatePoint[]
  /** תיאור מילולי מוכן לתצוגה. עובדה, לא תחזית. */
  readonly summary: string
}

/** ערך עם מקור ותאריך, לתצוגה לצד כל מספר. */
export interface SourcedRate {
  readonly rate: number
  /** התקופה שאליה הערך מתייחס. */
  readonly asOf: string
  readonly sourceName: string
  readonly sourceUrl: string
}

const SOURCE_NAME = 'בנק ישראל'
const SOURCE_URL = 'https://www.boi.org.il/'

/** תאריך המשיכה של ה-snapshot. */
export const dataFetchedAt: string = snapshot.fetchedAt

/** ריבית בנק ישראל הנוכחית, עם מקור ותאריך. */
export function getCurrentBoiRate(): SourcedRate {
  return {
    rate: snapshot.boiRate.currentRate,
    asOf: snapshot.boiRate.latestDate,
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
  }
}

/**
 * מגמת ריבית בנק ישראל על פני מספר החודשים האחרונים.
 * @param months כמה חודשים אחורה. ברירת מחדל 12.
 */
export function getBoiRateTrend(months = 12): BoiRateTrend | null {
  const all = snapshot.boiRate.trend as readonly BoiRatePoint[]
  if (all.length === 0) return null

  const points = all.slice(Math.max(0, all.length - months))
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return null

  // עיגול לשתי ספרות כדי שלא יופיע רעש של חישוב צף בממשק.
  const changePoints = Math.round((last.rate - first.rate) * 100) / 100
  const direction: TrendDirection = changePoints < 0 ? 'down' : changePoints > 0 ? 'up' : 'flat'

  const abs = Math.abs(changePoints)
  const summary =
    direction === 'flat'
      ? `ריבית בנק ישראל לא השתנתה ב-${points.length} החודשים האחרונים ועומדת על ${last.rate}%`
      : direction === 'down'
        ? `ריבית בנק ישראל ירדה ב-${abs} נקודות אחוז ב-${points.length} החודשים האחרונים, מ-${first.rate}% ל-${last.rate}%`
        : `ריבית בנק ישראל עלתה ב-${abs} נקודות אחוז ב-${points.length} החודשים האחרונים, מ-${first.rate}% ל-${last.rate}%`

  return {
    direction,
    changePoints,
    fromRate: first.rate,
    toRate: last.rate,
    fromMonth: first.month,
    toMonth: last.month,
    points,
    summary,
  }
}

/** סוג המסלול שהמשתמש בוחר, בשפה של המוצר. */
export type TrackChoice =
  /** קבועה לא צמודה - הנפוץ ביותר. */
  | 'fixedUnlinked'
  /** קבועה צמודה למדד. */
  | 'fixedCpiLinked'
  /** משתנה צמודה למדד. */
  | 'variableCpiLinked'

const TRACK_TO_KEY: Record<TrackChoice, string> = {
  fixedUnlinked: 'NI+F',
  fixedCpiLinked: 'CPI+F',
  variableCpiLinked: 'CPI+A',
}

const TRACK_LABEL: Record<TrackChoice, string> = {
  fixedUnlinked: 'קבועה לא צמודה',
  fixedCpiLinked: 'קבועה צמודה למדד',
  variableCpiLinked: 'צמודה למדד',
}

/** הריבית הממוצעת בפועל במסלול, מנתוני בנק ישראל. */
export interface TypicalRate extends SourcedRate {
  readonly trackLabel: string
  /**
   * true כשהנתון נשען על מדגם דליל או על תקופה ישנה.
   * הממשק חייב לסמן זאת ולא להציג את המספר כמייצג.
   */
  readonly lowConfidence: boolean
}

/**
 * הריבית הממוצעת בפועל שנלקחה במסלול הזה, לפי דיווחי כלל המערכת הבנקאית.
 * מחזיר null אם אין נתון - במקרה כזה הממשק לא מציג עוגן, ולא ממציא מספר.
 */
export function getTypicalMortgageRate(track: TrackChoice): TypicalRate | null {
  const key = TRACK_TO_KEY[track]
  const entry = (snapshot.mortgageRates.latestRates as Record<string, { rate: number; month: string } | undefined>)[key]

  // ריבית 0 אינה נתון אמיתי אלא היעדר דיווח בפלח הזה.
  if (!entry || entry.rate <= 0) return null

  const latest = snapshot.mortgageRates.latestRateMonth
  const lowConfidence = entry.month !== latest

  return {
    rate: entry.rate,
    asOf: entry.month,
    trackLabel: TRACK_LABEL[track],
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    lowConfidence,
  }
}

/** הצעת ריבית לעסקה נתונה, עם כל ההקשר שהממשק צריך כדי להציג אותה כעוגן. */
export interface RateSuggestion {
  readonly suggestedRatePct: number
  readonly trackLabel: string
  readonly asOf: string
  readonly sourceName: string
  readonly sourceUrl: string
  readonly lowConfidence: boolean
  /** ה-LTV שחושב מהקלט, בנקודות אחוז. */
  readonly ltvPct: number
  /** true אם ה-LTV חורג ממגבלת בנק ישראל לדירה להשקעה. */
  readonly exceedsInvestmentLtvCap: boolean
  /** משפט מוכן לתצוגה. עובדה עם מקור, לא המלצה. */
  readonly note: string
}

/** מגבלת בנק ישראל על שיעור מימון לדירה שאינה יחידה. */
export const INVESTMENT_LTV_CAP_PCT = 50

/**
 * הצעת ריבית לפי נתוני העסקה.
 *
 * עיקרון 2: הפונקציה מציעה עוגן ולא ממלאת. הממשק מציג את המספר, את מקורו
 * ואת התקופה, והמשתמש מזין את הריבית שהוא מאמין בה.
 */
export function suggestMortgageRate(params: {
  price: number
  downPayment: number
  track?: TrackChoice
}): RateSuggestion | null {
  const { price, downPayment } = params
  const track = params.track ?? 'fixedUnlinked'

  if (!Number.isFinite(price) || price <= 0) return null

  const loanAmount = Math.max(0, price - downPayment)
  const ltvPct = (loanAmount / price) * 100

  const typical = getTypicalMortgageRate(track)
  if (!typical) return null

  const exceedsInvestmentLtvCap = ltvPct > INVESTMENT_LTV_CAP_PCT

  const note =
    `הריבית הממוצעת שנלקחה בפועל במסלול ${typical.trackLabel} היא ${typical.rate}%, ` +
    `לפי דיווחי המערכת הבנקאית לבנק ישראל ל-${typical.asOf}.`

  return {
    suggestedRatePct: typical.rate,
    trackLabel: typical.trackLabel,
    asOf: typical.asOf,
    sourceName: typical.sourceName,
    sourceUrl: typical.sourceUrl,
    lowConfidence: typical.lowConfidence,
    ltvPct,
    exceedsInvestmentLtvCap,
    note,
  }
}
