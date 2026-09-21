/**
 * גרף הרווח ממכירה לאורך זמן.
 *
 * מצויר ידנית ב-d3-scale ו-d3-shape, בלי recharts (dependency-audit.md).
 *
 * שני כללי RTL:
 * - **ציר X נשאר LTR.** זמן הוא קונבנציה אוניברסלית - שנה 1 בשמאל.
 * - **ציר Y עובר לימין**, כי העין העברית מתחילה שם.
 *
 * ובאג מהמוצר הקודם שלא חוזר כאן: **ערכים שליליים נושאים סימן מינוס.**
 * שם התוויות מתחת לאפס הוצגו "150K" במקום "-150K".
 */

import { useMemo, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { line as d3Line, area as d3Area, curveMonotoneX } from 'd3-shape'
import type { SaleAtYear } from '@/lib/calc'
import { formatCompactILS, formatILS } from '@/lib/format'

const H = 240
const PAD = { top: 16, right: 64, bottom: 28, left: 12 }

export function ProfitChart({
  rows,
  appreciationPct,
}: {
  rows: readonly SaleAtYear[]
  appreciationPct: number
}) {
  const [hover, setHover] = useState<SaleAtYear | null>(null)
  const [width, setWidth] = useState(640)

  const { linePath, areaPath, x, y, ticks, zeroY } = useMemo(() => {
    const innerW = Math.max(120, width - PAD.left - PAD.right)
    const innerH = H - PAD.top - PAD.bottom

    const xs = rows.map((r) => r.year)
    const ys = rows.map((r) => r.totalProfit)
    const minY = Math.min(0, ...ys)
    const maxY = Math.max(0, ...ys)

    // ציר X נשאר LTR: שנה 1 בשמאל.
    const x = scaleLinear()
      .domain([Math.min(...xs), Math.max(...xs)])
      .range([PAD.left, PAD.left + innerW])
    const y = scaleLinear()
      .domain([minY, maxY])
      .nice()
      .range([PAD.top + innerH, PAD.top])

    const linePath =
      d3Line<SaleAtYear>()
        .x((d) => x(d.year))
        .y((d) => y(d.totalProfit))
        .curve(curveMonotoneX)(rows as SaleAtYear[]) ?? ''

    const areaPath =
      d3Area<SaleAtYear>()
        .x((d) => x(d.year))
        .y0(y(0))
        .y1((d) => y(d.totalProfit))
        .curve(curveMonotoneX)(rows as SaleAtYear[]) ?? ''

    return { linePath, areaPath, x, y, ticks: y.ticks(5), zeroY: y(0) }
  }, [rows, width])

  if (rows.length < 2) return null

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-base font-semibold">רווח כולל לפי שנת המכירה</h3>
        <p className="mt-1 text-xs text-slate-500">
          לפי ההנחה שלך של{' '}
          <span dir="ltr" className="tabular-nums">
            {appreciationPct}%
          </span>{' '}
          עליית ערך בשנה. הרווח כולל את התזרים שנצבר ואת המס. זו הרצה של ההנחות
          שלך, לא תחזית.
        </p>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
        ref={(el) => {
          if (el && el.clientWidth !== width) setWidth(el.clientWidth)
        }}
      >
        <svg
          viewBox={`0 0 ${width} ${H}`}
          width="100%"
          height={H}
          role="img"
          aria-label="גרף הרווח הכולל לפי שנת המכירה"
        >
          {/* קווי רשת ותוויות ציר Y - בימין */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? '#94a3b8' : '#e2e8f0'}
                strokeDasharray={t === 0 ? undefined : '3 3'}
              />
              <text
                x={width - PAD.right + 8}
                y={y(t) + 4}
                fontSize="11"
                fill="#64748b"
                direction="ltr"
              >
                {/* סימן המינוס נשמר במכוון. */}
                {formatCompactILS(t)}
              </text>
            </g>
          ))}

          <path d={areaPath} fill="#6366f1" fillOpacity={0.12} />
          <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth={2} />

          {/* נקודות ואזורי מגע */}
          {rows.map((r) => (
            <g key={r.year}>
              <circle
                cx={x(r.year)}
                cy={y(r.totalProfit)}
                r={hover?.year === r.year ? 5 : 3}
                fill={r.totalProfit >= 0 ? '#059669' : '#e11d48'}
              />
              <rect
                x={x(r.year) - 14}
                y={PAD.top}
                width={28}
                height={H - PAD.top - PAD.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(r)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(r)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                role="button"
                aria-label={`שנה ${r.year}`}
              />
            </g>
          ))}

          {/* תוויות ציר X - LTR */}
          {rows
            .filter((_, i) => i === 0 || i === rows.length - 1 || (r0(rows, i) % 5 === 0))
            .map((r) => (
              <text
                key={r.year}
                x={x(r.year)}
                y={H - 8}
                fontSize="11"
                fill="#64748b"
                textAnchor="middle"
              >
                {r.year}
              </text>
            ))}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={zeroY}
            y2={zeroY}
            stroke="#94a3b8"
          />
        </svg>

        {hover && (
          <div className="pointer-events-none absolute inset-x-2 top-2 rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-white sm:inset-x-auto sm:start-2">
            <div className="font-semibold">מכירה בשנה {hover.year}</div>
            <div className="mt-1 space-y-0.5">
              <div>
                שווי הנכס:{' '}
                <span dir="ltr" className="tabular-nums">
                  {formatCompactILS(hover.propertyValue)}
                </span>
              </div>
              <div>
                רווח כולל:{' '}
                <span dir="ltr" className="tabular-nums">
                  {formatILS(hover.totalProfit)}
                </span>
              </div>
              <div>
                תשואה שנתית ממוצעת:{' '}
                <span dir="ltr" className="tabular-nums">
                  {hover.averageAnnualReturnPct === null
                    ? '-'
                    : `${hover.averageAnnualReturnPct.toFixed(1)}%`}
                </span>
              </div>
              <div>
                מס שבח:{' '}
                <span dir="ltr" className="tabular-nums">
                  {hover.capitalGains.exemptionApplied
                    ? 'פטור'
                    : formatCompactILS(hover.capitalGains.taxAmount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        הקו חוצה את האפס בנקודה שבה הרווח הכולל מכסה את ההון שהושקע. ציר השנים
        נקרא משמאל לימין.
      </p>
    </section>
  )
}

/** מספר השנה בפריט i, לצורך סינון תוויות. */
function r0(rows: readonly SaleAtYear[], i: number): number {
  return rows[i]?.year ?? 0
}
