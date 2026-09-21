/**
 * בדיקת עשן ל-handler של שמשון.
 *
 * מריץ את הפונקציה עצמה, לא רק את ה-API. בודק את כל השרשרת:
 * ולידציה, מכסה, קריאה למודל, והזרמה חזרה.
 *
 * `getStore` של נטליפיי לא זמין מחוץ לסביבה שלהם - הקוד אמור לתפוס את זה
 * ולהמשיך. זה בדיוק מה שנבדק כאן.
 *
 * הרצה: npm run smoke:shimshon
 */

import handler from '../netlify/functions/shimshon.mts';

function req(body) {
  return new Request('http://localhost/api/shimshon', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': '127.0.0.1' },
    body: JSON.stringify(body),
  });
}

const CONTEXT = `## התזרים החודשי
- שכר דירה ברוטו: 4,800 ₪
- החזר משכנתא: 5,620 ₪
- תזרים נקי: -1,430 ₪`;

let failed = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? '[עבר] ' : '[נכשל]'} ${name}${detail ? ' - ' + detail : ''}`);
  if (!cond) failed++;
}

// 1. ולידציה - שאלה ריקה
const r1 = await handler(req({ question: '', context: '' }));
check('שאלה ריקה נדחית ב-400', r1.status === 400);

// 2. ולידציה - שאלה ארוכה מדי
const r2 = await handler(req({ question: 'א'.repeat(1001), context: '' }));
check('שאלה ארוכה מדי נדחית ב-400', r2.status === 400);

// 3. שיטה לא נתמכת
const r3 = await handler(new Request('http://localhost/api/shimshon', { method: 'GET' }));
check('GET נדחה ב-405', r3.status === 405);

// 4. הזרמה אמיתית מקצה לקצה
const r4 = await handler(req({ question: 'למה התזרים שלי שלילי?', context: CONTEXT }));
check('בקשה תקינה מחזירה 200', r4.status === 200, `status=${r4.status}`);

if (r4.status === 200) {
  const text = await r4.text();
  check('התקבל טקסט', text.length > 20, `${text.length} תווים`);
  check('התשובה בעברית', /[֐-׿]/.test(text));
  check('אין em-dash', !text.includes('—'));
  check('כותרת מכסה קיימת', r4.headers.get('x-shimshon-remaining') !== null);
  console.log('\n--- תשובת שמשון ---\n' + text.trim() + '\n');
} else {
  console.log('גוף השגיאה:', await r4.text());
}

console.log(failed === 0 ? 'הכל עבר.' : `${failed} בדיקות נכשלו.`);
process.exit(failed === 0 ? 0 : 1);
