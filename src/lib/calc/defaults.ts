/**
 * ברירות מחדל לשדות ההנחה.
 *
 * עיקרון 3: "אין ברירת מחדל מוסתרת". כל ערך כאן הוא נקודת פתיחה שהמשתמש
 * רואה בממשק ויכול לשנות. שום ערך מכאן לא מוטמע בתוך פונקציית חישוב.
 *
 * לכל ערך מצורף מקור. ערך שאין לו מקור מחקרי מסומן ככזה במפורש.
 */

import type {
  Assumptions,
  AmountOrPercent,
  IncomeInput,
  OperatingExpensesInput,
  AcquisitionCostsInput,
} from '@/types/property';
import { RENTAL_MARGINAL_DEFAULT_PCT } from './tax-data';

/** תיאור מקור של ברירת מחדל, לתצוגה בשכבה 3 של הממשק. */
export interface DefaultOrigin {
  readonly label: string;
  readonly source: string;
  readonly verified: boolean;
}

export const DEFAULT_ORIGINS: Readonly<Record<string, DefaultOrigin>> = {
  vacancyPct: {
    label: 'אי-אכלוס',
    // 8.33 אחוז = חודש אחד בשנה. עיקרון 3 מזכיר את "חודש אי-אכלוס בשנה" כדוגמה
    // מובהקת להנחה שאסור שתהיה קבועה נסתרת בקוד.
    source: 'docs/product-principles.md עיקרון 3 - חודש אחד בשנה, 1/12 = 8.33 אחוז.',
    verified: false,
  },
  maintenancePct: {
    label: 'תחזוקה',
    source: 'docs/product-principles.md עיקרון 3 מזכיר "2 אחוז תחזוקה" כדוגמה. הערכה, לא נתון רגולטורי.',
    verified: false,
  },
  managementPct: {
    label: 'דמי ניהול',
    source: 'נוהג שוק לחברת ניהול - כ-8 אחוז מדמי השכירות. לא אומת במחקר.',
    verified: false,
  },
  lawyerFeePct: {
    label: 'שכר טרחת עורך דין',
    source: 'docs/research/market-research.md פער 4 - "עו"ד (0.5-1.5 אחוז)". נלקח האמצע.',
    verified: true,
  },
  brokerFeePct: {
    label: 'דמי תיווך',
    source: 'נוהג שוק - 2 אחוז בתוספת מע"מ. לא אומת במחקר.',
    verified: false,
  },
  mortgageRatePct: {
    label: 'ריבית משכנתא',
    source:
      'docs/research/market-research.md סעיף 8.4 מסמן את ריבית הפריים כ-[?] "יש לאמת בזמן אמת". 4.5 אחוז הוא ערך פתיחה בלבד.',
    verified: false,
  },
  appreciationPct: {
    label: 'עליית ערך שנתית',
    source: 'הנחת המשתמש. הכלי לא מנבא (עיקרון 1). 3 אחוז הוא ערך פתיחה נייטרלי בלבד.',
    verified: false,
  },
  marginalTaxRatePct: {
    label: 'מס שולי',
    source: RENTAL_MARGINAL_DEFAULT_PCT.source,
    verified: RENTAL_MARGINAL_DEFAULT_PCT.verified,
  },
};

/** שיעור אי-אכלוס ברירת מחדל - חודש אחד בשנה. */
export const DEFAULT_VACANCY_PCT = 100 / 12;

/** תקופת משכנתא ברירת מחדל בחודשים - 30 שנה, המקסימום לפי בנק ישראל. */
export const DEFAULT_TERM_MONTHS = 360;

/** ריבית שנתית ברירת מחדל. ערך פתיחה, לא נתון שוק מאומת. */
export const DEFAULT_ANNUAL_RATE_PCT = 4.5;

/** אחוז מימון ברירת מחדל - תקרת בנק ישראל לדירה שאינה יחידה. */
export const DEFAULT_LTV_PCT = 50;

/** עמלת פירעון מוקדם ברירת מחדל. */
export const DEFAULT_EARLY_REPAYMENT_FEE_PCT = 0;

/** שכר טרחת עורך דין כאחוז ממחיר הנכס - אמצע הטווח 0.5-1.5. */
export const DEFAULT_LAWYER_FEE_PCT = 1;

/** דמי תיווך כאחוז ממחיר הנכס. */
export const DEFAULT_BROKER_FEE_PCT = 2;

/** רזרבה נזילה ברירת מחדל בשקלים. */
export const DEFAULT_LIQUIDITY_RESERVE = 30_000;

/** ברירת מחדל להכנסות. שכר הדירה עצמו תמיד מגיע מהמשתמש - אין לו ברירת מחדל. */
export function defaultIncome(monthlyRent: number): IncomeInput {
  return { monthlyRent, vacancyPct: DEFAULT_VACANCY_PCT };
}

/** ברירות המחדל להוצאות השוטפות. */
export function defaultOperatingExpenses(): OperatingExpensesInput {
  const buildingFee: AmountOrPercent = { kind: 'monthlyAmount', amount: 250 };
  const propertyTax: AmountOrPercent = { kind: 'monthlyAmount', amount: 300 };
  const insurance: AmountOrPercent = { kind: 'annualAmount', amount: 1_200 };
  // 1 אחוז ממחיר הנכס לשנה - נקודת פתיחה שמרנית יותר מ-2 אחוז שמוזכר בעקרונות,
  // המשתמש רואה ומשנה.
  const maintenance: AmountOrPercent = { kind: 'percentOfPricePerYear', percent: 1 };
  const management: AmountOrPercent = { kind: 'percentOfAnnualRent', percent: 8 };
  return { buildingFee, propertyTax, insurance, maintenance, management, custom: [] };
}

/** ברירות המחדל לעלויות הרכישה, נגזרות ממחיר הנכס. */
export function defaultAcquisitionCosts(price: number): AcquisitionCostsInput {
  return {
    brokerFee: (price * DEFAULT_BROKER_FEE_PCT) / 100,
    lawyerFee: (price * DEFAULT_LAWYER_FEE_PCT) / 100,
    mortgageAdvisorFee: 0,
    finishingCostPerSqm: 0,
    liquidityReserve: DEFAULT_LIQUIDITY_RESERVE,
    custom: [],
  };
}

/**
 * ברירות המחדל להנחות ההרצה קדימה.
 * עיקרון 1: אלה הנחות פתיחה, והממשק חייב להציג אותן צמוד לכל מספר שנגזר מהן.
 */
/**
 * עלויות מכירה מונחות - מתווך ועו"ד בעת המכירה.
 * 2 אחוז הוא נוהג השוק לעמלת מתווך. ראה docs/research/professional-cost-ranges.md.
 */
export const DEFAULT_SELLING_COST_PCT = 2;

export function defaultAssumptions(): Assumptions {
  return {
    assumedAppreciationPct: 3,
    assumedRentGrowthPct: 2,
    assumedExpenseGrowthPct: 2,
    assumedIndexChangePct: 3,
    assumedSellingCostPct: DEFAULT_SELLING_COST_PCT,
    horizonYears: 10,
    scenarioSpreadPoints: 2,
  };
}
