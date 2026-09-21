/**
 * @vitest-environment jsdom
 *
 * בדיקה מקצה לקצה: לחיצה על כפתור ההדפסה במסך האמיתי חייבת לפתוח את
 * כל הסקשנים המקופלים. זה הבאג שהמשתמש דיווח עליו - הדוח יצא חסר.
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

describe('הדפסת הדוח מהמסך', () => {
  it('לחיצה על הכפתור פותחת את כל הסקשנים בזמן ההדפסה', () => {
    render(<App />);

    const before = Array.from(document.querySelectorAll('details'));
    const closedBefore = before.filter((d) => !d.open);
    // אם אין סקשן סגור, הטסט חסר משמעות.
    expect(closedBefore.length).toBeGreaterThan(0);

    let closedDuringPrint = -1;
    vi.spyOn(window, 'print').mockImplementation(() => {
      closedDuringPrint = Array.from(document.querySelectorAll('details')).filter(
        (d) => !d.open,
      ).length;
    });

    screen.getByRole('button', { name: /הדפסה/ }).click();

    // הבדיקה: בזמן ההדפסה אף סקשן לא היה סגור.
    expect(closedDuringPrint).toBe(0);
    // השחזור קורה על afterprint, לא סינכרונית - אחרת דפדפן שבו print()
    // חוזר מיד היה סוגר את הסקשנים לפני שצילם את העמוד.
    window.dispatchEvent(new Event('afterprint'));
    const closedAfter = Array.from(document.querySelectorAll('details')).filter(
      (d) => !d.open,
    );
    expect(closedAfter.length).toBe(closedBefore.length);
  });
});
