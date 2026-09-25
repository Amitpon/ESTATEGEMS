/**
 * נתוני השוואה חיצוניים (benchmarks).
 *
 * עיקרון 2 (docs/product-principles.md): "נתונים חיצוניים הם עוגן, לא מילוי
 * אוטומטי". מוצג למשתמש עם מקור ותאריך, ולא מוזן בשבילו.
 *
 * עיקרון 1: "הכלי לא מנבא". ה-CAGR כאן הוא תשואה היסטורית של עשור שחלף -
 * **לא תחזית לעתיד**. כל מקום שמציג את הנתון הזה חייב לומר זאת במפורש.
 */

/** תשואת מדד S&P 500 (עם דיבידנדים) - נתון היסטורי בלבד. */
export const SP500_BENCHMARK = {
  /** תשואה שנתית ממוצעת (CAGR) לעשור, כשבר עשרוני (0.148 = 14.8 אחוז). */
  tenYearCAGR: 0.148,
  tenYearPeriod: { from: '2016-01', to: '2025-12' },
  asOf: '2026-01-01',
  source: 'Fidelity Financial Solutions, calculated from S&P 500 (SPX) total return incl. dividends',
  sourceUrl: 'https://www.fidelity.com/learning-center/trading-investing/sp-500-average-return',
  verified: '2026-03-06',
  note: 'נתון היסטורי בלבד - אינו תחזית לעתיד.',
} as const;
