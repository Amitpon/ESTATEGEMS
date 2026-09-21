import { describe, expect, it } from 'vitest';
import {
  analyze,
  defaultAcquisitionCosts,
  defaultAssumptions,
  defaultOperatingExpenses,
  DEFAULT_VACANCY_PCT,
} from '../index';
import type { PaymentScheduleInput, PropertyInput } from '@/types/property';

/**
 * מקרי הקצה של הזרקת שורת כניסת הפטור ממס שבח.
 *
 * למה: השורה הזו היא היחידה בטבלה שלא מגיעה ישירות מההרצה השנתית, ולכן
 * היא הנקודה שבה קל ביותר לייצר שורה כפולה, שורה מחוץ לטווח, או קריסה
 * על תאריך לא תקין. המשקיע מקבל החלטת מכירה לפי השורה הזו.
 */

const LABEL = 'כניסת הפטור ממס שבח';

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

/** לוח תשלומים מקבלן, שכל תפקידו כאן הוא לשאת תאריך אכלוס. */
function schedule(occupancyDate: string | undefined): PaymentScheduleInput {
  return {
    ...(occupancyDate ? { occupancyDate: occupancyDate as PaymentScheduleInput['occupancyDate'] } : {}),
    stages: [
      {
        id: 's1',
        label: 'חוזה',
        percentOfPrice: 50,
        dueDate: '2026-01-01',
        linkedToIndex: false,
        fundingSource: 'equity',
      },
      {
        id: 's2',
        label: 'מסירה',
        percentOfPrice: 50,
        dueDate: '2027-01-01',
        linkedToIndex: false,
        fundingSource: 'mortgage',
      },
    ],
    indexationMode: 'off',
    assumedIndexChangePct: 0,
  };
}

describe('מקרי קצה של שורת כניסת הפטור', () => {
  it('אין שורת פטור כשהיא נופלת מעבר לאופק הבדיקה', () => {
    // אכלוס ב-2030 פירושו פטור ב-2031, הרבה אחרי אופק של 3 שנים.
    const r = analyze(
      { ...base(), paymentSchedule: schedule('2030-06-01') },
      { ...defaultAssumptions(), horizonYears: 3 },
    );
    expect(r.saleSchedule.some((x) => x.label === LABEL)).toBe(false);
    expect(r.saleSchedule).toHaveLength(3);
  });

  it('אין שורה כפולה כשהפטור נופל בדיוק על שנה עגולה', () => {
    // אכלוס 18 חודשים אחרי הרכישה מציב את הפטור בדיוק על שנה 3.
    const r = analyze(
      { ...base(), paymentSchedule: schedule('2027-07-01') },
      { ...defaultAssumptions(), horizonYears: 6 },
    );
    expect(r.saleSchedule.some((x) => x.label === LABEL)).toBe(false);
    expect(r.saleSchedule).toHaveLength(6);
    // ושנה 3 עצמה מופיעה פעם אחת בלבד.
    expect(r.saleSchedule.filter((x) => x.year === 3)).toHaveLength(1);
  });

  it('באופק של שנה אחת אין מה לשרבב - אין מספיק שורות לאינטרפולציה', () => {
    const r = analyze(base(), { ...defaultAssumptions(), horizonYears: 1 });
    expect(r.saleSchedule).toHaveLength(1);
    expect(r.saleSchedule.some((x) => x.label === LABEL)).toBe(false);
  });

  it('תאריך אכלוס לא תקין לא מפיל את הניתוח ולא מוסיף שורה', () => {
    const r = analyze(
      { ...base(), paymentSchedule: schedule('לא-תאריך') },
      { ...defaultAssumptions(), horizonYears: 5 },
    );
    expect(r.saleSchedule).toHaveLength(5);
    expect(r.saleSchedule.some((x) => x.label === LABEL)).toBe(false);
  });

  it('ערכי שורת הפטור נמצאים בין שתי השנים הסמוכות', () => {
    // האינטרפולציה חייבת להיות מונוטונית - אחרת המשקיע רואה קפיצת שווי
    // מלאכותית בדיוק בנקודה שהוא שוקל למכור בה.
    const r = analyze(base(), { ...defaultAssumptions(), horizonYears: 5 });
    const row = r.saleSchedule.find((x) => x.label === LABEL);
    expect(row).toBeDefined();
    if (!row) return;

    const y1 = r.saleSchedule.find((x) => x.year === 1);
    const y2 = r.saleSchedule.find((x) => x.year === 2);
    expect(y1).toBeDefined();
    expect(y2).toBeDefined();
    if (!y1 || !y2) return;

    expect(row.year).toBeCloseTo(1.5, 1);
    expect(row.propertyValue).toBeGreaterThan(y1.propertyValue);
    expect(row.propertyValue).toBeLessThan(y2.propertyValue);
    expect(row.mortgageBalance).toBeLessThan(y1.mortgageBalance);
    expect(row.mortgageBalance).toBeGreaterThan(y2.mortgageBalance);
  });

  it('בשורת הפטור הפטור כבר חל, ובשנה שלפניה עוד לא', () => {
    const r = analyze(base(), { ...defaultAssumptions(), horizonYears: 5 });
    const row = r.saleSchedule.find((x) => x.label === LABEL);
    const y1 = r.saleSchedule.find((x) => x.year === 1);
    expect(row?.capitalGains.exemptionApplied).toBe(true);
    expect(y1?.capitalGains.exemptionApplied).toBe(false);
  });
});
