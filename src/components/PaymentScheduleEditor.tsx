/**
 * עורך חלוקת התשלומים.
 *
 * רלוונטי לכל עסקה, לא רק לקבלן: גם ביד שנייה יש מקדמה בחתימה ויתרה
 * במסירה. `isOffPlan` מוסיף רק את מה שייחודי לדירה על הנייר - תאריך
 * האכלוס שממנו נספרים 18 החודשים לפטור ממס שבח.
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

/**
 * תבניות נפוצות. הן לא מחייבות - הן חוסכות למשתמש להרכיב מאפס לוח
 * שגם ככה יצטרך להתאים לחוזה שלו.
 */
const TEMPLATES: readonly {
  readonly id: string
  readonly label: string
  readonly offPlanOnly: boolean
  readonly parts: readonly { pct: number; label: string; months: number }[]
}[] = [
  {
    id: 'second-hand',
    label: 'יד שנייה רגילה',
    offPlanOnly: false,
    parts: [
      { pct: 15, label: 'מקדמה בחתימה', months: 0 },
      { pct: 85, label: 'יתרה במסירה', months: 3 },
    ],
  },
  {
    id: 'contractor-4',
    label: 'קבלן - 4 תשלומים',
    offPlanOnly: true,
    parts: [
      { pct: 20, label: 'חתימת חוזה', months: 0 },
      { pct: 30, label: 'גמר שלד', months: 12 },
      { pct: 30, label: 'גמר טיח', months: 24 },
      { pct: 20, label: 'מסירת מפתח', months: 36 },
    ],
  },
  {
    id: 'single',
    label: 'תשלום אחד',
    offPlanOnly: false,
    parts: [{ pct: 100, label: 'תשלום מלא', months: 0 }],
  },
]

/** מזיז תאריך במספר חודשים, בלי תלות בספרייה חיצונית. */
function addMonths(iso: string, months: number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function SourceToggle({
  value,
  onChange,
}: {
  value: FundingSource
  onChange: (v: FundingSource) => void
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-[var(--color-border)] text-xs">
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
              ? 'bg-[var(--color-primary)] px-3 py-1.5 text-white'
              : 'px-3 py-1.5 text-[var(--color-muted-foreground)]'
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
  isOffPlan,
  occupancyDate,
  onOccupancyDateChange,
  costAmounts,
  stageDates,
  onStageDatesChange,
}: {
  price: number
  stages: readonly PaymentStage[]
  onStagesChange: (stages: PaymentStage[]) => void
  /** דירה על הנייר. מוסיף את תאריך האכלוס. */
  isOffPlan: boolean
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

  /**
   * מאזן את האחוזים כך שהסכום יהיה בדיוק 100, בלי לשנות את היחס ביניהם.
   * שדה אחד סופג את שארית העיגול, אחרת המשתמש נתקע על 99.9%.
   */
  const normalize = () => {
    if (stages.length === 0) return
    const sum = stages.reduce((a, st) => a + st.percentOfPrice, 0)
    if (sum <= 0) return
    const scaled = stages.map((st) => ({
      ...st,
      percentOfPrice: Math.round((st.percentOfPrice / sum) * 1000) / 10,
    }))
    const drift =
      Math.round((100 - scaled.reduce((a, st) => a + st.percentOfPrice, 0)) * 10) / 10
    const last = scaled[scaled.length - 1]
    if (last) last.percentOfPrice = Math.round((last.percentOfPrice + drift) * 10) / 10
    onStagesChange(scaled)
  }

  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)
    if (!t) return
    const base = stages[0]?.dueDate ?? new Date().toISOString().slice(0, 10)
    onStagesChange(
      t.parts.map((part, i) => ({
        id: `stage-${Date.now()}-${i}`,
        label: part.label,
        percentOfPrice: part.pct,
        dueDate: addMonths(base, part.months),
        linkedToIndex: isOffPlan,
        // התשלום הראשון כמעט תמיד מההון העצמי, והמשכנתא נכנסת אחר כך.
        fundingSource: i === 0 ? 'equity' : 'mortgage',
      })),
    )
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= stages.length) return
    const next = [...stages]
    const a = next[i]
    const b = next[j]
    if (!a || !b) return
    next[i] = b
    next[j] = a
    onStagesChange(next)
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
        <h3 className="text-base font-semibold">התשלומים</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          מתי כל תשלום יוצא, כמה אחוז ממחיר הנכס, ומאיפה הכסף מגיע. זה קובע את
          המכנה של התשואה: מכירה מוקדמת נמדדת מול ההון שהושקע עד אז בלבד.
        </p>
      </div>

      {isOffPlan && (
      <div>
        <label className="block text-sm font-medium text-[var(--color-foreground)]">
          תאריך אכלוס צפוי (טופס 4)
        </label>
        <input
          type="date"
          dir="ltr"
          value={occupancyDate}
          onChange={(e) => onOccupancyDateChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-start tabular-nums outline-none focus:border-[var(--color-ring)] focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          18 חודשי ההחזקה לפטור ממס שבח נספרים מכאן, לא מחתימת החוזה.{' '}
          <span className="text-[var(--color-warning)]">הכלל לא אומת מול רשות המסים.</span>
        </p>
      </div>
      )}

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-[var(--color-muted-foreground)]">התחל מתבנית</span>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.filter((t) => !t.offPlanOnly || isOffPlan).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t.id)}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-foreground)] hover:border-[var(--color-ring)] hover:bg-[var(--color-accent)] hover:text-[var(--color-primary)]"
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          התבנית מחליפה את מה שקיים. אחריה תתאים את התאריכים לחוזה שלך.
        </p>
      </div>

      {stages.map((stage, i) => (
        <Card key={stage.id} className="space-y-3 p-3">
          <div className="flex items-center gap-2">
            <input
              value={stage.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm outline-none focus:border-[var(--color-ring)]"
            />
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label={`הזז את ${stage.label} למעלה`}
              className="rounded-lg px-2 py-1.5 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === stages.length - 1}
              aria-label={`הזז את ${stage.label} למטה`}
              className="rounded-lg px-2 py-1.5 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => onStagesChange(stages.filter((_, idx) => idx !== i))}
              aria-label={`מחק ${stage.label}`}
              className="rounded-lg px-2 py-1.5 text-sm text-[var(--color-destructive)] hover:bg-[var(--color-destructive-bg)]"
            >
              מחק
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted-foreground)]">תאריך</label>
              <input
                type="date"
                dir="ltr"
                value={stage.dueDate}
                onChange={(e) => update(i, { dueDate: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-start text-sm tabular-nums outline-none focus:border-[var(--color-ring)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-muted-foreground)]">
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
            unit="percent"
            base={price}
            baseLabel="ממחיר הנכס"
            max={100}
            step={0.5}
          />

          <label className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
            <input
              type="checkbox"
              checked={stage.linkedToIndex}
              onChange={(e) => update(i, { linkedToIndex: e.target.checked })}
              className="size-4 rounded border-[var(--color-border)]"
            />
            צמוד למדד תשומות הבנייה
          </label>
        </Card>
      ))}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={addStage}
          className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted-foreground)] hover:border-[var(--color-ring)] hover:text-[var(--color-primary)]"
        >
          הוסף תשלום
        </button>
        <div className="text-start text-sm">
          <div
            className={
              Math.abs(totalPct - 100) < 0.01
                ? 'text-[var(--color-positive)]'
                : 'font-medium text-[var(--color-destructive)]'
            }
          >
            <span dir="ltr" className="tabular-nums">
              {totalPct.toFixed(1)}%
            </span>{' '}
            מתוך 100%
          </div>
          <div className="text-xs text-[var(--color-muted-foreground)]">
            מזה מהון עצמי:{' '}
            <span dir="ltr" className="tabular-nums">
              {equityPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {Math.abs(totalPct - 100) >= 0.01 && (
        <p className="rounded-xl bg-[var(--color-destructive-bg)] px-3 py-2 text-sm text-[var(--color-destructive)]">
          סכום התשלומים חייב להיות בדיוק 100%. כרגע חסרים או עודפים{' '}
          <span dir="ltr" className="tabular-nums">
            {(100 - totalPct).toFixed(1)}%
          </span>
          . עד שזה יתוקן חלוקת התשלומים לא מופעלת בחישוב.
          {stages.length > 0 && (
            <button
              type="button"
              onClick={normalize}
              className="ms-2 underline underline-offset-2"
            >
              אזן אוטומטית ל-100%
            </button>
          )}
        </p>
      )}

      <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
        <h4 className="text-sm font-medium">מתי משלמים את העלויות הנלוות</h4>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          מס רכישה ועו"ד בדרך כלל עם התשלום הראשון. יועץ משכנתאות בדרך כלל סביב
          האכלוס. עלות שלא שויכה משולמת בשלב הראשון.
        </p>
        {ASSIGNABLE_COSTS.filter((c) => (costAmounts[c.key] ?? 0) > 0).map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {c.label}{' '}
              <span dir="ltr" className="tabular-nums text-[var(--color-muted-foreground)]">
                {formatILS(costAmounts[c.key] ?? 0)}
              </span>
            </span>
            <select
              value={stageDates[c.key] ?? ''}
              onChange={(e) =>
                onStageDatesChange({ ...stageDates, [c.key]: e.target.value })
              }
              className="shrink-0 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-xs outline-none focus:border-[var(--color-ring)]"
            >
              <option value="">תשלום ראשון</option>
              {stages.map((s) => (
                <option key={s.id} value={s.dueDate}>
                  {s.label}
                </option>
              ))}
              {isOffPlan && occupancyDate && (
                <option value={occupancyDate}>אכלוס</option>
              )}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}
