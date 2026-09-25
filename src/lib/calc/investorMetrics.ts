/**
 * 6 מדדי המשקיע המרכזיים.
 *
 * בעל המוצר ביקש שיוצגו למשקיע 6 מדדים ראשיים, בסדר קבוע (2026-09-21):
 * 1 הון עצמי ראשוני נדרש, 2 משכורת ברוטו נדרשת, 3 גודל המשכנתא הכולל,
 * 4 תזרים חודשי נטו לאחר אכלוס, 5 תשואה שנתית ממוצעת ל-10 שנים מול S&P 500,
 * 6 תשואה כוללת ל-10 שנים מול S&P 500.
 *
 * ארבעה מהם כבר קיימים במנוע ולא נגזרים כאן מחדש:
 * - הון עצמי: UpfrontEquityResult.total (metrics.ts)
 * - גודל המשכנתא: MortgageResult.loanAmount (mortgage.ts)
 * - תזרים חודשי נטו: CashflowResult.netCashflow.monthly (cashflow.ts)
 * - התשואות עצמן (שנתית ממוצעת וכוללת) כבר מחושבות לכל שנה בטבלת המכירה:
 *   SaleAtYear.averageAnnualReturnPct / totalReturnPct (capital-gains.ts)
 *
 * מה שהיה חסר ונוסף כאן:
 * - משכורת ברוטו נדרשת (יחס החזר להכנסה הפוך - תנאי סף בנקאי).
 * - השוואת שתי שורות התשואה מטבלת המכירה מול S&P 500 (benchmarks.ts).
 *
 * עיקרון 1 (docs/product-principles.md): השוואת S&P 500 היא נתון היסטורי,
 * לא תחזית. כל Metric שמציג אותה נושא ניסוח מפורש לכך.
 */

import { SP500_BENCHMARK } from '@/data/benchmarks';
import type { SaleAtYear } from './capital-gains';
import type { Metric } from './metrics';
import { assertPositive, roundAgorot } from './money';

/** פירוק חישוב המשכורת הברוטו הנדרשת. */
export interface RequiredGrossSalaryResult {
  readonly monthlyMortgagePayment: number;
  readonly maxPaymentToIncomeRatioPct: number;
  /** המשכורת הברוטו החודשית המינימלית הנדרשת לפי יחס ההחזר להכנסה. */
  readonly requiredGrossSalary: number;
  readonly formula: string;
}

/**
 * משכורת ברוטו נדרשת - מדד מספר 2. "יחס החזר להכנסה" הפוך: מתוך ההחזר
 * החודשי על המשכנתא, כמה צריך להרוויח ברוטו כדי לא לחרוג מהיחס המקסימלי
 * שהבנק מקובל עליו (תנאי סף, לא המלצה - עיקרון 3, שום הנחה נסתרת בקוד).
 *
 * אין משכנתא (ההחזר 0 או שלילי-לא-חוקי) -> אין תנאי סף -> משכורת נדרשת 0.
 */
export function calcRequiredGrossSalary(
  monthlyMortgagePayment: number,
  maxPaymentToIncomeRatioPct: number,
): RequiredGrossSalaryResult {
  assertPositive(
    'assumptions.maxPaymentToIncomeRatioPct',
    'יחס החזר להכנסה מקסימלי',
    maxPaymentToIncomeRatioPct,
  );

  const requiredGrossSalary =
    monthlyMortgagePayment <= 0
      ? 0
      : roundAgorot(monthlyMortgagePayment / (maxPaymentToIncomeRatioPct / 100));

  return {
    monthlyMortgagePayment: roundAgorot(monthlyMortgagePayment),
    maxPaymentToIncomeRatioPct,
    requiredGrossSalary,
    formula:
      'ההחזר החודשי על המשכנתא חלקי יחס ההחזר להכנסה המקסימלי, כדי לעמוד בתנאי הסף הבנקאי',
  };
}

/**
 * תשואת S&P 500 הכוללת לאורך N שנים, נגזרת מהתשואה השנתית הממוצעת ההיסטורית
 * של benchmarks.ts. חזקה מצטברת - לא תחזית, שחזור אריתמטי של הנתון ההיסטורי
 * על פני מספר שנים אחר מהעשור שממנו הוא נמדד.
 */
export function sp500TotalReturnPct(years: number): number {
  assertPositive('years', 'מספר השנים', years);
  return roundAgorot((Math.pow(1 + SP500_BENCHMARK.tenYearCAGR, years) - 1) * 100);
}

/** השוואת שורה אחת מטבלת המכירה מול S&P 500. */
export interface Sp500Comparison {
  readonly year: number;
  /** null כשתקופת ההחזקה בשורה קצרה משנה - ראה SaleAtYear.averageAnnualReturnPct. */
  readonly averageAnnualReturnPct: number | null;
  readonly totalReturnPct: number;
  readonly sp500AverageAnnualReturnPct: number;
  readonly sp500TotalReturnPct: number;
  /** ההפרש בנקודות אחוז. שלילי פירושו שה-S&P 500 ההיסטורי היה גבוה יותר. */
  readonly annualDeltaPoints: number | null;
  readonly totalDeltaPoints: number;
  /** הבהרה מילולית לממשק - הנתון היסטורי, לא תחזית (עיקרון 1). */
  readonly note: string;
}

/**
 * מוצא בטבלת המכירה את השורה שמתאימה לאופק ההרצה (בד"כ שנה 10),
 * ומשווה אותה מול S&P 500. מחזיר null אם אין שורה כזו.
 *
 * מסנן שורות עם label (כמו נקודת כניסת הפטור ממס שבח) - אלה שברי שנה
 * שהוזרקו לטבלה ולא שנים עגולות (ראה CLAUDE.md, "טבלת המכירה - שורות מפתח").
 */
export function compareToSp500(
  saleSchedule: readonly SaleAtYear[],
  horizonYears: number,
): Sp500Comparison | null {
  const row = saleSchedule.find((r) => r.year === horizonYears && !r.label);
  if (!row) return null;

  const sp500Total = sp500TotalReturnPct(horizonYears);
  const sp500Annual = roundAgorot(SP500_BENCHMARK.tenYearCAGR * 100);

  return {
    year: row.year,
    averageAnnualReturnPct: row.averageAnnualReturnPct,
    totalReturnPct: row.totalReturnPct,
    sp500AverageAnnualReturnPct: sp500Annual,
    sp500TotalReturnPct: sp500Total,
    annualDeltaPoints:
      row.averageAnnualReturnPct === null
        ? null
        : roundAgorot(row.averageAnnualReturnPct - sp500Annual),
    totalDeltaPoints: roundAgorot(row.totalReturnPct - sp500Total),
    note: `S&P 500, עשור ${SP500_BENCHMARK.tenYearPeriod.from} עד ${SP500_BENCHMARK.tenYearPeriod.to}: ${roundAgorot(
      SP500_BENCHMARK.tenYearCAGR * 100,
    )} אחוז שנתי (נתון היסטורי, לא תחזית).`,
  };
}

/** קלט לבניית 6 מדדי המשקיע המרכזיים. כל שדה נגזר ממקום אחד קיים במנוע. */
export interface InvestorHeadlineMetricsInput {
  /** UpfrontEquityResult.total. */
  readonly upfrontEquityTotal: number;
  /** MortgageResult.loanAmount. */
  readonly loanAmount: number;
  /** MortgageResult.firstMonthlyPayment / CashflowResult.mortgagePayment.monthly. */
  readonly monthlyMortgagePayment: number;
  /** CashflowResult.netCashflow.monthly. */
  readonly netMonthlyCashflow: number;
  readonly saleSchedule: readonly SaleAtYear[];
  /** Assumptions.horizonYears. */
  readonly horizonYears: number;
  /** ברירת מחדל DEFAULT_MAX_PAYMENT_TO_INCOME_RATIO_PCT מ-defaults.ts, ניתנת לעריכה. */
  readonly maxPaymentToIncomeRatioPct: number;
}

/** 6 מדדי המשקיע המרכזיים, בסדר שנקבע על ידי בעל המוצר. */
export interface InvestorHeadlineMetricsResult {
  readonly upfrontEquity: Metric;
  readonly requiredGrossSalary: Metric;
  readonly loanAmount: Metric;
  readonly netMonthlyCashflow: Metric;
  /** null כשאין שורה בטבלת המכירה לאופק המבוקש (לא אמור לקרות בהרצה תקינה). */
  readonly averageAnnualReturnVsSp500: Metric | null;
  readonly totalReturnVsSp500: Metric | null;
  /** ההשוואה המלאה, לשכבה 2/3 של הממשק. */
  readonly sp500Comparison: Sp500Comparison | null;
  readonly requiredGrossSalaryBreakdown: RequiredGrossSalaryResult;
  /** המדדים כמערך מסודר, בסדר הקבוע 1 עד 6. שני האחרונים מושמטים אם null. */
  readonly ordered: readonly Metric[];
}

/**
 * בונה את 6 מדדי המשקיע המרכזיים מתוך תוצאות שכבר חושבו במנוע.
 *
 * הפונקציה עצמה לא מחשבת מחדש שום דבר שכבר קיים (equity/loan/cashflow) -
 * היא רק עוטפת אותם כ-Metric ומוסיפה את שני החישובים החדשים
 * (משכורת נדרשת, השוואת S&P 500).
 */
export function buildInvestorHeadlineMetrics(
  input: InvestorHeadlineMetricsInput,
): InvestorHeadlineMetricsResult {
  const upfrontEquity: Metric = {
    key: 'headline:upfrontEquity',
    label: 'הון עצמי ראשוני נדרש',
    value: roundAgorot(input.upfrontEquityTotal),
    unit: 'ils',
    formula: 'סך ההון העצמי הנדרש ביום 1, כולל מס רכישה, עלויות נלוות ורזרבה נזילה',
  };

  const salary = calcRequiredGrossSalary(
    input.monthlyMortgagePayment,
    input.maxPaymentToIncomeRatioPct,
  );
  const requiredGrossSalary: Metric = {
    key: 'headline:requiredGrossSalary',
    label: 'משכורת ברוטו נדרשת',
    value: salary.requiredGrossSalary,
    unit: 'ils',
    formula: salary.formula,
  };

  const loanAmount: Metric = {
    key: 'headline:loanAmount',
    label: 'גודל המשכנתא הכולל',
    value: roundAgorot(input.loanAmount),
    unit: 'ils',
    formula: 'סכום ההלוואה שנגזר ממחיר הנכס פחות ההון העצמי',
  };

  const netMonthlyCashflow: Metric = {
    key: 'headline:netMonthlyCashflow',
    label: 'תזרים חודשי נטו לאחר אכלוס',
    value: roundAgorot(input.netMonthlyCashflow),
    unit: 'ils',
    formula: 'שכר דירה אפקטיבי פחות הוצאות תפעול פחות החזר משכנתא פחות מס שכר דירה',
  };

  const comparison = compareToSp500(input.saleSchedule, input.horizonYears);

  const averageAnnualReturnVsSp500: Metric | null =
    comparison && comparison.averageAnnualReturnPct !== null
      ? {
          key: 'headline:averageAnnualReturnVsSp500',
          label: `תשואה שנתית ממוצעת ל-${input.horizonYears} שנים`,
          value: comparison.averageAnnualReturnPct,
          unit: 'pct',
          formula: `הרווח הכולל בנקודת המכירה בשנה ${input.horizonYears}, מנורמל לשנה. ${comparison.note}`,
        }
      : null;

  const totalReturnVsSp500: Metric | null = comparison
    ? {
        key: 'headline:totalReturnVsSp500',
        label: `תשואה כוללת ל-${input.horizonYears} שנים`,
        value: comparison.totalReturnPct,
        unit: 'pct',
        formula: `הרווח הכולל חלקי ההון שהושקע, עד שנה ${input.horizonYears}. ${comparison.note}`,
      }
    : null;

  const ordered: Metric[] = [
    upfrontEquity,
    requiredGrossSalary,
    loanAmount,
    netMonthlyCashflow,
    ...(averageAnnualReturnVsSp500 ? [averageAnnualReturnVsSp500] : []),
    ...(totalReturnVsSp500 ? [totalReturnVsSp500] : []),
  ];

  return {
    upfrontEquity,
    requiredGrossSalary,
    loanAmount,
    netMonthlyCashflow,
    averageAnnualReturnVsSp500,
    totalReturnVsSp500,
    sp500Comparison: comparison,
    requiredGrossSalaryBreakdown: salary,
    ordered,
  };
}
