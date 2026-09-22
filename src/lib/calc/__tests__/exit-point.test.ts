import { describe, it, expect } from 'vitest';
import { findKeyExitPoint, type SaleAtYear } from '../capital-gains';

function row(o: Partial<SaleAtYear> & { year: number }): SaleAtYear {
  return {
    year: o.year,
    saleDate: `202${o.year}-01-01`,
    beforeMortgageStart: o.beforeMortgageStart ?? false,
    propertyValue: 0, mortgageBalance: 0, equityInProperty: 0,
    cumulativeNetCashflow: 0, equityInvestedSoFar: 0, cashContributions: 0,
    totalInvestedSoFar: 0, totalProfit: 0,
    totalReturnPct: o.totalReturnPct ?? 0,
    // ?? היה הופך null מפורש ל-0 ומבטל את המקרה שהטסט בודק
    averageAnnualReturnPct:
      'averageAnnualReturnPct' in o ? (o.averageAnnualReturnPct as number | null) : 0,
    capitalGains: {
      exemptionApplied: o.capitalGains?.exemptionApplied ?? false,
    } as SaleAtYear['capitalGains'],
  } as SaleAtYear;
}

describe('findKeyExitPoint', () => {
  it('בוחר תמיד את התשואה השנתית הגבוהה ביותר, גם אחרי 10 שנים', () => {
    const p = findKeyExitPoint([
      row({ year: 1, averageAnnualReturnPct: 4 }),
      row({ year: 5, averageAnnualReturnPct: 7 }),
      row({ year: 10, averageAnnualReturnPct: 19 }),
    ]);
    expect(p?.row.year).toBe(10);
  });

  it('הפטור אינו בוחר את הנקודה - השיא גובר גם כשהוא חייב במס', () => {
    // הכרעת בעל המוצר: הפטור משפיע על החישוב, לא כופה את התאריך.
    const p = findKeyExitPoint([
      row({ year: 2, averageAnnualReturnPct: 5, capitalGains: { exemptionApplied: true } as never }),
      row({ year: 6, averageAnnualReturnPct: 14 }),
    ]);
    expect(p?.row.year).toBe(6);
    expect(p?.reason).toBe('peak-taxed');
  });

  it('מסמן peak-exempt כשהשיא פטור ממס', () => {
    const p = findKeyExitPoint([
      row({ year: 1, averageAnnualReturnPct: 3 }),
      row({ year: 4, averageAnnualReturnPct: 12, capitalGains: { exemptionApplied: true } as never }),
    ]);
    expect(p?.reason).toBe('peak-exempt');
  });

  it('מחזיר בנפרד את שיא הרווח המצטבר כשהוא בשורה אחרת', () => {
    const p = findKeyExitPoint([
      row({ year: 2, averageAnnualReturnPct: 20, totalReturnPct: 40 }),
      row({ year: 10, averageAnnualReturnPct: 9, totalReturnPct: 90 }),
    ]);
    // השיא השנתי בשנה 2, אבל הרווח המצטבר ממשיך לגדול עד שנה 10.
    expect(p?.row.year).toBe(2);
    expect(p?.maxTotalReturnRow?.year).toBe(10);
  });

  it('לא מחזיר שיא מצטבר נפרד כששניהם באותה שורה', () => {
    const p = findKeyExitPoint([
      row({ year: 1, averageAnnualReturnPct: 5, totalReturnPct: 5 }),
      row({ year: 3, averageAnnualReturnPct: 15, totalReturnPct: 45 }),
    ]);
    expect(p?.row.year).toBe(3);
    expect(p?.maxTotalReturnRow).toBeNull();
  });

  it('שורות לפני תחילת המשכנתא לא נבחרות', () => {
    const p = findKeyExitPoint([
      row({ year: 1, averageAnnualReturnPct: 900, beforeMortgageStart: true }),
      row({ year: 2, averageAnnualReturnPct: 6 }),
    ]);
    expect(p?.row.year).toBe(2);
  });

  it('אין שורות כשירות - מחזיר null', () => {
    expect(findKeyExitPoint([row({ year: 1, beforeMortgageStart: true })])).toBeNull();
    expect(findKeyExitPoint([])).toBeNull();
  });

  it('אין תשואה שנתית באף שורה - נופל לסוף התקופה', () => {
    const p = findKeyExitPoint([
      row({ year: 1, averageAnnualReturnPct: null as never }),
      row({ year: 2, averageAnnualReturnPct: null as never }),
    ]);
    expect(p?.reason).toBe('end-of-horizon');
    expect(p?.row.year).toBe(2);
  });
});
