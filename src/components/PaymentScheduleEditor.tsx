/**
 * עורך לוח התשלומים לרכישה מקבלן.
 *
 * זה המסך שקובע **מתי כל שקל יוצא מהכיס**, ולכן הוא קודם לכל השאר:
 * ממנו נגזר המכנה של התשואה בכל נקודת מכירה.
 *
 * לכל שלב: תאריך, אחוז ממחיר הנכס, ומקור המימון - הון עצמי או משכנתא.
 * לכל עלות נלווית: לאיזה שלב היא משויכת.
 */

import type { FundingSource, IsoDate, PaymentStage } from '@/types/property'
import { Card } from '@/components/ui/Card'
import { ValueInput } from '@/components/ui/ValueInput'
import { formatILS } from '@/lib/format'

/** העלויות שניתן לשייך לשלב. המפתחות תואמים ל-equity.lines. */
export const ASSIGNABLE_COSTS = [
  { key: 'purchaseTax', label: 'מס רכישה' },
  { key: 'lawyerFee', label: 'שכר טרחת עורך דין' },
  { key: 'brokerFee', label: 'דמי תיווך' },
  { key: 'mortgageAdvisorFee', label: 'יועץ משכנתאות' },
  { key: 'finishing', label: 'עלויות גמר' },
] as const

function SourceToggle({
  value,
  onChange,
}: {
  value: FundingSource
  onChange: (v: FundingSource) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs">
      {(
        [
          ['equity', 'הון עצמי'],
          ['mortgage', 'משכנתא'],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={
            value === key
              ? 'bg-indigo-600 px-3 py-1.5 text-white'
              : 'px-3 py-1.5 text-slate-600'
          }
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function PaymentScheduleEditor({
  price,
  stages,
  onStagesChange,
  occupancyDate,
  onOccupancyDateChange,
  costAmounts,
  stageDates,
  onStageDatesChange,
}: {
  price: number
  stages: readonly PaymentStage[]
  onStagesChange: (stages: PaymentStage[]) => void
  occupancyDate: IsoDate
  onOccupancyDateChange: (d: IsoDate) => void
  /** הסכומים בפועל של העלויות, לתצוגה בלבד. */
  costAmounts: Readonly<Record<string, number>>
  stageDates: Readonly<Record<string, IsoDate>>
  onStageDatesChange: (m: Record<string, IsoDate>) => void
}) {
  const totalPct = stages.reduce((s, st) => s + st.percentOfPrice, 0)
  const equityPct = stages
    .filter((s) => s.fundingSource === 'equity')
    .reduce((s, st) => s + st.percentOfPrice, 0)

  const update = (i: number, patch: Partial<PaymentStage>) => {
    onStagesChange(stages.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  const addStage = () => {
    const last = stages[stages.length - 1]
    const nextDate = last ? last.dueDate : new Date().toISOString().slice(0, 10)
    onStagesChange([
      ...stages,
      {
        id: `stage-${Date.now()}`,
        label: `תשלום ${stages.length + 1}`,
        percentOfPrice: Math.max(0, 100 - totalPct),
        dueDate: nextDate,
        linkedToIndex: true,
        fundingSource: 'equity',
      },
    ])
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">לוח התשלומים</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          מתי כל תשלום יוצא, כמה אחוז ממחיר הנכס, ומאיפה הכסף מגיע. זה קובע את
          המכנה של התשואה: מכירה מוקדמת נמדדת מול ההון שהושקע עד אז בלבד.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          תאריך אכלוס צפוי (טופס 4)
        </label>
        <input
          type="date"
          dir="ltr"
          value={occupancyDate}
          onChange={(e) => onOccupancyDateChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-start tabular-nums outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          18 חודשי ההחזקה לפטור ממס שבח נספרים מכאן, לא מחתימת החוזה.{' '}
          <span className="text-amber-700">הכלל לא אומת מול רשות המסים.</span>
        </p>
      </div>

      {stages.map((stage, i) => (
        <Card key={stage.id} className="space-y-3 p-3">
          <div className="flex items-center gap-2">
            <input
              value={stage.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => onStagesChange(stages.filter((_, idx) => idx !== i))}
              aria-label={`מחק ${stage.label}`}
              className="rounded-lg px-2 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
            >
              מחק
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600">תאריך</label>
              <input
                type="date"
                dir="ltr"
                value={stage.dueDate}
                onChange={(e) => update(i, { dueDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-start text-sm tabular-nums outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                מקור המימון
              </label>
              <div className="mt-1">
                <SourceToggle
                  value={stage.fundingSource}
                  onChange={(v) => update(i, { fundingSource: v })}
                />
              </div>
            </div>
          </div>

          <ValueInput
            label="אחוז ממחיר הנכס"
            value={stage.percentOfPrice}
            onChange={(v) => update(i, { percentOfPrice: v })}
            mode="percent"
            base={price}
            baseLabel="ממחיר הנכס"
            max={100}
            step={0.5}
          />

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={stage.linkedToIndex}
              onChange={(e) => update(i, { linkedToIndex: e.target.checked })}
              className="size-4 rounded border-slate-300"
            />
            צמוד למדד תשומות הבנייה
          </label>
        </Card>
      ))}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={addStage}
          className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-700"
        >
          הוסף תשלום
        </button>
        <div className="text-start text-sm">
          <div
            className={
              Math.abs(totalPct - 100) < 0.01
                ? 'text-emerald-700'
                : 'font-medium text-rose-700'
            }
          >
            <span dir="ltr" className="tabular-nums">
              {totalPct.toFixed(1)}%
            </span>{' '}
            מתוך 100%
          </div>
          <div className="text-xs text-slate-500">
            מזה מהון עצמי:{' '}
            <span dir="ltr" className="tabular-nums">
              {equityPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {Math.abs(totalPct - 100) >= 0.01 && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          סכום התשלומים חייב להיות בדיוק 100%. כרגע חסרים או עודפים{' '}
          <span dir="ltr" className="tabular-nums">
            {(100 - totalPct).toFixed(1)}%
          </span>
          . עד שזה יתוקן לוח התשלומים לא מופעל בחישוב.
        </p>
      )}

      <div className="space-y-2 border-t border-slate-200 pt-3">
        <h4 className="text-sm font-medium">מתי משלמים את העלויות הנלוות</h4>
        <p className="text-xs text-slate-500">
          מס רכישה ועו"ד בדרך כלל עם התשלום הראשון. יועץ משכנתאות בדרך כלל סביב
          האכלוס. עלות שלא שויכה משולמת בשלב הראשון.
        </p>
        {ASSIGNABLE_COSTS.filter((c) => (costAmounts[c.key] ?? 0) > 0).map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {c.label}{' '}
              <span dir="ltr" className="tabular-nums text-slate-500">
                {formatILS(costAmounts[c.key] ?? 0)}
              </span>
            </span>
            <select
              value={stageDates[c.key] ?? ''}
              onChange={(e) =>
                onStageDatesChange({ ...stageDates, [c.key]: e.target.value })
              }
              className="shrink-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-indigo-500"
            >
              <option value="">תשלום ראשון</option>
              {stages.map((s) => (
                <option key={s.id} value={s.dueDate}>
                  {s.label}
                </option>
              ))}
              {occupancyDate && <option value={occupancyDate}>אכלוס</option>}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
