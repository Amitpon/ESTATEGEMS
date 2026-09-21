/**
 * נתונים רגולטוריים. כל ערך כאן נושא asOf, source ו-verified.
 *
 * זה הקובץ היחיד שבו מופיעים מספרי חוק. שום מדרגה ושום תקרה לא מופיעה
 * בתוך קוד חישוב - כדי שעדכון שנתי יהיה שינוי בקובץ אחד.
 */

import type { SourcedValue } from '@/types/property';

/** מדרגת מס אחת. upTo === null פירושו המדרגה העליונה, ללא תקרה. */
export interface TaxBracket {
  /** גבול עליון של המדרגה בשקלים, או null למדרגה העליונה. */
  readonly upTo: number | null;
  /** שיעור המס בנקודות אחוז על החלק שבתוך המדרגה. */
  readonly ratePct: number;
}

/**
 * מס רכישה - דירה נוספת (לא דירה יחידה).
 * המס מתחיל מהשקל הראשון, ללא פטור. המדרגות קפואות עד ינואר 2028 ואינן מוצמדות למדד.
 *
 * אימות: נכס ב-2,000,000 ש"ח -> 160,000 ש"ח. תואם את הדוגמה במחקר השוק.
 */
export const PURCHASE_TAX_ADDITIONAL: SourcedValue<readonly TaxBracket[]> = {
  value: [
    { upTo: 6_055_070, ratePct: 8 },
    { upTo: null, ratePct: 10 },
  ],
  asOf: '2026',
  source:
    'docs/research/market-research.md סעיף 8.1 (daud.co.il מדריך מס רכישה 2026, klikatnadlan.co.il). המדרגות קפואות עד ינואר 2028 - israel-law.co',
  verified: true,
};

/**
 * מס רכישה - דירה יחידה.
 *
 * [!] לא מאומת. מחקר השוק (סעיף 8.1) כיסה רק את מדרגות הדירה הנוספת.
 * המדרגות כאן הן מדרגות מדרגת הדירה היחידה של שנת המס 2025/2026 כפי שהן מוכרות,
 * והן עקביות עם נקודת השבירה 6,055,070 ש"ח שמופיעה במחקר. הן מתעדכנות ב-16 בינואר
 * בכל שנה לפי מדד מחירי הדירות.
 *
 * TODO: לאמת מול אתר רשות המסים לפני הצגה למשתמש. הממשק חייב לסמן אזהרה
 * כל עוד verified === false.
 */
export const PURCHASE_TAX_SINGLE: SourcedValue<readonly TaxBracket[]> = {
  value: [
    { upTo: 1_978_745, ratePct: 0 },
    { upTo: 2_347_040, ratePct: 3.5 },
    { upTo: 6_055_070, ratePct: 5 },
    { upTo: 20_183_565, ratePct: 8 },
    { upTo: null, ratePct: 10 },
  ],
  asOf: '2025',
  source: 'מדרגות מס רכישה דירה יחידה, מדרגות 16.1.2025 - 15.1.2026. לא הופיע במחקר השוק.',
  verified: false,
  note:
    'לא אומת מול רשות המסים. המדרגות מתעדכנות ב-16 בינואר מדי שנה. יש לאמת לפני הצגה למשתמש.',
};

/**
 * תקרת הפטור החודשית במסלול הפטור על הכנסות שכירות.
 *
 * [!] לא מאומת לשנת 2026. מחקר השוק (סעיף 8.2) מסמן את הערך הזה כ-[?] ומציין
 * שהוא מתייחס לשנת 2025 ומתעדכן שנתית.
 *
 * TODO: לאמת מול רשות המסים לפני הצגה למשתמש.
 */
export const RENTAL_EXEMPTION_CEILING_MONTHLY: SourcedValue<number> = {
  value: 5_654,
  asOf: '2025',
  source:
    'docs/research/market-research.md סעיף 8.2 (Grant Thornton, מסלולי מיסוי הכנסות שכירות). מסומן שם [?].',
  verified: false,
  note:
    'תקרת 2025. התקרה מתעדכנת מדי שנה. לא אומתה ל-2026. הממשק חייב להציג אזהרה ליד כל סכום שנגזר ממנה.',
};

/** שיעור המס במסלול המופחת - 10 אחוז על ההכנסה ברוטו, ללא ניכוי הוצאות. */
export const RENTAL_FLAT_RATE_PCT: SourcedValue<number> = {
  value: 10,
  asOf: '2026',
  source: 'docs/research/market-research.md סעיף 8.2 (Grant Thornton).',
  verified: true,
};

/**
 * שיעור המס השולי שמשמש כברירת מחדל במסלול המדרגות.
 * זו ברירת מחדל בלבד - השיעור הוא שדה קלט שהמשתמש משנה (עיקרון 3).
 */
export const RENTAL_MARGINAL_DEFAULT_PCT: SourcedValue<number> = {
  value: 31,
  asOf: '2026',
  source:
    'docs/research/market-research.md סעיף 8.2 - מדרגת המס השולי המינימלית על הכנסה מיגיעה שאינה אישית (10 אחוז מגיל 60).',
  verified: true,
  note: 'המס השולי האישי משתנה בין משתמשים. זהו ערך פתיחה בלבד.',
};

/** מגבלות בנק ישראל למשכנתא על דירה שאינה יחידה. משמשות לאזהרות בממשק, לא לחסימה. */
export const BOI_LIMITS: SourcedValue<{
  readonly maxLtvAdditionalPct: number;
  readonly maxLtvSinglePct: number;
  readonly maxTermMonths: number;
  readonly minFixedSharePct: number;
  readonly maxVariableSharePct: number;
}> = {
  value: {
    maxLtvAdditionalPct: 50,
    maxLtvSinglePct: 75,
    maxTermMonths: 360,
    minFixedSharePct: 33,
    maxVariableSharePct: 66,
  },
  asOf: '2026',
  source: 'docs/research/market-research.md סעיף 8.4 (kolzchut.org.il - מגבלות על לקיחת משכנתא).',
  verified: true,
  note: 'maxLtvSinglePct (75 אחוז לדירה יחידה) לא הופיע במחקר במפורש ולא אומת.',
};

/** כל הערכים שסומנו כלא מאומתים, לתצוגה מרוכזת בממשק. */
export function unverifiedRegulatoryValues(): readonly SourcedValue<unknown>[] {
  const all: readonly SourcedValue<unknown>[] = [
    PURCHASE_TAX_ADDITIONAL,
    PURCHASE_TAX_SINGLE,
    RENTAL_EXEMPTION_CEILING_MONTHLY,
    RENTAL_FLAT_RATE_PCT,
    RENTAL_MARGINAL_DEFAULT_PCT,
  ];
  return all.filter((entry) => !entry.verified);
}

// ---------------------------------------------------------------------------
// מס שבח - מכירת הנכס
//
// אזהרה כללית: אף אחד מהמספרים כאן לא אומת מול רשות המסים. המקור הרשמי
// היחיד שנקרא בהצלחה הוא הוראת ביצוע מיסוי מקרקעין 2/2024, שממנה עולה
// שסכומי התקרה מתעדכנים **מדי שנה**. ראה docs/research/capital-gains-tax.md.
// הממשק חייב להציג אזהרה ליד כל סכום שנגזר מכאן.
// ---------------------------------------------------------------------------

/** שיעור המס על השבח הריאלי ליחיד. */
export const SHEVACH_TAX_RATE_PCT: SourcedValue<number> = {
  value: 25,
  asOf: '2026',
  source: 'חוק מיסוי מקרקעין, סעיף 48א(ב1). docs/research/capital-gains-tax.md',
  verified: false,
  note: 'עקבי בכל המקורות שנבדקו, אך לא אומת מול taxes.gov.il. אין לדווח מס לפיו.',
};

/**
 * תאריך החיתוך לחישוב הלינארי. שבח שנצבר לפניו פטור, ומה שאחריו חייב.
 * מקורו ברפורמת 2014.
 */
export const SHEVACH_LINEAR_CUTOFF: SourcedValue<string> = {
  value: '2014-01-01',
  asOf: '2026',
  source: 'חוק מיסוי מקרקעין, סעיף 48א(ב2). docs/research/capital-gains-tax.md',
  verified: false,
};

/**
 * תקרת הפטור במכירת דירה יחידה.
 *
 * **המספר הזה מיושן.** הוראת ביצוע 2/2024 קובעת אותו במפורש לתקופה
 * 1.1.2024 עד 31.12.2024 בלבד. ההוראה היא שנתית והסכום מתעדכן.
 * הוחלט על ידי בעל המוצר (2026-09-21) להשתמש בו בינתיים, ובלבד
 * שהממשק יציג את המגבלה במפורש.
 */
export const SHEVACH_SINGLE_APT_CEILING: SourcedValue<number> = {
  value: 5_008_000,
  asOf: '2024',
  source:
    'הוראת ביצוע מיסוי מקרקעין 2/2024, סעיף 49א(א1). ציטוט: "סכום תקרת הפטור לתקופה שבין 1.1.2024 עד 31.12.2024 - 5,008,000 ש"ח".',
  verified: false,
  note:
    'תקף ל-2024 בלבד. הוראת הביצוע מתעדכנת מדי שנה ולא אותר הסכום ל-2026. לבדוק מול רשות המסים לפני כל החלטה.',
};

/** תקופת ההחזקה המינימלית לזכאות לפטור דירה יחידה, בחודשים. */
export const SHEVACH_MIN_HOLDING_MONTHS: SourcedValue<number> = {
  value: 18,
  asOf: '2026',
  source: 'חוק מיסוי מקרקעין, סעיף 49ב(2). docs/research/capital-gains-tax.md',
  verified: false,
  note:
    'בדירה שנרכשה על הנייר, 18 החודשים נספרים מיום שהדירה הפכה ראויה למגורים (טופס 4) ולא מיום החוזה. לא אומת מול רשות המסים.',
};
