import { describe, expect, it } from 'vitest';
import {
  analyze,
  defaultAcquisitionCosts,
  defaultAssumptions,
  defaultOperatingExpenses,
  DEFAULT_VACANCY_PCT,
} from '../index';
import { buildInsights } from '@/components/ReportInsights';
import type { PropertyInput } from '@/types/property';

/**
 * התובנות של הדוח המודפס.
 *
 * למה: הדוח חייב להיות דטרמיניסטי - אותם נתונים, אותן תובנות. התובנה
 * שהכי קל לטעות בה היא סימון התזרים, כי היא זו שצובעת את הדוח באזהרה.
 * תזרים שלילי שמוצג כתקין הוא הטעיה של המשקיע.
 */

function input(monthlyRent: number, ltvPct: number): PropertyInput {
  const price = 2_500_000;
  return {
    analysisDate: '2026-01-01',
    property: { price, sizeSqm: 80, city: '', kind: 'apartment', rooms: 3 },
    financing: {
      ltvPct,
      tracks: [
        {
          id: 'main',
          label: 'שפיצר',
          principal: price * (ltvPct / 100),
          annualRatePct: 5,
          termMonths: 25 * 12,
          amortization: 'spitzer',
          linkage: 'fixedUnlinked',
        },
      ],
      earlyRepaymentFeePct: 2,
    },
    income: { monthlyRent, vacancyPct: DEFAULT_VACANCY_PCT },
    expenses: defaultOperatingExpenses(),
    acquisitionCosts: defaultAcquisitionCosts(price),
    tax: { isSingleApartment: true, rentalTaxTrack: 'exempt', marginalTaxRatePct: 31 },
  };
}

const negative = buildInsights(analyze(input(4_000, 70), defaultAssumptions()));
const positive = buildInsights(analyze(input(14_000, 25), defaultAssumptions()));

describe('תובנות הדוח', () => {
  it('תזרים שלילי מייצר תובנת אזהרה', () => {
    const cf = negative.find((i) => i.title.includes('התזרים'));
    expect(cf?.title).toBe('התזרים שלילי');
    expect(cf?.tone).toBe('watch');
  });

  it('תזרים חיובי אינו מייצר אזהרה', () => {
    const cf = positive.find((i) => i.title.includes('התזרים'));
    expect(cf?.title).toBe('התזרים חיובי');
    expect(cf?.tone).toBe('neutral');
  });

  it('שכירות שאינה מכסה את ההחזר מסומנת לבדיקה', () => {
    const cov = negative.find((i) => i.title.includes('מההחזר'));
    expect(cov?.tone).toBe('watch');
  });

  it('שכירות שמכסה את ההחזר אינה מסומנת לבדיקה', () => {
    const cov = positive.find((i) => i.title.includes('מההחזר'));
    expect(cov?.tone).toBe('neutral');
  });

  it('תובנת ההנחות מופיעה תמיד - הכלי אינו מנבא', () => {
    for (const set of [negative, positive]) {
      const assumption = set.find((i) => i.title === 'המספרים תלויים בהנחות שלך');
      expect(assumption?.tone).toBe('watch');
    }
  });

  it('אין em-dash בשום תובנה', () => {
    for (const i of [...negative, ...positive]) {
      expect(i.title).not.toMatch(/[—–]/);
      expect(i.body).not.toMatch(/[—–]/);
    }
  });

  it('בעסקה ללא משכנתא אין תובנת ריבית ואין תובנת כיסוי החזר', () => {
    const cash = buildInsights(analyze(input(9_000, 0), defaultAssumptions()));
    expect(cash.some((i) => i.title.includes('הריבית לאורך'))).toBe(false);
    expect(cash.some((i) => i.title.includes('מההחזר'))).toBe(false);
  });
});
