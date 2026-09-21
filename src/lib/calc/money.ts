/**
 * עזרי כסף ואחוזים.
 *
 * כל סכום בכלי הוא מספר בשקלים. float מצטבר לאורך 360 חודשים גורר סחיפה,
 * ולכן כל מקום שבו סכום נצבר או מוצג עובר roundAgorot.
 */

/** שגיאת קלט של מנוע החישוב. ההודעה מיועדת למשתמש - עברית, מקף רגיל בלבד. */
export class CalcInputError extends Error {
  /** מזהה השדה שגרם לשגיאה, לשיוך בממשק. */
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = 'CalcInputError';
    this.field = field;
  }
}

/** עיגול לאגורות (שתי ספרות אחרי הנקודה). */
export function roundAgorot(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** עיגול לשקלים שלמים. */
export function roundShekels(amount: number): number {
  return Math.round(amount);
}

/**
 * עיגול גס למספרים עתידיים.
 * עיקרון 1: אם ההנחה גסה, העיגול צריך להיות גס. מספר שנובע מהרצת הנחות
 * לא מוצג בדיוק של שקל.
 */
export function roundCoarse(amount: number): number {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return Math.round(amount / 10_000) * 10_000;
  if (abs >= 100_000) return Math.round(amount / 1_000) * 1_000;
  if (abs >= 10_000) return Math.round(amount / 100) * 100;
  return Math.round(amount / 10) * 10;
}

/** המרת נקודות אחוז לשבר. 5 -> 0.05. */
export function pctToFraction(percent: number): number {
  return percent / 100;
}

/** חלק באחוזים מתוך בסיס. */
export function pctOf(base: number, percent: number): number {
  return base * pctToFraction(percent);
}

/** בדיקה שמספר הוא סופי (לא NaN ולא אינסוף). */
export function assertFinite(field: string, label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new CalcInputError(field, `${label} חייב להיות מספר תקין.`);
  }
}

/** בדיקה שמספר אינו שלילי. */
export function assertNonNegative(field: string, label: string, value: number): void {
  assertFinite(field, label, value);
  if (value < 0) {
    throw new CalcInputError(field, `${label} לא יכול להיות שלילי. התקבל ${value}.`);
  }
}

/** בדיקה שמספר חיובי ממש. */
export function assertPositive(field: string, label: string, value: number): void {
  assertFinite(field, label, value);
  if (value <= 0) {
    throw new CalcInputError(field, `${label} חייב להיות גדול מאפס. התקבל ${value}.`);
  }
}

/** בדיקה שאחוז נמצא בטווח 0 עד 100. */
export function assertPercent(field: string, label: string, percent: number): void {
  assertFinite(field, label, percent);
  if (percent < 0 || percent > 100) {
    throw new CalcInputError(field, `${label} חייב להיות בין 0 ל-100 אחוז. התקבל ${percent}.`);
  }
}

/**
 * סכימה עם עיגול לאגורות בכל צעד.
 * מונעת סחיפת float בצבירה ארוכה (למשל סך ריבית על פני 360 חודשים).
 */
export function sumAgorot(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    total = roundAgorot(total + value);
  }
  return total;
}

/** מספר החודשים בין שני תאריכי ISO, כולל שבר חודש לפי ימים בחודש של 30.4375 יום. */
export function monthsBetween(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso, 'fromDate');
  const to = parseIsoDate(toIso, 'toDate');
  const dayMs = 24 * 60 * 60 * 1000;
  const days = (to - from) / dayMs;
  // 365.25 / 12 - אורך חודש ממוצע, כדי שהצמדה לפי הפרש זמן תהיה רציפה ולא קופצנית.
  return days / 30.4375;
}

/** פענוח תאריך ISO 'YYYY-MM-DD' לחותמת זמן UTC. אין תלות באזור הזמן של המשתמש. */
export function parseIsoDate(iso: string, field: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    throw new CalcInputError(field, `תאריך לא תקין: "${iso}". הפורמט הנדרש הוא YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new CalcInputError(field, `תאריך לא תקין: "${iso}".`);
  }
  return Date.UTC(year, month - 1, day);
}
