/**
 * טסטים ל-buildShimshonContext, ממוקדים בפרמטר market שנוסף.
 *
 * הכלל שהטסטים האלה שומרים עליו: **שום מספר לא מגיע לשמשון בלי הקשר
 * מפורש**. אם market לא נמסר, אין בהקשר אזכור שכונה בכלל - שמשון לא
 * יכול "לזכור" נתון שלא קיבל.
 */
import { describe, it, expect } from 'vitest';
import { buildShimshonContext } from '../shimshon';
import { analyze, defaultAcquisitionCosts, defaultAssumptions, defaultOperatingExpenses, DEFAULT_VACANCY_PCT } from '@/lib/calc';
import type { PropertyInput } from '@/types/property';
import type { MarketInsights } from '@/lib/market/insights';

function baseInput(): PropertyInput {
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

function fakeInsights(): MarketInsights {
  return {
    medianPricePerSqm: {
      value: 25_000,
      asOf: '2026-06-30',
      source: 'https://www.govmap.gov.il/',
      verified: false,
      note: 'נתוני עסקאות רשות המסים דרך govmap.gov.il',
    },
    p25PricePerSqm: 22_000,
    p75PricePerSqm: 28_000,
    dealCount: 12,
    dateRange: { from: '2024-01-01', to: '2026-06-30' },
    trend: {
      changePct: 5,
      direction: 'up',
      olderMedian: 24_000,
      recentMedian: 25_200,
      olderCount: 6,
      recentCount: 6,
      label: 'המחירים עלו ב-5% בתקופה הנסקרת',
    },
  };
}

describe('buildShimshonContext - market', () => {
  it('בלי market, ההקשר לא מזכיר שכונה בכלל', () => {
    const input = baseInput();
    const r = analyze(input, defaultAssumptions());
    const ctx = buildShimshonContext(input, r);
    expect(ctx).not.toContain('שוק בשכונה');
    expect(ctx).not.toContain('govmap');
  });

  it('עם market, ההקשר כולל חציון, מספר עסקאות, וסטייה מהחציון', () => {
    const input = baseInput();
    const r = analyze(input, defaultAssumptions());
    const insights = fakeInsights();
    // 2,000,000 / 80 מ"ר = 25,000 - בדיוק על החציון
    const ctx = buildShimshonContext(input, r, { insights, subjectPricePerSqm: 25_000 });

    expect(ctx).toContain('נתוני שוק בשכונה');
    expect(ctx).toContain('12 עסקאות');
    expect(ctx).toContain('+0%');
    expect(ctx).toContain('המחירים עלו ב-5%');
    expect(ctx).toContain('לא תחזית');
  });

  it('מחשב נכון סטייה חיובית ושלילית מהחציון', () => {
    const input = baseInput();
    const r = analyze(input, defaultAssumptions());
    const insights = fakeInsights();

    const expensive = buildShimshonContext(input, r, { insights, subjectPricePerSqm: 30_000 });
    expect(expensive).toContain('+20%');

    const cheap = buildShimshonContext(input, r, { insights, subjectPricePerSqm: 20_000 });
    expect(cheap).toContain('-20%');
  });

  it('כשאין מגמה (null), ההקשר אומר זאת במפורש ולא משתיק את זה', () => {
    const input = baseInput();
    const r = analyze(input, defaultAssumptions());
    const insights = { ...fakeInsights(), trend: null };
    const ctx = buildShimshonContext(input, r, { insights, subjectPricePerSqm: 25_000 });
    expect(ctx).toContain('אין מספיק נתונים כדי לתאר מגמה');
  });
});
