/**
 * מנוע החישוב - נקודת הכניסה היחידה.
 *
 * analyze() מקבל את הקלט המלא ומחזיר את כל התוצאות עם הפירוקים,
 * כדי שהממשק יוכל לממש את שלוש שכבות העומק (docs/product-principles.md עיקרון 3)
 * בלי לחשב שום דבר בעצמו.
 */

import type { Assumptions, PropertyInput } from '@/types/property';
import { buildSaleSchedule, type DeductibleLine, type SaleAtYear } from './capital-gains';
import { buildCapitalTimeline, singleDateTimeline, type CapitalTimeline } from './capital-timeline';
import { calcCashflow, type CashflowInput, type CashflowResult } from './cashflow';
import { calcMetrics, calcUpfrontEquity, solveBreakEvenRent, type MetricsResult, type UpfrontEquityResult } from './metrics';
import { buildMortgage, type MortgageResult } from './mortgage';
import { CalcInputError } from './money';
import { calcPaymentSchedule, type PaymentScheduleResult } from './payment-schedule';
import { runScenarios, yearEndBalances, type ScenarioRun } from './projection';
import { calcPurchaseTax, type PurchaseTaxResult } from './purchase-tax';
import { compareRentalTaxTracks, type RentalTaxComparison } from './rental-tax';

export * from './capital-gains';
export * from './capital-timeline';
export * from './cashflow';
export * from './defaults';
export * from './metrics';
export * from './money';
export * from './mortgage';
export * from './payment-schedule';
export * from './projection';
export * from './purchase-tax';
export * from './rental-tax';
export * from './tax-data';

/** תוצאת הניתוח המלאה. */
export interface AnalysisResult {
  /** ההון העצמי שנגזר מהקלט - סכום או אחוז מימון. */
  readonly downPayment: number;
  /** סכום ההלוואה. */
  readonly loanAmount: number;
  /** שיעור המימון בפועל, בנקודות אחוז. */
  readonly ltvPct: number;
  readonly purchaseTax: PurchaseTaxResult;
  readonly mortgage: MortgageResult;
  readonly rentalTax: RentalTaxComparison;
  readonly cashflow: CashflowResult;
  readonly equity: UpfrontEquityResult;
  readonly metrics: MetricsResult;
  readonly scenarios: ScenarioRun;
  /** קיים רק ברכישה מקבלן. */
  readonly paymentSchedule?: PaymentScheduleResult;
  /**
   * כמה נרוויח אם נמכור בכל שנה. שורה לכל שנה בהרצה.
   * עיקרון 1 - אלה הרצות של ההנחות, והכלי לא מסמן שנה מועדפת.
   */
  readonly saleSchedule: readonly SaleAtYear[];
  /** ציר הזמן של ההון העצמי - מתי כל שקל יצא מהכיס. */
  readonly capitalTimeline: CapitalTimeline;
}

/**
 * גוזר את ההון העצמי ואת סכום ההלוואה מהקלט.
 * בדיוק אחד משני השדות downPayment / ltvPct חייב להיות מוגדר.
 */
function resolveFinancing(price: number, financing: PropertyInput['financing']) {
  const hasAmount = financing.downPayment !== undefined;
  const hasLtv = financing.ltvPct !== undefined;

  if (hasAmount === hasLtv) {
    throw new CalcInputError(
      'financing',
      'יש להגדיר בדיוק אחד מהשניים - סכום ההון העצמי או אחוז המימון, לא את שניהם ולא אף אחד.',
    );
  }

  const downPayment = hasAmount
    ? financing.downPayment!
    : price * (1 - financing.ltvPct! / 100);

  if (downPayment < 0 || downPayment > price) {
    throw new CalcInputError(
      'financing.downPayment',
      'ההון העצמי חייב להיות בין 0 למחיר הנכס.',
    );
  }

  const loanAmount = price - downPayment;
  const ltvPct = price > 0 ? (loanAmount / price) * 100 : 0;

  return { downPayment, loanAmount, ltvPct };
}

/**
 * ניתוח מלא של נכס.
 *
 * @param input הקלט של המשתמש.
 * @param assumptions ההנחות שלו להרצה קדימה. עיקרון 1 - אלה הנחות, לא תחזית.
 */
export function analyze(input: PropertyInput, assumptions: Assumptions): AnalysisResult {
  const { price, sizeSqm } = input.property;

  const { downPayment, loanAmount, ltvPct } = resolveFinancing(price, input.financing);

  const purchaseTax = calcPurchaseTax(
    price,
    input.tax.isSingleApartment,
    input.tax.purchaseTaxOverride,
  );

  const mortgage = buildMortgage(input.financing.tracks, loanAmount);

  const equity = calcUpfrontEquity({
    downPayment,
    purchaseTax: purchaseTax.total,
    costs: input.acquisitionCosts,
    sizeSqm,
  });

  // הוצאות מוכרות לניכוי במסלול המדרגות - הוצאות התפעול בלבד.
  // מחושב פעם אחת עם תזרים "יבש" כדי לקבל את סך ההוצאות.
  const dryCashflow = calcCashflow({
    monthlyGrossRent: input.income.monthlyRent,
    vacancyPct: input.income.vacancyPct,
    expenses: input.expenses,
    price,
    monthlyMortgagePayment: 0,
    annualRentalTax: 0,
  });

  const taxInputFor = (monthlyGrossRent: number) => ({
    monthlyGrossRent: monthlyGrossRent * (1 - input.income.vacancyPct / 100),
    annualDeductibleExpenses: dryCashflow.operatingExpenses.annualTotal,
    marginalTaxRatePct: input.tax.marginalTaxRatePct,
  });

  const rentalTax = compareRentalTaxTracks(
    input.tax.rentalTaxTrack,
    taxInputFor(input.income.monthlyRent),
  );

  const cashflowInput: CashflowInput = {
    monthlyGrossRent: input.income.monthlyRent,
    vacancyPct: input.income.vacancyPct,
    expenses: input.expenses,
    price,
    monthlyMortgagePayment: mortgage.firstMonthlyPayment,
    annualRentalTax: rentalTax.selected.annualTax,
  };

  const cashflow = calcCashflow(cashflowInput);

  // נקודת האיזון: המס מחושב מחדש בכל איטרציה, אחרת התוצאה מוטה.
  const breakEvenRent = solveBreakEvenRent(cashflowInput, (rent) =>
    compareRentalTaxTracks(input.tax.rentalTaxTrack, taxInputFor(rent)).selected.annualTax,
  );

  const metrics = calcMetrics({ price, cashflow, equity, breakEvenRent });

  const scenarios = runScenarios(
    {
      price,
      monthlyRent: input.income.monthlyRent,
      annualNetCashflow: cashflow.netCashflow.annual,
      annualExpenses: cashflow.operatingExpenses.annualTotal,
      mortgageBalanceByYear: yearEndBalances(
        mortgage.combinedRows.map((row) => row.balance),
        assumptions.horizonYears,
      ),
    },
    assumptions,
  );

  const paymentSchedule = input.paymentSchedule
    ? calcPaymentSchedule(price, input.paymentSchedule)
    : undefined;

  // ההוצאות המוכרות לניכוי מהשבח מגיעות מעלויות הרכישה שכבר חושבו.
  // מה מוכר בפועל תלוי ברשות המסים ולא אומת - ראה capital-gains.ts.
  const shevachDeductibles: DeductibleLine[] = [
    { key: 'purchaseTax', label: 'מס רכישה', amount: purchaseTax.total },
    ...equity.lines
      .filter((l) => l.key === 'lawyerFee' || l.key === 'brokerFee')
      .map((l) => ({ key: l.key, label: l.label, amount: l.amount })),
  ];

  // ציר הזמן של ההון העצמי. בעסקה רגילה הכל ביום אחד; בעסקה מקבלן
  // לוח התשלומים פורס אותו, וכל שלב נושא את מקור המימון שלו.
  const capitalTimeline: CapitalTimeline = paymentSchedule
    ? buildCapitalTimeline([
        ...paymentSchedule.stages.map((st) => ({
          key: st.id,
          label: st.label,
          amount: st.payableAmount,
          date: st.dueDate,
          source: st.fundingSource,
        })),
        ...equity.lines
          .filter((l) => l.key !== 'downPayment' && l.key !== 'liquidityReserve')
          .map((l) => ({
            key: l.key,
            label: l.label,
            // עלות שלא שויכה לשלב משולמת בשלב הראשון.
            amount: l.amount,
            date:
              input.acquisitionCosts.stageDates?.[l.key] ??
              paymentSchedule.stages[0]?.dueDate ??
              input.analysisDate,
            source: 'equity' as const,
          })),
      ])
    : singleDateTimeline(
        input.analysisDate,
        downPayment,
        loanAmount,
        equity.lines.filter(
          (l) => l.key !== 'downPayment' && l.key !== 'liquidityReserve',
        ),
      );

  const saleSchedule = buildSaleSchedule({
    purchasePrice: price,
    purchaseDate: input.analysisDate,
    ...(input.paymentSchedule?.occupancyDate
      ? { occupancyDate: input.paymentSchedule.occupancyDate }
      : {}),
    isSingleApartment: input.tax.isSingleApartment,
    capitalTimeline,
    deductibles: shevachDeductibles,
    sellingCostPct: assumptions.assumedSellingCostPct,
    // המשכנתא נלקחת בשלב הראשון שממומן ממנה. ברכישה רגילה - ביום העסקה.
    mortgageStartDate:
      capitalTimeline.outflows.find((o) => o.source === 'mortgage')?.date ??
      input.analysisDate,
    years: scenarios.central.years.map((y) => ({
      year: y.year,
      propertyValue: y.propertyValue,
      mortgageBalance: y.mortgageBalance,
      cumulativeNetCashflow: y.cumulativeNetCashflow,
    })),
  });

  return {
    downPayment,
    loanAmount,
    ltvPct,
    purchaseTax,
    mortgage,
    rentalTax,
    cashflow,
    equity,
    metrics,
    scenarios,
    saleSchedule,
    capitalTimeline,
    ...(paymentSchedule ? { paymentSchedule } : {}),
  };
}
