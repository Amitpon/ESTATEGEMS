/**
 * פאנל ההנחות והעלויות.
 *
 * עיקרון 3: **כל הנחה נראית וניתנת לעריכה. אין קבוע נסתר בקוד.**
 * עיקרון 2: לצד שדה עלות מוצג הטווח המקובל בשוק - עוגן, לא מילוי אוטומטי.
 *
 * העיצוב מינימליסטי בכוונה: ברירת המחדל מקופלת, והמשתמש פותח מה שמעניין
 * אותו. במוצר הקודם כל 20 הסליידרים היו פרושים על מסך אחד.
 */

import { useState } from 'react'
import { Slider } from '@/components/ui/Slider'
import { ValueInput } from '@/components/ui/ValueInput'
import { Card } from '@/components/ui/Card'
import { formatPercentDirect } from '@/lib/format'
import { PaymentScheduleEditor } from '@/components/PaymentScheduleEditor'
import type { IsoDate, PaymentStage } from '@/types/property'
import {
  ACQUISITION_ANCHORS,
  OPERATING_ANCHORS,
  formatAnchorRange,
  type CostAnchor,
} from '@/lib/cost-anchors'

/** הטווח המקובל, מוצג מתחת לשדה. אף פעם לא ממלא אותו. */
function Anchor({ anchor }: { anchor: CostAnchor }) {
  return (
    <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
      מקובל בשוק:{' '}
      <span dir="ltr" className="tabular-nums">
        {formatAnchorRange(anchor)}
      </span>{' '}
      <span className="text-[var(--color-muted-foreground)]">
        ({anchor.source}, {anchor.asOf}
        {anchor.verified ? '' : ', לא אומת'})
      </span>
      {anchor.note && (
        <span className="block text-[var(--color-muted-foreground)]">{anchor.note}</span>
      )}
    </p>
  )
}

/**
 * Section - accordion עם Card wrapper.
 * כפתור ה-header הוא full-width עם p-4, נותן אזור מגע מספיק.
 * האינדיקטור ‹ מסתובב: סגור = ← (שמאל), פתוח = ↓ (rotate-90 clockwise).
 */
function Section({
  title,
  hint,
  children,
  defaultOpen = false,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-[52px] w-full items-center justify-between p-4 text-start"
      >
        <span>
          <span className="font-medium">{title}</span>
          {hint && (
            <span className="block text-xs text-[var(--color-muted-foreground)]">{hint}</span>
          )}
        </span>
        {/* אינדיקטור פתוח/סגור - rotate-90 = ↓ כשפתוח */}
        <span
          aria-hidden
          className={`inline-block text-[var(--color-muted-foreground)] transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        >
          ‹
        </span>
      </button>
      {open && (
        <div className="space-y-5 border-t border-[var(--color-border)] p-4">
          {children}
        </div>
      )}
    </Card>
  )
}

/** שדה עלות: סליידר, הקלדה, ומתג אחוזים מול שקלים. */
function AmountField({
  label,
  value,
  onChange,
  anchorKey,
  suffix = '₪',
  anchors,
  base,
  baseLabel,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  anchorKey?: string
  suffix?: string
  anchors: readonly CostAnchor[]
  base: number
  baseLabel?: string
  max?: number
}) {
  const [mode, setMode] = useState<'percent' | 'amount'>('amount')
  const anchor = anchorKey ? anchors.find((a) => a.key === anchorKey) : undefined
  return (
    <ValueInput
      label={label}
      value={value}
      onChange={onChange}
      unit="amount"
      mode={mode}
      onModeChange={setMode}
      base={base}
      baseLabel={baseLabel}
      amountSuffix={suffix}
      {...(max !== undefined ? { max } : {})}
      {...(anchor ? { hint: <Anchor anchor={anchor} /> } : {})}
    />
  )
}

export interface AssumptionsPanelValues {
  // הנחות ההרצה
  appreciationPct: number
  rentGrowthPct: number
  expenseGrowthPct: number
  indexChangePct: number
  sellingCostPct: number
  horizonYears: number
  spreadPoints: number
  vacancyPct: number
  // עלויות רכישה
  brokerFee: number
  lawyerFee: number
  mortgageAdvisorFee: number
  finishingCostPerSqm: number
  liquidityReserve: number
  // הוצאות שוטפות
  buildingFee: number
  insurance: number
  managementPct: number
  maintenancePct: number
  // קבלן
  hasPaymentSchedule: boolean
  isContractorPurchase: boolean
  occupancyDate: string
  stages: PaymentStage[]
  stageDates: Record<string, IsoDate>
}

export function AssumptionsPanel({
  values,
  onChange,
  price,
  monthlyRent,
  costAmounts,
}: {
  values: AssumptionsPanelValues
  onChange: <K extends keyof AssumptionsPanelValues>(
    key: K,
    value: AssumptionsPanelValues[K],
  ) => void
  price: number
  monthlyRent: number
  costAmounts: Readonly<Record<string, number>>
}) {
  const set =
    <K extends keyof AssumptionsPanelValues>(key: K) =>
    (v: AssumptionsPanelValues[K]) =>
      onChange(key, v)

  return (
    <div className="space-y-3">
      <Section
        title="חלוקת תשלומים"
        hint="מתי כל שקל יוצא מהכיס"
        defaultOpen={values.hasPaymentSchedule}
      >
        <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          גם ביד שנייה התשלום כמעט תמיד מחולק - מקדמה בחתימה והיתרה במסירה.
          החלוקה קובעת את המכנה של התשואה: מכירה מוקדמת נמדדת מול ההון שהושקע
          עד אותו תאריך בלבד.
        </p>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={values.hasPaymentSchedule}
            onChange={(e) => set('hasPaymentSchedule')(e.target.checked)}
            className="size-5 rounded border-[var(--color-border)]"
          />
          <span className="text-sm font-medium">התשלום מחולק לכמה תאריכים</span>
        </label>

        {values.hasPaymentSchedule && (
          <>
            {/* דירה על הנייר אינה תנאי לפיצול תשלומים, אלא תת-מקרה שלו.
                היא מוסיפה שני דברים: תאריך אכלוס שממנו נספרים 18 החודשים
                לפטור ממס שבח, והצמדה למדד תשומות הבנייה. */}
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={values.isContractorPurchase}
                onChange={(e) => set('isContractorPurchase')(e.target.checked)}
                className="size-5 rounded border-[var(--color-border)]"
              />
              <span className="text-sm font-medium">
                זו דירה על הנייר, רכישה מקבלן
              </span>
            </label>

            <PaymentScheduleEditor
              price={price}
              stages={values.stages}
              onStagesChange={set('stages')}
              isOffPlan={values.isContractorPurchase}
              occupancyDate={values.occupancyDate}
              onOccupancyDateChange={set('occupancyDate')}
              costAmounts={costAmounts}
              stageDates={values.stageDates}
              onStageDatesChange={set('stageDates')}
            />

            {values.isContractorPurchase && (
              <div className="border-t border-[var(--color-border)] pt-3">
                <Slider
                  label="שינוי מדד תשומות הבנייה"
                  valueDisplay={formatPercentDirect(values.indexChangePct)}
                  min={0}
                  max={10}
                  step={0.5}
                  value={values.indexChangePct}
                  onChange={(e) => set('indexChangePct')(Number(e.target.value))}
                />
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                  תשלומים לקבלן צמודים למדד הזה. זו הנחה שלך, לא תחזית.
                  <br />
                  <span className="text-[var(--color-muted-foreground)]">
                    לשם השוואה, הנתון ההיסטורי:{' '}
                    <span dir="ltr" className="tabular-nums">+3.5%</span> בשנה
                    האחרונה לפי למ״ס, אוגוסט 2026.
                  </span>
                </p>
              </div>
            )}
          </>
        )}
      </Section>

      <Section
        title="ההנחות שלך"
        hint="כל מספר עתידי בכלי נגזר מכאן"
        defaultOpen
      >
        <Slider
          label="עליית ערך שנתית"
          valueDisplay={formatPercentDirect(values.appreciationPct)}
          min={0}
          max={12}
          step={0.5}
          value={values.appreciationPct}
          onChange={(e) => set('appreciationPct')(Number(e.target.value))}
        />
        <Slider
          label="עליית שכר דירה שנתית"
          valueDisplay={formatPercentDirect(values.rentGrowthPct)}
          min={0}
          max={8}
          step={0.5}
          value={values.rentGrowthPct}
          onChange={(e) => set('rentGrowthPct')(Number(e.target.value))}
        />
        <Slider
          label="עליית הוצאות שנתית"
          valueDisplay={formatPercentDirect(values.expenseGrowthPct)}
          min={0}
          max={8}
          step={0.5}
          value={values.expenseGrowthPct}
          onChange={(e) => set('expenseGrowthPct')(Number(e.target.value))}
        />
        <Slider
          label="אופק ההרצה"
          valueDisplay={`${values.horizonYears} שנים`}
          min={1}
          max={30}
          step={1}
          value={values.horizonYears}
          onChange={(e) => set('horizonYears')(Number(e.target.value))}
        />
        <Slider
          label="רוחב טווח התרחישים"
          valueDisplay={`± ${values.spreadPoints} נק' אחוז`}
          min={0}
          max={4}
          step={0.5}
          value={values.spreadPoints}
          onChange={(e) => set('spreadPoints')(Number(e.target.value))}
        />
        <div>
          <Slider
            label="חודשי אי-אכלוס בשנה"
            valueDisplay={`${((values.vacancyPct / 100) * 12).toFixed(1)} חודשים`}
            min={0}
            max={20}
            step={1}
            value={values.vacancyPct}
            onChange={(e) => set('vacancyPct')(Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            כמה זמן בשנה הדירה עומדת ריקה. משפיע על התזרים ועל כל המדדים.
          </p>
        </div>
        <div>
          <Slider
            label="עלויות מכירה בעתיד"
            valueDisplay={formatPercentDirect(values.sellingCostPct)}
            min={0}
            max={5}
            step={0.5}
            value={values.sellingCostPct}
            onChange={(e) => set('sellingCostPct')(Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            מתווך ועו"ד ביום המכירה. נכנס לטבלת הרווח ממכירה.
          </p>
        </div>
      </Section>

      <Section title="עלויות הרכישה" hint="מה משלמים ביום 1, מעבר למחיר">
        <AmountField
          label="עמלת מתווך"
          value={values.brokerFee}
          onChange={set('brokerFee')}
          anchorKey="brokerFee"
          base={price}
          baseLabel="ממחיר הנכס"
          max={price * 0.05}
          anchors={ACQUISITION_ANCHORS}
        />
        <AmountField
          label={values.isContractorPurchase ? 'עו"ד - מקבלן' : 'עו"ד - יד שנייה'}
          value={values.lawyerFee}
          onChange={set('lawyerFee')}
          anchorKey={values.isContractorPurchase ? 'lawyerFeeContractor' : 'lawyerFeeSecondHand'}
          base={price}
          baseLabel="ממחיר הנכס"
          max={price * 0.05}
          anchors={ACQUISITION_ANCHORS}
        />
        <AmountField
          label="יועץ משכנתאות"
          value={values.mortgageAdvisorFee}
          onChange={set('mortgageAdvisorFee')}
          anchorKey="mortgageAdvisor"
          base={price}
          baseLabel="ממחיר הנכס"
          max={30_000}
          anchors={ACQUISITION_ANCHORS}
        />
        <AmountField
          label="עלות גמר ושיפוץ למ״ר"
          value={values.finishingCostPerSqm}
          onChange={set('finishingCostPerSqm')}
          anchorKey="renovationCosmetic"
          base={0}
          max={6_000}
          suffix="₪ למ״ר"
          anchors={ACQUISITION_ANCHORS}
        />
        <AmountField
          label="רזרבה נזילה"
          value={values.liquidityReserve}
          onChange={set('liquidityReserve')}
          anchors={ACQUISITION_ANCHORS}
          base={price}
          baseLabel="ממחיר הנכס"
          max={price * 0.15}
        />
        <p className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          הרזרבה אינה הון מושקע - היא כסף שאתה מחזיק בצד. לכן היא נכנסת ל"דרוש
          ביום 1" אבל לא למכנה של התשואה על ההון.
        </p>
      </Section>

      <Section title="הוצאות שוטפות" hint="מנוכות מהתזרים כל חודש">
        <AmountField
          label="ועד בית"
          value={values.buildingFee}
          onChange={set('buildingFee')}
          anchorKey="buildingFee"
          base={monthlyRent}
          baseLabel="משכר הדירה"
          max={1_500}
          suffix="₪ לחודש"
          anchors={OPERATING_ANCHORS}
        />
        <AmountField
          label="ביטוח מבנה"
          value={values.insurance}
          onChange={set('insurance')}
          anchorKey="insurance"
          base={monthlyRent}
          baseLabel="משכר הדירה"
          max={500}
          suffix="₪ לחודש"
          anchors={OPERATING_ANCHORS}
        />
        <div>
          <Slider
            label="ניהול נכס"
            valueDisplay={formatPercentDirect(values.managementPct)}
            min={0}
            max={15}
            step={1}
            value={values.managementPct}
            onChange={(e) => set('managementPct')(Number(e.target.value))}
          />
          <Anchor anchor={OPERATING_ANCHORS.find((a) => a.key === 'management')!} />
        </div>
        <div>
          <Slider
            label="רזרבת תחזוקה"
            valueDisplay={formatPercentDirect(values.maintenancePct)}
            min={0}
            max={15}
            step={1}
            value={values.maintenancePct}
            onChange={(e) => set('maintenancePct')(Number(e.target.value))}
          />
          <Anchor anchor={OPERATING_ANCHORS.find((a) => a.key === 'maintenance')!} />
        </div>
        {/* ארנונה: הסבר למה אינה בתזרים */}
        <p className="rounded-[var(--radius)] bg-[var(--color-muted)] p-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
          <strong>ארנונה:</strong> בדירה מושכרת הדייר משלם אותה, ולכן היא אינה
          בתזרים שלך. היא נכנסת רק בחודשי הריק. אין טווח גנרי - התעריף תלוי
          בעירייה, בשטח ובסיווג.
        </p>
      </Section>


      <p className="px-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
        טווחי השוק המוצגים כאן הם אינדיקציה בלבד ורובם מבוססים על אתרי שיווק של
        נותני שירות. הם מוצגים כדי שתזין מתוך ידיעה, לא כדי למלא בשבילך. הסכום
        שקובע הוא מה שאתה מזין.
      </p>
    </div>
  )
}
