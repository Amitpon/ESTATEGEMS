/**
 * @vitest-environment jsdom
 *
 * הבאג שהטסט הזה שומר עליו: `print:open` ב-Tailwind אינו מייצר CSS
 * (`open` היא תכונת HTML ולא תכונת CSS), ולכן סקשנים מקופלים הודפסו
 * סגורים והדוח יצא חסר. הפתרון הוא JS, והטסט מאמת שהוא פותח **ומשחזר**.
 */
import { describe, it, expect, vi } from 'vitest';
import { printReport } from '../print';

describe('printReport', () => {
  it('פותח details סגור לפני ההדפסה ומחזיר אותו לסגור אחריה', () => {
    document.body.innerHTML = `
      <details id="a"><summary>א</summary><p>תוכן א</p></details>
      <details id="b" open><summary>ב</summary><p>תוכן ב</p></details>
    `;
    const a = document.getElementById('a') as HTMLDetailsElement;
    const b = document.getElementById('b') as HTMLDetailsElement;

    let openDuringPrint: boolean | null = null;
    let afterPrint: null | (() => void) = null;
    const win = {
      print: () => {
        openDuringPrint = a.open;
      },
      document,
      addEventListener: (_: string, h: () => void) => {
        afterPrint = h as () => void;
      },
      removeEventListener: vi.fn(),
      // ה-fallback ארוך ולא אמור לרוץ בטסט הזה.
      setTimeout: () => 0,
    } as unknown as Window;

    expect(a.open).toBe(false);
    expect(printReport(win)).toBe(true);

    // הבדיקה המרכזית: בזמן ההדפסה הסקשן היה פתוח.
    expect(openDuringPrint).toBe(true);
    // **ונשאר פתוח** עד שהדפדפן מודיע שסיים. שחזור סינכרוני כאן היה
    // סוגר אותו לפני הצילום בדפדפנים שבהם print() חוזר מיד.
    expect(a.open).toBe(true);

    // השחזור קורה על afterprint.
    ;(afterPrint as (() => void) | null)?.();
    expect(a.open).toBe(false);
    // מי שהיה פתוח מראש נשאר פתוח.
    expect(b.open).toBe(true);
  });

  it('לא נופל כשאין details בעמוד', () => {
    document.body.innerHTML = '<p>בלי סקשנים</p>';
    let called = 0;
    const win = {
      print: () => {
        called += 1;
      },
      document,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout: () => 0,
    } as unknown as Window;
    expect(printReport(win)).toBe(true);
    expect(called).toBe(1);
  });

  it('מחזיר false כשאין תמיכה בהדפסה', () => {
    document.body.innerHTML = '';
    const win = { document } as unknown as Window;
    expect(printReport(win)).toBe(false);
  });

  it('השחזור אינו רץ פעמיים, גם כשגם afterprint וגם finally מפעילים אותו', () => {
    document.body.innerHTML = '<details id="a"><summary>א</summary><p>x</p></details>';
    const a = document.getElementById('a') as HTMLDetailsElement;
    // האנוטציה חייבת להיות מפורשת: ההשמה קורית בתוך callback,
    // ובלעדיה TypeScript מצמצם את הטיפוס ל-never.
    let handler: null | (() => void) = null;
    const win = {
      print: () => {},
      document,
      addEventListener: (_: string, h: () => void) => {
        handler = h as () => void;
      },
      removeEventListener: vi.fn(),
      setTimeout: () => 0,
    } as unknown as Window;

    printReport(win);
    ;(handler as (() => void) | null)?.();
    expect(a.open).toBe(false);

    // הפעלה חוזרת של ה-handler אסור שתשנה דבר. בלי ההגנה הזו, דפדפן
    // שמפעיל את שני המסלולים היה סוגר סקשן שהמשתמש פתח בינתיים.
    a.open = true;
    ;(handler as (() => void) | null)?.();
    expect(a.open).toBe(true);
  });
});
