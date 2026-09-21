import { describe, it, expect } from 'vitest';
import {
  analyze,
  defaultAcquisitionCosts,
  defaultAssumptions,
  defaultOperatingExpenses,
  DEFAULT_VACANCY_PCT,
} from '../index';
import type { PropertyInput } from '@/types/property';

function base(): PropertyInput {
  const price = 2_000_000;
  return {
    analysisDate: '2026-01-01',
    property: { price, sizeSqm: 80, city: '', kind: 'apartment', rooms: 3 },
    financing: {
      downPayment: price * 0.5,
      tracks: [
        {
          id: 'main',
          label: 'שפיצר',
          principal: price * 0.5,
          annualRatePct: 4.5,
          termMonths: 25 * 12,
          amortization: 'spitzer',
          linkage: 'fixedUnlinked',
        },
      ],
      earlyRepaymentFeePct: 2,
    },
    income: { monthlyRent: 5_500, vacancyPct: DEFAULT_VACANCY_PCT },
    expenses: defaultOperatingExpenses(),
    acquisitionCosts: defaultAcquisitionCosts(price),
    tax: { isSingleApartment: true, rentalTaxTrack: 'exempt', marginalTaxRatePct: 31 },
  };
}

describe('שורת כניסת הפטור', () => {
  it('נוספת שורה ב-18 חודשים מהאכלוס, והתשואה השנתית מחולקת ב-1.5', () => {
    const r = analyze(base(), defaultAssumptions());
    const row = r.saleSchedule.find((x) => x.label === 'כניסת הפטור ממס שבח');
    expect(row, 'שורת הפטור חייבת להתווסף').toBeDefined();
    if (!row) return;

    // 18 חודשים מ-2026-01-01
    expect(row.saleDate.slice(0, 7)).toBe('2027-07');
    expect(row.capitalGains.holdingMonths).toBe(18);

    // הבדיקה המרכזית: חלוקה בשנים בפועל (1.5), לא במספר מחזורים (2).
    const expected = row.totalReturnPct / 1.5;
    expect(row.averageAnnualReturnPct).toBeCloseTo(expected, 6);

    // ולא חלוקה ב-2
    expect(row.averageAnnualReturnPct).not.toBeCloseTo(row.totalReturnPct / 2, 4);
  });

  it('בדירה שאינה ראשונה אין פטור ולכן אין שורה כזו', () => {
    const input = base();
    const r = analyze({ ...input, tax: { ...input.tax, isSingleApartment: false } }, defaultAssumptions());
    expect(r.saleSchedule.some((x) => x.label === 'כניסת הפטור ממס שבח')).toBe(false);
  });

  it('הטבלה נשארת ממוינת לפי תאריך', () => {
    const r = analyze(base(), defaultAssumptions());
    const dates = r.saleSchedule.map((x) => x.saleDate);
    expect([...dates].sort()).toEqual(dates);
  });
});
