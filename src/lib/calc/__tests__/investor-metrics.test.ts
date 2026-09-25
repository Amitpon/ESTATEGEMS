/**
 * בדיקות ל-6 מדדי המשקיע המרכזיים (investorMetrics.ts).
 * כל בדיקה מאמתת ערך, לא רק שהפונקציה לא זרקה.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../index';
import {
  buildInvestorHeadlineMetrics,
  calcRequiredGrossSalary,
  compareToSp500,
  sp500TotalReturnPct,
} from '../investorMetrics';
import { DEFAULT_MAX_PAYMENT_TO_INCOME_RATIO_PCT, defaultAcquisitionCosts, defaultAssumptions, defaultOperatingExpenses } from '../defaults';
import { SP500_BENCHMARK } from '@/data/benchmarks';
import type { SaleAtYear } from '../capital-gains';
import type { PropertyInput } from '@/types/property';

/** שורה מינימלית לטבלת המכירה, כמו ב-exit-point.test.ts. */
function row(o: Partial<SaleAtYear> & { year: number }): SaleAtYear {
  return {
    year: o.year,
    ...(o.label ? { label: o.label } : {}),
    saleDate: `202${o.year}-01-01`,
    beforeMortgageStart: o.beforeMortgageStart ?? false,
    propertyValue: 0,
    mortgageBalance: 0,
    equityInProperty: 0,
    cumulativeNetCashflow: 0,
    equityInvestedSoFar: 0,
    cashContributions: 0,
    totalInvestedSoFar: 0,
    totalProfit: 0,
    totalReturnPct: o.totalReturnPct ?? 0,
    averageAnnualReturnPct:
      'averageAnnualReturnPct' in o ? (o.averageAnnualReturnPct as number | null) : 0,
    capitalGains: {} as SaleAtYear['capitalGains'],
  } as SaleAtYear;
}

describe('calcRequiredGrossSalary', () => {
  it('החזר 5,000 ש"ח ביחס 33 אחוז -> כ-15,151.5 ש"ח משכורת ברוטו', () => {
    const r = calcRequiredGrossSalary(5_000, 33);
    expect(r.requiredGrossSalary).toBeCloseTo(15_151.52, 1);
    expect(r.monthlyMortgagePayment).toBe(5_000);
    expect(r.maxPaymentToIncomeRatioPct).toBe(33);
  });

  it('אין משכנתא (החזר 0) - אין תנאי סף, משכורת נדרשת 0', () => {
    const r = calcRequiredGrossSalary(0, 33);
    expect(r.requiredGrossSalary).toBe(0);
  });

  it('יחס גבוה יותר דורש משכורת נמוכה יותר לאותו החזר', () => {
    const low = calcRequiredGrossSalary(5_000, 50);
    const high = calcRequiredGrossSalary(5_000, 20);
    expect(low.requiredGrossSalary).toBeLessThan(high.requiredGrossSalary);
  });

  it('יחס לא חוקי (0 או שלילי) זורק שגיאת קלט', () => {
    expect(() => calcRequiredGrossSalary(5_000, 0)).toThrow();
    expect(() => calcRequiredGrossSalary(5_000, -10)).toThrow();
  });
});

describe('sp500TotalReturnPct', () => {
  it('10 שנים לפי 14.8 אחוז שנתי -> כ-297.8 אחוז תשואה כוללת', () => {
    const expected = (Math.pow(1.148, 10) - 1) * 100;
    expect(sp500TotalReturnPct(10)).toBeCloseTo(expected, 2);
  });

  it('שנה 0 זורקת שגיאה (assertPositive)', () => {
    expect(() => sp500TotalReturnPct(0)).toThrow();
  });
});

describe('compareToSp500', () => {
  it('מוצא את שורת שנה 10 ומשווה נכון', () => {
    const schedule = [
      row({ year: 1, averageAnnualReturnPct: 5, totalReturnPct: 5 }),
      row({ year: 10, averageAnnualReturnPct: 20, totalReturnPct: 250 }),
    ];
    const c = compareToSp500(schedule, 10);
    expect(c).not.toBeNull();
    expect(c!.year).toBe(10);
    expect(c!.averageAnnualReturnPct).toBe(20);
    expect(c!.sp500AverageAnnualReturnPct).toBeCloseTo(14.8, 6);
    expect(c!.annualDeltaPoints).toBeCloseTo(20 - 14.8, 6);
    expect(c!.totalDeltaPoints).toBeCloseTo(250 - sp500TotalReturnPct(10), 2);
    expect(c!.note).toContain('היסטורי');
  });

  it('מתעלם משורה עם label - נקודת מפתח שאינה שנה עגולה', () => {
    // שורה עם year=10 אבל עם label (למשל הוזרקה בטעות) לא נחשבת.
    const schedule = [row({ year: 10, label: 'כניסת הפטור', averageAnnualReturnPct: 99 })];
    expect(compareToSp500(schedule, 10)).toBeNull();
  });

  it('אין שורה לאופק המבוקש - מחזיר null', () => {
    const schedule = [row({ year: 1 }), row({ year: 5 })];
    expect(compareToSp500(schedule, 10)).toBeNull();
  });

  it('averageAnnualReturnPct null בשורה - annualDeltaPoints גם null, totalDeltaPoints עדיין מחושב', () => {
    const schedule = [row({ year: 10, averageAnnualReturnPct: null, totalReturnPct: 30 })];
    const c = compareToSp500(schedule, 10);
    expect(c!.averageAnnualReturnPct).toBeNull();
    expect(c!.annualDeltaPoints).toBeNull();
    expect(c!.totalDeltaPoints).toBeCloseTo(30 - sp500TotalReturnPct(10), 2);
  });
});

describe('buildInvestorHeadlineMetrics', () => {
  it('בונה 6 מדדים בסדר הנכון כשיש שורת השוואה', () => {
    const schedule = [row({ year: 10, averageAnnualReturnPct: 12, totalReturnPct: 180 })];
    const result = buildInvestorHeadlineMetrics({
      upfrontEquityTotal: 500_000,
      loanAmount: 1_000_000,
      monthlyMortgagePayment: 5_000,
      netMonthlyCashflow: 800,
      saleSchedule: schedule,
      horizonYears: 10,
      maxPaymentToIncomeRatioPct: 33,
    });

    expect(result.ordered).toHaveLength(6);
    expect(result.ordered.map((m) => m.key)).toEqual([
      'headline:upfrontEquity',
      'headline:requiredGrossSalary',
      'headline:loanAmount',
      'headline:netMonthlyCashflow',
      'headline:averageAnnualReturnVsSp500',
      'headline:totalReturnVsSp500',
    ]);
    expect(result.upfrontEquity.value).toBe(500_000);
    expect(result.loanAmount.value).toBe(1_000_000);
    expect(result.netMonthlyCashflow.value).toBe(800);
    expect(result.requiredGrossSalary.value).toBeCloseTo(5_000 / 0.33, 1);
    expect(result.averageAnnualReturnVsSp500?.value).toBe(12);
    expect(result.totalReturnVsSp500?.value).toBe(180);
  });

  it('משמיט את שני מדדי ה-S&P כשאין שורת מכירה לאופק', () => {
    const result = buildInvestorHeadlineMetrics({
      upfrontEquityTotal: 500_000,
      loanAmount: 1_000_000,
      monthlyMortgagePayment: 5_000,
      netMonthlyCashflow: 800,
      saleSchedule: [row({ year: 3 })],
      horizonYears: 10,
      maxPaymentToIncomeRatioPct: 33,
    });
    expect(result.ordered).toHaveLength(4);
    expect(result.averageAnnualReturnVsSp500).toBeNull();
    expect(result.totalReturnVsSp500).toBeNull();
    expect(result.sp500Comparison).toBeNull();
  });

  it('הון עצמי מלא (בלי משכנתא) - משכורת נדרשת 0, שאר המדדים תקינים', () => {
    const result = buildInvestorHeadlineMetrics({
      upfrontEquityTotal: 2_000_000,
      loanAmount: 0,
      monthlyMortgagePayment: 0,
      netMonthlyCashflow: 3_000,
      saleSchedule: [row({ year: 10, averageAnnualReturnPct: 5, totalReturnPct: 50 })],
      horizonYears: 10,
      maxPaymentToIncomeRatioPct: 33,
    });
    expect(result.loanAmount.value).toBe(0);
    expect(result.requiredGrossSalary.value).toBe(0);
  });
});

/** קלט בסיסי לבדיקת אינטגרציה מלאה מול analyze(), כמו ב-calc.test.ts. */
function baseInput(over: Partial<PropertyInput> = {}): PropertyInput {
  const price = 2_000_000;
  return {
    analysisDate: '2026-09-20',
    property: { price, sizeSqm: 80, city: 'חיפה', kind: 'apartment', rooms: 3 },
    financing: {
      downPayment: 1_000_000,
      tracks: [
        {
          id: 'main',
          label: 'קבועה לא צמודה',
          principal: 1_000_000,
          annualRatePct: 4.9,
          termMonths: 360,
          amortization: 'spitzer',
          linkage: 'fixedUnlinked',
        },
      ],
      earlyRepaymentFeePct: 0,
    },
    income: { monthlyRent: 5_500, vacancyPct: 100 / 12 },
    expenses: defaultOperatingExpenses(),
    acquisitionCosts: defaultAcquisitionCosts(price),
    tax: { isSingleApartment: false, rentalTaxTrack: 'exempt', marginalTaxRatePct: 31 },
    ...over,
  };
}

describe('analyze() מחבר את investorMetrics', () => {
  it('מחזיר 6 מדדים תקינים, עקביים עם שאר תוצאת הניתוח', () => {
    const r = analyze(baseInput(), defaultAssumptions());

    expect(r.investorMetrics.upfrontEquity.value).toBe(r.equity.total);
    expect(r.investorMetrics.loanAmount.value).toBe(r.mortgage.loanAmount);
    expect(r.investorMetrics.netMonthlyCashflow.value).toBe(r.cashflow.netCashflow.monthly);

    // ריבית 4.9 אחוז על מיליון ל-360 חודשים - החזר חודשי חיובי, אז יש משכורת נדרשת.
    expect(r.investorMetrics.requiredGrossSalary.value).toBeGreaterThan(0);
    expect(r.investorMetrics.requiredGrossSalary.value).toBeCloseTo(
      r.mortgage.firstMonthlyPayment / (DEFAULT_MAX_PAYMENT_TO_INCOME_RATIO_PCT / 100),
      1,
    );

    // אופק ברירת המחדל הוא 10 שנים - אמור להימצא שורה תואמת בטבלת המכירה.
    expect(r.investorMetrics.averageAnnualReturnVsSp500).not.toBeNull();
    expect(r.investorMetrics.totalReturnVsSp500).not.toBeNull();
    expect(r.investorMetrics.sp500Comparison?.sp500AverageAnnualReturnPct).toBeCloseTo(
      SP500_BENCHMARK.tenYearCAGR * 100,
      6,
    );
    expect(r.investorMetrics.ordered).toHaveLength(6);
  });

  it('יחס החזר להכנסה ניתן לעריכה כפרמטר שלישי ל-analyze', () => {
    const strict = analyze(baseInput(), defaultAssumptions(), 20);
    const lenient = analyze(baseInput(), defaultAssumptions(), 50);
    // יחס נמוך יותר (20 אחוז) דורש משכורת גבוהה יותר לאותו החזר.
    expect(strict.investorMetrics.requiredGrossSalary.value).toBeGreaterThan(
      lenient.investorMetrics.requiredGrossSalary.value,
    );
  });

  it('הון עצמי מלא (בלי משכנתא) - המשכורת הנדרשת היא 0', () => {
    const r = analyze(
      baseInput({
        financing: { downPayment: 2_000_000, tracks: [], earlyRepaymentFeePct: 0 },
      }),
      defaultAssumptions(),
    );
    expect(r.loanAmount).toBe(0);
    expect(r.investorMetrics.requiredGrossSalary.value).toBe(0);
    expect(r.investorMetrics.loanAmount.value).toBe(0);
  });

  it('שכ"ד 0 - תזרים חודשי נטו שלילי בגודל ההחזר ועוד ההוצאות', () => {
    const r = analyze(baseInput({ income: { monthlyRent: 0, vacancyPct: 0 } }), defaultAssumptions());
    expect(r.investorMetrics.netMonthlyCashflow.value).toBe(r.cashflow.netCashflow.monthly);
    expect(r.investorMetrics.netMonthlyCashflow.value).toBeLessThan(0);
  });
});
