/**
 * הדפסת הדוח.
 *
 * ## למה זה לא סתם `window.print()`
 *
 * המסך בנוי מ-`<details>` מקופלים ומשני שלבים שרק אחד מהם גלוי במובייל.
 * קריאה ישירה ל-`window.print()` מדפיסה **רק את מה שפתוח** - כלומר דוח
 * חסר, ולפעמים כמעט ריק.
 *
 * הניסיון הראשון היה לפתוח אותם ב-CSS דרך `print:open`. זה לא עובד:
 * `open` הוא **תכונת HTML ולא תכונת CSS**, והכלל פשוט לא נוצר. אין דרך
 * ב-CSS לפתוח `<details>` סגור בצורה אמינה בכל הדפדפנים.
 *
 * לכן הפתרון הוא JS: פותחים הכל, מדפיסים, ומחזירים למצב הקודם.
 *
 * ## למה השחזור אסינכרוני
 *
 * מפתה לשחזר מיד אחרי `window.print()`. זו טעות: ברוב הדפדפנים הקריאה
 * חוסמת עד סגירת הדיאלוג, אבל **בספארי ובחלק מהמובייל היא חוזרת מיד**.
 * שחזור סינכרוני שם היה סוגר את הסקשנים **לפני** שהדפדפן מצלם את העמוד,
 * כלומר מחזיר בדיוק את הבאג שבאנו לתקן.
 *
 * לכן השחזור תלוי ב-`afterprint`, עם timeout ארוך כרשת ביטחון למקרה
 * שהאירוע לא נורה כלל. שניהם מוגנים מפני הרצה כפולה.
 */

/**
 * כמה לחכות לשחזור כשהאירוע `afterprint` לא נורה.
 * ארוך מספיק שלא יקטע דיאלוג הדפסה אמיתי, קצר מספיק שהמסך לא ייתקע.
 */
const RESTORE_FALLBACK_MS = 60_000;

/** מחזיר פונקציית שחזור למצב שלפני הפתיחה. */
function openAllDetails(root: Document): () => void {
  const all = Array.from(root.querySelectorAll('details'));
  // נשמר רק מה שהיה **סגור**, כי רק אותו צריך לסגור בחזרה.
  const wasClosed = all.filter((d) => !d.open);
  for (const d of wasClosed) d.open = true;

  return () => {
    for (const d of wasClosed) d.open = false;
  };
}

/**
 * מדפיס את הדוח עם כל הסקשנים פתוחים.
 *
 * @param win חלון היעד. פרמטר כדי שאפשר יהיה לבדוק את הפונקציה.
 * @returns true אם ההדפסה הופעלה.
 */
export function printReport(win: Window = window): boolean {
  if (typeof win.print !== 'function') return false;

  const restore = openAllDetails(win.document);

  let restored = false;
  const restoreOnce = () => {
    if (restored) return;
    restored = true;
    restore();
    win.removeEventListener('afterprint', restoreOnce);
  };

  win.addEventListener('afterprint', restoreOnce);

  // רשת ביטחון: אם afterprint לא נורה כלל (קורה בחלק מהמובייל), המסך
  // לא יישאר פתוח לנצח. ארוך מספיק כדי לא לקטוע הדפסה אמיתית.
  win.setTimeout(restoreOnce, RESTORE_FALLBACK_MS);

  // רינדור מחדש אחרי פתיחת ה-details, לפני שהדפדפן מצלם את העמוד.
  void win.document.body.offsetHeight;
  win.print();
  return true;
}
