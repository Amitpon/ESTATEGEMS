/**
 * מס שבח ורווח ממכירה.
 *
 * שתי אזהרות שחייבות להישאר בראש הקובץ:
 *
 * 1. **אף אחד ממספרי המס כאן לא אומת מול רשות המסים.** הם יושבים ב-tax-data.ts
 *    עם `verified: false`, והתוצאה מחזירה `allRegulatoryVerified` כדי שהממשק
 *    יציג אזהרה. אין להשתמש בכלי לדיווח מס.
 *
 * 2. **תקרת הפטור היא של 2024.** הוראת הביצוע מתעדכנת שנתית.
 *
 * עיקרון 1: הפונקציה לא מחליטה מתי כדאי למכור ולא ממליצה. היא מחזירה את
 * המספרים לכל נקודת זמן, והממשק מציג אותם.
 */

import type { SourcedValue } from '@/types/property';
import {
  SHEVACH_LINEAR_CUTOFF,
  SHEVACH_MIN_HOLDING_MONTHS,
  SHEVACH_SINGLE_APT_CEILING,
  SHEVACH_TAX_RATE_PCT,
} from './tax-data';
import { assertNonNegative, pctOf, roundAgorot, roundCoarse } from './money';
import { equityInvestedBy, type CapitalTimeline } from './capital-timeline';

/** שורה בפירוק ההוצאות המוכרות. */
export interface DeductibleLine {
  readonly key: string;
  readonly label: string;
  readonly amount: number;
}

/** הסיבה שבגללה הפטור לא הוחל. null כשהפטור כן הוחל. */
export type ExemptionDenialReason =
  /** המשתמש סימן שזו אינה דירתו היחידה. */
  | 'notSingleApartment'
  /** טרם חלפו 18 חודשי החזקה. */
  | 'holdingTooShort'
  /** מחיר המכירה גבוה מתקרת הפטור. */
  | 'aboveCeiling';

export interface CapitalGainsInput {
  /** מחיר הרכישה המקורי. */
  readonly purchasePrice: number;
  /** מחיר המכירה בנקודת הזמן הנבדקת. */
  readonly salePrice: number;
  /**
   * יום הרכישה לצורך מס - **יום חתימת החוזה**, לא טאבו ולא אכלוס.
   * ISO, YYYY-MM-DD.
   */
  readonly purchaseDate: string;
  /** יום המכירה הנבדק. ISO. */
  readonly saleDate: string;
  /**
   * יום האכלוס בפועל (טופס 4), לדירה שנרכשה על הנייר.
   * ממנו נספרים 18 חודשי ההחזקה לצורך הפטור. undefined בדירה מיד שנייה,
   * ואז הספירה מיום הרכישה.
   */
  readonly occupancyDate?: string;
  /** האם זו דירתו היחידה של המוכר. ברירת המחדל של המוצר היא true. */
  readonly isSingleApartment: boolean;
  /** הוצאות מוכרות לניכוי מהשבח. */
  readonly deductibles: readonly DeductibleLine[];
  /** עלויות המכירה עצמה - מתווך, עו"ד. מנוכות מהתמורה נטו. */
  readonly sellingCosts: readonly DeductibleLine[];
}

export interface CapitalGainsResult {
  /** השבח הגולמי - מחיר מכירה פחות מחיר רכישה. */
  readonly grossGain: number;
  /** סך ההוצאות המוכרות שנוכו. */
  readonly totalDeductibles: number;
  readonly deductibleLines: readonly DeductibleLine[];
  /** השבח אחרי ניכוי הוצאות. זהו הבסיס לחישוב. */
  readonly netGain: number;
  /** מספר חודשי ההחזקה לצורך בדיקת הפטור. */
  readonly holdingMonths: number;
  /** האם הפטור הוחל בפועל. */
  readonly exemptionApplied: boolean;
  /** הסיבה לאי-החלת הפטור. null כשהוא הוחל. */
  readonly exemptionDenialReason: ExemptionDenialReason | null;
  /** החלק מהשבח שפטור בזכות החישוב הלינארי (לפני 1.1.2014). */
  readonly linearExemptGain: number;
  /** החלק החייב במס. */
  readonly taxableGain: number;
  /** שיעור המס שהופעל, בנקודות אחוז. */
  readonly appliedRatePct: number;
  /** סכום המס. */
  readonly taxAmount: number;
  /** סך עלויות המכירה. */
  readonly totalSellingCosts: number;
  readonly sellingCostLines: readonly DeductibleLine[];
  /** הרווח הנקי בפועל - שבח גולמי פחות מס פחות עלויות מכירה. */
  readonly netProceeds: number;
  /** false אם כל נתון רגולטורי בחישוב לא אומת. תמיד false כרגע. */
  readonly allRegulatoryVerified: boolean;
  /** הנתונים הרגולטוריים ששימשו, לתצוגה בשכבה 3. */
  readonly sources: readonly SourcedValue<unknown>[];
}

/** מספר החודשים המלאים בין שני תאריכי ISO. */
function monthsBetweenDates(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  // חודש נספר רק אם עבר גם היום בחודש.
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

/**
 * היחס החייב במס לפי החישוב הלינארי.
 *
 * שבח שנצבר לפני 1.1.2014 פטור; מה שאחריו חייב. החלוקה היא לפי יחס הימים,
 * לא לפי יחס השווי - כך קובע סעיף 48א(ב2).
 *
 * מוחזר בטווח 0 עד 1.
 */
export function linearTaxableRatio(purchaseDate: string, saleDate: string): number {
  const purchase = new Date(purchaseDate).getTime();
  const sale = new Date(saleDate).getTime();
  const cutoff = new Date(SHEVACH_LINEAR_CUTOFF.value).getTime();

  const totalDays = sale - purchase;
  if (totalDays <= 0) return 0;

  // נרכש אחרי החיתוך - הכל חייב.
  if (purchase >= cutoff) return 1;
  // נמכר לפני החיתוך - הכל פטור.
  if (sale <= cutoff) return 0;

  return (sale - cutoff) / totalDays;
}

/**
 * חישוב מס שבח והרווח הנקי ממכירה בנקודת זמן אחת.
 *
 * @param input נתוני המכירה.
 */
export function calcCapitalGains(input: CapitalGainsInput): CapitalGainsResult {
  assertNonNegative('capitalGains.purchasePrice', 'מחיר הרכישה', input.purchasePrice);
  assertNonNegative('capitalGains.salePrice', 'מחיר המכירה', input.salePrice);

  const grossGain = roundAgorot(input.salePrice - input.purchasePrice);

  const deductibleLines = input.deductibles.filter((l) => l.amount > 0);
  const totalDeductibles = roundAgorot(
    deductibleLines.reduce((sum, l) => sum + l.amount, 0),
  );

  const sellingCostLines = input.sellingCosts.filter((l) => l.amount > 0);
  const totalSellingCosts = roundAgorot(
    sellingCostLines.reduce((sum, l) => sum + l.amount, 0),
  );

  // הפסד הון אינו מחויב במס. השבח לחישוב לא יורד מתחת לאפס.
  const netGain = Math.max(0, roundAgorot(grossGain - totalDeductibles));

  // 18 החודשים נספרים מהאכלוס בדירה על הנייר, ומהרכישה אחרת.
  const holdingStart = input.occupancyDate ?? input.purchaseDate;
  const holdingMonths = Math.max(0, monthsBetweenDates(holdingStart, input.saleDate));

  let exemptionDenialReason: ExemptionDenialReason | null = null;
  if (!input.isSingleApartment) {
    exemptionDenialReason = 'notSingleApartment';
  } else if (holdingMonths < SHEVACH_MIN_HOLDING_MONTHS.value) {
    exemptionDenialReason = 'holdingTooShort';
  } else if (input.salePrice > SHEVACH_SINGLE_APT_CEILING.value) {
    exemptionDenialReason = 'aboveCeiling';
  }
  const exemptionApplied = exemptionDenialReason === null;

  const ratio = linearTaxableRatio(input.purchaseDate, input.saleDate);
  const linearExemptGain = exemptionApplied ? netGain : roundAgorot(netGain * (1 - ratio));
  const taxableGain = exemptionApplied ? 0 : roundAgorot(netGain - linearExemptGain);

  const appliedRatePct = exemptionApplied ? 0 : SHEVACH_TAX_RATE_PCT.value;
  const taxAmount = roundAgorot(pctOf(taxableGain, appliedRatePct));

  const netProceeds = roundAgorot(grossGain - taxAmount - totalSellingCosts);

  const sources: SourcedValue<unknown>[] = [SHEVACH_TAX_RATE_PCT, SHEVACH_LINEAR_CUTOFF];
  if (input.isSingleApartment) {
    sources.push(SHEVACH_SINGLE_APT_CEILING, SHEVACH_MIN_HOLDING_MONTHS);
  }

  return {
    grossGain,
    totalDeductibles,
    deductibleLines,
    netGain,
    holdingMonths,
    exemptionApplied,
    exemptionDenialReason,
    linearExemptGain,
    taxableGain,
    appliedRatePct,
    taxAmount,
    totalSellingCosts,
    sellingCostLines,
    netProceeds,
    allRegulatoryVerified: sources.every((s) => s.verified),
    sources,
  };
}

/** שורה בטבלת "כמה נרוויח אם נמכור בכל שנה". */
export interface SaleAtYear {
  readonly year: number;
  /** תווית לשורה שאינה שנה עגולה, למשל "כניסת הפטור". */
  readonly label?: string;
  readonly saleDate: string;
  /** שווי הנכס לפי ההנחה של המשתמש. מעוגל גס - זו הנחה, לא ידיעה. */
  readonly propertyValue: number;
  readonly mortgageBalance: number;
  /** ההון בנכס - שווי פחות יתרה. */
  readonly equityInProperty: number;
  /** התזרים הנקי המצטבר עד אותה שנה. */
  readonly cumulativeNetCashflow: number;
  readonly capitalGains: CapitalGainsResult;
  /**
   * ההון העצמי שהושקע **עד אותה נקודת מכירה**. זהו המכנה של התשואה.
   * בעסקה מקבלן הוא גדל עם כל תשלום, ולכן שונה בין שנה לשנה.
   */
  readonly equityInvestedSoFar: number;
  /**
   * ההשלמות מהכיס - סך התזרים השלילי שנצבר עד אותה נקודה.
   * כשהמשכנתא גדולה מהשכירות, כל חודש מזרימים עוד כסף פנימה. זה הון
   * מושקע לכל דבר.
   */
  readonly cashContributions: number;
  /**
   * **סך ההון שהושקע עד אותה נקודה** - תשלומי ההון ועוד ההשלמות מהכיס.
   * זהו המכנה האמיתי של התשואה.
   */
  readonly totalInvestedSoFar: number;
  /**
   * הרווח הכולל - הרווח הנקי ממכירה בתוספת התזרים המצטבר,
   * בניכוי ההון שהושקע עד אותה נקודה.
   */
  readonly totalProfit: number;
  /**
   * התשואה הכוללת על ההון המושקע, בנקודות אחוז.
   */
  readonly totalReturnPct: number;
  /**
   * התשואה השנתית הממוצעת, בנקודות אחוז.
   *
   * **null כשתקופת ההחזקה קצרה מ-12 חודשים.** נרמול של תקופה קצרה מייצר
   * מספרים אבסורדיים - במוצר הקודם הוצג מינוס 70 אחוז אחרי 5 חודשים.
   * הממשק מציג מקף במקום.
   */
  readonly averageAnnualReturnPct: number | null;
  /**
   * true כשהמכירה נופלת לפני שהמשכנתא נלקחה - בדירה על הנייר, לפני
   * שהושקע מספיק הון. המספרים בשורה כזו אינם מכירת נכס אלא המחאת זכויות,
   * והממשק מסמן אותם ולא מציג אותם כרווח ממכירה.
   */
  readonly beforeMortgageStart: boolean;
}

export interface SaleScheduleInput {
  readonly purchasePrice: number;
  readonly purchaseDate: string;
  readonly occupancyDate?: string;
  readonly isSingleApartment: boolean;
  /**
   * ציר הזמן של ההון העצמי. המכנה של התשואה בכל נקודה הוא ההון שהושקע
   * **עד אותה נקודה**, ולא הסכום הסופי.
   */
  readonly capitalTimeline: CapitalTimeline;
  readonly deductibles: readonly DeductibleLine[];
  /** עלויות המכירה כאחוז ממחיר המכירה - נגזרות לכל שנה בנפרד. */
  readonly sellingCostPct: number;
  /**
   * התאריך שבו המשכנתא נלקחה. שורות לפניו מסומנות כלא-רלוונטיות.
   * ברכישה רגילה זהו יום העסקה.
   */
  readonly mortgageStartDate?: string;
  /** השנים מההרצה, עם השווי והיתרה בכל אחת. */
  readonly years: readonly {
    /** שנה שלמה, או שבר שנה עבור נקודת מפתח. */
    readonly year: number;
    readonly propertyValue: number;
    readonly mortgageBalance: number;
    readonly cumulativeNetCashflow: number;
    /**
     * תאריך מכירה מדויק, שגובר על החישוב מ-`year`.
     *
     * נחוץ לנקודות מפתח שאינן נופלות על שנה עגולה - בעיקר הרגע שבו
     * הפטור ממס שבח נכנס, 18 חודשים מהאכלוס. בלעדיו הטבלה מציגה את
     * שנה 2 (24 חודשים) ומחלקת את התשואה ב-2 במקום ב-1.5.
     */
    readonly saleDate?: string;
    /** תווית לתצוגה, כשהשורה אינה שנה עגולה. */
    readonly label?: string;
  }[];
}

/**
 * בונה את טבלת המכירה לכל שנה בהרצה.
 *
 * עיקרון 1: אלה הרצות של ההנחות שהמשתמש הזין, לא תחזית. הפונקציה לא
 * מסמנת שנה מועדפת ולא ממליצה מתי למכור.
 */
export function buildSaleSchedule(input: SaleScheduleInput): readonly SaleAtYear[] {
  const purchase = new Date(input.purchaseDate);

  return input.years.map((y) => {
    const saleDateFromYear = new Date(
      Date.UTC(purchase.getUTCFullYear() + y.year, purchase.getUTCMonth(), purchase.getUTCDate()),
    )
      .toISOString()
      .slice(0, 10);
    // תאריך מפורש גובר, כדי שנקודת מפתח תיפול על היום הנכון.
    const saleDate = y.saleDate ?? saleDateFromYear;

    const sellingCosts: DeductibleLine[] = [
      {
        key: 'sellingCosts',
        label: 'עלויות מכירה',
        amount: roundAgorot(pctOf(y.propertyValue, input.sellingCostPct)),
      },
    ];

    const capitalGains = calcCapitalGains({
      purchasePrice: input.purchasePrice,
      salePrice: y.propertyValue,
      purchaseDate: input.purchaseDate,
      saleDate,
      occupancyDate: input.occupancyDate,
      isSingleApartment: input.isSingleApartment,
      deductibles: input.deductibles,
      sellingCosts,
    });

    const equityInProperty = roundAgorot(y.propertyValue - y.mortgageBalance);

    // **המכנה הוא ההון שהושקע עד תאריך המכירה הזה**, לא הסכום הסופי.
    // בעסקה מקבלן זה גדל עם כל תשלום, ולכן מכירה מוקדמת נמדדת מול פחות הון.
    const equityInvestedSoFar = equityInvestedBy(input.capitalTimeline, saleDate);

    // הרווח הכולל: מה שנשאר ביד אחרי סילוק המשכנתא, המס ועלויות המכירה,
    // בתוספת התזרים שנצבר, פחות ההון שהושקע עד אותה נקודה.
    const cashAtExit = roundAgorot(
      y.propertyValue - y.mortgageBalance - capitalGains.taxAmount - capitalGains.totalSellingCosts,
    );
    const totalProfit = roundAgorot(
      cashAtExit + y.cumulativeNetCashflow - equityInvestedSoFar,
    );

    // תזרים שלילי הוא כסף שהוזרם פנימה, ולכן הוא הון מושקע.
    // תזרים חיובי הוא תשואה ולא השקעה, ולכן אינו מגדיל את המכנה.
    const cashContributions = roundAgorot(Math.max(0, -y.cumulativeNetCashflow));
    const totalInvestedSoFar = roundAgorot(equityInvestedSoFar + cashContributions);

    const totalReturnPct =
      totalInvestedSoFar > 0 ? (totalProfit / totalInvestedSoFar) * 100 : 0;

    // מתחת לשנה אין משמעות לנרמול שנתי.
    const averageAnnualReturnPct =
      capitalGains.holdingMonths >= 12 && totalInvestedSoFar > 0
        ? totalReturnPct / (capitalGains.holdingMonths / 12)
        : null;

    return {
      year: y.year,
      ...(y.label ? { label: y.label } : {}),
      saleDate,
      beforeMortgageStart: input.mortgageStartDate
        ? saleDate < input.mortgageStartDate
        : false,
      propertyValue: roundCoarse(y.propertyValue),
      mortgageBalance: y.mortgageBalance,
      equityInProperty,
      cumulativeNetCashflow: y.cumulativeNetCashflow,
      capitalGains,
      equityInvestedSoFar,
      cashContributions,
      totalInvestedSoFar,
      totalProfit,
      totalReturnPct,
      averageAnnualReturnPct,
    };
  });
}

/**
 * למה נבחרה נקודת היציאה שמוצגת בראש המסך.
 *
 * ההבחנה מגיעה מבעל המוצר: בדירה ראשונה יש רגע מוגדר שבו הפטור ממס שבח
 * נכנס, וזו הנקודה שמעניינת את המשקיע. בדירה שאינה ראשונה אין פטור,
 * ולכן אין תאריך מפתח - שם מוצגת פשוט הנקודה עם התשואה הגבוהה ביותר.
 */
export type ExitPointReason =
  | 'exemption' // הפטור ממס שבח נכנס לתוקף כאן
  | 'best-return' // אין פטור, זו התשואה הגבוהה ביותר
  | 'end-of-horizon'; // אין פטור ואין שיא ברור - סוף התקופה

export interface KeyExitPoint {
  readonly row: SaleAtYear;
  readonly reason: ExitPointReason;
}

/**
 * בוחר את נקודת היציאה שתוצג כמדד הראשי.
 *
 * בדירה ראשונה: השורה **הראשונה** שבה הפטור חל. זה הרגע שאחריו המכירה
 * פטורה ממס שבח, ולכן הוא נקודת ההשוואה הטבעית. אם הפטור לא חל באף שורה
 * (למשל מחיר מכירה מעל התקרה) - נופלים לשיא התשואה.
 *
 * בדירה שאינה ראשונה: אין פטור, ולכן נבחרת השורה עם התשואה השנתית
 * הממוצעת הגבוהה ביותר. שורות לפני תחילת המשכנתא אינן נספרות - מכירה
 * שם היא המחאת זכויות ולא מכירת נכס.
 */
export function findKeyExitPoint(
  rows: readonly SaleAtYear[],
): KeyExitPoint | null {
  const eligible = rows.filter((r) => !r.beforeMortgageStart);
  if (eligible.length === 0) return null;

  const firstExempt = eligible.find((r) => r.capitalGains.exemptionApplied);
  if (firstExempt) return { row: firstExempt, reason: 'exemption' };

  // בלי פטור, מה שמעניין הוא איפה התשואה הממוצעת לשנה הכי גבוהה.
  // שורות בלי תשואה שנתית (החזקה קצרה מ-12 חודשים) אינן מועמדות.
  const withReturn = eligible.filter((r) => r.averageAnnualReturnPct !== null);
  if (withReturn.length === 0) {
    const last = eligible[eligible.length - 1];
    return last ? { row: last, reason: 'end-of-horizon' } : null;
  }

  let best = withReturn[0]!;
  for (const r of withReturn) {
    if ((r.averageAnnualReturnPct ?? 0) > (best.averageAnnualReturnPct ?? 0)) {
      best = r;
    }
  }
  return { row: best, reason: 'best-return' };
}
