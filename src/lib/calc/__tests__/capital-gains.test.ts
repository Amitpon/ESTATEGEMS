import { describe, expect, it } from 'vitest';
import {
  buildSaleSchedule,
  calcCapitalGains,
  linearTaxableRatio,
  type DeductibleLine,
} from '../capital-gains';
import { singleDateTimeline } from '../capital-timeline';

/** ציר זמן פשוט - כל ההון ביום העסקה. */
function timeline(equity: number, date = '2026-01-01') {
  return singleDateTimeline(date, equity, 0, []);
}

const NO_LINES: readonly DeductibleLine[] = [];

/** קלט בסיסי: נרכש אחרי 1.1.2014, כך שכל השבח חייב. */
function baseInput(over: Partial<Parameters<typeof calcCapitalGains>[0]> = {}) {
  return {
    purchasePrice: 2_000_000,
    salePrice: 2_500_000,
    purchaseDate: '2020-01-01',
    saleDate: '2030-01-01',
    isSingleApartment: false,
    deductibles: NO_LINES,
    sellingCosts: NO_LINES,
    ...over,
  };
}

describe('linearTaxableRatio', () => {
  it('נרכש אחרי 1.1.2014 - כל השבח חייב', () => {
    expect(linearTaxableRatio('2020-01-01', '2030-01-01')).toBe(1);
  });

  it('נמכר לפני 1.1.2014 - כל השבח פטור', () => {
    expect(linearTaxableRatio('2005-01-01', '2010-01-01')).toBe(0);
  });

  it('רכישה ומכירה סביב החיתוך - היחס לפי ימים', () => {
    // נרכש 1.1.2004, נמכר 1.1.2024. 10 שנים לפני החיתוך, 10 אחריו.
    const ratio = linearTaxableRatio('2004-01-01', '2024-01-01');
    expect(ratio).toBeCloseTo(0.5, 2);
  });

  it('מכירה לפני רכישה מחזירה 0 ולא מספר שלילי', () => {
    expect(linearTaxableRatio('2030-01-01', '2020-01-01')).toBe(0);
  });
});

describe('calcCapitalGains - דירה שאינה יחידה', () => {
  it('מחשב 25 אחוז על מלוא השבח', () => {
    const r = calcCapitalGains(baseInput());
    expect(r.grossGain).toBe(500_000);
    expect(r.netGain).toBe(500_000);
    expect(r.exemptionApplied).toBe(false);
    expect(r.exemptionDenialReason).toBe('notSingleApartment');
    expect(r.taxableGain).toBe(500_000);
    expect(r.appliedRatePct).toBe(25);
    expect(r.taxAmount).toBe(125_000);
    expect(r.netProceeds).toBe(375_000);
  });

  it('מנכה הוצאות מוכרות מהשבח לפני המס', () => {
    const r = calcCapitalGains(
      baseInput({
        deductibles: [
          { key: 'purchaseTax', label: 'מס רכישה', amount: 100_000 },
          { key: 'lawyer', label: 'עו"ד', amount: 20_000 },
        ],
      }),
    );
    expect(r.totalDeductibles).toBe(120_000);
    expect(r.netGain).toBe(380_000);
    expect(r.taxAmount).toBe(95_000);
  });

  it('מנכה עלויות מכירה מהרווח הנקי אך לא מבסיס המס', () => {
    const r = calcCapitalGains(
      baseInput({
        sellingCosts: [{ key: 'broker', label: 'מתווך', amount: 50_000 }],
      }),
    );
    expect(r.taxAmount).toBe(125_000);
    expect(r.totalSellingCosts).toBe(50_000);
    expect(r.netProceeds).toBe(325_000);
  });
});

describe('calcCapitalGains - פטור דירה יחידה', () => {
  it('מחיל פטור מלא כשכל התנאים מתקיימים', () => {
    const r = calcCapitalGains(
      baseInput({ isSingleApartment: true, salePrice: 2_500_000 }),
    );
    expect(r.exemptionApplied).toBe(true);
    expect(r.exemptionDenialReason).toBeNull();
    expect(r.taxAmount).toBe(0);
    expect(r.taxableGain).toBe(0);
  });

  it('שולל פטור כשטרם חלפו 18 חודשים', () => {
    const r = calcCapitalGains(
      baseInput({
        isSingleApartment: true,
        purchaseDate: '2026-01-01',
        saleDate: '2027-01-01',
      }),
    );
    expect(r.holdingMonths).toBe(12);
    expect(r.exemptionApplied).toBe(false);
    expect(r.exemptionDenialReason).toBe('holdingTooShort');
    expect(r.taxAmount).toBeGreaterThan(0);
  });

  it('שולל פטור כשמחיר המכירה מעל התקרה', () => {
    const r = calcCapitalGains(
      baseInput({ isSingleApartment: true, salePrice: 6_000_000 }),
    );
    expect(r.exemptionApplied).toBe(false);
    expect(r.exemptionDenialReason).toBe('aboveCeiling');
  });

  it('בדירה על הנייר סופר 18 חודשים מהאכלוס ולא מהרכישה', () => {
    // נרכש 2024, אוכלס 2027, נמכר 2028. מהרכישה עברו 4 שנים, מהאכלוס 12 חודשים.
    const r = calcCapitalGains(
      baseInput({
        isSingleApartment: true,
        purchaseDate: '2024-01-01',
        occupancyDate: '2027-01-01',
        saleDate: '2028-01-01',
      }),
    );
    expect(r.holdingMonths).toBe(12);
    expect(r.exemptionDenialReason).toBe('holdingTooShort');
  });

  it('דירה על הנייר שעברו 18 חודשים מהאכלוס - פטורה', () => {
    const r = calcCapitalGains(
      baseInput({
        isSingleApartment: true,
        purchaseDate: '2024-01-01',
        occupancyDate: '2027-01-01',
        saleDate: '2028-08-01',
      }),
    );
    expect(r.holdingMonths).toBe(19);
    expect(r.exemptionApplied).toBe(true);
    expect(r.taxAmount).toBe(0);
  });
});

describe('calcCapitalGains - מקרי קצה', () => {
  it('הפסד הון אינו מחויב במס', () => {
    const r = calcCapitalGains(baseInput({ salePrice: 1_500_000 }));
    expect(r.grossGain).toBe(-500_000);
    expect(r.netGain).toBe(0);
    expect(r.taxAmount).toBe(0);
  });

  it('שבח אפס מייצר מס אפס', () => {
    const r = calcCapitalGains(baseInput({ salePrice: 2_000_000 }));
    expect(r.grossGain).toBe(0);
    expect(r.taxAmount).toBe(0);
  });

  it('הוצאות גדולות מהשבח מאפסות את המס ולא הופכות אותו לשלילי', () => {
    const r = calcCapitalGains(
      baseInput({
        deductibles: [{ key: 'reno', label: 'שיפוץ', amount: 900_000 }],
      }),
    );
    expect(r.netGain).toBe(0);
    expect(r.taxAmount).toBe(0);
  });

  it('מסמן שהנתונים הרגולטוריים לא אומתו', () => {
    const r = calcCapitalGains(baseInput());
    expect(r.allRegulatoryVerified).toBe(false);
    expect(r.sources.length).toBeGreaterThan(0);
  });
});

describe('buildSaleSchedule', () => {
  const years = [
    { year: 1, propertyValue: 2_060_000, mortgageBalance: 1_400_000, cumulativeNetCashflow: -12_000 },
    { year: 5, propertyValue: 2_320_000, mortgageBalance: 1_200_000, cumulativeNetCashflow: -50_000 },
    { year: 10, propertyValue: 2_690_000, mortgageBalance: 900_000, cumulativeNetCashflow: -80_000 },
  ];

  function schedule(over = {}) {
    return buildSaleSchedule({
      purchasePrice: 2_000_000,
      purchaseDate: '2026-01-01',
      isSingleApartment: false,
      capitalTimeline: timeline(700_000),
      deductibles: NO_LINES,
      sellingCostPct: 2,
      years,
      ...over,
    });
  }

  it('מחזיר שורה לכל שנה בהרצה', () => {
    expect(schedule()).toHaveLength(3);
  });

  it('גוזר את תאריך המכירה מתאריך הרכישה', () => {
    const rows = schedule();
    expect(rows[0]?.saleDate).toBe('2027-01-01');
    expect(rows[2]?.saleDate).toBe('2036-01-01');
  });

  it('מחשב הון בנכס כשווי פחות יתרה', () => {
    const rows = schedule();
    expect(rows[1]?.equityInProperty).toBe(2_320_000 - 1_200_000);
  });

  it('התשואה השנתית הממוצעת נמוכה מהתשואה הכוללת באופק ארוך', () => {
    const rows = schedule();
    const last = rows[2];
    expect(last?.averageAnnualReturnPct).not.toBeNull();
    expect(Math.abs(last!.averageAnnualReturnPct!)).toBeLessThan(
      Math.abs(last!.totalReturnPct),
    );
  });

  it('לא מנרמל תשואה שנתית מתחת ל-12 חודשי החזקה', () => {
    const rows = buildSaleSchedule({
      purchasePrice: 2_000_000,
      purchaseDate: '2026-01-01',
      isSingleApartment: true,
      // אוכלס מאוחר, ולכן ההחזקה לצורך הפטור קצרה
      occupancyDate: '2026-09-01',
      capitalTimeline: timeline(700_000),
      deductibles: NO_LINES,
      sellingCostPct: 2,
      years: [
        { year: 1, propertyValue: 2_060_000, mortgageBalance: 1_400_000, cumulativeNetCashflow: 0 },
      ],
    });
    expect(rows[0]?.capitalGains.holdingMonths).toBe(4);
    expect(rows[0]?.averageAnnualReturnPct).toBeNull();
  });

  it('הון עצמי אפס - ההשלמות מהכיס עדיין נספרות כהון מושקע', () => {
    const rows = schedule({ capitalTimeline: timeline(0) });
    // התזרים בשנה 1 הוא מינוס 12,000, כלומר הוזרמו 12,000 מהכיס.
    expect(rows[0]?.equityInvestedSoFar).toBe(0);
    expect(rows[0]?.cashContributions).toBe(12_000);
    expect(rows[0]?.totalInvestedSoFar).toBe(12_000);
  });

  it('עלויות המכירה נגזרות מהשווי בכל שנה בנפרד', () => {
    const rows = schedule();
    expect(rows[0]?.capitalGains.totalSellingCosts).toBe(2_060_000 * 0.02);
    expect(rows[2]?.capitalGains.totalSellingCosts).toBe(2_690_000 * 0.02);
  });
});

describe('כיסוי ההחזר מהשכירות', () => {
  it('שכירות אפקטיבית שווה להחזר נותנת 100 אחוז', async () => {
    const { calcMetrics } = await import('../metrics');
    const m = calcMetrics({
      price: 2_000_000,
      cashflow: {
        grossRent: { monthly: 6_000, annual: 72_000 },
        vacancyLoss: { monthly: 0, annual: 0 },
        effectiveRent: { monthly: 6_000, annual: 72_000 },
        operatingExpenses: { lines: [], monthlyTotal: 0, annualTotal: 0 },
        mortgagePayment: { monthly: 6_000, annual: 72_000 },
        rentalTax: { monthly: 0, annual: 0 },
        netCashflow: { monthly: 0, annual: 0 },
      },
      equity: { lines: [], total: 500_000, investedCapital: 500_000 },
      breakEvenRent: 6_000,
    });
    expect(m.mortgageCoveragePct.value).toBe(100);
  });

  it('שכירות נמוכה מההחזר נותנת פחות מ-100', async () => {
    const { calcMetrics } = await import('../metrics');
    const m = calcMetrics({
      price: 2_000_000,
      cashflow: {
        grossRent: { monthly: 5_000, annual: 60_000 },
        vacancyLoss: { monthly: 0, annual: 0 },
        effectiveRent: { monthly: 5_000, annual: 60_000 },
        operatingExpenses: { lines: [], monthlyTotal: 0, annualTotal: 0 },
        mortgagePayment: { monthly: 10_000, annual: 120_000 },
        rentalTax: { monthly: 0, annual: 0 },
        netCashflow: { monthly: -5_000, annual: -60_000 },
      },
      equity: { lines: [], total: 500_000, investedCapital: 500_000 },
      breakEvenRent: 10_000,
    });
    expect(m.mortgageCoveragePct.value).toBe(50);
  });

  it('בלי משכנתא המדד מאופס ולא מתפוצץ', async () => {
    const { calcMetrics } = await import('../metrics');
    const m = calcMetrics({
      price: 2_000_000,
      cashflow: {
        grossRent: { monthly: 6_000, annual: 72_000 },
        vacancyLoss: { monthly: 0, annual: 0 },
        effectiveRent: { monthly: 6_000, annual: 72_000 },
        operatingExpenses: { lines: [], monthlyTotal: 0, annualTotal: 0 },
        mortgagePayment: { monthly: 0, annual: 0 },
        rentalTax: { monthly: 0, annual: 0 },
        netCashflow: { monthly: 6_000, annual: 72_000 },
      },
      equity: { lines: [], total: 2_000_000, investedCapital: 2_000_000 },
      breakEvenRent: 0,
    });
    expect(m.mortgageCoveragePct.value).toBe(0);
    expect(Number.isFinite(m.mortgageCoveragePct.value)).toBe(true);
  });
});

describe('המכנה של התשואה מצטבר לפי תאריך', () => {
  it('מכירה לפני התשלום השני נמדדת מול ההון הראשון בלבד', async () => {
    const { buildCapitalTimeline } = await import('../capital-timeline');
    // 500,000 בחתימה, ועוד 200,000 באכלוס שנתיים אחר כך.
    const tl = buildCapitalTimeline([
      { key: 's1', label: 'חתימה', amount: 500_000, date: '2026-01-01', source: 'equity' },
      { key: 's2', label: 'אכלוס', amount: 200_000, date: '2028-01-01', source: 'equity' },
    ]);

    const rows = buildSaleSchedule({
      purchasePrice: 2_000_000,
      purchaseDate: '2026-01-01',
      isSingleApartment: false,
      capitalTimeline: tl,
      deductibles: NO_LINES,
      sellingCostPct: 0,
      years: [
        { year: 1, propertyValue: 2_000_000, mortgageBalance: 0, cumulativeNetCashflow: 0 },
        { year: 3, propertyValue: 2_000_000, mortgageBalance: 0, cumulativeNetCashflow: 0 },
      ],
    });

    // שנה 1 היא 2027 - לפני התשלום השני.
    expect(rows[0]?.equityInvestedSoFar).toBe(500_000);
    // שנה 3 היא 2029 - אחרי שני התשלומים.
    expect(rows[1]?.equityInvestedSoFar).toBe(700_000);
  });

  it('אותו רווח נותן תשואה גבוהה יותר כשההון שהושקע קטן יותר', async () => {
    const { buildCapitalTimeline } = await import('../capital-timeline');
    const tl = buildCapitalTimeline([
      { key: 's1', label: 'חתימה', amount: 500_000, date: '2026-01-01', source: 'equity' },
      { key: 's2', label: 'אכלוס', amount: 200_000, date: '2028-01-01', source: 'equity' },
    ]);

    const rows = buildSaleSchedule({
      purchasePrice: 2_000_000,
      purchaseDate: '2026-01-01',
      isSingleApartment: true,
      capitalTimeline: tl,
      deductibles: NO_LINES,
      sellingCostPct: 0,
      years: [
        // אותו שווי ואותו רווח גולמי בשתי הנקודות.
        // שנה 1 היא 2027 - לפני התשלום השני. שנה 3 היא 2029 - אחריו.
        { year: 1, propertyValue: 2_100_000, mortgageBalance: 0, cumulativeNetCashflow: 0 },
        { year: 3, propertyValue: 2_100_000, mortgageBalance: 0, cumulativeNetCashflow: 0 },
      ],
    });

    const early = rows[0]!;
    const later = rows[1]!;
    expect(early.equityInvestedSoFar).toBe(500_000);
    expect(later.equityInvestedSoFar).toBe(700_000);
    // המינוף חזק יותר מוקדם, ולכן התשואה הכוללת גבוהה יותר.
    expect(early.totalReturnPct).toBeGreaterThan(later.totalReturnPct);
  });

  it('תשלום ממומן משכנתא אינו נכנס למכנה', async () => {
    const { buildCapitalTimeline, equityInvestedBy } = await import('../capital-timeline');
    const tl = buildCapitalTimeline([
      { key: 's1', label: 'הון', amount: 500_000, date: '2026-01-01', source: 'equity' },
      { key: 's2', label: 'משכנתא', amount: 1_500_000, date: '2026-06-01', source: 'mortgage' },
    ]);
    expect(tl.totalEquity).toBe(500_000);
    expect(tl.totalMortgage).toBe(1_500_000);
    expect(equityInvestedBy(tl, '2027-01-01')).toBe(500_000);
  });
});

describe('ההשלמות מהכיס נכנסות למכנה', () => {
  const tl = () => singleDateTimeline('2026-01-01', 1_000_000, 0, []);

  function run(cumulativeNetCashflow: number) {
    return buildSaleSchedule({
      purchasePrice: 2_000_000,
      purchaseDate: '2026-01-01',
      isSingleApartment: false,
      capitalTimeline: tl(),
      deductibles: NO_LINES,
      sellingCostPct: 0,
      years: [
        { year: 3, propertyValue: 2_300_000, mortgageBalance: 1_000_000, cumulativeNetCashflow },
      ],
    })[0]!;
  }

  it('תזרים שלילי מגדיל את ההון המושקע', () => {
    const r = run(-150_000);
    expect(r.equityInvestedSoFar).toBe(1_000_000);
    expect(r.cashContributions).toBe(150_000);
    expect(r.totalInvestedSoFar).toBe(1_150_000);
  });

  it('תזרים חיובי אינו מגדיל את ההון המושקע - הוא תשואה', () => {
    const r = run(150_000);
    expect(r.cashContributions).toBe(0);
    expect(r.totalInvestedSoFar).toBe(1_000_000);
  });

  it('אותו נכס עם השלמות מהכיס מראה תשואה נמוכה יותר', () => {
    const withOutflow = run(-150_000);
    const without = run(0);
    expect(withOutflow.totalInvestedSoFar).toBeGreaterThan(without.totalInvestedSoFar);
    expect(withOutflow.totalReturnPct).toBeLessThan(without.totalReturnPct);
  });
});
