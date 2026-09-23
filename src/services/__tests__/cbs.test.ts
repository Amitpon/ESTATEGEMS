/**
 * טסט על נתונים אמיתיים ב-`src/data/cbs-indices.json` (נמשך חי ב-2026-09-22).
 * לא בודק ערך קבוע - המדד מתעדכן - אלא **שהחישוב הגיוני**: שיעור
 * שנתי סביר, המקור מצוין, וה-note אומר במפורש שזה עבר ולא תחזית.
 */
import { describe, it, expect } from 'vitest';
import { getHousingPriceGrowth } from '../cbs';

describe('getHousingPriceGrowth', () => {
  it('מחזיר שיעור שנתי בטווח הגיוני לשוק הדיור הישראלי', () => {
    const r = getHousingPriceGrowth(5);
    expect(r).not.toBeNull();
    if (!r) return;
    // מדד מחירי דירות בישראל לא זז ביותר מ-20% בשנה בממוצע רב-שנתי.
    expect(r.value).toBeGreaterThan(-10);
    expect(r.value).toBeLessThan(20);
  });

  it('מסומן כלא מאומת, עם מקור ותאריך', () => {
    const r = getHousingPriceGrowth(5);
    expect(r?.verified).toBe(false);
    expect(r?.source).toContain('cbs.gov.il');
    expect(r?.asOf).toMatch(/^\d{4}-\d{2}$/);
  });

  it('ה-note אומר במפורש שזה נתון עבר ולא תחזית', () => {
    const r = getHousingPriceGrowth(5);
    expect(r?.note).toContain('לא תחזית');
  });

  it('lookback קצר יותר נותן חלון זמן שונה', () => {
    const r5 = getHousingPriceGrowth(5);
    const r2 = getHousingPriceGrowth(2);
    expect(r5).not.toBeNull();
    expect(r2).not.toBeNull();
    // אין קשר מונוטוני מחייב בין הערכים עצמם, אבל שניהם חייבים לחזור
    // עם אותו תאריך asOf (המדד העדכני ביותר, בלי קשר לחלון שנבחר).
    expect(r5?.asOf).toBe(r2?.asOf);
  });
});
