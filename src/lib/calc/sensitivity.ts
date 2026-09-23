/**
 * רגישות התזרים לשינוי בריבית המשכנתא.
 *
 * ## למה זה קיים
 *
 * המשתמש מזין ריבית נקודתית, אבל ריביות זזות. השאלה שמעניינת אותו היא
 * לא "מה התזרים בריבית הנוכחית" (זה כבר מוצג בראש המסך) אלא **"מה קורה
 * אם הריבית עולה ב-1.5%"** - זו נקודת הכשל של הרבה עסקאות ממונפות.
 *
 * פונקציה טהורה: מריצה מחדש את `analyze()` עם ריבית מוזזת בכל שלוחת
 * מימון (`tracks[]`), ומחזירה את התזרים והכיסוי בכל תרחיש. אין fetch,
 * אין React, אין `Date.now()` - הכל נגזר מה-input שהתקבל.
 */

import type { Assumptions, PropertyInput } from '@/types/property';
import { analyze } from './index';

/** נקודות אחוז שנבדקות סביב הריבית שהמשתמש הזין. */
export const DEFAULT_RATE_DELTAS: readonly number[] = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];

/** מינימום ריבית שנבדק - ריבית שלילית חסרת משמעות במשכנתא ישראלית. */
const MIN_TESTABLE_RATE_PCT = 0.1;

export interface SensitivityRow {
  /** נקודות האחוז שהוזזו מהריבית שהוזנה. 0 הוא השורה שכבר מוצגת בראש המסך. */
  readonly deltaPct: number;
  /** הריבית בפועל שנבדקה בשורה הזו, אחרי הזזה וחיתוך לגבול המינימום. */
  readonly ratePct: number;
  readonly monthlyCashflow: number;
  /** אחוז מההחזר שהשכירות מכסה. 0 אם אין משכנתא בכלל. */
  readonly coveragePct: number;
}

/**
 * מזיז את הריבית בכל שלוחות המימון באותה כמות נקודות אחוז.
 * שומר על יחס הריביות בין שלוחות אם יש כמה מסלולים.
 */
function shiftRate(input: PropertyInput, deltaPct: number): PropertyInput {
  return {
    ...input,
    financing: {
      ...input.financing,
      tracks: input.financing.tracks.map((t) => ({
        ...t,
        annualRatePct: Math.max(MIN_TESTABLE_RATE_PCT, t.annualRatePct + deltaPct),
      })),
    },
  };
}

/**
 * מריץ את המנוע פעם לכל דלתא ומחזיר טבלת רגישות.
 *
 * אם אין משכנתא בכלל (`tracks` ריק) - ריבית לא רלוונטית, ומוחזר מערך
 * ריק. הממשק צריך לבדוק זאת ולא להציג את הסקשן.
 */
export function calcRateSensitivity(
  input: PropertyInput,
  assumptions: Assumptions,
  deltas: readonly number[] = DEFAULT_RATE_DELTAS,
): readonly SensitivityRow[] {
  if (input.financing.tracks.length === 0) return [];

  return deltas.map((deltaPct) => {
    const shifted = shiftRate(input, deltaPct);
    const result = analyze(shifted, assumptions);
    // הריבית בפועל שנבדקה - אחרי החיתוך לגבול המינימום, לתצוגה נכונה.
    const actualRate = shifted.financing.tracks[0]?.annualRatePct ?? 0;
    return {
      deltaPct,
      ratePct: Math.round(actualRate * 100) / 100,
      monthlyCashflow: result.metrics.netMonthlyCashflow.value,
      coveragePct: result.metrics.mortgageCoveragePct.value,
    };
  });
}
