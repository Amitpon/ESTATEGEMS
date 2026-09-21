/**
 * @vitest-environment jsdom
 *
 * טסט רינדור של המסך כולו. הוא לא בודק מספרים - הוא בודק שהאפליקציה
 * עולה בלי שגיאת ריצה ושכל הסקשנים המרכזיים באמת מגיעים ל-DOM.
 * בלעדיו שינוי מבני עובר קומפילציה ונשבר רק אצל המשתמש.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

describe('רינדור המסך', () => {
  it('עולה בלי שגיאות ומציג את כל הסקשנים המרכזיים', () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => {
      errors.push(a.join(' '));
    });

    render(<App />);

    for (const heading of [
      'תזרים חודשי נטו',
      'לוח הסילוקין',
      'חלוקת תשלומים',
      'מתי משלמים ומה',
      'פרטי העסקה',
    ]) {
      expect(screen.getAllByText(new RegExp(heading)).length).toBeGreaterThan(0);
    }

    expect(errors).toEqual([]);
    spy.mockRestore();
  });

  it('מציג את שני שלבי הניווט ואת כפתור ההדפסה', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'הנתונים שלי' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'התוצאות' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /הדפסה/ })).toBeTruthy();
  });
});
