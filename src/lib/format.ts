/**
 * format.ts - עטיפות Intl עם instances ממוחזרים.
 *
 * יצירת Intl.NumberFormat בכל קריאה היא יקרה - ממחזרים כאן.
 * כל הפורמטים הם he-IL כי הכלי ישראל-בלבד.
 */

// ─── Formatters מאוחסנים ───────────────────────────────────────────────────

const ilsFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const ilsDecimalFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("he-IL", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("he-IL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const monthYearFormatter = new Intl.DateTimeFormat("he-IL", {
  year: "numeric",
  month: "long",
});

// ─── API ציבורי ────────────────────────────────────────────────────────────

/**
 * מספר שלם בשקלים: 1850000 -> "1,850,000 ₪"
 * Intl.NumberFormat he-IL מציב ₪ אחרי המספר - זה הנהוג בישראל.
 */
export function formatILS(amount: number): string {
  return ilsFormatter.format(amount);
}

/**
 * שקלים עם שתי ספרות אחרי נקודה: 4823.5 -> "4,823.50 ₪"
 * לשימוש בפירוטי תשלום מדויקים.
 */
export function formatILSDecimal(amount: number): string {
  return ilsDecimalFormatter.format(amount);
}

/**
 * אחוז: 0.042 -> "4.2%"
 * מקבל ערך עשרוני (לא 4.2 אלא 0.042).
 */
export function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

/**
 * אחוז מספר ישיר: 4.2 -> "4.2%"
 * לשימוש כשהערך כבר באחוזים (לא עשרוני).
 */
export function formatPercentDirect(value: number): string {
  return percentFormatter.format(value / 100);
}

/**
 * עיגול גס למספרים עתידיים - לפי עיקרון 1 (אין דיוק מדומה).
 * 2847000 -> "כ-2.85 מיליון"
 * 950000  -> "כ-950 אלף"
 * 12500   -> "12,500 ₪"
 */
export function formatCompactILS(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    // מיליון ומעלה - מעגל ל-2 ספרות משמעותיות
    const millions = abs / 1_000_000;
    const rounded =
      millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10;
    return `${sign}כ-${rounded} מיליון ₪`;
  }

  if (abs >= 100_000) {
    // מאה אלף - מעגל לאלפים
    const thousands = Math.round(abs / 1_000);
    return `${sign}כ-${thousands} אלף ₪`;
  }

  // מתחת למאה אלף - מספר מלא
  return formatILS(amount);
}

/**
 * מספר בלי מטבע: 1850000 -> "1,850,000"
 */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/**
 * תאריך מלא: Date -> "20 בספטמבר 2026"
 */
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/**
 * חודש ושנה: Date -> "ספטמבר 2026"
 */
export function formatMonthYear(date: Date): string {
  return monthYearFormatter.format(date);
}

/**
 * תאריך ISO קצר: Date -> "2026-09-20"
 * לשימוש ב-data attributes וב-aria-label.
 */
export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
