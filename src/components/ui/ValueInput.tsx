/**
 * שדה ערך: סליידר **וגם** הקלדה, אחוזים **וגם** סכום מוחלט.
 *
 * ## העיקרון שמונע את הבאג
 *
 * הגרסה הקודמת החזיקה את הערך ביחידה שהמשתמש **רואה**, וקראה ל-`onChange`
 * בזמן החלפת המתג. התוצאה: מעבר מ-₪ ל-% הפך עמלת מתווך של 40,000 ₪ ל-2,
 * והמנוע קיבל "2 שקלים". המספר על המסך נראה תקין, והחישוב מאחוריו נמחק.
 *
 * כאן ההפרדה מוחלטת:
 * - **`value` תמיד ביחידה הקנונית** (`unit`), ולעולם לא ביחידת התצוגה.
 * - **`onChange` תמיד מחזיר ביחידה הקנונית.**
 * - **`mode` משנה תצוגה בלבד.** החלפת מתג אינה משנה את הערך ואינה
 *   קוראת ל-`onChange` כלל, ולכן גם אין סחף עיגול בלחיצות חוזרות.
 *
 * `min`, `max` ו-`step` נמסרים ביחידה הקנונית ומומרים לתצוגה כאן, אחרת
 * סליידר עם `max` של 100,000 ₪ הופך במצב אחוזים לטווח של 100,000 אחוז.
 */

import { useId } from 'react'
import { cn } from '@/lib/cn'

export type ValueMode = 'percent' | 'amount'

export interface ValueInputProps {
  label: string
  /** הערך ביחידה הקנונית שמוגדרת ב-`unit`. */
  value: number
  /** מקבל את הערך ביחידה הקנונית, תמיד. */
  onChange: (value: number) => void
  /**
   * היחידה שבה `value` נשמר בקומפוננטה שמעל.
   * עלות נשמרת כ-`amount`, הנחה כמו עליית ערך נשמרת כ-`percent`.
   */
  unit: ValueMode
  /** יחידת התצוגה. אם לא נמסר `onModeChange`, אין מתג והתצוגה קבועה. */
  mode?: ValueMode
  onModeChange?: (mode: ValueMode) => void
  /** הבסיס להמרה בין אחוז לסכום. למשל מחיר הנכס. */
  base: number
  /** תווית הבסיס, להסבר. למשל "ממחיר הנכס". */
  baseLabel?: string
  /** כולם ביחידה הקנונית. */
  min?: number
  max?: number
  step?: number
  amountSuffix?: string
  /** תצוגה חלופית לערך, למשל "1.2 חודשים בשנה". גובר על תצוגת ההמרה. */
  valueDisplay?: string
  hint?: React.ReactNode
  className?: string
}

const fmt = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 })

/** אחוז מתוך בסיס -> סכום. */
const toAmount = (pct: number, base: number) => (pct / 100) * base
/** סכום -> אחוז מתוך בסיס. */
const toPercent = (amount: number, base: number) =>
  base > 0 ? (amount / base) * 100 : 0

export function ValueInput({
  label,
  value,
  onChange,
  unit,
  mode,
  onModeChange,
  base,
  baseLabel,
  min = 0,
  max,
  step,
  amountSuffix = '₪',
  valueDisplay,
  hint,
  className,
}: ValueInputProps) {
  const id = useId()

  // המתג זמין רק כשיש בסיס להמיר לפיו. בלעדיו אחוז חסר משמעות.
  const canSwitch = Boolean(onModeChange) && base > 0
  const shown: ValueMode = canSwitch && mode ? mode : unit
  const showingPercent = shown === 'percent'

  /** ערך קנוני -> ערך תצוגה. */
  const toShown = (canonical: number): number => {
    if (shown === unit) return canonical
    return unit === 'amount'
      ? toPercent(canonical, base)
      : toAmount(canonical, base)
  }

  /** ערך תצוגה -> ערך קנוני. זה מה שיוצא ב-onChange. */
  const toCanonical = (displayed: number): number => {
    if (shown === unit) return displayed
    return unit === 'amount'
      ? toAmount(displayed, base)
      : toPercent(displayed, base)
  }

  const displayed = toShown(value)

  // הגבולות מומרים יחד עם הערך, אחרת הסליידר נשבר בהחלפת מצב.
  const shownMin = toShown(min)
  const shownMax = toShown(
    max ?? (unit === 'percent' ? 100 : Math.max(base, 1)),
  )
  const shownStep = step
    ? Math.max(toShown(step), showingPercent ? 0.01 : 1)
    : showingPercent
      ? 0.1
      : Math.max(1, Math.round(shownMax / 200))

  // אחוז המילוי של הפס. מוגן מפני טווח מנוון.
  const fill =
    shownMax > shownMin
      ? Math.min(100, Math.max(0, ((displayed - shownMin) / (shownMax - shownMin)) * 100))
      : 0

  // הערך המקביל, כדי שלא צריך לחשב בראש.
  const other = showingPercent
    ? `${fmt.format(toAmount(displayed, base))} ${amountSuffix}`
    : `${fmt.format(toPercent(displayed, base))}%`

  const commit = (displayedValue: number) => {
    if (!Number.isFinite(displayedValue)) return
    onChange(toCanonical(displayedValue))
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-foreground)]">
          {label}
        </label>

        {canSwitch && (
          /*
           * מתג יחידת תצוגה - primary token למצב פעיל.
           * min-h-[44px] - אזור מגע מינימלי.
           */
          <div
            role="group"
            aria-label={`יחידת התצוגה של ${label}`}
            className="flex overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)] text-xs"
          >
            {(
              [
                ['percent', '%'],
                ['amount', amountSuffix],
              ] as const
            ).map(([m, symbol]) => (
              <button
                key={m}
                type="button"
                aria-pressed={shown === m}
                // שינוי תצוגה בלבד. הערך הקנוני לא זז, ולכן אין סחף עיגול.
                onClick={() => onModeChange?.(m)}
                className={cn(
                  'min-h-[44px] px-3 py-1 transition-colors',
                  shown === m
                    ? 'bg-[var(--color-brand-accent)] text-white'
                    : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]',
                )}
              >
                {symbol}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/*
         * RTL: `dir="rtl"` על ה-input, כמו ברכיב Slider, כדי ששני הסליידרים
         * בפרויקט יתנהגו אותו דבר. scaleX(-1) היה הופך גם את טבעת הפוקוס
         * ואת כיוון מקשי החצים.
         *
         * gradient: var(--color-primary) ו-var(--color-border) במקום hex.
         * שינוי זה מאפשר תמיכה נכונה ב-dark mode.
         */}
        <input
          id={id}
          type="range"
          dir="rtl"
          min={shownMin}
          max={shownMax}
          step={shownStep}
          value={displayed}
          onChange={(e) => commit(Number(e.target.value))}
          aria-valuetext={valueDisplay ?? `${fmt.format(displayed)}${showingPercent ? '%' : ''}`}
          className="h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:size-[22px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--color-primary)] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow"
          style={{
            background: `linear-gradient(to left, var(--color-brand-accent) ${fill}%, var(--color-border) ${fill}%)`,
            backgroundSize: '100% 6px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* תיבת הקלדה מספרית */}
        <span className="flex w-28 shrink-0 items-center gap-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] px-2 focus-within:border-[var(--color-ring)] focus-within:ring-2 focus-within:ring-[var(--color-ring)]/20">
          <input
            type="number"
            dir="ltr"
            inputMode="decimal"
            value={Math.round(displayed * 100) / 100}
            min={shownMin}
            step={shownStep}
            onChange={(e) => commit(Number(e.target.value))}
            className="w-full bg-transparent py-2 text-start tabular-nums outline-none"
          />
          <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">
            {showingPercent ? '%' : amountSuffix}
          </span>
        </span>
      </div>

      {(valueDisplay || base > 0) && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          <span dir="ltr" className="tabular-nums">
            {valueDisplay ?? other}
          </span>
          {!valueDisplay && baseLabel && <span> {baseLabel}</span>}
        </p>
      )}

      {hint && <div className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">{hint}</div>}
    </div>
  )
}
