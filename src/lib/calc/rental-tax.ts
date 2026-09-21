/**
 * מס על הכנסות שכירות מדירת מגורים - שלושה מסלולים.
 *
 * 1. פטור - פטור מלא עד תקרה חודשית. מעל התקרה הפטור יורד: כל שקל מעל התקרה
 *    מקטין את הפטור בשקל, והיתרה ממוסה במס שולי.
 * 2. מופחת - 10 אחוז על ההכנסה ברוטו, ללא ניכוי הוצאות.
 * 3. מדרגות - מס שולי על ההכנסה בניכוי הוצאות מוכרות.
 *
 * [!] תקרת הפטור אינה מאומתת לשנת 2026. ראה RENTAL_EXEMPTION_CEILING_MONTHLY
 *     ב-tax-data.ts. כל תוצאה של מסלול הפטור נושאת דגל ceilingVerified === false.
 *
 * עיקרון 1: compareRentalTaxTracks מחזירה את שלושת המסלולים ממוינים לפי המס.
 * זו השוואה, לא המלצה. אין שדה recommended ואין ניסוח שמרמז על בחירה.
 */

import type { RentalTaxTrack, SourcedValue } from '@/types/property';
import {
  RENTAL_EXEMPTION_CEILING_MONTHLY,
  RENTAL_FLAT_RATE_PCT,
} from './tax-data';
import { assertNonNegative, assertPercent, roundAgorot } from './money';

/** קלט לחישוב מס שכירות. */
export interface RentalTaxInput {
  /** שכר דירה חודשי ברוטו, אחרי ניכוי אי-אכלוס. */
  readonly monthlyGrossRent: number;
  /** הוצאות מוכרות שנתיות, לניכוי במסלול המדרגות. */
  readonly annualDeductibleExpenses: number;
  /** שיעור המס השולי של המשתמש, בנקודות אחוז. */
  readonly marginalTaxRatePct: number;
}

/** תוצאת חישוב מסלול מס אחד. */
export interface RentalTaxTrackResult {
  readonly track: RentalTaxTrack;
  /** שם המסלול לתצוגה. */
  readonly label: string;
  /** ההכנסה השנתית ברוטו. */
  readonly annualGrossRent: number;
  /** החלק החייב במס מתוך ההכנסה השנתית. */
  readonly annualTaxableIncome: number;
  /** שיעור המס שהופעל על החלק החייב, בנקודות אחוז. */
  readonly appliedRatePct: number;
  /** המס השנתי. */
  readonly annualTax: number;
  /** המס החודשי הממוצע. */
  readonly monthlyTax: number;
  /** שיעור המס האפקטיבי מתוך ההכנסה ברוטו, בנקודות אחוז. */
  readonly effectiveRatePct: number;
  /** הסבר הפירוק לשכבה 2 בממשק. */
  readonly explanation: string;
  /** false אם החישוב נשען על נתון רגולטורי שלא אומת. */
  readonly regulatoryVerified: boolean;
  /** הנתונים הרגולטוריים ששימשו, עם מקור ותאריך. */
  readonly sources: readonly SourcedValue<number>[];
}

const TRACK_LABELS: Readonly<Record<RentalTaxTrack, string>> = {
  exempt: 'מסלול הפטור',
  flat10: 'מסלול 10 אחוז',
  marginal: 'מסלול המס השולי',
};

/**
 * מסלול הפטור.
 *
 * הנוסחה: אם שכר הדירה החודשי אינו עולה על התקרה - פטור מלא.
 * אם הוא עולה עליה, ההפרש מעל התקרה מנוכה מהתקרה עצמה ומתקבלת "תקרה מתואמת".
 * החלק החייב הוא שכר הדירה פחות התקרה המתואמת, והוא ממוסה במס שולי.
 * כשההפרש מגיע לגובה התקרה (כלומר שכר דירה של פי 2 מהתקרה) הפטור מתאפס לגמרי.
 */
export function calcExemptTrack(input: RentalTaxInput): RentalTaxTrackResult {
  const ceiling = RENTAL_EXEMPTION_CEILING_MONTHLY.value;
  const rent = input.monthlyGrossRent;
  const annualGrossRent = roundAgorot(rent * 12);

  const excess = Math.max(0, rent - ceiling);
  const adjustedCeiling = Math.max(0, ceiling - excess);
  const monthlyTaxable = Math.max(0, rent - adjustedCeiling);
  const annualTaxableIncome = roundAgorot(monthlyTaxable * 12);
  const annualTax = roundAgorot((annualTaxableIncome * input.marginalTaxRatePct) / 100);

  const explanation =
    excess === 0
      ? `שכר הדירה (${roundAgorot(rent)} ש"ח) אינו עולה על תקרת הפטור (${ceiling} ש"ח) - אין מס.`
      : `שכר הדירה עולה על התקרה ב-${roundAgorot(excess)} ש"ח, ולכן התקרה מתואמת ל-${roundAgorot(
          adjustedCeiling,
        )} ש"ח. החלק החייב הוא ${roundAgorot(monthlyTaxable)} ש"ח לחודש, במס שולי של ${input.marginalTaxRatePct} אחוז.`;

  return {
    track: 'exempt',
    label: TRACK_LABELS.exempt,
    annualGrossRent,
    annualTaxableIncome,
    appliedRatePct: input.marginalTaxRatePct,
    annualTax,
    monthlyTax: roundAgorot(annualTax / 12),
    effectiveRatePct: annualGrossRent > 0 ? roundAgorot((annualTax / annualGrossRent) * 100) : 0,
    explanation,
    regulatoryVerified: RENTAL_EXEMPTION_CEILING_MONTHLY.verified,
    sources: [RENTAL_EXEMPTION_CEILING_MONTHLY],
  };
}

/** מסלול 10 אחוז על ההכנסה ברוטו, ללא ניכוי הוצאות. */
export function calcFlat10Track(input: RentalTaxInput): RentalTaxTrackResult {
  const ratePct = RENTAL_FLAT_RATE_PCT.value;
  const annualGrossRent = roundAgorot(input.monthlyGrossRent * 12);
  const annualTax = roundAgorot((annualGrossRent * ratePct) / 100);

  return {
    track: 'flat10',
    label: TRACK_LABELS.flat10,
    annualGrossRent,
    annualTaxableIncome: annualGrossRent,
    appliedRatePct: ratePct,
    annualTax,
    monthlyTax: roundAgorot(annualTax / 12),
    effectiveRatePct: annualGrossRent > 0 ? ratePct : 0,
    explanation: `${ratePct} אחוז על כל ההכנסה ברוטו (${annualGrossRent} ש"ח לשנה), ללא ניכוי הוצאות.`,
    regulatoryVerified: RENTAL_FLAT_RATE_PCT.verified,
    sources: [RENTAL_FLAT_RATE_PCT],
  };
}

/** מסלול המס השולי, עם ניכוי הוצאות מוכרות. */
export function calcMarginalTrack(input: RentalTaxInput): RentalTaxTrackResult {
  const annualGrossRent = roundAgorot(input.monthlyGrossRent * 12);
  const annualTaxableIncome = roundAgorot(Math.max(0, annualGrossRent - input.annualDeductibleExpenses));
  const annualTax = roundAgorot((annualTaxableIncome * input.marginalTaxRatePct) / 100);

  return {
    track: 'marginal',
    label: TRACK_LABELS.marginal,
    annualGrossRent,
    annualTaxableIncome,
    appliedRatePct: input.marginalTaxRatePct,
    annualTax,
    monthlyTax: roundAgorot(annualTax / 12),
    effectiveRatePct: annualGrossRent > 0 ? roundAgorot((annualTax / annualGrossRent) * 100) : 0,
    explanation: `הכנסה שנתית ${annualGrossRent} ש"ח פחות הוצאות מוכרות ${roundAgorot(
      input.annualDeductibleExpenses,
    )} ש"ח, כפול מס שולי של ${input.marginalTaxRatePct} אחוז.`,
    regulatoryVerified: true,
    sources: [],
  };
}

/** חישוב מסלול אחד לפי בחירת המשתמש. */
export function calcRentalTax(track: RentalTaxTrack, input: RentalTaxInput): RentalTaxTrackResult {
  assertNonNegative('income.monthlyRent', 'שכר הדירה החודשי', input.monthlyGrossRent);
  assertNonNegative('expenses.deductible', 'הוצאות מוכרות', input.annualDeductibleExpenses);
  assertPercent('tax.marginalTaxRatePct', 'שיעור המס השולי', input.marginalTaxRatePct);

  switch (track) {
    case 'exempt':
      return calcExemptTrack(input);
    case 'flat10':
      return calcFlat10Track(input);
    case 'marginal':
      return calcMarginalTrack(input);
  }
}

/** תוצאת ההשוואה בין שלושת המסלולים. */
export interface RentalTaxComparison {
  /** שלושת המסלולים, ממוינים מהמס הנמוך לגבוה. זו השוואה, לא המלצה. */
  readonly tracks: readonly RentalTaxTrackResult[];
  /** המסלול שהמשתמש בחר. */
  readonly selected: RentalTaxTrackResult;
  /**
   * ההפרש השנתי בשקלים בין המסלול שהמשתמש בחר לבין המסלול הזול ביותר בהשוואה.
   * 0 אם המשתמש כבר במסלול הזול. הממשק מציג את המספר, המשתמש מחליט.
   */
  readonly gapFromLowest: number;
  /** false אם לפחות מסלול אחד בהשוואה נשען על נתון רגולטורי שלא אומת. */
  readonly allRegulatoryVerified: boolean;
}

/**
 * חישוב שלושת המסלולים והחזרתם ממוינים לפי גובה המס.
 *
 * עיקרון 1: הפונקציה לא ממליצה ולא בוחרת. היא מחזירה מיון, והממשק מציג
 * "המס במסלול X נמוך ב-Y ש"ח בשנה" - עובדה, לא הנחיה.
 */
export function compareRentalTaxTracks(
  selectedTrack: RentalTaxTrack,
  input: RentalTaxInput,
): RentalTaxComparison {
  const all = [
    calcRentalTax('exempt', input),
    calcRentalTax('flat10', input),
    calcRentalTax('marginal', input),
  ];

  const sorted = [...all].sort((a, b) => a.annualTax - b.annualTax);
  const selected = all.find((entry) => entry.track === selectedTrack) ?? all[0];
  const lowest = sorted[0];

  // selected ו-lowest תמיד קיימים - המערך בנוי משלושה איברים קבועים.
  const selectedResult = selected as RentalTaxTrackResult;
  const lowestResult = lowest as RentalTaxTrackResult;

  return {
    tracks: sorted,
    selected: selectedResult,
    gapFromLowest: roundAgorot(selectedResult.annualTax - lowestResult.annualTax),
    allRegulatoryVerified: all.every((entry) => entry.regulatoryVerified),
  };
}
