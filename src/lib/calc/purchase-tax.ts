/**
 * מס רכישה מדורג.
 *
 * המס מחושב לפי מדרגות שוליות: כל חלק מהשווי ממוסה בשיעור המדרגה שלו,
 * ולא כל השווי בשיעור המדרגה העליונה.
 *
 * הפונקציה מחזירה גם את הסכום וגם את הפירוק המלא למדרגות, כדי שהממשק
 * יוכל להציג את הפירוק בשכבה 2 (עיקרון 3).
 */

import type { SourcedValue } from '@/types/property';
import { PURCHASE_TAX_ADDITIONAL, PURCHASE_TAX_SINGLE, type TaxBracket } from './tax-data';
import { assertNonNegative, roundAgorot, sumAgorot } from './money';

/** שורה אחת בפירוק מס הרכישה. */
export interface PurchaseTaxBracketLine {
  /** גבול תחתון של המדרגה. */
  readonly from: number;
  /** גבול עליון של המדרגה, או null למדרגה העליונה. */
  readonly to: number | null;
  readonly ratePct: number;
  /** החלק מהשווי שנפל בתוך המדרגה. */
  readonly taxableAmount: number;
  /** המס על החלק הזה. */
  readonly tax: number;
}

/** תוצאת חישוב מס רכישה. */
export interface PurchaseTaxResult {
  /** סך המס בשקלים. */
  readonly total: number;
  /** הפירוק למדרגות, לשכבה 2 בממשק. */
  readonly breakdown: readonly PurchaseTaxBracketLine[];
  /** שיעור המס האפקטיבי על כלל השווי, בנקודות אחוז. */
  readonly effectiveRatePct: number;
  /** מערכת המדרגות ששימשה, כולל מקור ותאריך. */
  readonly brackets: SourcedValue<readonly TaxBracket[]>;
  /** true אם הערך הוזן ידנית על ידי המשתמש ולא חושב לפי מדרגות. */
  readonly isManualOverride: boolean;
}

/** מחזיר את מערכת המדרגות המתאימה. */
export function purchaseTaxBrackets(isSingleApartment: boolean): SourcedValue<readonly TaxBracket[]> {
  return isSingleApartment ? PURCHASE_TAX_SINGLE : PURCHASE_TAX_ADDITIONAL;
}

/**
 * חישוב מס רכישה מדורג.
 *
 * @param price מחיר הנכס בשקלים.
 * @param isSingleApartment האם זו דירה יחידה.
 * @param manualOverride סכום מס שהמשתמש הזין ידנית, אם הזין. דורס את החישוב.
 */
export function calcPurchaseTax(
  price: number,
  isSingleApartment: boolean,
  manualOverride?: number,
): PurchaseTaxResult {
  assertNonNegative('property.price', 'מחיר הנכס', price);

  const brackets = purchaseTaxBrackets(isSingleApartment);

  if (manualOverride !== undefined) {
    assertNonNegative('tax.purchaseTaxOverride', 'מס רכישה ידני', manualOverride);
    const total = roundAgorot(manualOverride);
    return {
      total,
      breakdown: [],
      effectiveRatePct: price > 0 ? roundAgorot((total / price) * 100) : 0,
      brackets,
      isManualOverride: true,
    };
  }

  const breakdown: PurchaseTaxBracketLine[] = [];
  let lowerBound = 0;

  for (const bracket of brackets.value) {
    if (price <= lowerBound) break;
    const upperBound = bracket.upTo === null ? price : Math.min(bracket.upTo, price);
    const taxableAmount = roundAgorot(upperBound - lowerBound);
    if (taxableAmount > 0) {
      breakdown.push({
        from: lowerBound,
        to: bracket.upTo,
        ratePct: bracket.ratePct,
        taxableAmount,
        tax: roundAgorot((taxableAmount * bracket.ratePct) / 100),
      });
    }
    lowerBound = upperBound;
  }

  const total = sumAgorot(breakdown.map((line) => line.tax));

  return {
    total,
    breakdown,
    effectiveRatePct: price > 0 ? roundAgorot((total / price) * 100) : 0,
    brackets,
    isManualOverride: false,
  };
}
