import { describe, expect, it } from 'vitest';
import { buildTrackSchedule, spitzerMonthlyPayment } from '../mortgage';
import type { LoanTrack } from '@/types/property';

/**
 * השוואת קרן שווה מול שפיצר.
 *
 * למה: שתי השיטות נתמכות במנוע, אבל רק שפיצר מכוסה בפועל. קרן שווה היא
 * השיטה שבה ההחזר הראשון הכי גבוה - בדיוק המספר שקובע אם המשקיע עומד
 * בתזרים. אם היא מחושבת לא נכון, כל התזרים של העסקה שגוי.
 */

const PRINCIPAL = 1_000_000;
const RATE = 5;
const TERM = 20 * 12;

function track(over: Partial<LoanTrack>): LoanTrack {
  return {
    id: 't',
    label: 'מסלול',
    principal: PRINCIPAL,
    annualRatePct: RATE,
    termMonths: TERM,
    amortization: 'spitzer',
    linkage: 'fixedUnlinked',
    ...over,
  };
}

const spitzer = buildTrackSchedule(track({ amortization: 'spitzer' }));
const equal = buildTrackSchedule(track({ id: 'e', amortization: 'equalPrincipal' }));

describe('קרן שווה מול שפיצר', () => {
  it('בשפיצר ההחזר החודשי קבוע לכל אורך התקופה', () => {
    expect(spitzer.firstPayment).toBeCloseTo(spitzerMonthlyPayment(PRINCIPAL, RATE, TERM), 2);
    // החודש האחרון עשוי לסטות באגורות בגלל סגירת היתרה המדויקת.
    const middle = spitzer.rows.slice(0, spitzer.rows.length - 1);
    for (const row of middle) {
      expect(row.payment).toBeCloseTo(spitzer.firstPayment, 2);
    }
  });

  it('בקרן שווה ההחזר הראשון גבוה מהאחרון', () => {
    expect(equal.firstPayment).toBeGreaterThan(equal.lastPayment);
    // הקרן קבועה, כך שכל הפער נובע מהריבית על היתרה היורדת.
    const firstRow = equal.rows[0];
    const lastRow = equal.rows[equal.rows.length - 1];
    expect(firstRow).toBeDefined();
    expect(lastRow).toBeDefined();
    if (!firstRow || !lastRow) return;
    // החודש האחרון סוגר את היתרה במדויק, ולכן הוא סופג את סחיפת העיגול
    // של 240 חודשים. סטייה של עד שקל היא התנהגות מכוונת ולא שגיאה.
    expect(Math.abs(firstRow.principal - lastRow.principal)).toBeLessThan(1);
    expect(firstRow.interest).toBeGreaterThan(lastRow.interest);
  });

  it('רכיב הקרן בשפיצר עולה מחודש לחודש', () => {
    const firstRow = spitzer.rows[0];
    const midRow = spitzer.rows[119];
    expect(firstRow).toBeDefined();
    expect(midRow).toBeDefined();
    if (!firstRow || !midRow) return;
    expect(midRow.principal).toBeGreaterThan(firstRow.principal);
  });

  it('ההחזר הראשון בקרן שווה גבוה מההחזר הקבוע בשפיצר', () => {
    expect(equal.firstPayment).toBeGreaterThan(spitzer.firstPayment);
  });

  it('סך הריבית בקרן שווה נמוך מבשפיצר באותה קרן ובאותה ריבית', () => {
    expect(equal.totalInterest).toBeLessThan(spitzer.totalInterest);
    expect(equal.totalPaid).toBeLessThan(spitzer.totalPaid);
  });

  it('הקרן מתאפסת בדיוק בסוף התקופה בשתי השיטות', () => {
    for (const schedule of [spitzer, equal]) {
      expect(schedule.rows).toHaveLength(TERM);
      expect(schedule.rows[TERM - 1]?.balance).toBe(0);
      const principalSum = schedule.rows.reduce((s, r) => s + r.principal, 0);
      expect(principalSum).toBeCloseTo(PRINCIPAL, 2);
    }
  });

  it('סך התשלומים שווה לקרן ועוד הריבית, בשתי השיטות', () => {
    for (const schedule of [spitzer, equal]) {
      expect(schedule.totalPaid).toBeCloseTo(PRINCIPAL + schedule.totalInterest, 1);
    }
  });

  it('בריבית 0 שתי השיטות מחזירות החזר זהה וקבוע וללא ריבית', () => {
    const z0 = buildTrackSchedule(track({ annualRatePct: 0, amortization: 'spitzer' }));
    const z1 = buildTrackSchedule(
      track({ id: 'z1', annualRatePct: 0, amortization: 'equalPrincipal' }),
    );
    expect(z0.totalInterest).toBe(0);
    expect(z1.totalInterest).toBe(0);
    expect(z0.firstPayment).toBeCloseTo(PRINCIPAL / TERM, 2);
    expect(z1.firstPayment).toBeCloseTo(PRINCIPAL / TERM, 2);
    expect(Math.abs(z0.firstPayment - z0.lastPayment)).toBeLessThan(1);
    expect(z0.totalPaid).toBeCloseTo(PRINCIPAL, 2);
    expect(z1.totalPaid).toBeCloseTo(PRINCIPAL, 2);
    expect(z1.rows[TERM - 1]?.balance).toBe(0);
  });

  it('תקופה של חודש אחד מסלקת את כל הקרן מיד', () => {
    const one = buildTrackSchedule(track({ id: 'one', termMonths: 1, amortization: 'equalPrincipal' }));
    expect(one.rows).toHaveLength(1);
    expect(one.rows[0]?.principal).toBeCloseTo(PRINCIPAL, 2);
    expect(one.rows[0]?.balance).toBe(0);
    // ריבית של חודש אחד על הקרן המלאה.
    expect(one.totalInterest).toBeCloseTo((PRINCIPAL * 0.05) / 12, 1);
  });
});
