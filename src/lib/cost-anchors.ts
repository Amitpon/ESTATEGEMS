/**
 * עוגני עלות - טווחים מקובלים בשוק.
 *
 * עיקרון 2: **עוגן, לא מילוי אוטומטי.** המספרים כאן מוצגים לצד השדה כדי
 * שהמשתמש יזין מתוך ידיעה. הכלי לא ממלא בשבילו ולא קובע מה נכון.
 *
 * **אזהרת מקורות:** רוב הטווחים מגיעים מאתרי שיווק של נותני שירות (משרדי
 * עו"ד, חברות שיפוצים) ולכן מוטים. ראה `docs/research/professional-cost-ranges.md`.
 * אף אחד מהם אינו `verified`. הממשק מציג אותם כטווח ולעולם לא כמספר יחיד.
 */

export type AnchorUnit = 'ils' | 'pctOfPrice' | 'pctOfRent' | 'ilsPerSqm';

export interface CostAnchor {
  readonly key: string;
  readonly label: string;
  readonly unit: AnchorUnit;
  readonly low: number;
  readonly typical: number;
  readonly high: number;
  readonly source: string;
  readonly asOf: string;
  readonly verified: boolean;
  readonly note?: string;
}

/** עלויות חד-פעמיות סביב העסקה. */
export const ACQUISITION_ANCHORS: readonly CostAnchor[] = [
  {
    key: 'lawyerFeeSecondHand',
    label: 'עו"ד - יד שנייה',
    unit: 'pctOfPrice',
    low: 0.5,
    typical: 0.75,
    high: 1,
    source: 'nadlan-lawyer.co.il',
    asOf: '2026',
    verified: false,
    note: 'מינימום שוק מקובל כ-5,000 ₪ בתוספת מע"מ.',
  },
  {
    key: 'lawyerFeeContractor',
    label: 'עו"ד - מקבלן',
    unit: 'pctOfPrice',
    low: 1.5,
    typical: 1.75,
    high: 2,
    source: 'nadlan-lawyer.co.il',
    asOf: '2026',
    verified: false,
    note: 'גבוה יותר בגלל ליווי של 2-4 שנים עד הרישום.',
  },
  {
    key: 'brokerFee',
    label: 'עמלת מתווך',
    unit: 'pctOfPrice',
    low: 1,
    typical: 2,
    high: 2,
    source: 'kolzchut.org.il',
    asOf: '2025',
    verified: false,
    note: 'נוהג שוק. אין חוק שמחייב 2 אחוז, וניתן למיקוח.',
  },
  {
    key: 'appraiser',
    label: 'שמאי למשכנתא',
    unit: 'ils',
    low: 2_000,
    typical: 2_500,
    high: 3_500,
    source: 'midrag.co.il',
    asOf: '2026',
    verified: false,
  },
  {
    key: 'homeInspection',
    label: 'בדק בית',
    unit: 'ils',
    low: 1_200,
    typical: 1_500,
    high: 3_000,
    source: 'midrag.co.il',
    asOf: '2025',
    verified: false,
  },
  {
    key: 'mortgageAdvisor',
    label: 'יועץ משכנתאות',
    unit: 'ils',
    low: 5_000,
    typical: 7_000,
    high: 15_000,
    source: 'midrag.co.il',
    asOf: '2026',
    verified: false,
    note: 'תמחור קבוע, לא אחוז. מקרים מורכבים מגיעים ל-25,000 ₪.',
  },
  {
    key: 'tabouFees',
    label: 'אגרות טאבו',
    unit: 'ils',
    low: 725,
    typical: 725,
    high: 725,
    source: 'תקנות המקרקעין (אגרות)',
    asOf: '2025',
    verified: false,
    note: '600 ₪ רישום משכנתא ועוד 125 ₪ הערת אזהרה. לאמת מול justice.gov.il.',
  },
  {
    key: 'movingCost',
    label: 'הובלה',
    unit: 'ils',
    low: 1_200,
    typical: 2_500,
    high: 5_500,
    source: 'olimpus-hovalot.co.il',
    asOf: '2025',
    verified: false,
  },
  {
    key: 'renovationCosmetic',
    label: 'שיפוץ קוסמטי',
    unit: 'ilsPerSqm',
    low: 300,
    typical: 450,
    high: 600,
    source: 'oz-shiputsim.co.il',
    asOf: '2026',
    verified: false,
    note: 'ללא מע"מ. צביעה, טיח, ריצוף קל.',
  },
  {
    key: 'renovationMedium',
    label: 'שיפוץ בינוני',
    unit: 'ilsPerSqm',
    low: 1_200,
    typical: 1_600,
    high: 2_000,
    source: 'oz-shiputsim.co.il',
    asOf: '2026',
    verified: false,
    note: 'ללא מע"מ. מטבח, אמבטיה, חשמל, אינסטלציה.',
  },
  {
    key: 'renovationFull',
    label: 'שיפוץ יסודי',
    unit: 'ilsPerSqm',
    low: 2_000,
    typical: 3_000,
    high: 5_000,
    source: 'oz-shiputsim.co.il',
    asOf: '2026',
    verified: false,
    note: 'ללא מע"מ. שינויים מבניים, חלונות.',
  },
];

/** עלויות שוטפות - נכנסות לתזרים החודשי. */
export const OPERATING_ANCHORS: readonly CostAnchor[] = [
  {
    key: 'buildingFee',
    label: 'ועד בית',
    unit: 'ils',
    low: 80,
    typical: 200,
    high: 400,
    source: 'vaadplus.co.il',
    asOf: '2026',
    verified: false,
    note: 'ללא מעלית 80-130. עם מעלית 130-200. מגדל יוקרה 280-400 ומעלה.',
  },
  {
    key: 'insurance',
    label: 'ביטוח מבנה',
    unit: 'ils',
    low: 35,
    typical: 55,
    high: 80,
    source: 'container.org.il',
    asOf: '2025',
    verified: false,
    note: 'לחודש, לדירה של כ-100 מ"ר. כיסוי רחב עם רעידת אדמה יקר יותר.',
  },
  {
    key: 'management',
    label: 'ניהול נכס',
    unit: 'pctOfRent',
    low: 8,
    typical: 10,
    high: 12,
    source: 'מחירון ניהול נכסים',
    asOf: '2026',
    verified: false,
    note: 'רק אם בחרת בניהול חיצוני. מינימום מקובל כ-500 ₪ לחודש.',
  },
  {
    key: 'maintenance',
    label: 'רזרבת תחזוקה',
    unit: 'pctOfRent',
    low: 5,
    typical: 8,
    high: 10,
    source: 'כלל אצבע מפורומים',
    asOf: '2024',
    verified: false,
    note: 'לא מחקר מסודר. נכס בן 20 שנה ומעלה נוטה לגבוה.',
  },
  {
    key: 'propertyTax',
    label: 'ארנונה',
    unit: 'ils',
    low: 0,
    typical: 0,
    high: 0,
    source: 'kolzchut.org.il',
    asOf: '2024',
    verified: true,
    note:
      'בדירה מושכרת הדייר משלם. נכנס לתזרים רק בחודשי ריק. אין טווח גנרי - התעריף תלוי בעירייה, בשטח ובסיווג. בדוק באתר העירייה שלך.',
  },
];

export function findAnchor(key: string): CostAnchor | undefined {
  return [...ACQUISITION_ANCHORS, ...OPERATING_ANCHORS].find((a) => a.key === key);
}

/** ניסוח הטווח לתצוגה. מספרים LTR בתוך טקסט RTL. */
export function formatAnchorRange(a: CostAnchor): string {
  const fmt = (n: number) =>
    a.unit === 'pctOfPrice' || a.unit === 'pctOfRent'
      ? `${n}%`
      : new Intl.NumberFormat('he-IL').format(n);

  const suffix =
    a.unit === 'ilsPerSqm' ? ' ₪ למ"ר' : a.unit === 'ils' ? ' ₪' : '';

  if (a.low === a.high) return `${fmt(a.typical)}${suffix}`;
  return `${fmt(a.low)} עד ${fmt(a.high)}${suffix}`;
}
