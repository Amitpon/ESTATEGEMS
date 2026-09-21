/**
 * לוחות סילוקין.
 *
 * שני סוגים: שפיצר (החזר חודשי קבוע) וקרן שווה (החזר קרן קבוע).
 * תמיכה בתמהיל - מערך מסלולים, כל אחד עם קרן, ריבית, תקופה וסוג לוח משלו.
 *
 * הערה: לוח הסילוקין נבנה במלואו, ללא קטימה. EstateGems קוטע ל-120 חודשים
 * (docs/research/estategems-teardown.md סעיף 3, "שבור" פריט 4) - זה באג.
 * משכנתא ל-30 שנה היא 360 חודשים ואנחנו מחזירים את כולם.
 */

import type { AmortizationKind, LoanTrack } from '@/types/property';
import {
  CalcInputError,
  assertNonNegative,
  assertPositive,
  pctToFraction,
  roundAgorot,
} from './money';

/** שורה אחת בלוח הסילוקין. */
export interface AmortizationRow {
  /** מספר החודש, החל מ-1. */
  readonly month: number;
  /** ההחזר החודשי הכולל. */
  readonly payment: number;
  /** רכיב הקרן בהחזר. */
  readonly principal: number;
  /** רכיב הריבית בהחזר. */
  readonly interest: number;
  /** יתרת הקרן בסוף החודש. */
  readonly balance: number;
}

/** לוח סילוקין של מסלול אחד. */
export interface TrackSchedule {
  readonly trackId: string;
  readonly label: string;
  readonly amortization: AmortizationKind;
  readonly principal: number;
  readonly annualRatePct: number;
  readonly termMonths: number;
  /** כל החודשים, ללא קטימה. */
  readonly rows: readonly AmortizationRow[];
  /** ההחזר בחודש הראשון. בשפיצר זה גם ההחזר הקבוע. */
  readonly firstPayment: number;
  /** ההחזר בחודש האחרון. */
  readonly lastPayment: number;
  /** סך הריבית לאורך כל התקופה. */
  readonly totalInterest: number;
  /** סך התשלומים לאורך כל התקופה. */
  readonly totalPaid: number;
}

/** לוח סילוקין מאוחד של כל התמהיל. */
export interface MortgageResult {
  /** סך קרן ההלוואה. */
  readonly loanAmount: number;
  readonly tracks: readonly TrackSchedule[];
  /** לוח מאוחד - סכום כל המסלולים בכל חודש. אורכו כאורך המסלול הארוך ביותר. */
  readonly combinedRows: readonly AmortizationRow[];
  /** ההחזר החודשי בחודש הראשון, סך כל המסלולים. */
  readonly firstMonthlyPayment: number;
  readonly totalInterest: number;
  readonly totalPaid: number;
  /** אורך התקופה הארוכה ביותר בתמהיל, בחודשים. */
  readonly maxTermMonths: number;
}

/**
 * ההחזר החודשי בלוח שפיצר.
 * P * r / (1 - (1 + r)^-n), כאשר r היא הריבית החודשית ו-n מספר החודשים.
 * בריבית אפס ההחזר הוא פשוט הקרן חלקי מספר החודשים.
 */
export function spitzerMonthlyPayment(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  assertNonNegative('principal', 'קרן ההלוואה', principal);
  assertNonNegative('annualRatePct', 'ריבית שנתית', annualRatePct);
  assertPositive('termMonths', 'תקופת ההלוואה בחודשים', termMonths);
  if (principal === 0) return 0;
  const monthlyRate = pctToFraction(annualRatePct) / 12;
  if (monthlyRate === 0) return roundAgorot(principal / termMonths);
  const factor = Math.pow(1 + monthlyRate, -termMonths);
  return roundAgorot((principal * monthlyRate) / (1 - factor));
}

/** בניית לוח סילוקין מלא למסלול אחד. */
export function buildTrackSchedule(track: LoanTrack): TrackSchedule {
  assertNonNegative(`track.${track.id}.principal`, `קרן המסלול "${track.label}"`, track.principal);
  assertNonNegative(`track.${track.id}.annualRatePct`, `ריבית המסלול "${track.label}"`, track.annualRatePct);
  assertPositive(`track.${track.id}.termMonths`, `תקופת המסלול "${track.label}"`, track.termMonths);
  if (!Number.isInteger(track.termMonths)) {
    throw new CalcInputError(
      `track.${track.id}.termMonths`,
      `תקופת המסלול "${track.label}" חייבת להיות מספר שלם של חודשים.`,
    );
  }

  const monthlyRate = pctToFraction(track.annualRatePct) / 12;
  const rows: AmortizationRow[] = [];
  let balance = roundAgorot(track.principal);

  const fixedPayment =
    track.amortization === 'spitzer'
      ? spitzerMonthlyPayment(track.principal, track.annualRatePct, track.termMonths)
      : 0;
  const fixedPrincipal =
    track.amortization === 'equalPrincipal' ? roundAgorot(track.principal / track.termMonths) : 0;

  for (let month = 1; month <= track.termMonths; month += 1) {
    const interest = roundAgorot(balance * monthlyRate);
    const isLast = month === track.termMonths;

    let principalPart: number;
    if (track.amortization === 'spitzer') {
      principalPart = roundAgorot(fixedPayment - interest);
    } else {
      principalPart = fixedPrincipal;
    }

    // בחודש האחרון מסלקים בדיוק את היתרה, כדי שסחיפת העיגול לא תשאיר שארית.
    if (isLast || principalPart > balance) {
      principalPart = balance;
    }

    const payment = roundAgorot(principalPart + interest);
    balance = roundAgorot(balance - principalPart);
    rows.push({ month, payment, principal: principalPart, interest, balance });
  }

  let totalInterest = 0;
  let totalPaid = 0;
  for (const row of rows) {
    totalInterest = roundAgorot(totalInterest + row.interest);
    totalPaid = roundAgorot(totalPaid + row.payment);
  }

  const first = rows[0];
  const last = rows[rows.length - 1];

  return {
    trackId: track.id,
    label: track.label,
    amortization: track.amortization,
    principal: roundAgorot(track.principal),
    annualRatePct: track.annualRatePct,
    termMonths: track.termMonths,
    rows,
    firstPayment: first ? first.payment : 0,
    lastPayment: last ? last.payment : 0,
    totalInterest,
    totalPaid,
  };
}

/**
 * בניית לוח סילוקין לתמהיל שלם.
 *
 * @param tracks מסלולי התמהיל.
 * @param expectedLoanAmount סכום ההלוואה שהתמהיל אמור לכסות. סכום הקרנות חייב להיות שווה לו.
 * @param toleranceAgorot סטייה מותרת בשקלים בין סכום הקרנות לסכום ההלוואה.
 */
export function buildMortgage(
  tracks: readonly LoanTrack[],
  expectedLoanAmount: number,
  toleranceAgorot = 1,
): MortgageResult {
  assertNonNegative('financing.loanAmount', 'סכום ההלוואה', expectedLoanAmount);

  if (expectedLoanAmount === 0) {
    if (tracks.length > 0 && tracks.some((t) => t.principal > 0)) {
      throw new CalcInputError(
        'financing.tracks',
        'סכום ההלוואה הוא 0 אך הוגדרו מסלולי משכנתא. הסר את המסלולים או הגדל את סכום ההלוואה.',
      );
    }
    return {
      loanAmount: 0,
      tracks: [],
      combinedRows: [],
      firstMonthlyPayment: 0,
      totalInterest: 0,
      totalPaid: 0,
      maxTermMonths: 0,
    };
  }

  if (tracks.length === 0) {
    throw new CalcInputError(
      'financing.tracks',
      'לא הוגדר אף מסלול משכנתא, אך סכום ההלוואה גדול מאפס. הוסף לפחות מסלול אחד.',
    );
  }

  const seenIds = new Set<string>();
  for (const track of tracks) {
    if (seenIds.has(track.id)) {
      throw new CalcInputError('financing.tracks', `מזהה מסלול כפול: "${track.id}". לכל מסלול חייב להיות מזהה ייחודי.`);
    }
    seenIds.add(track.id);
  }

  let principalSum = 0;
  for (const track of tracks) {
    principalSum = roundAgorot(principalSum + track.principal);
  }

  if (Math.abs(principalSum - expectedLoanAmount) > toleranceAgorot) {
    const diff = roundAgorot(principalSum - expectedLoanAmount);
    const direction = diff > 0 ? 'גדול' : 'קטן';
    throw new CalcInputError(
      'financing.tracks',
      `סכום מסלולי התמהיל (${principalSum} ש"ח) ${direction} מסכום ההלוואה (${expectedLoanAmount} ש"ח) ב-${Math.abs(
        diff,
      )} ש"ח. התאם את הקרנות כך שיסתכמו בדיוק בסכום ההלוואה.`,
    );
  }

  const schedules = tracks.map(buildTrackSchedule);
  const maxTermMonths = Math.max(...schedules.map((s) => s.termMonths));

  const combinedRows: AmortizationRow[] = [];
  for (let month = 1; month <= maxTermMonths; month += 1) {
    let payment = 0;
    let principal = 0;
    let interest = 0;
    let balance = 0;
    for (const schedule of schedules) {
      const row = schedule.rows[month - 1];
      if (row) {
        payment = roundAgorot(payment + row.payment);
        principal = roundAgorot(principal + row.principal);
        interest = roundAgorot(interest + row.interest);
        balance = roundAgorot(balance + row.balance);
      }
      // מסלול שהסתיים תורם 0 לתשלום ו-0 ליתרה, ולכן אין צורך בענף else.
    }
    combinedRows.push({ month, payment, principal, interest, balance });
  }

  let totalInterest = 0;
  let totalPaid = 0;
  for (const schedule of schedules) {
    totalInterest = roundAgorot(totalInterest + schedule.totalInterest);
    totalPaid = roundAgorot(totalPaid + schedule.totalPaid);
  }

  const firstRow = combinedRows[0];

  return {
    loanAmount: roundAgorot(expectedLoanAmount),
    tracks: schedules,
    combinedRows,
    firstMonthlyPayment: firstRow ? firstRow.payment : 0,
    totalInterest,
    totalPaid,
    maxTermMonths,
  };
}

/** תוצאת חישוב עמלת פירעון מוקדם. */
export interface EarlyRepaymentResult {
  /** החודש שבו מתבצע הפירעון. */
  readonly atMonth: number;
  /** יתרת הקרן באותו חודש. */
  readonly outstandingBalance: number;
  readonly feePct: number;
  readonly fee: number;
  /** סך הסילוק - היתרה בתוספת העמלה. */
  readonly totalPayoff: number;
}

/**
 * עמלת פירעון מוקדם על היתרה הלא מסולקת בחודש נתון.
 *
 * @param mortgage תוצאת לוח הסילוקין.
 * @param atMonth החודש שבו נפרעת ההלוואה, החל מ-1.
 * @param feePct שיעור העמלה מהיתרה, בנקודות אחוז.
 */
export function calcEarlyRepayment(
  mortgage: MortgageResult,
  atMonth: number,
  feePct: number,
): EarlyRepaymentResult {
  assertNonNegative('financing.earlyRepaymentFeePct', 'עמלת פירעון מוקדם', feePct);
  if (!Number.isInteger(atMonth) || atMonth < 1) {
    throw new CalcInputError('earlyRepayment.atMonth', 'חודש הפירעון המוקדם חייב להיות מספר שלם החל מ-1.');
  }
  if (atMonth > mortgage.maxTermMonths) {
    throw new CalcInputError(
      'earlyRepayment.atMonth',
      `חודש הפירעון המוקדם (${atMonth}) חורג מתקופת המשכנתא (${mortgage.maxTermMonths} חודשים).`,
    );
  }

  const row = mortgage.combinedRows[atMonth - 1];
  const outstandingBalance = row ? row.balance : 0;
  const fee = roundAgorot((outstandingBalance * feePct) / 100);

  return {
    atMonth,
    outstandingBalance,
    feePct,
    fee,
    totalPayoff: roundAgorot(outstandingBalance + fee),
  };
}
