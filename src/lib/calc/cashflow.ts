/**
 * תזרים מזומנים חודשי ושנתי.
 *
 * התזרים = שכר דירה, פחות אי-אכלוס, פחות הוצאות תפעול, פחות משכנתא, פחות מס.
 *
 * עיקרון 3, שכבה 2: הפונקציות כאן מחזירות תמיד את הפירוק המלא לרכיבים ולא רק
 * את הסכום, כדי שהממשק יוכל להראות מאיפה כל מספר בא.
 */

import type { AmountOrPercent, OperatingExpensesInput } from '@/types/property';
import { assertNonNegative, assertPercent, pctOf, roundAgorot } from './money';

/** שורה אחת בפירוק ההוצאות. */
export interface ExpenseLine {
  /** מזהה יציב לרכיב, לשימוש הממשק. */
  readonly key: string;
  readonly label: string;
  /** הסכום החודשי. */
  readonly monthly: number;
  /** הסכום השנתי. */
  readonly annual: number;
  /** כיצד הוזן הערך - סכום או אחוז - כדי שהממשק יוכל להסביר. */
  readonly input: AmountOrPercent;
}

/** הקשר שנדרש כדי להמיר אחוזים לסכומים. */
export interface ExpenseContext {
  /** מחיר הנכס, לבסיס percentOfPricePerYear. */
  readonly price: number;
  /** שכר דירה שנתי ברוטו, לבסיס percentOfAnnualRent. */
  readonly annualGrossRent: number;
}

/** המרת רכיב הוצאה לסכום חודשי ושנתי. */
export function resolveExpense(value: AmountOrPercent, context: ExpenseContext): {
  monthly: number;
  annual: number;
} {
  switch (value.kind) {
    case 'monthlyAmount':
      return { monthly: roundAgorot(value.amount), annual: roundAgorot(value.amount * 12) };
    case 'annualAmount':
      return { monthly: roundAgorot(value.amount / 12), annual: roundAgorot(value.amount) };
    case 'percentOfAnnualRent': {
      const annual = roundAgorot(pctOf(context.annualGrossRent, value.percent));
      return { monthly: roundAgorot(annual / 12), annual };
    }
    case 'percentOfPricePerYear': {
      const annual = roundAgorot(pctOf(context.price, value.percent));
      return { monthly: roundAgorot(annual / 12), annual };
    }
  }
}

/** פירוק מלא של הוצאות התפעול. */
export interface OperatingExpensesResult {
  readonly lines: readonly ExpenseLine[];
  readonly monthlyTotal: number;
  readonly annualTotal: number;
}

const EXPENSE_LABELS = {
  buildingFee: 'ועד בית',
  propertyTax: 'ארנונה',
  insurance: 'ביטוח',
  maintenance: 'תחזוקה',
  management: 'ניהול',
} as const;

/** חישוב כל רכיבי הוצאות התפעול, עם פירוק. */
export function calcOperatingExpenses(
  expenses: OperatingExpensesInput,
  context: ExpenseContext,
): OperatingExpensesResult {
  const lines: ExpenseLine[] = [];

  const fixedKeys = ['buildingFee', 'propertyTax', 'insurance', 'maintenance', 'management'] as const;
  for (const key of fixedKeys) {
    const input = expenses[key];
    const resolved = resolveExpense(input, context);
    lines.push({ key, label: EXPENSE_LABELS[key], monthly: resolved.monthly, annual: resolved.annual, input });
  }

  expenses.custom.forEach((entry, index) => {
    const resolved = resolveExpense(entry.value, context);
    lines.push({
      key: `custom:${index}`,
      label: entry.label,
      monthly: resolved.monthly,
      annual: resolved.annual,
      input: entry.value,
    });
  });

  let monthlyTotal = 0;
  let annualTotal = 0;
  for (const line of lines) {
    monthlyTotal = roundAgorot(monthlyTotal + line.monthly);
    annualTotal = roundAgorot(annualTotal + line.annual);
  }

  return { lines, monthlyTotal, annualTotal };
}

/** פירוק תזרים מלא, חודשי ושנתי. */
export interface CashflowResult {
  /** שכר דירה ברוטו. */
  readonly grossRent: { readonly monthly: number; readonly annual: number };
  /** הפסד מאי-אכלוס, כמספר חיובי שיורד מהברוטו. */
  readonly vacancyLoss: { readonly monthly: number; readonly annual: number };
  /** שכר דירה אפקטיבי - ברוטו פחות אי-אכלוס. */
  readonly effectiveRent: { readonly monthly: number; readonly annual: number };
  /** הוצאות התפעול, עם פירוק לרכיבים. */
  readonly operatingExpenses: OperatingExpensesResult;
  /** החזר המשכנתא. */
  readonly mortgagePayment: { readonly monthly: number; readonly annual: number };
  /** מס שכר הדירה לפי המסלול שנבחר. */
  readonly rentalTax: { readonly monthly: number; readonly annual: number };
  /** התזרים הנקי. שלילי פירושו השלמה מהכיס. */
  readonly netCashflow: { readonly monthly: number; readonly annual: number };
}

/** קלט לחישוב התזרים. */
export interface CashflowInput {
  readonly monthlyGrossRent: number;
  readonly vacancyPct: number;
  readonly expenses: OperatingExpensesInput;
  readonly price: number;
  /** ההחזר החודשי על המשכנתא, מלוח הסילוקין. */
  readonly monthlyMortgagePayment: number;
  /** המס השנתי על שכר הדירה, לפי המסלול שנבחר. */
  readonly annualRentalTax: number;
}

/** חישוב התזרים עם פירוק מלא. */
export function calcCashflow(input: CashflowInput): CashflowResult {
  assertNonNegative('income.monthlyRent', 'שכר הדירה החודשי', input.monthlyGrossRent);
  assertPercent('income.vacancyPct', 'שיעור אי-אכלוס', input.vacancyPct);
  assertNonNegative('financing.monthlyPayment', 'ההחזר החודשי', input.monthlyMortgagePayment);
  assertNonNegative('property.price', 'מחיר הנכס', input.price);

  const grossMonthly = roundAgorot(input.monthlyGrossRent);
  const grossAnnual = roundAgorot(grossMonthly * 12);

  const vacancyMonthly = roundAgorot(pctOf(grossMonthly, input.vacancyPct));
  const vacancyAnnual = roundAgorot(vacancyMonthly * 12);

  const effectiveMonthly = roundAgorot(grossMonthly - vacancyMonthly);
  const effectiveAnnual = roundAgorot(effectiveMonthly * 12);

  const operatingExpenses = calcOperatingExpenses(input.expenses, {
    price: input.price,
    annualGrossRent: grossAnnual,
  });

  const mortgageMonthly = roundAgorot(input.monthlyMortgagePayment);
  const mortgageAnnual = roundAgorot(mortgageMonthly * 12);

  const taxAnnual = roundAgorot(input.annualRentalTax);
  const taxMonthly = roundAgorot(taxAnnual / 12);

  const netMonthly = roundAgorot(
    effectiveMonthly - operatingExpenses.monthlyTotal - mortgageMonthly - taxMonthly,
  );
  const netAnnual = roundAgorot(
    effectiveAnnual - operatingExpenses.annualTotal - mortgageAnnual - taxAnnual,
  );

  return {
    grossRent: { monthly: grossMonthly, annual: grossAnnual },
    vacancyLoss: { monthly: vacancyMonthly, annual: vacancyAnnual },
    effectiveRent: { monthly: effectiveMonthly, annual: effectiveAnnual },
    operatingExpenses,
    mortgagePayment: { monthly: mortgageMonthly, annual: mortgageAnnual },
    rentalTax: { monthly: taxMonthly, annual: taxAnnual },
    netCashflow: { monthly: netMonthly, annual: netAnnual },
  };
}
