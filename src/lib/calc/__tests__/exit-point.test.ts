import { describe, it, expect } from 'vitest';
import { findKeyExitPoint, type SaleAtYear } from '../capital-gains';

function row(o: Partial<SaleAtYear> & { year: number }): SaleAtYear {
  return {
    year: o.year,
    saleDate: `202${o.year}-01-01`,
    beforeMortgageStart: o.beforeMortgageStart ?? false,
    propertyValue: 0, mortgageBalance: 0, equityInProperty: 0,
    cumulativeNetCashflow: 0, equityInvestedSoFar: 0, cashContributions: 0,
    totalInvestedSoFar: 0, totalProfit: 0, totalReturnPct: 0,
    // ?? היה הופך null מפורש ל-0 ומבטל את המקרה שהטסט בודק
    averageAnnualReturnPct:
      'averageAnnualReturnPct' in o ? (o.averageAnnualReturnPct as number | null) : 0,
    capitalGains: {
      exemptionApplied: o.capitalGains?.exemptionApplied ?? false,
    } as SaleAtYear['capitalGains'],
  } as SaleAtYear;
}

describe('findKeyExitPoint', () => {
  it('דירה ראשונה - בוחר את השורה הראשונה שבה הפטור חל', () => {
    const p = findKeyExitPoint([
      row({ year: 1, averageAnnualReturnPct: 50 }),
      row({ year: 2, capitalGains: { exemptionApplied: true } as never }),
      row({ year: 3, capitalGains: { exemptionApplied: true } as never }),
    ]);
    expect(p?.reason).toBe('exemption');
    // הראשונה, לא האחרונה - זה הרגע שבו הפטור נכנס
    expect(p?.row.year).toBe(2);
  });

  it('הפטור גובר גם כשתשואה מוקדמת גבוהה יותר', () => {
    const p = findKeyExitPoint([
      row({ year: 1, averageAnnualReturnPct: 99 }),
      row({ year: 4, averageAnnualReturnPct: 5, capitalGains: { exemptionApplied: true } as never }),
    ]);
    expect(p?.row.year).toBe(4);
  });

  it('בלי פטור - בוחר את התשואה השנתית הגבוהה ביותר', () => {
    const p = findKeyExitPoint([
      row({ year: 1, averageAnnualReturnPct: 4 }),
      row({ year: 2, averageAnnualReturnPct: 11 }),
      row({ year: 3, averageAnnualReturnPct: 7 }),
    ]);
    expect(p?.reason).toBe('best-return');
    expect(p?.row.year).toBe(2);
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
