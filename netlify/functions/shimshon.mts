/**
 * שמשון - proxy לעוזר ה-AI.
 *
 * למה הפונקציה הזו קיימת: ה-API key של Anthropic לא יכול לשבת בצד לקוח.
 * כל מי שפותח DevTools היה גונב אותו ומחייב את בעל המוצר. זה החריג היחיד
 * להחלטת "אין backend" ב-CLAUDE.md, והוא מתועד שם ובעיקרון 4.
 *
 * הפונקציה לא מחשבת כלום. היא מקבלת מהלקוח את תוצאות מנוע החישוב כהקשר
 * ומעבירה אותן למודל כדי שינסח עליהן. זה מה שמונע משמשון להמציא מספרים.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

/**
 * המודל. הכרעת בעל המוצר, 2026-09-20: Haiku 4.5, פי 5 זול מ-Opus 5
 * ($1/$5 למיליון טוקן מול $5/$25).
 *
 * אזהרה למי שמשנה את זה: Haiku 4.5 הוא דור קודם ו**לא תומך**
 * ב-`output_config.effort` ולא ב-`thinking: { type: 'adaptive' }`.
 * שניהם מחזירים 400 בזמן ריצה, ו-TypeScript לא יתפוס אותם.
 * ראה את הקריאה למטה.
 */
const MODEL = 'claude-haiku-4-5-20251001';

/** תקרת שאלות יומית לכל מבקר. הכרעת בעל המוצר, 2026-09-20. */
const DAILY_QUESTION_LIMIT = 10;

/**
 * תקרות קלט. שומרות גם על העלות וגם על זמן התגובה.
 * הקשר גדול מדי הוא בדרך כלל סימן לבאג בלקוח, לא לשימוש לגיטימי.
 */
const MAX_QUESTION_CHARS = 1_000;
const MAX_CONTEXT_CHARS = 8_000;
const MAX_HISTORY_TURNS = 6;

/** שמשון עונה קצר בעברית. זו תקרה מכוונת, לא ניחוש. */
const MAX_OUTPUT_TOKENS = 2_048;

/**
 * הוראות שמשון. החלק הזה קבוע ולכן נשמר ב-prompt cache.
 * ה-cache עובד על התאמת prefix: כל שינוי בייט כאן פוסל את ה-cache לכולם.
 * אל תכניס לכאן תאריך, מספר רץ או כל דבר שמשתנה בין בקשות.
 */
export const SYSTEM_PROMPT = `אתה "שמשון", העוזר של כלי לניתוח כדאיות דירה להשקעה בישראל.

## מי המשתמש
משקיע פרטי ישראלי, לא איש פיננסים. שוקל דירה שנייה. הוא הזין נתוני עסקה וקיבל תזרים, תשואה, מיסוי וניתוח משכנתא.

## מה מותר לך
- להסביר מושגים: מס רכישה, מסלולי משכנתא, מדד תשומות בנייה, תשואה על ההון
- להסביר את המספרים שלו ולפרק אותם לרכיבים שהמנוע כבר חישב
- להצביע על סיכון וחשיפה - רגישות לריבית, לאי-אכלוס, להוצאות שלא נלקחו בחשבון
- לכוון מה לבדוק ומה הוא שכח להזין
- להשוות בין ההנחות שלו ולהסביר מה מייקר ומה מוזיל
- לומר "אני לא יודע" כשהנתון לא קיים בכלי. זו תשובה טובה

## מה אסור לך - מוחלט
- אסור להמציא מספר. כל מספר שאתה מזכיר חייב להגיע מההקשר שתקבל. אם המנוע לא חישב אותו - אמור שאתה לא יודע. אין מספרים מהזיכרון שלך: לא מחירי שוק, לא ריביות, לא עלויות.
- אסור לנבא. לא מחירים, לא ריביות, לא שוק. מותר לתאר מה קרה בעבר לפי הנתונים שבהקשר.
- אסור להמליץ על החלטה. לא "כדאי לקנות", לא "זו עסקה טובה", לא "אני ממליץ על המסלול הזה". הצג את השיקולים ואת המספרים. ההחלטה שלו.
- אסור לתת ייעוץ פיננסי, מיסויי או משפטי מחייב. בנקודות כאלה הפנה לבעל מקצוע.

## איך לנסח
- עברית ברורה ופשוטה. בלי מונח מקצועי בלי הסבר.
- קצר. 2-4 משפטים לשאלה פשוטה. פירוט רק אם ביקש.
- מקף רגיל בלבד. לעולם לא em-dash.
- מספר עתידי תמיד צמוד להנחה שיצרה אותו: "לפי ההנחה שלך של 3% בשנה".
- אל תכתוב "התשואה תהיה" אלא "התשואה לפי הנתונים שהזנת".
- אם נתון בהקשר מסומן כלא מאומת או נושא תאריך - ציין את זה.

## דוגמאות ניסוח
שאלה: "כדאי לי לקנות?"
תשובה טובה: "זו החלטה שלך, ואני לא נותן המלצות השקעה. מה שאני יכול להראות לך: התזרים החודשי לפי הנתונים שהזנת הוא X, והתשואה Y. השיקול המרכזי כאן הוא Z."

שאלה: "כמה תעלה דירה כזו בעוד 5 שנים?"
תשובה טובה: "אני לא יודע ולא מנבא מחירים. הכלי מריץ קדימה את ההנחה שאתה מזין. אם תזין 3% עליית ערך בשנה תראה את התוצאה במסך התחזית - אבל זו ההנחה שלך, לא תחזית שלי."`;

const anthropic = new Anthropic();

/** מזהה מבקר לצורך מכסה בלבד. ה-IP לא נשמר גולמי - רק hash יומי. */
function visitorKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip =
    req.headers.get('x-nf-client-connection-ip') ??
    forwarded?.split(',')[0]?.trim() ??
    'unknown';
  const today = new Date().toISOString().slice(0, 10);
  return createHash('sha256').update(`${ip}|${today}`).digest('hex').slice(0, 32);
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

interface HistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface ShimshonRequest {
  question: string;
  /** תוצאות מנוע החישוב, כבר מעוצבות כטקסט על ידי הלקוח. */
  context: string;
  history?: HistoryTurn[];
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return jsonError(405, 'רק POST נתמך.');

  let body: ShimshonRequest;
  try {
    body = (await req.json()) as ShimshonRequest;
  } catch {
    return jsonError(400, 'גוף הבקשה אינו JSON תקין.');
  }

  const question = (body.question ?? '').trim();
  const context = (body.context ?? '').trim();

  if (!question) return jsonError(400, 'לא נשלחה שאלה.');
  if (question.length > MAX_QUESTION_CHARS) {
    return jsonError(400, `השאלה ארוכה מדי. עד ${MAX_QUESTION_CHARS} תווים.`);
  }
  if (context.length > MAX_CONTEXT_CHARS) {
    return jsonError(400, 'ההקשר שנשלח גדול מדי.');
  }

  // המכסה נבדקת לפני הקריאה למודל, כדי שלא נשלם על בקשה חסומה.
  //
  // getStore זורק **בקריאה עצמה** כשהסביבה לא מוגדרת (פיתוח מקומי בלי
  // netlify dev, או Blobs שלא הופעל באתר). לכן הוא חייב להיות בתוך ה-try,
  // ולא רק ה-get. בלי זה שמשון קורס ב-500 במקום להמשיך בלי מכסה.
  const key = visitorKey(req);
  let store: ReturnType<typeof getStore> | null = null;
  let used = 0;
  try {
    store = getStore('shimshon-quota');
    const raw = await store.get(key, { type: 'text' });
    used = raw ? Number.parseInt(raw, 10) || 0 : 0;
  } catch {
    // תקלה באחסון המכסה לא צריכה להשבית את שמשון למשתמש לגיטימי.
    // ההשלכה: בזמן תקלה כזו אין תקרה. מקובל - התקלה נדירה והחלופה גרועה יותר.
    store = null;
    used = 0;
  }

  if (used >= DAILY_QUESTION_LIMIT) {
    return jsonError(
      429,
      `הגעת ל-${DAILY_QUESTION_LIMIT} שאלות היום. המכסה מתאפסת מחר. בינתיים כל החישובים בכלי ממשיכים לעבוד בלי שמשון.`,
    );
  }

  const history: HistoryTurn[] = (body.history ?? []).slice(-MAX_HISTORY_TURNS);

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      // אין כאן thinking ואין output_config.effort - **שניהם שוברים את Haiku 4.5
      // בזמן ריצה עם שגיאת 400**, ו-TypeScript לא תופס את זה כי הטיפוסים
      // אינם מוגבלים לפי מודל. אם מישהו מחזיר את המודל ל-Opus, אפשר להחזיר
      // גם `thinking: { type: 'adaptive' }` ו-`output_config: { effort: 'low' }`.
      //
      // ההוראות הקבועות נשמרות ב-cache. ההקשר המשתנה יושב ב-messages אחריהן,
      // כדי שנתוני הנכס ישתנו בכל שאלה בלי לפסול את החלק היקר.
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        {
          role: 'user' as const,
          content: context
            ? `נתוני הנכס והחישובים הנוכחיים:\n\n${context}\n\n---\n\nהשאלה: ${question}`
            : question,
        },
      ],
    });

    const encoder = new TextEncoder();
    const out = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          const final = await stream.finalMessage();
          // סירוב מטעמי בטיחות מגיע כ-200 עם stop_reason, לא כשגיאה.
          if (final.stop_reason === 'refusal') {
            controller.enqueue(
              encoder.encode('\n\nלא אוכל לענות על זה. נסה לנסח את השאלה אחרת.'),
            );
          }
        } catch {
          controller.enqueue(encoder.encode('\n\n[השיחה נקטעה. נסה שוב.]'));
        } finally {
          controller.close();
        }
      },
    });

    // המכסה נספרת אחרי שהבקשה יצאה בהצלחה, לא לפני.
    try {
      await store?.set(key, String(used + 1));
    } catch {
      // כישלון ספירה לא מפיל תשובה שכבר בדרך למשתמש.
    }

    return new Response(out, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-shimshon-remaining': String(DAILY_QUESTION_LIMIT - used - 1),
      },
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return jsonError(429, 'שמשון עמוס כרגע. נסה שוב בעוד רגע.');
    }
    if (err instanceof Anthropic.AuthenticationError) {
      // שגיאת תצורה בצד שלנו. למשתמש לא אומרים "API key".
      return jsonError(500, 'שמשון לא זמין כרגע. החישובים בכלי ממשיכים לעבוד.');
    }
    if (err instanceof Anthropic.APIError) {
      return jsonError(502, 'שמשון לא זמין כרגע. נסה שוב בעוד רגע.');
    }
    return jsonError(500, 'שגיאה לא צפויה. נסה שוב.');
  }
};

// הניתוב מוגדר ב-netlify.toml כ-redirect מפורש שקודם לכלל ה-SPA, ולא דרך
// config.path כאן. שני מנגנונים על אותו נתיב מתנגשים - עדיף אחד, מפורש.
