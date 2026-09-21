/**
 * הרצה קדימה של ההנחות.
 *
 * עיקרון 1 (docs/product-principles.md): "הכלי לא מנבא. הכלי מציג, המשתמש מחליט."
 *
 * לכן, בקובץ הזה:
 * - אין שדה בשם forecast או prediction. השמות הם scenarioRun ו-assumedGrowthPct.
 * - כל תוצאה מחזירה איתה את ההנחות ששימשו אותה (השדה assumptions), כדי שהממשק
 *   יוכל להציג אותן צמוד למספר: "לפי ההנחה שלך של 3 אחוז בשנה".
 * - התוצאה היא תמיד טווח: תרחיש מרכזי, נמוך וגבוה. לא מספר בודד.
 * - הסכומים העתידיים מעוגלים עיגול גס (roundCoarse), כי ההנחה גסה.
 *   עיקרון 1: "אם ההנחה גסה, העיגול צריך להיות גס".
 *
 * המספרים כאן אינם ידיעה. הם מה שיקרה אם ההנחות שהמשתמש הזין יתקיימו בדיוק.
 */

import type { Assumptions } from '@/types/property';
import { CalcInputError, assertFinite, assertPositive, roundAgorot, roundCoarse } from './money';

/** שנה אחת בהרצה. */
export interface ScenarioYear {
  /** מספר השנה מתחילת ההרצה, החל מ-1. */
  readonly year: number;
  /** שווי הנכס בסוף השנה, לפי הנחת עליית הערך. מעוגל עיגול גס. */
  readonly propertyValue: number;
  /** שכר הדירה החודשי בשנה הזו, לפי הנחת עליית השכירות. */
  readonly monthlyRent: number;
  /** התזרים הנקי השנתי בשנה הזו. */
  readonly annualNetCashflow: number;
  /** סך התזרים הנקי המצטבר מתחילת ההרצה. */
  readonly cumulativeNetCashflow: number;
  /** יתרת המשכנתא בסוף השנה. */
  readonly mortgageBalance: number;
  /** ההון בנכס - שווי פחות יתרת משכנתא. */
  readonly equityInProperty: number;
}

/** תרחיש אחד בהרצה. */
export interface Scenario {
  /** 'central' ההנחה שהמשתמש הזין, 'low' ו-'high' ההנחה פלוס ומינוס הטווח. */
  readonly key: 'low' | 'central' | 'high';
  readonly label: string;
  /** הנחת עליית הערך שהופעלה בתרחיש הזה, בנקודות אחוז. */
  readonly assumedGrowthPct: number;
  /** הנחת עליית שכר הדירה שהופעלה בתרחיש הזה, בנקודות אחוז. */
  readonly assumedRentGrowthPct: number;
  readonly years: readonly ScenarioYear[];
  /** שווי הנכס בסוף תקופת ההרצה. */
  readonly endPropertyValue: number;
  /** סך התזרים הנקי לאורך כל תקופת ההרצה. */
  readonly totalNetCashflow: number;
  /** ההון בנכס בסוף תקופת ההרצה. */
  readonly endEquityInProperty: number;
}

/** תוצאת ההרצה המלאה. */
export interface ScenarioRun {
  /**
   * ההנחות ששימשו את ההרצה. הממשק חייב להציג אותן צמוד לכל מספר שנגזר מהן
   * (עיקרון 1). התוצאה לעולם לא מוחזרת בלעדיהן.
   */
  readonly assumptions: Assumptions;
  readonly horizonYears: number;
  readonly central: Scenario;
  readonly low: Scenario;
  readonly high: Scenario;
  /**
   * הבהרה מילולית לשימוש הממשק. מנוסחת כהנחה ולא כידיעה, בהתאם לטבלת
   * הניסוחים בעיקרון 1.
   */
  readonly disclaimer: string;
}

/** קלט להרצה. */
export interface ScenarioRunInput {
  /** מחיר הנכס בתחילת ההרצה. */
  readonly price: number;
  /** שכר הדירה החודשי בשנה הראשונה. */
  readonly monthlyRent: number;
  /** התזרים הנקי השנתי בשנה הראשונה. */
  readonly annualNetCashflow: number;
  /** ההוצאות השנתיות בשנה הראשונה, שגדלות לפי הנחת עליית ההוצאות. */
  readonly annualExpenses: number;
  /**
   * יתרת המשכנתא בסוף כל שנה, מלוח הסילוקין. אינדקס 0 הוא סוף שנה 1.
   * מערך ריק פירושו שאין משכנתא.
   */
  readonly mortgageBalanceByYear: readonly number[];
}

function buildScenario(
  key: Scenario['key'],
  label: string,
  growthPct: number,
  rentGrowthPct: number,
  input: ScenarioRunInput,
  assumptions: Assumptions,
): Scenario {
  const years: ScenarioYear[] = [];
  let cumulative = 0;

  for (let year = 1; year <= assumptions.horizonYears; year += 1) {
    const appreciationFactor = Math.pow(1 + growthPct / 100, year);
    const rentFactor = Math.pow(1 + rentGrowthPct / 100, year - 1);
    const expenseFactor = Math.pow(1 + assumptions.assumedExpenseGrowthPct / 100, year - 1);

    const monthlyRent = roundCoarse(input.monthlyRent * rentFactor);
    const propertyValue = roundCoarse(input.price * appreciationFactor);

    // התזרים בשנה N: ההכנסה גדלה לפי הנחת השכירות, ההוצאות לפי הנחת ההוצאות.
    // ההחזר על המשכנתא נומינלי וקבוע, ולכן אינו מוכפל בשום מקדם.
    const incomeDelta = input.annualNetCashflow + input.annualExpenses;
    const annualNetCashflow = roundCoarse(
      incomeDelta * rentFactor - input.annualExpenses * expenseFactor,
    );

    cumulative = roundAgorot(cumulative + annualNetCashflow);

    const balance = input.mortgageBalanceByYear[year - 1] ?? 0;

    years.push({
      year,
      propertyValue,
      monthlyRent,
      annualNetCashflow,
      cumulativeNetCashflow: roundCoarse(cumulative),
      mortgageBalance: roundAgorot(balance),
      equityInProperty: roundCoarse(propertyValue - balance),
    });
  }

  const last = years[years.length - 1];

  return {
    key,
    label,
    assumedGrowthPct: growthPct,
    assumedRentGrowthPct: rentGrowthPct,
    years,
    endPropertyValue: last ? last.propertyValue : roundCoarse(input.price),
    totalNetCashflow: last ? last.cumulativeNetCashflow : 0,
    endEquityInProperty: last ? last.equityInProperty : roundCoarse(input.price),
  };
}

/**
 * הרצת ההנחות של המשתמש קדימה, בשלושה תרחישים.
 *
 * זו אינה תחזית. זו הרצה אריתמטית של מה שהמשתמש הזין.
 */
export function runScenarios(input: ScenarioRunInput, assumptions: Assumptions): ScenarioRun {
  assertPositive('property.price', 'מחיר הנכס', input.price);
  assertFinite('assumptions.assumedAppreciationPct', 'הנחת עליית הערך', assumptions.assumedAppreciationPct);
  assertFinite('assumptions.assumedRentGrowthPct', 'הנחת עליית שכר הדירה', assumptions.assumedRentGrowthPct);
  assertFinite('assumptions.assumedExpenseGrowthPct', 'הנחת עליית ההוצאות', assumptions.assumedExpenseGrowthPct);
  assertFinite('assumptions.scenarioSpreadPoints', 'רוחב טווח התרחישים', assumptions.scenarioSpreadPoints);

  if (!Number.isInteger(assumptions.horizonYears) || assumptions.horizonYears < 1) {
    throw new CalcInputError(
      'assumptions.horizonYears',
      'מספר שנות ההרצה חייב להיות מספר שלם וגדול מאפס.',
    );
  }
  if (assumptions.scenarioSpreadPoints < 0) {
    throw new CalcInputError(
      'assumptions.scenarioSpreadPoints',
      'רוחב טווח התרחישים לא יכול להיות שלילי.',
    );
  }

  const spread = assumptions.scenarioSpreadPoints;
  const growth = assumptions.assumedAppreciationPct;
  const rentGrowth = assumptions.assumedRentGrowthPct;

  const central = buildScenario('central', 'ההנחה שהזנת', growth, rentGrowth, input, assumptions);
  const low = buildScenario(
    'low',
    `הנחה נמוכה ב-${spread} נקודות אחוז`,
    growth - spread,
    rentGrowth - spread,
    input,
    assumptions,
  );
  const high = buildScenario(
    'high',
    `הנחה גבוהה ב-${spread} נקודות אחוז`,
    growth + spread,
    rentGrowth + spread,
    input,
    assumptions,
  );

  return {
    assumptions,
    horizonYears: assumptions.horizonYears,
    central,
    low,
    high,
    disclaimer:
      `המספרים כאן הם הרצה של ההנחות שהזנת (${growth} אחוז עליית ערך ו-${rentGrowth} אחוז עליית שכר דירה בשנה), ` +
      `בטווח של פלוס ומינוס ${spread} נקודות אחוז. אלה לא נתונים ולא ידיעה על העתיד.`,
  };
}

/** חילוץ יתרת המשכנתא בסוף כל שנה מתוך לוח הסילוקין החודשי. */
export function yearEndBalances(
  monthlyBalances: readonly number[],
  horizonYears: number,
): readonly number[] {
  const result: number[] = [];
  for (let year = 1; year <= horizonYears; year += 1) {
    const index = year * 12 - 1;
    if (index < monthlyBalances.length) {
      result.push(monthlyBalances[index] ?? 0);
    } else {
      // מעבר לתקופת המשכנתא - ההלוואה סולקה.
      result.push(0);
    }
  }
  return result;
}
