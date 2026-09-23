/**
 * גרף קו קטן למגמת הריבית. SVG ידני - אין ספריית גרפים ב-bundle.
 * ציר הזמן נשאר LTR: מוקדם משמאל, עדכני מימין, כמקובל בגרפים פיננסיים.
 */
export function RateSparkline({ points }: { points: readonly number[] }) {
  if (points.length < 2) return null

  const w = 300
  const h = 48
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1

  const d = points
    .map((rate, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((rate - min) / span) * (h - 8) - 4
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 h-12 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={`מגמת ריבית בנק ישראל, מ-${points[0]} אחוז ל-${points[points.length - 1]} אחוז`}
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-primary)]" />
    </svg>
  )
}
