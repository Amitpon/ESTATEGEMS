/**
 * @vitest-environment jsdom
 *
 * הדוח המודפס הוא תוכן נפרד מהמסך. הטסט מוודא שהוא קיים ב-DOM, שהוא
 * מוסתר מהמשתמש, ושהוא מכיל את הסקשנים שבעל המוצר ביקש - מספרי מפתח
 * והשוואת תרחישים - ולא את מה שביקש להשמיט.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import App from '../App';

beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

describe('הדוח המודפס', () => {
  it('קיים ב-DOM אבל מוסתר מהמסך', () => {
    render(<App />);
    const report = document.querySelector('[data-print-report]');
    expect(report, 'הדוח חייב להיות ב-DOM כדי שההדפסה תמצא אותו').toBeTruthy();
    expect(report?.hasAttribute('hidden'), 'ומוסתר על המסך').toBe(true);
  });

  it('מכיל את סקשני המפתח', () => {
    render(<App />);
    const text = document.querySelector('[data-print-report]')?.textContent ?? '';
    for (const section of [
      'מספרי מפתח',
      'ההון ביום 1',
      'השוואת תרחישים',
      'נקודות מכירה נבחרות',
      'מה ראוי לשים לב אליו',
    ]) {
      expect(text, `הדוח חייב לכלול: ${section}`).toContain(section);
    }
  });

  it('קומפקטי - לא יותר מ-6 שורות בטבלת המכירה', () => {
    render(<App />);
    const report = document.querySelector('[data-print-report]');
    const tables = report?.querySelectorAll('table') ?? [];
    const saleTable = tables[tables.length - 1];
    const rows = saleTable?.querySelectorAll('tbody tr') ?? [];
    // בעל המוצר ביקש "לא את כל הבלאגן". ארבע נקודות מייצגות, לא 10.
    expect(rows.length).toBeLessThanOrEqual(6);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('אינו מכיל את לוח הסילוקין המלא', () => {
    render(<App />);
    const text = document.querySelector('[data-print-report]')?.textContent ?? '';
    // 300 שורות חודשיות אינן שייכות לדוח.
    expect(text).not.toContain('חודש 120');
  });
});
