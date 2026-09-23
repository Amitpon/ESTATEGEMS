import { describe, expect, it } from 'vitest';
import {
  calcRateSensitivity,
  defaultAcquisitionCosts,
  defaultAssumptions,
  defaultOperatingExpenses,
  DEFAULT_VACANCY_PCT,
  DEFAULT_RATE_DELTAS,
} from '../index';
import type { PropertyInput } from '@/types/property';

function input(overrides: Partial<PropertyInput['financing']> = {}): PropertyInput {
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
      ...overrides,
    },
    income: { monthlyRent: 5_500, vacancyPct: DEFAULT_VACANCY_PCT },
    expenses: defaultOperatingExpenses(),
    acquisitionCosts: defaultAcquisitionCosts(price),
    tax: { isSingleApartment: true, rentalTaxTrack: 'exempt', marginalTaxRatePct: 31 },
  };
}

describe('calcRateSensitivity', () => {
  it('מחזיר שורה לכל דלתא ברירת המחדל', () => {
    const rows = calcRateSensitivity(input(), defaultAssumptions());
    expect(rows).toHaveLength(DEFAULT_RATE_DELTAS.length);
  });

  it('השורה עם דלתא 0 משקפת בדיוק את הריבית שהוזנה', () => {
    const rows = calcRateSensitivity(input(), defaultAssumptions());
    const zero = rows.find((r) => r.deltaPct === 0);
    expect(zero?.ratePct).toBe(4.5);
  });

  it('ריבית גבוהה יותר -> תזרים חודשי נמוך יותר (מונוטוני יורד)', () => {
    const rows = calcRateSensitivity(input(), defaultAssumptions());
    const sorted = [...rows].sort((a, b) => a.deltaPct - b.deltaPct);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      expect(cur.monthlyCashflow).toBeLessThanOrEqual(prev.monthlyCashflow);
    }
  });

  it('ריבית גבוהה יותר -> כיסוי נמוך יותר', () => {
    const rows = calcRateSensitivity(input(), defaultAssumptions());
    const sorted = [...rows].sort((a, b) => a.deltaPct - b.deltaPct);
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    expect(last.coveragePct).toBeLessThan(first.coveragePct);
  });

  it('ריבית לא יורדת מתחת לגבול המינימום גם בדלתא שלילית קיצונית', () => {
    // ריבית מוצא נמוכה + דלתא שלילית גדולה עלולה לצאת שלילית בלי החיתוך.
    const rows = calcRateSensitivity(
      input(),
      defaultAssumptions(),
      [-10],
    );
    expect(rows[0]?.ratePct).toBeGreaterThan(0);
  });

  it('בלי משכנתא כלל (תשלום מלא מהון עצמי) - מחזיר מערך ריק', () => {
    const cashOnly = input({ tracks: [] });
    // downPayment צריך להיות המחיר המלא כדי שהעסקה תהיה תקינה.
    const full: PropertyInput = {
      ...cashOnly,
      financing: { ...cashOnly.financing, downPayment: cashOnly.property.price, tracks: [] },
    };
    const rows = calcRateSensitivity(full, defaultAssumptions());
    expect(rows).toHaveLength(0);
  });

  it('דלתא מותאמת אישית נבחרת כמו שנשלחה', () => {
    const rows = calcRateSensitivity(input(), defaultAssumptions(), [0, 3]);
    expect(rows.map((r) => r.deltaPct)).toEqual([0, 3]);
    expect(rows[1]?.ratePct).toBeCloseTo(7.5, 5);
  });
});
