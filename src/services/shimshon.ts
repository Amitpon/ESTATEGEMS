/**
 * שמשון - צד הלקוח.
 *
 * שתי אחריויות:
 * 1. לתרגם את תוצאות מנוע החישוב לטקסט שהמודל יכול לנסח עליו.
 * 2. לקרוא ל-Netlify Function ולהזרים את התשובה למסך.
 *
 * ההקשר נבנה **רק** ממה שהמנוע חישב. זה המנגנון שמונע משמשון להמציא מספרים
 * (עיקרון 4): אם מספר לא נמצא כאן, שמשון לא ראה אותו ולא יכול לצטט אותו.
 */

import type { AnalysisResult } from '@/lib/calc';
import type { PropertyInput } from '@/types/property';
import { formatILS, formatPercentDirect } from '@/lib/format';

/** תור אחד בשיחה. */
export interface ShimshonTurn {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

/** מכסה יומית. חייב להישאר תואם ל-DAILY_QUESTION_LIMIT בפונקציה. */
export const SHIMSHON_DAILY_LIMIT = 10;

/** הגילוי הנאות. עיקרון 4 מחייב אותו נראה בממשק, לא מוסתר בהגדרות. */
export const SHIMSHON_DISCLAIMER =
  'שמשון מסביר ומכוון על בסיס הנתונים שהזנת. הוא לא נותן ייעוץ השקעות, מיסוי או משפט, ולא לוקח אחריות על ההחלטה. השאלה שלך נשלחת לשרת לצורך המענה - שאר הנתונים שלך נשארים במכשיר.';

function metricLine(label: string, value: number, unit: 'ils' | 'pct'): string {
  return `- ${label}: ${unit === 'ils' ? formatILS(value) : formatPercentDirect(value)}`;
}

/**
 * בונה את ההקשר שנשלח לשמשון.
 *
 * מכוון להיות קריא לאדם: אם ההקשר קריא, גם התשובה תהיה. כל מספר מגיע
 * מהמנוע ונושא את התווית שלו, כדי ששמשון יוכל להפנות אליו בשם.
 */
export function buildShimshonContext(
  input: PropertyInput,
  analysis: AnalysisResult,
): string {
  const { cashflow, metrics, equity, mortgage, purchaseTax, rentalTax } = analysis;
  const parts: string[] = [];

  parts.push(
    [
      '## נתוני העסקה שהמשתמש הזין',
      `- מחיר הנכס: ${formatILS(input.property.price)}`,
      `- גודל: ${input.property.sizeSqm} מ"ר`,
      `- הון עצמי: ${formatILS(analysis.downPayment)}`,
      `- סכום ההלוואה: ${formatILS(analysis.loanAmount)}`,
      `- שיעור מימון בפועל: ${formatPercentDirect(analysis.ltvPct)}`,
    ].join('\n'),
  );

  parts.push(
    [
      '## התזרים החודשי',
      metricLine('שכר דירה ברוטו', cashflow.grossRent.monthly, 'ils'),
      metricLine('הפסד מאי-אכלוס', cashflow.vacancyLoss.monthly, 'ils'),
      metricLine('שכר דירה אפקטיבי', cashflow.effectiveRent.monthly, 'ils'),
      metricLine('הוצאות תפעול', cashflow.operatingExpenses.monthlyTotal, 'ils'),
      ...cashflow.operatingExpenses.lines.map(
        (l) => `  - מזה ${l.label}: ${formatILS(l.monthly)}`,
      ),
      metricLine('החזר משכנתא', cashflow.mortgagePayment.monthly, 'ils'),
      metricLine('מס שכר דירה', cashflow.rentalTax.monthly, 'ils'),
      metricLine('תזרים נקי', cashflow.netCashflow.monthly, 'ils'),
    ].join('\n'),
  );

  // הנוסחה של כל מדד נשלחת גם היא. בלעדיה שמשון מסביר מהזיכרון
  // במקום להסביר את החישוב שהמשתמש בפועל רואה על המסך.
  parts.push(
    [
      '## המדדים שהמנוע חישב',
      ...metrics.ordered.map(
        (m) =>
          `- ${m.label}: ${m.unit === 'ils' ? formatILS(m.value) : formatPercentDirect(m.value)} (נוסחה: ${m.formula})`,
      ),
    ].join('\n'),
  );

  parts.push(
    [
      '## ההון הנדרש ביום הרכישה',
      ...equity.lines.map((l) => `- ${l.label}: ${formatILS(l.amount)}`),
      `- סך הכל נדרש נזיל: ${formatILS(equity.total)}`,
      `- מזה הון מושקע בנכס: ${formatILS(equity.investedCapital)}`,
    ].join('\n'),
  );

  parts.push(
    [
      '## מס רכישה',
      ...purchaseTax.breakdown.map(
        (l) => `- מדרגה ${formatPercentDirect(l.ratePct)}: ${formatILS(l.tax)}`,
      ),
      `- סך מס רכישה: ${formatILS(purchaseTax.total)}`,
      `- שיעור אפקטיבי: ${formatPercentDirect(purchaseTax.effectiveRatePct)}`,
      `- מקור המדרגות: ${purchaseTax.brackets.source} (${purchaseTax.brackets.asOf})${purchaseTax.brackets.verified ? '' : ' - נתון שטרם אומת'}`,
    ].join('\n'),
  );

  // המסלולים מגיעים ממוינים מהזול לגבוה. זו השוואה, לא המלצה - עיקרון 1.
  parts.push(
    [
      '## מס שכר דירה - השוואת מסלולים',
      ...rentalTax.tracks.map(
        (t) =>
          `- ${t.label}: ${formatILS(t.annualTax)} בשנה (שיעור אפקטיבי ${formatPercentDirect(t.effectiveRatePct)})`,
      ),
      `- המסלול שהמשתמש בחר: ${rentalTax.selected.label}`,
      rentalTax.gapFromLowest > 0
        ? `- ההפרש בין המסלול שנבחר לזול ביותר בהשוואה: ${formatILS(rentalTax.gapFromLowest)} בשנה`
        : '- המשתמש כבר במסלול הזול ביותר בהשוואה',
      rentalTax.allRegulatoryVerified
        ? ''
        : '- שים לב: לפחות מסלול אחד נשען על נתון רגולטורי שטרם אומת. אם אתה מזכיר את המספרים האלה, ציין זאת.',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  parts.push(
    [
      '## המשכנתא',
      `- החזר חודשי בחודש הראשון, כל התמהיל: ${formatILS(mortgage.firstMonthlyPayment)}`,
      `- סך ריבית לאורך כל התקופה: ${formatILS(mortgage.totalInterest)}`,
      `- סך תשלומים: ${formatILS(mortgage.totalPaid)}`,
      ...mortgage.tracks.map(
        (t) =>
          `- מסלול ${t.label}: ${formatILS(t.principal)} בריבית ${formatPercentDirect(t.annualRatePct)} ל-${t.termMonths} חודשים, ריבית מצטברת ${formatILS(t.totalInterest)}`,
      ),
    ].join('\n'),
  );

  if (analysis.paymentSchedule) {
    const ps = analysis.paymentSchedule;
    parts.push(
      [
        '## לוח תשלומים לקבלן',
        `- הנחת שינוי מדד תשומות הבנייה שהמשתמש הזין: ${formatPercentDirect(ps.assumedIndexChangePct)} בשנה`,
        ...ps.stages.map(
          (s) =>
            `- ${s.label} (${s.dueDate}): ${formatILS(s.payableAmount)}${s.indexed ? ` כולל הצמדה של ${formatILS(s.indexationAmount)}` : ''}`,
        ),
        `- סך לתשלום: ${formatILS(ps.totalPayable)}`,
      ].join('\n'),
    );
  }

  return parts.join('\n\n');
}

/** תוצאת קריאה לשמשון שנכשלה לפני תחילת ההזרמה. */
export class ShimshonError extends Error {
  constructor(
    message: string,
    /** true כשהמכסה היומית נגמרה - הממשק מציג את זה אחרת משגיאה. */
    readonly quotaExhausted: boolean = false,
  ) {
    super(message);
    this.name = 'ShimshonError';
  }
}

export interface AskShimshonOptions {
  readonly question: string;
  readonly context: string;
  readonly history?: readonly ShimshonTurn[];
  /** נקרא לכל מקטע טקסט שמגיע. */
  readonly onChunk: (text: string) => void;
  readonly signal?: AbortSignal;
}

/**
 * שואל את שמשון ומזרים את התשובה.
 *
 * מחזיר את מספר השאלות שנותרו היום, או null אם השרת לא דיווח.
 */
export async function askShimshon(options: AskShimshonOptions): Promise<number | null> {
  const { question, context, history = [], onChunk, signal } = options;

  const response = await fetch('/api/shimshon', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, context, history }),
    signal,
  });

  if (!response.ok) {
    let message = 'שמשון לא זמין כרגע. נסה שוב בעוד רגע.';
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // גוף לא תקין - נשארים עם ההודעה הגנרית.
    }
    throw new ShimshonError(message, response.status === 429);
  }

  if (!response.body) {
    throw new ShimshonError('לא התקבלה תשובה משמשון.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value, { stream: true }));
    }
    // ניקוז אחרון - תו רב-בייטי שנחתך בין מקטעים.
    const tail = decoder.decode();
    if (tail) onChunk(tail);
  } finally {
    reader.releaseLock();
  }

  const remaining = response.headers.get('x-shimshon-remaining');
  return remaining === null ? null : Number.parseInt(remaining, 10);
}
