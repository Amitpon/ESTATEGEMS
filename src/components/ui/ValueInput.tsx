/**
 * שדה ערך דו-מצבי: סליידר **וגם** הקלדה, אחוזים **וגם** סכום מוחלט.
 *
 * שלוש בעיות שהוא פותר, כולן דיווח של בעל המוצר:
 * 1. סליידר לבד לא מאפשר ערך מדויק. יש כאן תיבת קלט לצד הסליידר.
 * 2. לפעמים נוח לחשוב באחוזים ולפעמים בשקלים. המתג ממיר בשני הכיוונים.
 * 3. RTL: `input[type=range]` לא עקבי בין דפדפנים, ולכן היפוך מפורש.
 */

import { useId } from 'react'
import { cn } from '@/lib/cn'

export type ValueMode = 'percent' | 'amount'

export interface ValueInputProps {
  label: string
  /** הערך בתצוגה הנוכחית. */
  value: number
  onChange: (value: number) => void
  mode: ValueMode
  onModeChange?: (mode: ValueMode) => void
  /** הבסיס להמרה בין אחוז לסכום. למשל מחיר הנכס. */
  base: number
  /** תווית הבסיס, להסבר. למשל "ממחיר הנכס". */
  baseLabel?: string
  min?: number
  max?: number
  step?: number
  /** סיומת לתצוגת סכום. */
  amountSuffix?: string
  hint?: React.ReactNode
  className?: string
}

/** ממיר אחוז לסכום ולהפך, כדי שהמתג לא ישנה את המשמעות. */
function convert(value: number, from: ValueMode, base: number): number {
  if (base <= 0) return value
  if (from === 'percent') return Math.round((value / 100) * base)
  return Math.round((value / base) * 1000) / 10
}

export function ValueInput({
  label,
  value,
  onChange,
  mode,
  onModeChange,
  base,
  baseLabel,
  min = 0,
  max,
  step,
  amountSuffix = '₪',
  hint,
  className,
}: ValueInputProps) {
  const id = useId()

  const isPct = mode === 'percent'
  const sliderMax = max ?? (isPct ? 100 : Math.max(base, 1))
  const sliderStep = step ?? (isPct ? 0.5 : Math.max(1, Math.round(base / 200)))
  const pct = sliderMax > min ? ((value - min) / (sliderMax - min)) * 100 : 0

  // הערך המקביל במצב השני, מוצג כדי שלא צריך לחשב בראש.
  const other = convert(value, mode, base)

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>

        {onModeChange && base > 0 && (
          <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs">
            <button
              type="button"
              aria-pressed={isPct}
              onClick={() => {
                if (!isPct) onChange(convert(value, 'amount', base))
                onModeChange('percent')
              }}
              className={cn('px-2 py-1', isPct ? 'bg-indigo-600 text-white' : 'text-slate-600')}
            >
              %
            </button>
            <button
              type="button"
              aria-pressed={!isPct}
              onClick={() => {
                if (isPct) onChange(convert(value, 'percent', base))
                onModeChange('amount')
              }}
              className={cn('px-2 py-1', !isPct ? 'bg-indigo-600 text-white' : 'text-slate-600')}
            >
              ₪
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* RTL: input[type=range] אינו עקבי בין דפדפנים, ולכן היפוך מפורש
            והיפוך חוזר אינו נדרש כי אין תוכן פנימי. */}
        <input
          id={id}
          type="range"
          min={min}
          max={sliderMax}
          step={sliderStep}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-11 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600"
          style={{
            transform: 'scaleX(-1)',
            background: `linear-gradient(to right, #e2e8f0 ${100 - pct}%, #6366f1 ${100 - pct}%)`,
            backgroundSize: '100% 6px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        <span className="flex w-32 shrink-0 items-center gap-1 rounded-xl border border-slate-300 bg-white px-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
          <input
            type="number"
            dir="ltr"
            value={value}
            min={min}
            step={sliderStep}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className="w-full bg-transparent py-2 text-start tabular-nums outline-none"
          />
          <span className="shrink-0 text-xs text-slate-500">
            {isPct ? '%' : amountSuffix}
          </span>
        </span>
      </div>

      {base > 0 && (
        <p className="text-xs text-slate-500">
          <span dir="ltr" className="tabular-nums">
            {isPct
              ? `${new Intl.NumberFormat('he-IL').format(other)} ${amountSuffix}`
              : `${other}%`}
          </span>
          {baseLabel && <span> {baseLabel}</span>}
        </p>
      )}

      {hint && <div className="text-xs leading-relaxed text-slate-500">{hint}</div>}
    </div>
  )
}
