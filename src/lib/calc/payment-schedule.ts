/**
 * לוח תשלומים לרכישה מקבלן.
 *
 * זהו הפיצ'ר הייחודי של המוצר (docs/research/estategems-teardown.md סעיף 2.4):
 * שלבים באחוזים ממחיר הנכס, כל שלב עם תאריך, והצמדה למדד תשומות הבנייה.
 *
 * ההצמדה מחושבת לפי הפרש הזמן מהשלב הראשון: שלב שמשולם N שנים אחרי השלב
 * הראשון מוצמד בשיעור (1 + שיעור השינוי השנתי) בחזקת N.
 *
 * שיעור שינוי המדד הוא הנחה של המשתמש (עיקרון 1), לא תחזית של הכלי.
 */

import type { FundingSource, PaymentScheduleInput, PaymentStage } from '@/types/property';
import {
  CalcInputError,
  assertFinite,
  monthsBetween,
  parseIsoDate,
  roundAgorot,
} from './money';

/** שלב מחושב בלוח התשלומים. */
export interface ResolvedStage {
  readonly id: string;
  readonly label: string;
  readonly percentOfPrice: number;
  readonly dueDate: string;
  /** מספר החודשים מהשלב הראשון. */
  readonly monthsFromFirst: number;
  /** הסכום הנומינלי, לפני הצמדה. */
  readonly nominalAmount: number;
  /** מקדם ההצמדה שהופעל. 1 פירושו ללא הצמדה. */
  readonly indexFactor: number;
  /** תוספת ההצמדה בשקלים. */
  readonly indexationAmount: number;
  /** הסכום בפועל לתשלום - נומינלי בתוספת הצמדה. */
  readonly payableAmount: number;
  /** האם ההצמדה הופעלה על השלב הזה. */
  readonly indexed: boolean;
  /** ממה השלב ממומן - מהכיס או מההלוואה. */
  readonly fundingSource: FundingSource;
}

/** תוצאת חישוב לוח התשלומים. */
export interface PaymentScheduleResult {
  readonly stages: readonly ResolvedStage[];
  /** סך התשלומים הנומינליים - שווה למחיר הנכס. */
  readonly totalNominal: number;
  /** סך תוספת ההצמדה על כל השלבים. */
  readonly totalIndexation: number;
  /** סך התשלומים בפועל. */
  readonly totalPayable: number;
  /** שיעור שינוי המדד שהונח, בנקודות אחוז. זו הנחת המשתמש. */
  readonly assumedIndexChangePct: number;
  /** תאריך השלב הראשון - בסיס ההצמדה. */
  readonly indexBaseDate: string;
}

/**
 * ולידציה שסכום האחוזים בלוח התשלומים הוא בדיוק 100.
 * מחזירה את הסכום אם תקין, וזורקת שגיאה בעברית אם לא.
 */
export function validateStagePercents(stages: readonly PaymentStage[], tolerancePct = 0.01): number {
  if (stages.length === 0) {
    throw new CalcInputError('paymentSchedule.stages', 'לוח התשלומים ריק. הוסף לפחות שלב תשלום אחד.');
  }

  const seen = new Set<string>();
  let sum = 0;
  for (const stage of stages) {
    if (seen.has(stage.id)) {
      throw new CalcInputError(
        'paymentSchedule.stages',
        `מזהה שלב כפול בלוח התשלומים: "${stage.id}". לכל שלב חייב להיות מזהה ייחודי.`,
      );
    }
    seen.add(stage.id);

    assertFinite(`paymentSchedule.${stage.id}.percentOfPrice`, `אחוז השלב "${stage.label}"`, stage.percentOfPrice);
    if (stage.percentOfPrice < 0) {
      throw new CalcInputError(
        `paymentSchedule.${stage.id}.percentOfPrice`,
        `אחוז השלב "${stage.label}" לא יכול להיות שלילי.`,
      );
    }
    parseIsoDate(stage.dueDate, `paymentSchedule.${stage.id}.dueDate`);
    sum += stage.percentOfPrice;
  }

  const rounded = Math.round(sum * 100) / 100;
  if (Math.abs(rounded - 100) > tolerancePct) {
    const diff = Math.round((100 - rounded) * 100) / 100;
    const action = diff > 0 ? `חסרים ${diff}` : `עודפים ${Math.abs(diff)}`;
    throw new CalcInputError(
      'paymentSchedule.stages',
      `סכום אחוזי לוח התשלומים הוא ${rounded} אחוז במקום 100 אחוז - ${action} אחוז. תקן את השלבים.`,
    );
  }

  return rounded;
}

/**
 * חישוב לוח התשלומים, כולל הצמדה למדד תשומות הבנייה.
 *
 * @param price מחיר הנכס בשקלים.
 * @param schedule לוח התשלובים והנחת המדד.
 */
export function calcPaymentSchedule(
  price: number,
  schedule: PaymentScheduleInput,
): PaymentScheduleResult {
  if (!Number.isFinite(price) || price < 0) {
    throw new CalcInputError('property.price', 'מחיר הנכס חייב להיות מספר תקין ולא שלילי.');
  }
  validateStagePercents(schedule.stages);
  assertFinite('paymentSchedule.assumedIndexChangePct', 'שיעור שינוי המדד השנתי', schedule.assumedIndexChangePct);

  const sorted = [...schedule.stages].sort(
    (a, b) => parseIsoDate(a.dueDate, 'dueDate') - parseIsoDate(b.dueDate, 'dueDate'),
  );
  const firstStage = sorted[0] as PaymentStage;
  const baseDate = firstStage.dueDate;
  const annualFactor = 1 + schedule.assumedIndexChangePct / 100;

  const resolved: ResolvedStage[] = sorted.map((stage) => {
    const nominalAmount = roundAgorot((price * stage.percentOfPrice) / 100);
    const monthsFromFirst = monthsBetween(baseDate, stage.dueDate);

    // ההצמדה חלה רק אם המצב הכללי מאפשר וגם השלב עצמו סומן כצמוד.
    const indexed = schedule.indexationMode !== 'off' && stage.linkedToIndex && monthsFromFirst > 0;
    const indexFactor = indexed ? Math.pow(annualFactor, monthsFromFirst / 12) : 1;
    const payableAmount = roundAgorot(nominalAmount * indexFactor);

    return {
      id: stage.id,
      label: stage.label,
      percentOfPrice: stage.percentOfPrice,
      dueDate: stage.dueDate,
      monthsFromFirst: Math.round(monthsFromFirst * 100) / 100,
      nominalAmount,
      indexFactor: Math.round(indexFactor * 1e6) / 1e6,
      indexationAmount: roundAgorot(payableAmount - nominalAmount),
      payableAmount,
      indexed,
      fundingSource: stage.fundingSource,
    };
  });

  let totalNominal = 0;
  let totalIndexation = 0;
  let totalPayable = 0;
  for (const stage of resolved) {
    totalNominal = roundAgorot(totalNominal + stage.nominalAmount);
    totalIndexation = roundAgorot(totalIndexation + stage.indexationAmount);
    totalPayable = roundAgorot(totalPayable + stage.payableAmount);
  }

  return {
    stages: resolved,
    totalNominal,
    totalIndexation,
    totalPayable,
    assumedIndexChangePct: schedule.assumedIndexChangePct,
    indexBaseDate: baseDate,
  };
}
