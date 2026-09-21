/**
 * טיפוסי הקלט של מנוע החישוב.
 *
 * מבוסס על מפת הפיצ'רים של EstateGems (docs/research/estategems-teardown.md סעיף 2),
 * בניכוי מדינה ומטבע - ישראל ושקלים בלבד.
 *
 * עיקרון 3 (docs/product-principles.md): כל הנחה היא שדה בטיפוס הקלט.
 * אין הנחה שקבועה בתוך קוד החישוב. ברירות המחדל יושבות ב-src/lib/calc/defaults.ts
 * עם ציון מקור לכל ערך, והמשתמש יכול לשנות כל אחת מהן.
 *
 * מוסכמות:
 * - כל סכום כסף הוא מספר בשקלים (ILS). אין מטבע אחר.
 * - כל שדה ששמו מסתיים ב-Pct הוא אחוז בנקודות אחוז (5 = 5%), לא שבר עשרוני.
 * - כל תאריך הוא מחרוזת ISO בפורמט 'YYYY-MM-DD'. אין Date בתוך החישוב.
 */

/** תאריך לוח שנה בפורמט ISO 'YYYY-MM-DD'. */
export type IsoDate = string;

/** מקור המימון של תשלום - מהכיס או מההלוואה. */
export type FundingSource = 'equity' | 'mortgage';

/** סוג הנכס. */
export type PropertyKind = 'apartment' | 'house' | 'land' | 'commercial' | 'aparthotel';

/** סוג לוח הסילוקין. */
export type AmortizationKind =
  /** שפיצר - החזר חודשי קבוע. */
  | 'spitzer'
  /** קרן שווה - החזר קרן קבוע, ריבית יורדת. */
  | 'equalPrincipal';

/** סוג ההצמדה של מסלול משכנתא. משמש לתיוג ולתצוגה; אינו משנה את לוח הסילוקין הנומינלי. */
export type LoanLinkage = 'fixedUnlinked' | 'fixedCpiLinked' | 'variableUnlinked' | 'variableCpiLinked' | 'prime';

/** מסלול מס על הכנסות שכירות מדירת מגורים. */
export type RentalTaxTrack =
  /** מסלול הפטור (עם תקרה ונוסחת פטור יורד מעליה). */
  | 'exempt'
  /** מסלול 10% על ההכנסה ברוטו, ללא ניכוי הוצאות. */
  | 'flat10'
  /** מס שולי עם ניכוי הוצאות. */
  | 'marginal';

/** מצב ההצמדה של לוח התשלומים למדד תשומות הבנייה. */
export type IndexationMode =
  /** אין הצמדה. */
  | 'off'
  /** הצמדה מלאה. */
  | 'on'
  /** הצמדה על שלבי התשלום בלבד (ולא על עלויות נלוות שמשויכות לשלב). */
  | 'paymentsOnly';

/**
 * סכום שאפשר להזין כערך מוחלט או כאחוז מבסיס כלשהו.
 * קיים כדי לא לכפות על המשתמש להמיר בעצמו (EstateGems מאפשר את שתי הצורות).
 */
export type AmountOrPercent =
  /** סכום חודשי קבוע בשקלים. */
  | { readonly kind: 'monthlyAmount'; readonly amount: number }
  /** סכום שנתי קבוע בשקלים. */
  | { readonly kind: 'annualAmount'; readonly amount: number }
  /** אחוז משכר הדירה הברוטו השנתי. */
  | { readonly kind: 'percentOfAnnualRent'; readonly percent: number }
  /** אחוז ממחיר הנכס, לשנה. */
  | { readonly kind: 'percentOfPricePerYear'; readonly percent: number };

/** פרטי הנכס. */
export interface PropertyDetails {
  /** מחיר הנכס בשקלים, לפני מסים ועלויות נלוות. */
  readonly price: number;
  /** שטח במ"ר. */
  readonly sizeSqm: number;
  /** עיר או יישוב. */
  readonly city: string;
  /** שכונה או אזור בתוך העיר. אופציונלי. */
  readonly neighborhood?: string;
  readonly kind: PropertyKind;
  /** מספר חדרים (מאפשר חצאים, למשל 3.5). */
  readonly rooms: number;
  /** תאריך אכלוס צפוי. רלוונטי בעיקר לרכישה מקבלן. */
  readonly occupancyDate?: IsoDate;
}

/** מסלול אחד בתמהיל המשכנתא. */
export interface LoanTrack {
  /** מזהה יציב לתצוגה ולהודעות שגיאה. */
  readonly id: string;
  /** שם תצוגה, למשל "קבועה לא צמודה". */
  readonly label: string;
  /** קרן המסלול בשקלים. */
  readonly principal: number;
  /** ריבית שנתית נומינלית בנקודות אחוז. */
  readonly annualRatePct: number;
  /** תקופת המסלול בחודשים. */
  readonly termMonths: number;
  readonly amortization: AmortizationKind;
  readonly linkage: LoanLinkage;
}

/** מימון הרכישה. */
export interface FinancingInput {
  /**
   * גובה ההון העצמי. בדיוק אחד משני השדות הבאים חייב להיות מוגדר -
   * או סכום ההון העצמי, או אחוז המימון (LTV). אם שניהם או אף אחד מהם, זו שגיאת קלט.
   */
  readonly downPayment?: number;
  /** אחוז המימון (LTV) מתוך מחיר הנכס, בנקודות אחוז. */
  readonly ltvPct?: number;
  /**
   * תמהיל המסלולים. סכום הקרנות חייב להיות שווה לסכום ההלוואה הנגזר.
   * מסלול יחיד הוא המקרה הפשוט.
   */
  readonly tracks: readonly LoanTrack[];
  /** עמלת פירעון מוקדם באחוזים מהיתרה הלא מסולקת, בנקודות אחוז. */
  readonly earlyRepaymentFeePct: number;
}

/** הכנסות שוטפות. */
export interface IncomeInput {
  /** שכר דירה חודשי ברוטו בשקלים. */
  readonly monthlyRent: number;
  /** שיעור אי-אכלוס שנתי בנקודות אחוז (למשל 8.33 = חודש בשנה). */
  readonly vacancyPct: number;
}

/** הוצאות שוטפות. כל רכיב יכול להיות סכום או אחוז. */
export interface OperatingExpensesInput {
  /** ועד בית. */
  readonly buildingFee: AmountOrPercent;
  /** ארנונה. */
  readonly propertyTax: AmountOrPercent;
  /** ביטוח מבנה. */
  readonly insurance: AmountOrPercent;
  /** תחזוקה ותיקונים. */
  readonly maintenance: AmountOrPercent;
  /** דמי ניהול / חברת ניהול. */
  readonly management: AmountOrPercent;
  /** הוצאות נוספות בשם חופשי. */
  readonly custom: readonly { readonly label: string; readonly value: AmountOrPercent }[];
}

/** עלויות חד-פעמיות סביב הרכישה. */
export interface AcquisitionCostsInput {
  /** עמלת תיווך בשקלים. */
  readonly brokerFee: number;
  /** שכר טרחת עורך דין ברכישה. */
  readonly lawyerFee: number;
  /** יועץ משכנתאות. */
  readonly mortgageAdvisorFee: number;
  /** עלות גמר למ"ר (מוכפלת בשטח). */
  readonly finishingCostPerSqm: number;
  /** רזרבה נזילה שהמשתמש רוצה להחזיק ביום 1. */
  readonly liquidityReserve: number;
  /**
   * שיוך עלות לתאריך תשלום, לפי מפתח השורה ב-equity.lines.
   * למשל שכר טרחת עו"ד בשלב הראשון ויועץ משכנתאות באכלוס.
   * עלות שלא שויכה משולמת בשלב הראשון.
   */
  readonly stageDates?: Readonly<Record<string, IsoDate>>;
  /** עלויות חד-פעמיות נוספות, כל אחת עם שם וסכום, ואופציונלית משויכת לשלב תשלום. */
  readonly custom: readonly {
    readonly label: string;
    readonly amount: number;
    /** id של שלב בלוח התשלומים, אם העלות משויכת לשלב. */
    readonly stageId?: string;
  }[];
}

/** מיסוי. */
export interface TaxInput {
  /** האם זו דירתו היחידה של הרוכש - קובע את מערכת מדרגות מס הרכישה. */
  readonly isSingleApartment: boolean;
  /** מסלול מס שכר הדירה שהמשתמש בחר. הכלי לא בוחר בשבילו. */
  readonly rentalTaxTrack: RentalTaxTrack;
  /** שיעור המס השולי של המשתמש בנקודות אחוז. רלוונטי רק למסלול 'marginal'. */
  readonly marginalTaxRatePct: number;
  /**
   * דריסה ידנית של מס הרכישה בשקלים. אם מוגדר, המנוע משתמש בו במקום בחישוב המדורג
   * (EstateGems מאפשר "מס רכישה (ידני)" למקרים חריגים - עולה חוזר, נכה, ירושה).
   */
  readonly purchaseTaxOverride?: number;
}

/** שלב אחד בלוח התשלומים לרכישה מקבלן. */
export interface PaymentStage {
  readonly id: string;
  readonly label: string;
  /** אחוז ממחיר הנכס, בנקודות אחוז. סכום כל השלבים חייב להיות 100. */
  readonly percentOfPrice: number;
  readonly dueDate: IsoDate;
  /** האם השלב הזה צמוד למדד תשומות הבנייה. */
  readonly linkedToIndex: boolean;
  /**
   * ממה השלב ממומן. 'equity' יוצא מהכיס ונכנס למכנה של התשואה,
   * 'mortgage' ממומן בהלוואה. ברוב עסקאות הקבלן התשלומים הראשונים
   * מההון העצמי והאחרונים מהמשכנתא.
   */
  readonly fundingSource: FundingSource;
}

/** לוח תשלומים לרכישה מקבלן. */
export interface PaymentScheduleInput {
  /**
   * תאריך האכלוס בפועל - טופס 4. לדירה שנרכשת על הנייר.
   *
   * ממנו נספרים 18 חודשי ההחזקה לצורך הפטור ממס שבח, ולא מיום חתימת החוזה
   * (סעיף 49ב(2)). **הכלל הזה לא אומת מול רשות המסים** - ראה
   * docs/research/capital-gains-tax.md.
   */
  readonly occupancyDate?: IsoDate;
  readonly stages: readonly PaymentStage[];
  readonly indexationMode: IndexationMode;
  /**
   * שיעור השינוי השנתי של מדד תשומות הבנייה, בנקודות אחוז.
   * זו הנחה של המשתמש, לא תחזית של הכלי.
   */
  readonly assumedIndexChangePct: number;
}

/**
 * ההנחות של המשתמש להרצה קדימה.
 * עיקרון 1: אלה הנחות, לא תחזיות. שמות השדות נושאים את המילה assumed בכוונה.
 */
export interface Assumptions {
  /** עליית ערך שנתית מונחת, בנקודות אחוז. */
  readonly assumedAppreciationPct: number;
  /** עליית שכר דירה שנתית מונחת, בנקודות אחוז. */
  readonly assumedRentGrowthPct: number;
  /** עליית הוצאות שנתית מונחת, בנקודות אחוז. */
  readonly assumedExpenseGrowthPct: number;
  /** שיעור שינוי מדד שנתי מונח (מדד תשומות הבנייה), בנקודות אחוז. */
  readonly assumedIndexChangePct: number;
  /** מספר השנים להרצה. */
  readonly horizonYears: number;
  /**
   * עלויות המכירה כאחוז ממחיר המכירה - מתווך ועו"ד בעת המכירה.
   * הנחה של המשתמש, נגזרת מחדש לכל שנה בטבלת המכירה.
   */
  readonly assumedSellingCostPct: number;
  /**
   * רוחב הטווח בנקודות אחוז לכל צד, לתרחיש הנמוך והגבוה.
   * ברירת המחדל 2 - כלומר ההנחה פלוס/מינוס 2 נקודות אחוז.
   */
  readonly scenarioSpreadPoints: number;
}

/** הקלט המלא לניתוח נכס. */
export interface PropertyInput {
  /** תאריך הייחוס של הניתוח. מגיע כפרמטר - אין Date.now() בתוך החישוב. */
  readonly analysisDate: IsoDate;
  readonly property: PropertyDetails;
  readonly financing: FinancingInput;
  readonly income: IncomeInput;
  readonly expenses: OperatingExpensesInput;
  readonly acquisitionCosts: AcquisitionCostsInput;
  readonly tax: TaxInput;
  /** לוח תשלומים לרכישה מקבלן. נעדר אם מדובר ברכישה רגילה בתשלום אחד. */
  readonly paymentSchedule?: PaymentScheduleInput;
}

/** ערך רגולטורי עם מקור ותאריך עדכון, כדי שהממשק יוכל להציג מקור לכל מספר. */
export interface SourcedValue<T> {
  readonly value: T;
  /** השנה או התאריך שאליו הערך מתייחס. */
  readonly asOf: string;
  /** מקור הנתון - קישור או שם המסמך. */
  readonly source: string;
  /** האם הערך אומת מול מקור רשמי. false מחייב את הממשק לסמן אזהרה. */
  readonly verified: boolean;
  /** הערה חופשית, למשל מה בדיוק לא אומת. */
  readonly note?: string;
}
