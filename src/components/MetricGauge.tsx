/**
 * MetricGauge - gauge עגול SVG למדדי תשואה מרכזיים.
 *
 * בהשראת WaterPod glassmorphic tablet UI: טבעת התקדמות פשוטה,
 * track בצבע border, fill ב-brand-accent, מספר במרכז.
 *
 * ## חוקים מוצריים
 * - מותר רק ל-3-4 מדדי תשואה מרכזיים (לא לכל מדד).
 * - בהדפסה: [data-gauge-svg] מוסתר, [data-gauge-text] מוצג.
 *   ה-CSS ב-index.css מטפל בזה דרך @media print.
 * - אין gauge "עסקה טובה" / המלצה - עיקרון מוצר 1.
 *
 * ## RTL
 * SVG עובד ב-coordinate space גאומטרי - כיוון הגאוג' (clockwise)
 * אינו תלוי בכיוון הטקסט. הטקסט במרכז נרנדר ב-dir="ltr" כי מדובר
 * במספר (tabular, LTR תמיד).
 */

interface MetricGaugeProps {
  /** ערך בין 0 ל-100 (אחוז) */
  value: number
  /** מקסימום לצורך חישוב קשת - ברירת מחדל 100 */
  max?: number
  /** label מתחת למספר */
  label: string
  /** המספר הפורמטי להצגה במרכז */
  displayValue: string
  /** סטטוס סמנטי - קובע את צבע ה-fill */
  tone?: 'positive' | 'warning' | 'destructive' | 'neutral'
  /** גודל SVG בפיקסלים - ברירת מחדל 96 */
  size?: number
}

const TONE_FILL: Record<NonNullable<MetricGaugeProps['tone']>, string> = {
  positive: 'var(--color-positive)',
  warning: 'var(--color-warning)',
  destructive: 'var(--color-destructive)',
  neutral: 'var(--color-brand-accent)',
}

/** מחשב arc SVG path לטבעת חלקית. */
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const sx = cx + r * Math.cos(toRad(startDeg))
  const sy = cy + r * Math.sin(toRad(startDeg))
  const ex = cx + r * Math.cos(toRad(endDeg))
  const ey = cy + r * Math.sin(toRad(endDeg))
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`
}

export function MetricGauge({
  value,
  max = 100,
  label,
  displayValue,
  tone = 'neutral',
  size = 96,
}: MetricGaugeProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))

  // הגאוג' מתחיל ב-135 מעלות (שמאל-תחתון) ומסתיים ב-45 מעלות (ימין-תחתון)
  // כלומר 270 מעלות של קשת (3/4 עיגול).
  const startDeg = 135
  const totalSweep = 270
  const endDeg = startDeg + (totalSweep * pct) / 100

  const cx = size / 2
  const cy = size / 2
  const strokeWidth = size * 0.1
  const r = (size - strokeWidth) / 2 - 2

  const trackPath = describeArc(cx, cy, r, 135, 135 + totalSweep)
  const fillPath = pct > 0 ? describeArc(cx, cy, r, startDeg, Math.min(startDeg + totalSweep - 0.1, endDeg)) : null
  const fillColor = TONE_FILL[tone]

  return (
    <div className="flex flex-col items-center gap-1">
      {/* SVG gauge - מוסתר בהדפסה דרך [data-gauge-svg] */}
      <div data-gauge-svg aria-hidden="true">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ overflow: 'visible' }}
        >
          {/* track - הרקע האפור */}
          <path
            d={trackPath}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* fill - ה-arc הצבעוני */}
          {fillPath && (
            <path
              d={fillPath}
              fill="none"
              stroke={fillColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          )}
          {/* מספר במרכז - dir="ltr" כי מדובר בנתון מספרי */}
          <text
            x={cx}
            y={cy + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={size * 0.22}
            fontWeight="700"
            fontFamily="Heebo, sans-serif"
            fill={pct > 0 ? fillColor : 'var(--color-muted-foreground)'}
            direction="ltr"
          >
            {displayValue}
          </text>
        </svg>
      </div>

      {/* גרסה טקסטואלית לדפוס - מוסתרת במסך, גלויה בהדפסה */}
      <div
        data-gauge-text
        className="hidden"
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: fillColor,
          direction: 'ltr',
        }}
      >
        {displayValue}
      </div>

      {/* label מתחת - <div> בכוונה, לא <span>: תוויות שעלולות להופיע פעמיים
          במסך (למשל גם ככותרת עמודה בטבלת רגישות הריבית) מסוקפות ל-div
          בטסטים - ראה CLAUDE.md סעיף "טסטים". */}
      <div className="text-center text-xs leading-snug text-[var(--color-muted-foreground)]">
        {label}
      </div>
    </div>
  )
}
