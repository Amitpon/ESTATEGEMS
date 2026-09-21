/**
 * מדדי ההשקעה.
 *
 * סדר המדדים לפי הנספח "מדדים לפי חשיבות" ב-docs/research/market-research.md:
 * 1 תזרים נקי, 2 הון עצמי נדרש ביום 1, 3 תשואה ברוטו, 4 Cash-on-Cash,
 * 5 מס רכישה, 6 נקודת איזון, 7 NOI, 8 Cap Rate.
 *
 * כל מדד מחזיר גם את רכיביו, לשכבה 2 בממשק.
 */

import type { AcquisitionCostsInput } from '@/types/property';
import { assertPositive, roundAgorot } from './money';
import type { CashflowResult, CashflowInput } from './cashflow';
import { calcCashflow } from './cashflow';

/** שורה אחת בפירוק ההון העצמי הנדרש ביום 1. */
export interface EquityLine {
  readonly key: string;
  readonly label: string;
  readonly amount: number;
}

/**
 * הון עצמי נדרש ביום 1 - מדד מספר 2 בחשיבות.
 * פער 4 במחקר השוק: "אף כלי לא מחשב זאת".
 */
export interface UpfrontEquityResult {
  /** הפירוק המלא. */
  readonly lines: readonly EquityLine[];
  /** סך הכסף הנזיל שצריך ביום 1, כולל הרזרבה. */
  readonly total: number;
  /**
   * ההון המושקע בנכס - סך הכל בניכוי הרזרבה הנזילה.
   * זהו המכנה של Cash-on-Cash: הרזרבה לא הושקעה, היא רק מוחזקת בצד.
   */
  readonly investedCapital: number;
}

/** קלט לחישוב ההון העצמי הנדרש. */
export interface UpfrontEquityInput {
  /** ההון העצמי - מחיר הנכס פחות סכום ההלוואה. */
  readonly downPayment: number;
  /** מס הרכישה. */
  readonly purchaseTax: number;
  readonly costs: AcquisitionCostsInput;
  /** שטח הנכס במ"ר, להכפלת עלות הגמר למ"ר. */
  readonly sizeSqm: number;
}

/** חישוב ההון העצמי הנדרש ביום 1, עם פירוק. */
export function calcUpfrontEquity(input: UpfrontEquityInput): UpfrontEquityResult {
  const finishing = roundAgorot(input.costs.finishingCostPerSqm * input.sizeSqm);

  const lines: EquityLine[] = [
    { key: 'downPayment', label: 'הון עצמי (מקדמה)', amount: roundAgorot(input.downPayment) },
    { key: 'purchaseTax', label: 'מס רכישה', amount: roundAgorot(input.purchaseTax) },
    { key: 'lawyerFee', label: 'שכר טרחת עורך דין', amount: roundAgorot(input.costs.lawyerFee) },
    { key: 'brokerFee', label: 'דמי תיווך', amount: roundAgorot(input.costs.brokerFee) },
    { key: 'mortgageAdvisorFee', label: 'יועץ משכנתאות', amount: roundAgorot(input.costs.mortgageAdvisorFee) },
    { key: 'finishing', label: 'עלויות גמר', amount: finishing },
  ];

  input.costs.custom.forEach((entry, index) => {
    lines.push({ key: `custom:${index}`, label: entry.label, amount: roundAgorot(entry.amount) });
  });

  const reserve = roundAgorot(input.costs.liquidityReserve);

  let investedCapital = 0;
  for (const line of lines) {
    investedCapital = roundAgorot(investedCapital + line.amount);
  }

  lines.push({ key: 'liquidityReserve', label: 'רזרבה נזילה', amount: reserve });

  return { lines, total: roundAgorot(investedCapital + reserve), investedCapital };
}

/** מדד אחד, עם ערכו ורכיבי החישוב שלו. */
export interface Metric {
  readonly key: string;
  readonly label: string;
  /** הערך המספרי. */
  readonly value: number;
  /** יחידת המדידה. */
  readonly unit: 'ils' | 'pct';
  /** הנוסחה במילים, לשכבה 3 בממשק. */
  readonly formula: string;
}

/** כל המדדים. */
export interface MetricsResult {
  readonly netMonthlyCashflow: Metric;
  readonly netAnnualCashflow: Metric;
  readonly upfrontEquity: Metric;
  readonly grossYieldPct: Metric;
  readonly cashOnCashPct: Metric;
  readonly noi: Metric;
  readonly capRatePct: Metric;
  readonly breakEvenRent: Metric;
  /**
   * כמה מההחזר החודשי השכירות מכסה, באחוזים.
   * מעל 100 פירושו שהשכירות מכסה את ההחזר ונשאר עודף.
   */
  readonly mortgageCoveragePct: Metric;
  /** כל המדדים כמערך מסודר לפי עדיפות, לנוחות הממשק. */
  readonly ordered: readonly Metric[];
}

/** קלט לחישוב המדדים. */
export interface MetricsInput {
  readonly price: number;
  readonly cashflow: CashflowResult;
  readonly equity: UpfrontEquityResult;
  /** שכר הדירה שבו התזרים מתאפס, מחושב בנפרד. */
  readonly breakEvenRent: number;
}

/** חישוב סט המדדים המלא. */
export function calcMetrics(input: MetricsInput): MetricsResult {
  assertPositive('property.price', 'מחיר הנכס', input.price);

  const cf = input.cashflow;

  // NOI - הכנסה תפעולית נטו, לפני מימון ולפני מס. מדד 7.
  const noiValue = roundAgorot(cf.effectiveRent.annual - cf.operatingExpenses.annualTotal);

  const netMonthlyCashflow: Metric = {
    key: 'netMonthlyCashflow',
    label: 'תזרים חודשי נקי',
    value: cf.netCashflow.monthly,
    unit: 'ils',
    formula: 'שכר דירה פחות אי-אכלוס פחות הוצאות תפעול פחות החזר משכנתא פחות מס שכר דירה',
  };

  const netAnnualCashflow: Metric = {
    key: 'netAnnualCashflow',
    label: 'תזרים שנתי נקי',
    value: cf.netCashflow.annual,
    unit: 'ils',
    formula: 'התזרים החודשי הנקי כפול 12',
  };

  const upfrontEquity: Metric = {
    key: 'upfrontEquity',
    label: 'הון עצמי נדרש ביום 1',
    value: input.equity.total,
    unit: 'ils',
    formula: 'מקדמה ועוד מס רכישה ועוד עורך דין ועוד תיווך ועוד עלויות גמר ועוד רזרבה נזילה',
  };

  const grossYieldPct: Metric = {
    key: 'grossYieldPct',
    label: 'תשואה ברוטו שנתית',
    value: roundAgorot((cf.grossRent.annual / input.price) * 100),
    unit: 'pct',
    formula: 'שכר דירה שנתי ברוטו חלקי מחיר הנכס',
  };

  const cashOnCashPct: Metric = {
    key: 'cashOnCashPct',
    label: 'תשואה על ההון העצמי',
    value:
      input.equity.investedCapital > 0
        ? roundAgorot((cf.netCashflow.annual / input.equity.investedCapital) * 100)
        : 0,
    unit: 'pct',
    formula: 'תזרים שנתי נקי חלקי ההון שהושקע בפועל (ללא הרזרבה הנזילה)',
  };

  const noi: Metric = {
    key: 'noi',
    label: 'NOI - הכנסה תפעולית נטו',
    value: noiValue,
    unit: 'ils',
    formula: 'שכר דירה אפקטיבי שנתי פחות הוצאות תפעול שנתיות, לפני מימון ולפני מס',
  };

  const capRatePct: Metric = {
    key: 'capRatePct',
    label: 'Cap Rate',
    value: roundAgorot((noiValue / input.price) * 100),
    unit: 'pct',
    formula: 'NOI חלקי מחיר הנכס',
  };

  const breakEvenRent: Metric = {
    key: 'breakEvenRent',
    label: 'נקודת איזון - שכר דירה',
    value: roundAgorot(input.breakEvenRent),
    unit: 'ils',
    formula: 'שכר הדירה החודשי שבו התזרים הנקי מתאפס, בהתחשב באי-אכלוס, בהוצאות ובמס',
  };

  // "כמה מההחזר השכירות מחזירה לי" - בקשת בעל המוצר, 2026-09-21.
  // מושווה לשכר הדירה האפקטיבי (אחרי אי-אכלוס), לא לברוטו, אחרת המספר
  // מנפח את המציאות. בלי משכנתא אין מה לכסות, ולכן null מיוצג כאן כ-0
  // והממשק מסתיר את המדד.
  const monthlyMortgage = cf.mortgagePayment.monthly;
  const mortgageCoveragePct: Metric = {
    key: 'mortgageCoveragePct',
    label: 'כיסוי ההחזר מהשכירות',
    value:
      monthlyMortgage > 0
        ? roundAgorot((cf.effectiveRent.monthly / monthlyMortgage) * 100)
        : 0,
    unit: 'pct',
    formula:
      'שכר דירה אפקטיבי חודשי (אחרי אי-אכלוס) חלקי ההחזר החודשי. מעל 100 אחוז השכירות מכסה את ההחזר',
  };

  return {
    netMonthlyCashflow,
    netAnnualCashflow,
    upfrontEquity,
    grossYieldPct,
    cashOnCashPct,
    noi,
    capRatePct,
    breakEvenRent,
    mortgageCoveragePct,
    ordered: [
      netMonthlyCashflow,
      mortgageCoveragePct,
      upfrontEquity,
      grossYieldPct,
      cashOnCashPct,
      breakEvenRent,
      noi,
      capRatePct,
      netAnnualCashflow,
    ],
  };
}

/**
 * נקודת איזון - שכר הדירה החודשי שבו התזרים הנקי מתאפס.
 *
 * הפתרון נומרי (חצייה) ולא אנליטי, כי שכר הדירה משפיע גם על ההוצאות
 * שהוגדרו כאחוז משכר הדירה וגם על המס - ומס שכר הדירה אינו ליניארי
 * (מסלול הפטור מדורג). חצייה נותנת תשובה נכונה לכל שילוב של הגדרות.
 *
 * @param baseInput קלט התזרים הנוכחי. שדה monthlyGrossRent שלו מוחלף בכל איטרציה.
 * @param recomputeTax פונקציה שמחשבת את המס השנתי מחדש לשכר דירה חודשי נתון.
 * @param toleranceIls דיוק התשובה בשקלים.
 */
export function solveBreakEvenRent(
  baseInput: CashflowInput,
  recomputeTax: (monthlyGrossRent: number) => number,
  toleranceIls = 0.01,
): number {
  const netAt = (rent: number): number =>
    calcCashflow({ ...baseInput, monthlyGrossRent: rent, annualRentalTax: recomputeTax(rent) })
      .netCashflow.monthly;

  let low = 0;
  // חיפוש גבול עליון: מכפילים עד שהתזרים חיובי, עד גבול ביטחון.
  let high = Math.max(1000, baseInput.monthlyGrossRent * 2);
  let guard = 0;
  while (netAt(high) < 0 && guard < 40) {
    high *= 2;
    guard += 1;
  }

  if (netAt(high) < 0) {
    // גם בשכר דירה גבוה מאוד התזרים שלילי - ההוצאות שהוגדרו כאחוז משכר הדירה
    // גדולות מ-100 אחוז ממנו, ואין נקודת איזון.
    return Number.POSITIVE_INFINITY;
  }
  if (netAt(low) >= 0) return 0;

  while (high - low > toleranceIls) {
    const mid = (low + high) / 2;
    if (netAt(mid) < 0) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return roundAgorot((low + high) / 2);
}
