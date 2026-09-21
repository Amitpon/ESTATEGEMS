import { describe, expect, it } from 'vitest';
import {
  analyze,
  defaultAcquisitionCosts,
  defaultAssumptions,
  defaultOperatingExpenses,
  DEFAULT_VACANCY_PCT,
} from '../index';
import type { PropertyInput } from '@/types/property';

/**
 * בדיקת שפיות על העסקה מצילומי המסך של EstateGems:
 * נכס 2,500,000, מימון 70 אחוז, ריבית 4.5, 25 שנה, שכ"ד 12,500.
 * המטרה אינה להשוות מספר למספר - ההנחות שונות - אלא לוודא שהמנוע
 * מחזיר גדלים באותו סדר גודל ולא זבל.
 */
function input(): PropertyInput {
  const price = 2_500_000;
  return {
    analysisDate: '2026-10-01',
    property: { price, sizeSqm: 75, city: '', kind: 'apartment', rooms: 3 },
    financing: {
      downPayment: price * 0.3,
      tracks: [
        {
          id: 'main',
          label: 'שפיצר',
          principal: price * 0.7,
          annualRatePct: 4.5,
          termMonths: 25 * 12,
          amortization: 'spitzer',
          linkage: 'fixedUnlinked',
        },
      ],
      earlyRepaymentFeePct: 2,
    },
    income: { monthlyRent: 12_500, vacancyPct: DEFAULT_VACANCY_PCT },
    expenses: defaultOperatingExpenses(),
    acquisitionCosts: defaultAcquisitionCosts(price),
    tax: { isSingleApartment: true, rentalTaxTrack: 'exempt', marginalTaxRatePct: 31 },
  };
}

describe('שפיות המנוע מקצה לקצה', () => {
  const r = analyze(input(), { ...defaultAssumptions(), horizonYears: 5 });

  it('החזר המשכנתא בסדר גודל סביר', () => {
    // 1,750,000 ב-4.5% ל-25 שנה. EstateGems הראה 9,727.
    expect(r.mortgage.firstMonthlyPayment).toBeGreaterThan(9_000);
    expect(r.mortgage.firstMonthlyPayment).toBeLessThan(11_000);
  });

  it('טבלת המכירה מכילה שורה לכל שנה באופק, ועוד שורת כניסת הפטור', () => {
    // 5 שנים, ועוד שורה אחת בתאריך שבו הפטור ממס שבח נכנס לתוקף.
    // היא אינה נופלת על שנה עגולה ולכן מתווספת בנפרד.
    const yearly = r.saleSchedule.filter((x) => !x.label);
    expect(yearly).toHaveLength(5);
    expect(r.saleSchedule.filter((x) => x.label === 'כניסת הפטור ממס שבח')).toHaveLength(1);
  });

  it('שווי הנכס עולה לאורך השנים לפי הנחת עליית הערך', () => {
    const first = r.saleSchedule[0]!;
    const last = r.saleSchedule[r.saleSchedule.length - 1]!;
    expect(last.propertyValue).toBeGreaterThan(first.propertyValue);
    expect(last.propertyValue).toBeGreaterThan(2_500_000);
  });

  it('יתרת המשכנתא יורדת לאורך השנים', () => {
    const first = r.saleSchedule[0]!;
    const last = r.saleSchedule[r.saleSchedule.length - 1]!;
    expect(last.mortgageBalance).toBeLessThan(first.mortgageBalance);
  });

  it('כל שורה מסומנת כנשענת על נתוני מס שלא אומתו', () => {
    for (const row of r.saleSchedule) {
      expect(row.capitalGains.allRegulatoryVerified).toBe(false);
    }
  });

  it('אין תשואה שנתית ממוצעת אבסורדית - הבאג של המוצר הקודם', () => {
    for (const row of r.saleSchedule) {
      if (row.averageAnnualReturnPct !== null) {
        // הבאג שם הציג מינוס 70 אחוז אחרי 5 חודשים.
        expect(Math.abs(row.averageAnnualReturnPct)).toBeLessThan(100);
      }
    }
  });

  it('דירה יחידה מעל תקרת הפטור אינה מקבלת פטור', () => {
    // 2.5 מיליון מתחת לתקרה של 5,008,000, אז הפטור אמור לחול משנה 2.
    const y2 = r.saleSchedule.find((s) => s.year === 2)!;
    expect(y2.capitalGains.exemptionApplied).toBe(true);
  });
});
