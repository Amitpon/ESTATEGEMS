/**
 * ציר הזמן של ההון העצמי.
 *
 * **למה זה קיים:** התשואה בנקודת מכירה כלשהי חייבת להימדד מול ההון שהושקע
 * **עד אותו רגע**, לא מול ההון הסופי. אם שילמת 500,000 בחתימה ועוד 200,000
 * באכלוס, אז מכירה לפני האכלוס נמדדת מול 500,000 ולא מול 700,000.
 *
 * בלי זה התשואה בשנים המוקדמות יוצאת נמוכה מדי - בדיוק ההפך מהאבחנה הנכונה
 * של בעל המוצר, שהמינוף חזק יותר דווקא בהתחלה.
 *
 * פונקציות טהורות. תאריכים מגיעים כפרמטר.
 */

import type { FundingSource, IsoDate } from '@/types/property';
import { roundAgorot } from './money';

export type { FundingSource };

/** תשלום יחיד על ציר הזמן. */
export interface CapitalOutflow {
  readonly key: string;
  readonly label: string;
  readonly amount: number;
  readonly date: IsoDate;
  /**
   * 'equity' יוצא מהכיס ונכנס למכנה של התשואה.
   * 'mortgage' ממומן בהלוואה ולכן אינו הון עצמי.
   */
  readonly source: FundingSource;
}

/** ציר הזמן המלא, ממוין לפי תאריך. */
export interface CapitalTimeline {
  readonly outflows: readonly CapitalOutflow[];
  /** סך ההון העצמי לאורך כל התקופה. */
  readonly totalEquity: number;
  /** סך המימון מהמשכנתא. */
  readonly totalMortgage: number;
}

/**
 * בונה את ציר הזמן וממיין אותו.
 * תשלומים באותו תאריך נשארים בסדר שבו נמסרו.
 */
export function buildCapitalTimeline(
  outflows: readonly CapitalOutflow[],
): CapitalTimeline {
  const sorted = [...outflows].sort((a, b) => a.date.localeCompare(b.date));

  let totalEquity = 0;
  let totalMortgage = 0;
  for (const o of sorted) {
    if (o.source === 'equity') totalEquity = roundAgorot(totalEquity + o.amount);
    else totalMortgage = roundAgorot(totalMortgage + o.amount);
  }

  return { outflows: sorted, totalEquity, totalMortgage };
}

/**
 * ההון העצמי שהושקע עד תאריך נתון, כולל אותו יום.
 *
 * זהו המכנה הנכון לחישוב תשואה בנקודת מכירה.
 */
export function equityInvestedBy(timeline: CapitalTimeline, date: IsoDate): number {
  let sum = 0;
  for (const o of timeline.outflows) {
    if (o.source !== 'equity') continue;
    if (o.date > date) break;
    sum = roundAgorot(sum + o.amount);
  }
  return sum;
}

/** כמה מהמשכנתא כבר נמשך עד תאריך נתון. */
export function mortgageDrawnBy(timeline: CapitalTimeline, date: IsoDate): number {
  let sum = 0;
  for (const o of timeline.outflows) {
    if (o.source !== 'mortgage') continue;
    if (o.date > date) break;
    sum = roundAgorot(sum + o.amount);
  }
  return sum;
}

/**
 * ציר זמן לעסקה רגילה, שאינה מקבלן - הכל משולם ביום אחד.
 *
 * @param date יום העסקה.
 * @param downPayment ההון העצמי.
 * @param loanAmount סכום ההלוואה.
 * @param costs עלויות נלוות, כולן מההון העצמי.
 */
export function singleDateTimeline(
  date: IsoDate,
  downPayment: number,
  loanAmount: number,
  costs: readonly { readonly key: string; readonly label: string; readonly amount: number }[],
): CapitalTimeline {
  const outflows: CapitalOutflow[] = [
    { key: 'downPayment', label: 'הון עצמי (מקדמה)', amount: downPayment, date, source: 'equity' },
  ];
  if (loanAmount > 0) {
    outflows.push({
      key: 'mortgage',
      label: 'משכנתא',
      amount: loanAmount,
      date,
      source: 'mortgage',
    });
  }
  for (const c of costs) {
    if (c.amount > 0) {
      outflows.push({ ...c, date, source: 'equity' });
    }
  }
  return buildCapitalTimeline(outflows);
}
